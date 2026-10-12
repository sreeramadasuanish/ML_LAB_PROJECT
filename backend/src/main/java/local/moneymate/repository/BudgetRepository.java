package local.moneymate.repository;
import local.moneymate.entity.Budget;
import local.moneymate.entity.BudgetId;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface BudgetRepository extends JpaRepository<Budget, BudgetId> {
    List<Budget> findAllByUser_Id(Long userId);
}
