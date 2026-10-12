package local.moneymate.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "categories")
public class Category {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 80)
    private String name;
    @Column(nullable = false, length = 7)
    private String color;

    protected Category() {}
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getColor() { return color; }
}
