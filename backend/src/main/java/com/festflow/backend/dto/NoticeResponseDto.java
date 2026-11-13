package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record NoticeResponseDto(
        Long id,
        String title,
        String content,
        String category,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        long viewCount
) {
}
