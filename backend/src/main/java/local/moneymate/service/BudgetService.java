package local.moneymate.service;

import local.moneymate.dto.BudgetRequest;
import local.moneymate.dto.BudgetResponse;
import local.moneymate.entity.Budget;
import local.moneymate.entity.BudgetId;
import local.moneymate.exception.ApiException;
import local.moneymate.repository.BudgetRepository;
import local.moneymate.repository.CategoryRepository;
import local.moneymate.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BudgetService {
    private final BudgetRepository budgets;
    private final UserRepository users;
    private final CategoryRepository categories;
    private final Long defaultUserId;
    public BudgetService(BudgetRepository budgets, UserRepository users, CategoryRepository categories,
                         @Value("${moneymate.default-user-id}") Long defaultUserId) {
        this.budgets = budgets; this.users = users; this.categories = categories; this.defaultUserId = defaultUserId;
    }

    @Transactional(readOnly = true)
    public List<BudgetResponse> list(Long userId) {
        return budgets.findAllByUser_Id(userId == null ? defaultUserId : userId)
                .stream().map(BudgetResponse::from).toList();
    }

    @Transactional
    public BudgetResponse save(BudgetRequest request, Long userId, Long categoryId) {
        Long id = userId == null ? defaultUserId : userId;
        if (categoryId != null && !categoryId.equals(request.categoryId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Path category and request category must match");
        }
        var user = users.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        var category = categories.findById(request.categoryId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Category not found"));
        BudgetId key = new BudgetId(id, category.getId());
        Budget budget = budgets.findById(key).orElse(null);
        if (budget == null) {
            budget = new Budget(user, category, request.limit(), request.period() == null ? "monthly" : request.period());
        } else {
            budget.update(request.limit(), request.period() == null ? budget.getPeriod() : request.period());
        }
        return BudgetResponse.from(budgets.save(budget));
    }

    @Transactional
    public void delete(Long categoryId, Long userId) {
        Long id = userId == null ? defaultUserId : userId;
        BudgetId key = new BudgetId(id, categoryId);
        if (!budgets.existsById(key)) throw new ApiException(HttpStatus.NOT_FOUND, "Budget not found");
        budgets.deleteById(key);
    }
}
