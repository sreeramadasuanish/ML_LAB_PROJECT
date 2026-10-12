package local.moneymate.controller;

import jakarta.validation.Valid;
import local.moneymate.dto.BudgetRequest;
import local.moneymate.dto.BudgetResponse;
import local.moneymate.service.BudgetService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/budgets")
public class BudgetController {
    private final BudgetService service;
    public BudgetController(BudgetService service) { this.service = service; }
    @GetMapping
    public List<BudgetResponse> list(@RequestParam(required = false) Long userId) {
        return service.list(userId);
    }
    @PostMapping
    public BudgetResponse create(@Valid @RequestBody BudgetRequest request,
                                 @RequestParam(required = false) Long userId) {
        return service.save(request, userId, null);
    }
    @PutMapping("/{categoryId}")
    public BudgetResponse update(@PathVariable Long categoryId, @Valid @RequestBody BudgetRequest request,
                                 @RequestParam(required = false) Long userId) {
        return service.save(request, userId, categoryId);
    }
    @DeleteMapping("/{categoryId}")
    public void delete(@PathVariable Long categoryId, @RequestParam(required = false) Long userId) {
        service.delete(categoryId, userId);
    }
}
