package local.moneymate.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
public class Transaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(name = "raw_description", nullable = false, length = 500)
    private String rawDescription;
    @Column(name = "cleaned_description", nullable = false, length = 500)
    private String cleanedDescription;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;
    @Column(name = "txn_date", nullable = false)
    private LocalDate txnDate;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;
    @Column(name = "confidence_score", nullable = false, precision = 5, scale = 4)
    private BigDecimal confidenceScore;
    @Column(name = "dedupe_hash", nullable = false, length = 64, unique = true)
    private String dedupeHash;
    @Convert(converter = TransactionStatusConverter.class)
    @Column(nullable = false, length = 20)
    private TransactionStatus status;
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Transaction() {}
    public Transaction(User user, String rawDescription, String cleanedDescription,
                       BigDecimal amount, LocalDate txnDate, Category category,
                       BigDecimal confidenceScore, TransactionStatus status,
                       String dedupeHash) {
        this.user = user;
        this.rawDescription = rawDescription;
        this.cleanedDescription = cleanedDescription;
        this.amount = amount;
        this.txnDate = txnDate;
        this.category = category;
        this.confidenceScore = confidenceScore;
        this.status = status;
        this.dedupeHash = dedupeHash;
    }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public String getRawDescription() { return rawDescription; }
    public String getCleanedDescription() { return cleanedDescription; }
    public BigDecimal getAmount() { return amount; }
    public LocalDate getTxnDate() { return txnDate; }
    public Category getCategory() { return category; }
    public BigDecimal getConfidenceScore() { return confidenceScore; }
    public String getDedupeHash() { return dedupeHash; }
    public TransactionStatus getStatus() { return status; }
    public void correct(Category category) {
        this.category = category;
        this.status = TransactionStatus.AUTO;
        this.confidenceScore = BigDecimal.ONE;
    }
}
