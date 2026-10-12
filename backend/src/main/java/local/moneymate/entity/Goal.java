package local.moneymate.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "goals")
public class Goal {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id")
    private User user;
    @Column(nullable = false, length = 120)
    private String title;
    @Column(name = "target_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal targetAmount;
    @Column(name = "saved_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal savedAmount = BigDecimal.ZERO;
    @Column(name = "target_date")
    private LocalDate targetDate;
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Goal() {}
    public Goal(User user, String title, BigDecimal targetAmount, BigDecimal savedAmount, LocalDate targetDate) {
        this.user = user; this.title = title; this.targetAmount = targetAmount;
        this.savedAmount = savedAmount == null ? BigDecimal.ZERO : savedAmount; this.targetDate = targetDate;
    }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public String getTitle() { return title; }
    public BigDecimal getTargetAmount() { return targetAmount; }
    public BigDecimal getSavedAmount() { return savedAmount; }
    public LocalDate getTargetDate() { return targetDate; }
    public void update(String title, BigDecimal targetAmount, BigDecimal savedAmount, LocalDate targetDate) {
        this.title = title; this.targetAmount = targetAmount;
        this.savedAmount = savedAmount == null ? BigDecimal.ZERO : savedAmount;
        this.targetDate = targetDate;
    }
}
