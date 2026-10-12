package local.moneymate.service;

import local.moneymate.entity.Category;
import local.moneymate.repository.CategoryRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CategoryService {
    private final CategoryRepository categories;
    public CategoryService(CategoryRepository categories) { this.categories = categories; }
    public List<Category> list() { return categories.findAll(); }
}
