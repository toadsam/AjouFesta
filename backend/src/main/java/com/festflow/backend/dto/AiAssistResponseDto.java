package com.festflow.backend.dto;

import java.util.List;

public record AiAssistResponseDto(
        String title,
        String summary,
        List<String> highlights,
        List<String> recommendedActions,
        String draftTitle,
        String draftContent,
        String draftCategory,
        String confidence
) {
}
