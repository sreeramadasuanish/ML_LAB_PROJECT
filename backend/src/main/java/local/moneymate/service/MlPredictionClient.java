package local.moneymate.service;

import local.moneymate.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Component
public class MlPredictionClient {
    private final RestClient client;

    public MlPredictionClient(RestClient.Builder builder,
                              @Value("${moneymate.ml-service-url}") String serviceUrl) {
        this.client = builder.baseUrl(serviceUrl).build();
    }

    public List<Prediction> predict(List<Input> transactions) {
        try {
            PredictionResponse response = client.post().uri("/predict")
                    .body(Map.of("transactions", transactions))
                    .retrieve().body(PredictionResponse.class);
            if (response == null || response.predictions() == null
                    || response.predictions().size() != transactions.size()) {
                throw new ApiException(HttpStatus.BAD_GATEWAY,
                        "ML service returned an incomplete prediction batch");
            }
            return response.predictions();
        } catch (RestClientException error) {
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "ML service is unavailable: " + error.getMessage());
        }
    }

    public record Input(String description, BigDecimal amount, LocalDate date) {}
    public record Prediction(String category, BigDecimal confidence, String status,
                             String cleaned_description) {}
    public record PredictionResponse(List<Prediction> predictions) {}
}
