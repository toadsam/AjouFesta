package com.festflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.TranslateRequestDto;
import com.festflow.backend.dto.TranslateResponseDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;

@Service
public class TranslateService {

    private static final Map<String, String> PRESET_KO_TO_EN = Map.of(
            "화장실은 저쪽입니다.", "The restroom is over there.",
            "분실물 센터는 본부 부스 옆에 있습니다.", "The lost-and-found center is next to the main booth.",
            "입구는 왼쪽, 출구는 오른쪽입니다.", "The entrance is on the left, and the exit is on the right.",
            "잠시만 기다려 주세요.", "Please wait a moment.",
            "도움이 필요하시면 저를 따라오세요.", "If you need help, please follow me."
    );

    private static final Map<String, String> PRESET_EN_TO_KO = Map.of(
            "Where is the restroom?", "화장실은 어디인가요?",
            "I lost my wallet.", "지갑을 잃어버렸어요.",
            "Where is the main stage?", "메인 무대가 어디인가요?",
            "Can you help me?", "도와주실 수 있나요?",
            "Thank you.", "감사합니다."
    );

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    private final String googleEndpoint;

    public TranslateService(@Value("${app.translate.google-endpoint:https://translate.googleapis.com/translate_a/single}") String googleEndpoint) {
        this.googleEndpoint = googleEndpoint;
    }

    public TranslateResponseDto translate(TranslateRequestDto requestDto) {
        String text = requestDto.text().trim();
        String sourceLang = normalizeLang(requestDto.sourceLang());
        String targetLang = normalizeLang(requestDto.targetLang());
        long startedAt = System.currentTimeMillis();

        String preset = tryPreset(text, sourceLang, targetLang);
        if (preset != null) {
            long latency = System.currentTimeMillis() - startedAt;
            return new TranslateResponseDto(
                    preset,
                    sourceLang,
                    "preset",
                    0.99,
                    latency
            );
        }

        try {
            String translated = callGoogleTranslate(text, sourceLang, targetLang);
            long latency = System.currentTimeMillis() - startedAt;
            double confidence = translated.equalsIgnoreCase(text) ? 0.45 : 0.88;
            return new TranslateResponseDto(
                    translated,
                    sourceLang,
                    "google-translate",
                    confidence,
                    latency
            );
        } catch (Exception ignored) {
            // Fallback keeps service available even with external API failure.
            long latency = System.currentTimeMillis() - startedAt;
            String fallback = fallbackTranslate(text, sourceLang, targetLang, requestDto.contextHints());
            return new TranslateResponseDto(
                    fallback,
                    sourceLang,
                    "fallback",
                    0.35,
                    latency
            );
        }
    }

    private String callGoogleTranslate(String text, String sourceLang, String targetLang) throws IOException, InterruptedException {
        String sourceParam = "auto".equals(sourceLang) ? "auto" : sourceLang;
        String encodedText = URLEncoder.encode(text, StandardCharsets.UTF_8);

        String url = googleEndpoint
                + "?client=gtx"
                + "&dt=t"
                + "&sl=" + sourceParam
                + "&tl=" + targetLang
                + "&q=" + encodedText;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(3))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ResponseStatusException(BAD_GATEWAY, "Translate provider returned non-2xx status.");
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode sentences = root.path(0);
        if (!sentences.isArray() || sentences.isEmpty()) {
            throw new ResponseStatusException(BAD_GATEWAY, "Translate provider response shape is invalid.");
        }

        StringBuilder builder = new StringBuilder();
        for (JsonNode sentence : sentences) {
            JsonNode translated = sentence.path(0);
            if (translated.isTextual()) {
                builder.append(translated.asText());
            }
        }

        String translatedText = builder.toString().trim();
        if (translatedText.isEmpty()) {
            throw new ResponseStatusException(BAD_GATEWAY, "Translate provider returned empty text.");
        }
        return translatedText;
    }

    private String fallbackTranslate(String text, String sourceLang, String targetLang, List<String> contextHints) {
        String contextPrefix = contextHints == null || contextHints.isEmpty()
                ? ""
                : "(" + String.join(" / ", contextHints.stream().limit(3).toList()) + ") ";
        if ("ko".equals(sourceLang) && "en".equals(targetLang)) {
            return contextPrefix + "[EN] " + text;
        }
        if ("en".equals(sourceLang) && "ko".equals(targetLang)) {
            return contextPrefix + "[KO] " + text;
        }
        return contextPrefix + text;
    }

    private String tryPreset(String text, String sourceLang, String targetLang) {
        if ("ko".equals(sourceLang) && "en".equals(targetLang)) {
            return PRESET_KO_TO_EN.get(text);
        }
        if ("en".equals(sourceLang) && "ko".equals(targetLang)) {
            return PRESET_EN_TO_KO.get(text);
        }
        return null;
    }

    private String normalizeLang(String lang) {
        if (lang == null || lang.isBlank()) {
            return "auto";
        }
        String normalized = lang.toLowerCase(Locale.ROOT).trim();
        if (normalized.startsWith("ko")) {
            return "ko";
        }
        if (normalized.startsWith("en")) {
            return "en";
        }
        if ("auto".equals(normalized)) {
            return "auto";
        }
        return normalized;
    }
}

