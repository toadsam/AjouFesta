package com.festflow.backend.service.sms;

import net.nurigo.sdk.NurigoApp;
import net.nurigo.sdk.message.model.Message;
import net.nurigo.sdk.message.model.MessageType;
import net.nurigo.sdk.message.request.SingleMessageSendingRequest;
import net.nurigo.sdk.message.service.DefaultMessageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

@Component
public class SolapiMessageClient {

    private final boolean enabled;
    private final String apiKey;
    private final String apiSecret;
    private final String fromNumber;
    private final DefaultMessageService messageService;

    public SolapiMessageClient(
            @Value("${app.sms.provider:none}") String provider,
            @Value("${app.sms.solapi.api-key:}") String apiKey,
            @Value("${app.sms.solapi.api-secret:}") String apiSecret,
            @Value("${app.sms.solapi.api-base-url:https://api.solapi.com}") String apiBaseUrl,
            @Value("${app.sms.solapi.from:}") String fromNumber
    ) {
        this.enabled = "solapi".equalsIgnoreCase(provider == null ? "" : provider.trim());
        this.apiKey = trim(apiKey);
        this.apiSecret = trim(apiSecret);
        this.fromNumber = normalizePhoneNumber(fromNumber);
        this.messageService = isConfigured()
                ? NurigoApp.INSTANCE.initialize(this.apiKey, this.apiSecret, trim(apiBaseUrl))
                : null;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isConfigured() {
        return enabled
                && !apiKey.isBlank()
                && !apiSecret.isBlank()
                && !fromNumber.isBlank();
    }

    public void sendText(String to, String text) {
        if (!enabled) {
            return;
        }
        if (messageService == null) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Missing SOLAPI SMS configuration."
            );
        }

        String normalizedTo = normalizePhoneNumber(to);
        if (normalizedTo.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SMS receiver phone number is required.");
        }

        Message message = new Message();
        message.setFrom(fromNumber);
        message.setTo(normalizedTo);
        message.setText(text);
        message.setType(isSms(text) ? MessageType.SMS : MessageType.LMS);

        try {
            messageService.sendOne(new SingleMessageSendingRequest(message));
        } catch (Exception e) {
            // Solapi SDK(Kotlin)는 잘못된 번호 · 잔액 부족 · 통신 오류를 검사 예외(Exception)로 던진다. RuntimeException 만 잡으면 그대로 새어 나간다.
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to send SMS via SOLAPI.", e);
        }
    }

    private boolean isSms(String text) {
        return text != null && text.getBytes(StandardCharsets.UTF_8).length <= 90;
    }

    private String normalizePhoneNumber(String value) {
        String digitsOnly = trim(value).replaceAll("\\D", "");
        if (digitsOnly.startsWith("82") && digitsOnly.length() >= 10) {
            return "0" + digitsOnly.substring(2);
        }
        return digitsOnly;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
