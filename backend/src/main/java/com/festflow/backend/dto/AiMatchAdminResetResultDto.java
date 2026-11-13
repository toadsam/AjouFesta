package com.festflow.backend.dto;

public record AiMatchAdminResetResultDto(
        long profiles,
        long requests,
        long favorites,
        long meetupSlots,
        long reports,
        long phoneUsages,
        int deletedImageFiles,
        int failedImageFiles
) {
}
