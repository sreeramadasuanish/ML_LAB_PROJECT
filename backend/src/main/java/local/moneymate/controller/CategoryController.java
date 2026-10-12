package local.moneymate.controller;

import local.moneymate.entity.Category;
import local.moneymate.service.CategoryService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
    private final CategoryService service;
    public CategoryController(CategoryService service) { this.service = service; }
    @GetMapping
    public List<CategoryResponse> categories() {
        return service.list().stream().map(CategoryResponse::from).toList();
    }
    public record CategoryResponse(Long id, String name, String color) {
        static CategoryResponse from(Category category) {
            return new CategoryResponse(category.getId(), category.getName(), category.getColor());
        }
    }
}
