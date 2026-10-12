package local.moneymate.entity;

import java.io.Serializable;

public class BudgetId implements Serializable {
    private Long user;
    private Long category;
    public BudgetId() {}
    public BudgetId(Long user, Long category) { this.user = user; this.category = category; }
    @Override public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof BudgetId other)) return false;
        return java.util.Objects.equals(user, other.user) && java.util.Objects.equals(category, other.category);
    }
    @Override public int hashCode() { return java.util.Objects.hash(user, category); }
}
