package com.festflow.backend.service.sms;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@ConditionalOnProperty(prefix = "app.sms", name = "provider", havingValue = "aligo")
public class AligoSmsSender implements SmsSender {

    private static final URI SEND_URI = URI.create("https://apis.aligo.in/send/");

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String userId;
    private final String sender;
    private final boolean testMode;

    public AligoSmsSender(
            @Value("${app.sms.aligo.api-key}") String apiKey,
            @Value("${app.sms.aligo.user-id}") String userId,
            @Value("${app.sms.aligo.sender}") String sender,
            @Value("${app.sms.aligo.test-mode:false}") boolean testMode,
            ObjectMapper objectMapper
    ) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.userId = userId;
        this.sender = sender;
        this.testMode = testMode;
    }

    @Override
    public void sendVerificationCode(String phoneNumber, String code) {
        String message = "[Fest-A] 인증번호는 " + code + " 입니다. 3분 내 입력하세요.";

        Map<String, String> params = new LinkedHashMap<>();
        params.put("key", requireNonBlank(apiKey, "app.sms.aligo.api-key"));
        params.put("user_id", requireNonBlank(userId, "app.sms.aligo.user-id"));
        params.put("sender", requireNonBlank(sender, "app.sms.aligo.sender"));
        params.put("receiver", phoneNumber);
        params.put("msg", message);
        if (testMode) {
            params.put("testmode_yn", "Y");
        }

        HttpRequest request = HttpRequest.newBuilder(SEND_URI)
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(toFormBody(params)))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() >= 400) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "SMS provider request failed.");
            }

            JsonNode body = objectMapper.readTree(response.body());
            String resultCode = body.path("result_code").asText("");
            if (!"1".equals(resultCode)) {
                String reason = body.path("message").asText("SMS provider error");
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, reason);
            }
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to send SMS via Aligo.");
        }
    }

    private String requireNonBlank(String value, String propertyName) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Missing SMS configuration: " + propertyName
            );
        }
        return value.trim();
    }

    private String toFormBody(Map<String, String> params) {
        return params.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
