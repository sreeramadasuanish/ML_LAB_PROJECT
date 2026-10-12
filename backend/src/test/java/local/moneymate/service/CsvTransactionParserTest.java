package local.moneymate.service;

import local.moneymate.dto.UploadMapping;
import local.moneymate.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class CsvTransactionParserTest {
    private final CsvTransactionParser parser = new CsvTransactionParser();

    @Test
    void detectsIndianDateAndQuotedRupeeAmountWithThousandsSeparator() {
        var file = csv("Date,Narration,Withdrawal Amt,Deposit Amt,Reference\n"
                + "14/08/2025,UPI-SWIGGY,\"₹1,234.50\",,ref-1\n");

        var row = parser.parse(file, null).get(0);

        assertEquals("UPI-SWIGGY", row.description());
        assertEquals("2025-08-14", row.date().toString());
        assertEquals(new BigDecimal("1234.50"), row.amount());
    }

    @Test
    void usesCreditWhenDebitIsEmptyAndHonorsManualColumnMapping() {
        var file = csv("posted,merchant,out,in\n01-09-2025,Salary,,\"2,500.00\"\n");
        var mapping = new UploadMapping("posted", "merchant", null, "out", "in");

        var row = parser.parse(file, mapping).get(0);

        assertEquals(new BigDecimal("2500.00"), row.amount());
        assertEquals("2025-09-01", row.date().toString());
    }

    @Test
    void rejectsRowsWithoutRequiredColumnsOrData() {
        var file = csv("date,description,amount\n");
        assertThrows(ApiException.class, () -> parser.parse(file, null));
    }

    @Test
    void parsesTheIncludedSampleBankCsv() throws Exception {
        byte[] sample = Files.readAllBytes(Path.of("..", "frontend", "sample-bank.csv"));
        var file = new MockMultipartFile("file", "sample-bank.csv", "text/csv", sample);

        var rows = parser.parse(file, null);

        assertEquals(10, rows.size());
        assertEquals(new BigDecimal("1234.50"), rows.get(0).amount());
        assertEquals(new BigDecimal("75000.00"), rows.get(8).amount());
    }

    private MockMultipartFile csv(String contents) {
        return new MockMultipartFile("file", "bank.csv", "text/csv",
                contents.getBytes(StandardCharsets.UTF_8));
    }
}
