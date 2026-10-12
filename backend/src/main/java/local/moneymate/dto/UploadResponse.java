package local.moneymate.dto;

import java.util.List;
public record UploadResponse(int imported, int skippedDuplicates,
                             List<TransactionResponse> transactions) {}
