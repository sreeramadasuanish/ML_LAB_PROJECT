package local.moneymate.service;

import local.moneymate.dto.UploadMapping;
import local.moneymate.exception.ApiException;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class CsvTransactionParser {
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("d/M/uuuu"),
            DateTimeFormatter.ofPattern("d-M-uuuu"),
            DateTimeFormatter.ofPattern("d-MMM-uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d-MMM-uu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("M/d/uuuu"));

    public List<ParsedTransaction> parse(MultipartFile file, UploadMapping mapping) {
        if (file == null || file.isEmpty()) {
            throw badRequest("Choose a non-empty CSV file");
        }
        if (file.getOriginalFilename() == null
                || !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".csv")) {
            throw badRequest("Upload a .csv file");
        }

        try (CSVParser parser = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .setTrim(true)
                .build()
                .parse(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            List<String> headers = parser.getHeaderNames().stream()
                    .map(header -> header.replace("\uFEFF", "").trim())
                    .toList();
            if (headers.isEmpty()) throw badRequest("CSV must have a header row");
            Map<String, Integer> headerIndex = headers.stream().collect(Collectors.toMap(
                    CsvTransactionParser::normalizeHeader, headers::indexOf, (first, next) -> first));
            Columns columns = columns(headerIndex, mapping);
            List<ParsedTransaction> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                if (record.size() != headers.size()) {
                    throw badRequest("CSV row " + record.getRecordNumber()
                            + " has a different number of columns than the header");
                }
                LocalDate date = parseDate(value(record, columns.date()));
                String description = value(record, columns.description());
                if (description.isBlank()) {
                    throw badRequest("CSV row " + record.getRecordNumber()
                            + " has an empty description");
                }
                if (description.length() > 500) {
                    throw badRequest("Description on CSV row " + record.getRecordNumber()
                            + " exceeds the 500 character limit");
                }
                BigDecimal amount = parseAmount(record, columns);
                rows.add(new ParsedTransaction(date, description, amount));
                if (rows.size() > 1000) throw badRequest("CSV may contain at most 1,000 data rows");
            }
            if (rows.isEmpty()) throw badRequest("CSV contains no transaction rows");
            return rows;
        } catch (IOException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not read CSV file: " + error.getMessage());
        }
    }

    private Columns columns(Map<String, Integer> headers, UploadMapping mapping) {
        int date = resolve(headers, mapping == null ? null : mapping.dateColumn(),
                "date", "txn date", "transaction date", "value date", "posting date");
        int description = resolve(headers, mapping == null ? null : mapping.descriptionColumn(),
                "description", "narration", "particulars", "details", "transaction details");
        int amount = resolveOptional(headers, mapping == null ? null : mapping.amountColumn(),
                "amount", "transaction amount", "amt");
        int debit = resolveOptional(headers, mapping == null ? null : mapping.debitColumn(),
                "debit", "debit amount", "debit amt", "withdrawal", "withdrawals",
                "withdrawal amount", "withdrawal amt", "dr");
        int credit = resolveOptional(headers, mapping == null ? null : mapping.creditColumn(),
                "credit", "credit amount", "credit amt", "deposit", "deposits",
                "deposit amount", "deposit amt", "cr");
        if (date < 0 || description < 0 || (amount < 0 && debit < 0 && credit < 0)) {
            throw badRequest("Could not detect date, description and amount/debit/credit columns. "
                    + "Choose the columns manually and retry.");
        }
        return new Columns(date, description, amount, debit, credit);
    }

    private int resolve(Map<String, Integer> headers, String requested, String... aliases) {
        int result = resolveOptional(headers, requested, aliases);
        if (result < 0) throw badRequest("Required CSV column is missing: " + aliases[0]);
        return result;
    }

    private int resolveOptional(Map<String, Integer> headers, String requested, String... aliases) {
        if (requested != null && !requested.isBlank()) {
            Integer index = headers.get(normalizeHeader(requested));
            if (index == null) throw badRequest("Selected CSV column was not found: " + requested);
            return index;
        }
        for (String alias : aliases) {
            Integer index = headers.get(normalizeHeader(alias));
            if (index != null) return index;
        }
        return -1;
    }

    private LocalDate parseDate(String raw) {
        for (DateTimeFormatter formatter : DATE_FORMATS) {
            try {
                return LocalDate.parse(raw.trim(), formatter);
            } catch (DateTimeParseException ignored) {
                // Continue through the explicitly supported bank date formats.
            }
        }
        throw badRequest("Invalid transaction date '" + raw + "'. Use yyyy-MM-dd or a valid Indian date.");
    }

    private BigDecimal parseAmount(CSVRecord record, Columns columns) {
        String raw = columns.amount() >= 0 ? value(record, columns.amount()) : "";
        if (raw.isBlank()) raw = value(record, columns.debit());
        if (raw.isBlank()) raw = value(record, columns.credit());
        if (raw.isBlank()) throw badRequest("Transaction amount is missing on CSV row " + record.getRecordNumber());
        try {
            BigDecimal amount = decimalAmount(raw);
            if (amount.signum() == 0 && columns.amount() < 0) {
                String credit = value(record, columns.credit());
                if (!credit.isBlank()) amount = decimalAmount(credit);
            }
            return amount;
        } catch (NumberFormatException error) {
            throw badRequest("Invalid amount '" + raw + "' on CSV row " + record.getRecordNumber());
        }
    }

    private BigDecimal decimalAmount(String raw) {
        String normalized = raw.replace("₹", "").replaceAll("(?i)\\bINR\\b|Rs\\.?\\s*", "")
                .replace(",", "").replaceAll("\\s", "").replace("(", "-").replace(")", "");
        return new BigDecimal(normalized).abs().setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private String value(CSVRecord record, int index) {
        return index < 0 ? "" : record.get(index).trim();
    }

    private static String normalizeHeader(String header) {
        return header.toLowerCase(Locale.ROOT).replaceAll("[_\\-]+", " ")
                .replaceAll("\\s+", " ").trim();
    }

    private ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    public record ParsedTransaction(LocalDate date, String description, BigDecimal amount) {}
    private record Columns(int date, int description, int amount, int debit, int credit) {}
}
