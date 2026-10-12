package local.moneymate.controller;

import jakarta.validation.Valid;
import local.moneymate.dto.GoalRequest;
import local.moneymate.dto.GoalResponse;
import local.moneymate.service.GoalService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/goals")
public class GoalController {
    private final GoalService service;
    public GoalController(GoalService service) { this.service = service; }
    @GetMapping
    public List<GoalResponse> list(@RequestParam(required = false) Long userId) { return service.list(userId); }
    @PostMapping
    public GoalResponse create(@Valid @RequestBody GoalRequest request,
                               @RequestParam(required = false) Long userId) {
        return service.create(request, userId);
    }
    @PutMapping("/{id}")
    public GoalResponse update(@PathVariable Long id, @Valid @RequestBody GoalRequest request,
                               @RequestParam(required = false) Long userId) {
        return service.update(id, request, userId);
    }
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, @RequestParam(required = false) Long userId) {
        service.delete(id, userId);
    }
}
