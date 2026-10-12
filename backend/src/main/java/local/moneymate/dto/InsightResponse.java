package local.moneymate.dto;

import java.math.BigDecimal;
import java.util.List;

public record InsightResponse(List<CategoryTotal> categoryTotals,
                              List<MonthlyTotal> monthlyTrend,
                              BigDecimal totalSpend,
                              List<String> availableMonths,
                              String month) {
    public record CategoryTotal(String category, BigDecimal amount) {}
    public record MonthlyTotal(String month, BigDecimal amount) {}
}
