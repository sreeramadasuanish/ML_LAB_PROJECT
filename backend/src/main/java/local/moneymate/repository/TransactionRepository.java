package local.moneymate.repository;
import local.moneymate.entity.Transaction;
import local.moneymate.entity.TransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Collection;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findAllByUser_IdOrderByTxnDateDescIdDesc(Long userId);
    List<Transaction> findAllByUser_IdAndStatusOrderByTxnDateDesc(Long userId, TransactionStatus status);
    List<Transaction> findAllByDedupeHashIn(Collection<String> dedupeHashes);

    @Query(value = """
            SELECT DISTINCT DATE_FORMAT(txn_date, '%Y-%m')
            FROM transactions
            WHERE user_id = :userId
            ORDER BY DATE_FORMAT(txn_date, '%Y-%m') DESC
            """, nativeQuery = true)
    List<String> availableMonths(@Param("userId") Long userId);

    @Query(value = """
            SELECT COALESCE(c.name, 'Uncategorized'), SUM(t.amount)
            FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = :userId AND t.txn_date >= :fromDate AND t.txn_date < :toDate
            GROUP BY c.id, c.name ORDER BY SUM(t.amount) DESC
            """, nativeQuery = true)
    List<Object[]> categoryTotals(@Param("userId") Long userId,
                                  @Param("fromDate") LocalDate fromDate,
                                  @Param("toDate") LocalDate toDate);

    @Query(value = """
            SELECT DATE_FORMAT(txn_date, '%Y-%m'), SUM(amount)
            FROM transactions
            WHERE user_id = :userId AND txn_date >= :fromDate AND txn_date < :toDate
            GROUP BY DATE_FORMAT(txn_date, '%Y-%m')
            ORDER BY DATE_FORMAT(txn_date, '%Y-%m')
            """, nativeQuery = true)
    List<Object[]> monthlyTotals(@Param("userId") Long userId,
                                 @Param("fromDate") LocalDate fromDate,
                                 @Param("toDate") LocalDate toDate);

    @Query(value = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = :userId AND txn_date >= :fromDate AND txn_date < :toDate",
            nativeQuery = true)
    java.math.BigDecimal totalAmount(@Param("userId") Long userId,
                                     @Param("fromDate") LocalDate fromDate,
                                     @Param("toDate") LocalDate toDate);
}
