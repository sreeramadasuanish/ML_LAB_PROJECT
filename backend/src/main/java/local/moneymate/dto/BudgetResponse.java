package local.moneymate.dto;

import local.moneymate.entity.Budget;
import java.math.BigDecimal;

public record BudgetResponse(Long userId, Long categoryId, String categoryName,
                             String categoryColor, BigDecimal limit, String period) {
    public static BudgetResponse from(Budget budget) {
        return new BudgetResponse(budget.getUser().getId(), budget.getCategory().getId(),
                budget.getCategory().getName(), budget.getCategory().getColor(),
                budget.getLimit(), budget.getPeriod());
    }
}
