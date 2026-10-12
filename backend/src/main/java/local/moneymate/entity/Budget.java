package local.moneymate.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "budgets")
@IdClass(BudgetId.class)
public class Budget {
    @Id @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id")
    private User user;
    @Id @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "category_id")
    private Category category;
    @Column(name = "`limit`", nullable = false, precision = 14, scale = 2)
    private BigDecimal limit;
    @Column(nullable = false, length = 10)
    private String period = "monthly";
    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    protected Budget() {}
    public Budget(User user, Category category, BigDecimal limit, String period) {
        this.user = user;
        this.category = category;
        this.limit = limit;
        this.period = period;
    }
    public User getUser() { return user; }
    public Category getCategory() { return category; }
    public BigDecimal getLimit() { return limit; }
    public String getPeriod() { return period; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void update(BigDecimal limit, String period) { this.limit = limit; this.period = period; }
}
