package com.festflow.backend.dto;

import java.util.List;

public record AiMatchProfileAccessResponseDto(
        AiMatchProfileResponseDto profile,
        String phoneNumber,
        AiMatchPhoneCheckDto phoneUsage,
        List<AiMatchRequestResponseDto> receivedRequests,
        List<AiMatchRequestResponseDto> sentRequests,
        List<AiMatchProfileResponseDto> profiles,
        List<Long> favoriteProfileIds,
        AiMatchRequestQuotaDto requestQuota
) {
}
