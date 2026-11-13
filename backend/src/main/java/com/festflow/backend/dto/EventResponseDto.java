package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record EventResponseDto(
        Long id,
        String title,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String status,
        String imageUrl,
        String imageCredit,
        String imageFocus,
        String statusOverride,
        String liveMessage,
        Integer delayMinutes,
        LocalDateTime statusUpdatedAt
) {
}

