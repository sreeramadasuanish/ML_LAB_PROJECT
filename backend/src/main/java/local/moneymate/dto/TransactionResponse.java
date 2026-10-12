package local.moneymate.dto;

import local.moneymate.entity.Transaction;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TransactionResponse(
        Long id, String rawDescription, String cleanedDescription, BigDecimal amount,
        LocalDate txnDate, Long categoryId, String categoryName, String categoryColor,
        BigDecimal confidenceScore, String status) {
    public static TransactionResponse from(Transaction transaction) {
        var category = transaction.getCategory();
        return new TransactionResponse(
                transaction.getId(), transaction.getRawDescription(),
                transaction.getCleanedDescription(), transaction.getAmount(),
                transaction.getTxnDate(), category == null ? null : category.getId(),
                category == null ? "Uncategorized" : category.getName(),
                category == null ? "#666666" : category.getColor(),
                transaction.getConfidenceScore(),
                transaction.getStatus().name().toLowerCase(java.util.Locale.ROOT));
    }
}
