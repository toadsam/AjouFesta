package com.festflow.backend.dto;

public record AiMatchAdminPhonePurgeResponseDto(
        String phoneNumber,
        int deletedProfileCount,
        int deletedRequestCount,
        int deletedFavoriteCount,
        int deletedPhoneUsageCount,
        int deletedImageFileCount,
        int failedImageFileDeleteCount
) {
}
