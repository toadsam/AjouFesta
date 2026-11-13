package com.festflow.backend.dto;

public record AiAssistRequestDto(
        String type,
        String prompt
) {
}
