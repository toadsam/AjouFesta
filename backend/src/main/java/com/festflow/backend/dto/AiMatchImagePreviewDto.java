package com.festflow.backend.dto;

public record AiMatchImagePreviewDto(
        String originalImageUrl,
        String generatedImageUrl,
        int usedImageConversions,
        int remainingImageConversions,
        String message
) {
}
