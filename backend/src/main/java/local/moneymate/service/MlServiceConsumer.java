package local.moneymate.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.math.BigDecimal;
import java.util.Map;

@Service
public class MlServiceConsumer {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String mlServiceUrl = "http://localhost:8000/friendly-advice";

    public Map<String, Object> fetchFriendlyAdvice(
            BigDecimal monthlyIncome,
            BigDecimal savingsGoal,
            BigDecimal totalBudget,
            BigDecimal currentSpent,
            Map<String, BigDecimal> categorySpendings
    ) {
        Map<String, Object> requestPayload = Map.of(
                "monthly_income", monthlyIncome,
                "savings_goal", savingsGoal,
                "total_budget", totalBudget,
                "current_spent", currentSpent,
                "category_spendings", categorySpendings
        );

        try {
            return restTemplate.postForObject(mlServiceUrl, requestPayload, Map.class);
        } catch (Exception e) {
            return Map.of("adviceList", java.util.List.of("Advisor service is currently unreachable."));
        }
    }
}