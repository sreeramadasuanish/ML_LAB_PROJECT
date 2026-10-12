package local.moneymate.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class TransactionStatusConverter implements AttributeConverter<TransactionStatus, String> {
    @Override public String convertToDatabaseColumn(TransactionStatus status) {
        return status == null ? null : status.name().toLowerCase(java.util.Locale.ROOT);
    }
    @Override public TransactionStatus convertToEntityAttribute(String value) {
        return value == null ? null : TransactionStatus.valueOf(value.toUpperCase(java.util.Locale.ROOT));
    }
}
