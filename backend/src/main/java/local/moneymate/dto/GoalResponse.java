package local.moneymate.dto;

import local.moneymate.entity.Goal;
import java.math.BigDecimal;
import java.time.LocalDate;

public record GoalResponse(Long id, String title, BigDecimal targetAmount,
                           BigDecimal savedAmount, LocalDate targetDate) {
    public static GoalResponse from(Goal goal) {
        return new GoalResponse(goal.getId(), goal.getTitle(), goal.getTargetAmount(),
                goal.getSavedAmount(), goal.getTargetDate());
    }
}
