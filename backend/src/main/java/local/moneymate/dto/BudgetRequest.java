package local.moneymate.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

public record BudgetRequest(
        @NotNull Long categoryId,
        @NotNull @DecimalMin(value = "0.01") BigDecimal limit,
        @Pattern(regexp = "monthly|weekly") String period) {}
