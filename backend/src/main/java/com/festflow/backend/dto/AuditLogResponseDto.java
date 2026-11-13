package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record AuditLogResponseDto(
        Long id,
        String adminUsername,
        String action,
        String targetType,
        Long targetId,
        String details,
        LocalDateTime createdAt
) {
}
