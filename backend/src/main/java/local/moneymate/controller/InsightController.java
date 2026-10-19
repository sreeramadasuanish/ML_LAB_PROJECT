
package local.moneymate.controller;

import local.moneymate.dto.BudgetResponse;
import local.moneymate.dto.GoalResponse;
import local.moneymate.dto.InsightResponse;
import local.moneymate.service.BudgetService;
import local.moneymate.service.GoalService;
import local.moneymate.service.MlServiceConsumer;
import local.moneymate.service.TransactionService;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/advisor")
@CrossOrigin(origins = "http://localhost:3000")
public class InsightController {

    private final MlServiceConsumer mlServiceConsumer;
    private final TransactionService transactionService;
    private final BudgetService budgetService;
    private final GoalService goalService;

    public InsightController(
            MlServiceConsumer mlServiceConsumer,
            TransactionService transactionService,
            BudgetService budgetService,
            GoalService goalService) {
        this.mlServiceConsumer = mlServiceConsumer;
        this.transactionService = transactionService;
        this.budgetService = budgetService;
        this.goalService = goalService;
    }

    @GetMapping("/suggestions")
    public Map<String, Object> getAdvisorSuggestions(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String month,
            @RequestParam BigDecimal monthlyIncome) {

        InsightResponse insightData = transactionService.insights(userId, month);

        BigDecimal currentSpent = insightData.totalSpend() == null
                ? BigDecimal.ZERO
                : insightData.totalSpend();

        Map<String, BigDecimal> categorySpendings = new HashMap<>();

        if (insightData.categoryTotals() != null) {
            for (InsightResponse.CategoryTotal category
                    : insightData.categoryTotals()) {
                categorySpendings.put(category.category(), category.amount());
            }
        }

        List<BudgetResponse> budgets = budgetService.list(userId);
        List<GoalResponse> goals = goalService.list(userId);

        BigDecimal totalBudget = budgets.stream()
                .map(BudgetResponse::limit)
                .filter(value -> value != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal savingsGoal = goals.stream()
                .map(goal -> goal.targetAmount().subtract(
                        goal.savedAmount() == null
                                ? BigDecimal.ZERO
                                : goal.savedAmount()))
                .filter(value -> value.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return mlServiceConsumer.fetchFriendlyAdvice(
                monthlyIncome,
                savingsGoal,
                totalBudget,
                currentSpent,
                categorySpendings
        );
    }
}
