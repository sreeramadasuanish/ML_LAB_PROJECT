package local.moneymate.service;

import local.moneymate.dto.UploadMapping;
import local.moneymate.entity.Category;
import local.moneymate.entity.Transaction;
import local.moneymate.entity.User;
import local.moneymate.exception.ApiException;
import local.moneymate.repository.CategoryRepository;
import local.moneymate.repository.TransactionRepository;
import local.moneymate.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TransactionServiceTest {
    @Test
    void defaultInsightsUseLatestMonthAndA12MonthTrendWindow() {
        TransactionRepository transactions = mock(TransactionRepository.class);
        when(transactions.availableMonths(1L)).thenReturn(List.of("2025-08", "2025-07"));
        when(transactions.categoryTotals(1L, LocalDate.parse("2025-08-01"),
                LocalDate.parse("2025-09-01"))).thenReturn(List.of());
        when(transactions.monthlyTotals(1L, LocalDate.parse("2024-09-01"),
                LocalDate.parse("2025-09-01"))).thenReturn(List.of());
        when(transactions.totalAmount(1L, LocalDate.parse("2025-08-01"),
                LocalDate.parse("2025-09-01"))).thenReturn(new BigDecimal("1584.00"));

        TransactionService service = service(transactions, mock(UserRepository.class),
                mock(CategoryRepository.class), mock(CsvTransactionParser.class),
                mock(MlPredictionClient.class));

        var result = service.insights(null, null);

        assertEquals("2025-08", result.month());
        assertEquals(List.of("2025-08", "2025-07"), result.availableMonths());
        assertEquals(new BigDecimal("1584.00"), result.totalSpend());
        verify(transactions).monthlyTotals(1L, LocalDate.parse("2024-09-01"),
                LocalDate.parse("2025-09-01"));
    }

    @Test
    void rejectsMalformedInsightsMonth() {
        TransactionService service = service(mock(TransactionRepository.class),
                mock(UserRepository.class), mock(CategoryRepository.class),
                mock(CsvTransactionParser.class), mock(MlPredictionClient.class));

        ApiException error = assertThrows(ApiException.class,
                () -> service.insights(null, "2025-8"));

        assertTrue(error.getMessage().contains("YYYY-MM"));
    }

    @Test
    void requestedInsightsMonthSetsItsOwnTotalsAndTrailingTrend() {
        TransactionRepository transactions = mock(TransactionRepository.class);
        when(transactions.availableMonths(1L)).thenReturn(List.of("2025-08", "2025-07"));
        when(transactions.categoryTotals(1L, LocalDate.parse("2025-08-01"),
                LocalDate.parse("2025-09-01"))).thenReturn(List.of());
        when(transactions.monthlyTotals(1L, LocalDate.parse("2024-09-01"),
                LocalDate.parse("2025-09-01"))).thenReturn(List.of());
        when(transactions.totalAmount(1L, LocalDate.parse("2025-08-01"),
                LocalDate.parse("2025-09-01"))).thenReturn(new BigDecimal("1584.00"));
        TransactionService service = service(transactions, mock(UserRepository.class),
                mock(CategoryRepository.class), mock(CsvTransactionParser.class),
                mock(MlPredictionClient.class));

        var result = service.insights(null, "2025-08");

        assertEquals("2025-08", result.month());
        assertEquals(new BigDecimal("1584.00"), result.totalSpend());
        verify(transactions).monthlyTotals(1L, LocalDate.parse("2024-09-01"),
                LocalDate.parse("2025-09-01"));
    }

    @Test
    void uploadSkipsRepeatedRowsBeforeCallingTheMlService() {
        TransactionRepository transactions = mock(TransactionRepository.class);
        UserRepository users = mock(UserRepository.class);
        CategoryRepository categories = mock(CategoryRepository.class);
        CsvTransactionParser parser = mock(CsvTransactionParser.class);
        MlPredictionClient mlClient = mock(MlPredictionClient.class);
        User user = mock(User.class);
        Category category = mock(Category.class);
        var row = new CsvTransactionParser.ParsedTransaction(
                LocalDate.parse("2025-08-11"), "NETFLIX SUBSCRIPTION", new BigDecimal("649.00"));
        when(users.findById(1L)).thenReturn(Optional.of(user));
        when(user.getId()).thenReturn(1L);
        when(parser.parse(any(), any())).thenReturn(List.of(row, row));
        when(transactions.findAllByDedupeHashIn(anyCollection())).thenReturn(List.of());
        when(categories.findByNameIgnoreCase("Entertainment")).thenReturn(Optional.of(category));
        when(category.getId()).thenReturn(4L);
        when(category.getName()).thenReturn("Entertainment");
        when(category.getColor()).thenReturn("#F0E442");
        when(mlClient.predict(anyList())).thenReturn(List.of(new MlPredictionClient.Prediction(
                "Entertainment", new BigDecimal("0.9000"), "auto",
                "netflix subscription")));
        when(transactions.saveAll(anyList())).thenAnswer(call -> call.getArgument(0));
        TransactionService service = service(transactions, users, categories, parser, mlClient);

        var result = service.upload(
                new MockMultipartFile("file", "bank.csv", "text/csv", new byte[]{1}),
                null, new UploadMapping(null, null, null, null, null));

        assertEquals(1, result.imported());
        assertEquals(1, result.skippedDuplicates());
        assertEquals(1, result.transactions().size());
        verify(mlClient).predict(argThat(inputs -> inputs.size() == 1));
        verify(transactions).saveAll(argThat(saved ->
                StreamSupport.stream(saved.spliterator(), false).count() == 1));
    }

    private TransactionService service(TransactionRepository transactions,
                                       UserRepository users,
                                       CategoryRepository categories,
                                       CsvTransactionParser parser,
                                       MlPredictionClient mlClient) {
        return new TransactionService(transactions, users, categories, parser, mlClient, 1L);
    }
}
