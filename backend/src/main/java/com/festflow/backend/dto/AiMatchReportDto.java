package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record AiMatchReportDto(
        Long id,
        Long reporterProfileId,
        String reporterNickname,
        Long targetProfileId,
        String targetNickname,
        String reason,
        String detail,
        String status,
        String resolution,
        LocalDateTime createdAt,
        LocalDateTime resolvedAt
) {
}
