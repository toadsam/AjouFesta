package com.festflow.backend.dto;

import java.util.List;

public record AiMatchAdminOverviewDto(
        long activeProfileCount,
        long totalProfileCount,
        long totalRequestCount,
        long pendingRequestCount,
        long matchedRequestCount,
        List<AiMatchAdminProfileDto> profiles,
        List<AiMatchAdminRequestDto> requests,
        List<AiMatchReportDto> reports,
        long openReportCount,
        long pendingPhotoReviewCount,
        /** 새 가입을 받는 중인지. 통계·도구 탭의 스위치가 이 값을 보고 바꾼다. */
        boolean registrationOpen
) {
}
