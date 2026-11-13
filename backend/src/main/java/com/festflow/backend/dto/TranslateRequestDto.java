package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record TranslateRequestDto(
        @NotBlank String text,
        @NotBlank String sourceLang,
        @NotBlank String targetLang,
        List<String> contextHints
) {
}

