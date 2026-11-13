package com.festflow.backend.dto;

public record AiMatchPhoneCheckDto(
        String phoneNumber,
        boolean available,
        int usedImageConversions,
        int remainingImageConversions,
        String message
) {
}
