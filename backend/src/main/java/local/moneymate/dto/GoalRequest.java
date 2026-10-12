package local.moneymate.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record GoalRequest(
        @NotBlank @Size(max = 120) String title,
        @NotNull @DecimalMin(value = "0.01") BigDecimal targetAmount,
        @DecimalMin(value = "0.00") BigDecimal savedAmount,
        LocalDate targetDate) {}
