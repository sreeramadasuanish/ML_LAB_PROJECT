package local.moneymate.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "badges")
public class Badge {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id")
    private User user;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(nullable = false, length = 255)
    private String description;
    @Column(name = "awarded_at", insertable = false, updatable = false)
    private LocalDateTime awardedAt;

    protected Badge() {}
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
}
