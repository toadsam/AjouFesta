package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record AiMatchAdminProfileDto(
        Long id,
        String nickname,
        String gender,
        String intro,
        String meetPlace,
        String phoneNumber,
        String originalImageUrl,
        String generatedImageUrl,
        String status,
        int receivedCount,
        int sentCount,
        int pendingReceivedCount,
        int matchedCount,
        LocalDateTime createdAt,
        boolean hidden,
        String hiddenReason,
        String photoReview,
        int openReportCount
) {
}
