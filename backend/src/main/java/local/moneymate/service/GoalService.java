package local.moneymate.service;

import local.moneymate.dto.GoalRequest;
import local.moneymate.dto.GoalResponse;
import local.moneymate.entity.Goal;
import local.moneymate.exception.ApiException;
import local.moneymate.repository.GoalRepository;
import local.moneymate.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class GoalService {
    private final GoalRepository goals;
    private final UserRepository users;
    private final Long defaultUserId;
    public GoalService(GoalRepository goals, UserRepository users,
                       @Value("${moneymate.default-user-id}") Long defaultUserId) {
        this.goals = goals; this.users = users; this.defaultUserId = defaultUserId;
    }
    @Transactional(readOnly = true)
    public List<GoalResponse> list(Long userId) {
        return goals.findAllByUser_Id(userId == null ? defaultUserId : userId)
                .stream().map(GoalResponse::from).toList();
    }
    @Transactional
    public GoalResponse create(GoalRequest request, Long userId) {
        var user = users.findById(userId == null ? defaultUserId : userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        Goal goal = new Goal(user, request.title(), request.targetAmount(),
                request.savedAmount(), request.targetDate());
        return GoalResponse.from(goals.save(goal));
    }
    @Transactional
    public GoalResponse update(Long id, GoalRequest request, Long userId) {
        Goal goal = findOwned(id, userId);
        goal.update(request.title(), request.targetAmount(), request.savedAmount(), request.targetDate());
        return GoalResponse.from(goal);
    }
    @Transactional
    public void delete(Long id, Long userId) {
        goals.delete(findOwned(id, userId));
    }
    private Goal findOwned(Long id, Long userId) {
        Goal goal = goals.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Goal not found"));
        if (!goal.getUserId().equals(userId == null ? defaultUserId : userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Goal not found");
        }
        return goal;
    }
}
