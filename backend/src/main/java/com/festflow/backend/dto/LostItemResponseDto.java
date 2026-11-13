package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record LostItemResponseDto(
        Long id,
        String title,
        String description,
        String category,
        String foundLocation,
        String finderContact,
        String imageUrl,
        String status,
        String statusLabel,
        String reporterType,
        String reporterRef,
        String resolveNote,
        String claimantName,
        String claimantContact,
        String claimantNote,
        LocalDateTime claimedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}

