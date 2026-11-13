package com.festflow.backend.dto;

public record LostItemStatusUpdateRequestDto(
        String status,
        String resolveNote
) {
}

