package com.festflow.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public record AiDecisionLogDto(
        LocalDateTime createdAt,
        String type,
        String title,
        String summary,
        List<String> reasons,
        List<String> actions
) {
}
