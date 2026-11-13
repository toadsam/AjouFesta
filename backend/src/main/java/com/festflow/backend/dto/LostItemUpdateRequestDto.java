package com.festflow.backend.dto;

public record LostItemUpdateRequestDto(
        String title,
        String description,
        String category,
        String foundLocation,
        String finderContact,
        String imageUrl,
        String status,
        String resolveNote
) {
}
