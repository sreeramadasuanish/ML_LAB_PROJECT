package local.moneymate.controller;

import jakarta.validation.Valid;
import local.moneymate.dto.*;
import local.moneymate.service.TransactionService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api")
public class TransactionController {
    private final TransactionService service;
    public TransactionController(TransactionService service) { this.service = service; }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UploadResponse upload(@RequestPart("file") MultipartFile file,
                                 @RequestParam(required = false) Long userId,
                                 @RequestParam(required = false) String dateColumn,
                                 @RequestParam(required = false) String descriptionColumn,
                                 @RequestParam(required = false) String amountColumn,
                                 @RequestParam(required = false) String debitColumn,
                                 @RequestParam(required = false) String creditColumn) {
        UploadMapping mapping = new UploadMapping(dateColumn, descriptionColumn, amountColumn, debitColumn, creditColumn);
        return service.upload(file, userId, mapping);
    }

    @GetMapping("/transactions")
    public List<TransactionResponse> transactions(@RequestParam(required = false) Long userId) {
        return service.list(userId);
    }

    @GetMapping("/review-queue")
    public List<TransactionResponse> reviewQueue(@RequestParam(required = false) Long userId) {
        return service.reviewQueue(userId);
    }

    @PutMapping("/transactions/{id}")
    public TransactionResponse correct(@PathVariable Long id, @Valid @RequestBody CorrectionRequest request,
                                       @RequestParam(required = false) Long userId) {
        return service.correct(id, request.categoryId(), userId);
    }

    @GetMapping("/insights")
    public InsightResponse insights(@RequestParam(required = false) Long userId,
                                    @RequestParam(required = false) String month) {
        return service.insights(userId, month);
    }
}
