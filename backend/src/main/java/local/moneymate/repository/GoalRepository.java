package local.moneymate.repository;
import local.moneymate.entity.Goal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface GoalRepository extends JpaRepository<Goal, Long> {
    List<Goal> findAllByUser_Id(Long userId);
}
