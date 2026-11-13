package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record GpsLogResponseDto(
        Long id,
        LocalDateTime createdAt,
        String message
) {
}

