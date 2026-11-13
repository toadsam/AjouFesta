package com.festflow.backend.dto;

public record TranslateResponseDto(
        String translatedText,
        String detectedSourceLang,
        String provider,
        double confidence,
        long latencyMs
) {
}

