package local.moneymate.dto;
import jakarta.validation.constraints.NotNull;
public record CorrectionRequest(@NotNull Long categoryId) {}
