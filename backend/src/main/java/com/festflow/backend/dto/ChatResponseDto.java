package com.festflow.backend.dto;

import java.util.List;

public record ChatResponseDto(
        String answer,
        String confidence,
        List<ChatEvidenceDto> evidence,
        List<String> warnings
) {
    public ChatResponseDto(String answer) {
        this(answer, "LOW", List.of(), List.of());
    }
}

