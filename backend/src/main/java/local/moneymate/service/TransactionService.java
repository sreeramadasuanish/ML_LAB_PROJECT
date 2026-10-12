package local.moneymate.service;

import local.moneymate.dto.*;
import local.moneymate.entity.*;
import local.moneymate.exception.ApiException;
import local.moneymate.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class TransactionService {
    private final TransactionRepository transactions;
    private final UserRepository users;
    private final CategoryRepository categories;
    private final CsvTransactionParser csvParser;
    private final MlPredictionClient mlClient;
    private final Long defaultUserId;

    public TransactionService(TransactionRepository transactions, UserRepository users,
                              CategoryRepository categories, CsvTransactionParser csvParser,
                              MlPredictionClient mlClient,
                              @Value("${moneymate.default-user-id}") Long defaultUserId) {
        this.transactions = transactions; this.users = users; this.categories = categories;
        this.csvParser = csvParser; this.mlClient = mlClient; this.defaultUserId = defaultUserId;
    }

    @Transactional
    public UploadResponse upload(MultipartFile file, Long userId, UploadMapping mapping) {
        User user = requireUser(userId);
        List<CsvTransactionParser.ParsedTransaction> parsed = csvParser.parse(file, mapping);
        List<String> hashes = parsed.stream().map(row -> dedupeHash(user.getId(), row)).toList();
        Set<String> existingHashes = new HashSet<>(transactions.findAllByDedupeHashIn(hashes)
                .stream().map(Transaction::getDedupeHash).toList());
        List<CsvTransactionParser.ParsedTransaction> freshRows = new java.util.ArrayList<>();
        List<String> freshHashes = new java.util.ArrayList<>();
        int skippedDuplicates = 0;
        for (int index = 0; index < parsed.size(); index++) {
            String hash = hashes.get(index);
            if (!existingHashes.add(hash)) {
                skippedDuplicates++;
                continue;
            }
            freshRows.add(parsed.get(index));
            freshHashes.add(hash);
        }
        List<MlPredictionClient.Input> input = freshRows.stream()
                .map(row -> new MlPredictionClient.Input(row.description(), row.amount(), row.date()))
                .toList();
        if (freshRows.isEmpty()) {
            return new UploadResponse(0, skippedDuplicates, List.of());
        }
        List<MlPredictionClient.Prediction> predictions = mlClient.predict(input);
        List<Transaction> saved = new java.util.ArrayList<>(freshRows.size());
        for (int index = 0; index < freshRows.size(); index++) {
            var row = freshRows.get(index);
            var prediction = predictions.get(index);
            TransactionStatus status = parseStatus(prediction.status());
            Category category = categories.findByNameIgnoreCase(prediction.category()).orElse(null);
            if (category == null) status = TransactionStatus.UNVERIFIED;
            String cleaned = prediction.cleaned_description() == null
                    ? row.description() : prediction.cleaned_description();
            BigDecimal confidence = prediction.confidence() == null
                    ? BigDecimal.ZERO : prediction.confidence().max(BigDecimal.ZERO).min(BigDecimal.ONE);
            saved.add(new Transaction(user, row.description(), cleaned, row.amount(), row.date(),
                    category, confidence, status, freshHashes.get(index)));
        }
        return new UploadResponse(saved.size(), skippedDuplicates,
                transactions.saveAll(saved).stream().map(TransactionResponse::from).toList());
    }

    @Transactional(readOnly = true)
    public List<TransactionResponse> list(Long userId) {
        return transactions.findAllByUser_IdOrderByTxnDateDescIdDesc(userIdOrDefault(userId))
                .stream().map(TransactionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<TransactionResponse> reviewQueue(Long userId) {
        Long id = userIdOrDefault(userId);
        return java.util.stream.Stream.of(
                transactions.findAllByUser_IdAndStatusOrderByTxnDateDesc(id, TransactionStatus.SOFT),
                transactions.findAllByUser_IdAndStatusOrderByTxnDateDesc(id, TransactionStatus.UNVERIFIED))
                .flatMap(List::stream).map(TransactionResponse::from).toList();
    }

    @Transactional
    public TransactionResponse correct(Long transactionId, Long categoryId, Long userId) {
        Transaction transaction = transactions.findById(transactionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Transaction not found"));
        if (!transaction.getUserId().equals(userIdOrDefault(userId))) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Transaction not found");
        }
        Category category = categories.findById(categoryId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Category not found"));
        transaction.correct(category);
        return TransactionResponse.from(transaction);
    }

    @Transactional(readOnly = true)
    public InsightResponse insights(Long requestedUserId, String requestedMonth) {
        Long userId = userIdOrDefault(requestedUserId);
        List<String> availableMonths = transactions.availableMonths(userId);
        YearMonth selectedMonth = parseMonth(requestedMonth);
        if (selectedMonth == null && !availableMonths.isEmpty()) {
            selectedMonth = YearMonth.parse(availableMonths.get(0));
        }
        if (selectedMonth == null) {
            return new InsightResponse(List.of(), List.of(), BigDecimal.ZERO,
                    availableMonths, null);
        }
        LocalDate monthStart = selectedMonth.atDay(1);
        LocalDate monthEnd = monthStart.plusMonths(1);
        LocalDate trendStart = monthStart.minusMonths(11);
        List<InsightResponse.CategoryTotal> categoryTotals =
                transactions.categoryTotals(userId, monthStart, monthEnd)
                .stream().map(row -> new InsightResponse.CategoryTotal((String) row[0], (BigDecimal) row[1]))
                .toList();
        List<InsightResponse.MonthlyTotal> monthly = transactions.monthlyTotals(
                        userId, trendStart, monthEnd)
                .stream().map(row -> new InsightResponse.MonthlyTotal((String) row[0], (BigDecimal) row[1]))
                .toList();
        BigDecimal total = transactions.totalAmount(userId, monthStart, monthEnd);
        return new InsightResponse(categoryTotals, monthly,
                total == null ? BigDecimal.ZERO : total, availableMonths,
                selectedMonth.toString());
    }

    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) return null;
        try {
            YearMonth parsed = YearMonth.parse(month);
            if (!parsed.toString().equals(month)) throw new DateTimeParseException("Invalid month", month, 0);
            return parsed;
        } catch (DateTimeParseException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "month must use YYYY-MM format");
        }
    }

    private String dedupeHash(Long userId, CsvTransactionParser.ParsedTransaction row) {
        String value = userId + "\n" + row.date() + "\n" + row.description()
                + "\n" + row.amount().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 is not available", error);
        }
    }

    private User requireUser(Long userId) {
        return users.findById(userIdOrDefault(userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private Long userIdOrDefault(Long userId) { return userId == null ? defaultUserId : userId; }

    private TransactionStatus parseStatus(String status) {
        try {
            return TransactionStatus.valueOf(status.toUpperCase(java.util.Locale.ROOT));
        } catch (NullPointerException | IllegalArgumentException error) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "ML service returned an invalid status");
        }
    }
}
