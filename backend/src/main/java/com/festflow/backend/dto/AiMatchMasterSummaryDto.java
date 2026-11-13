package com.festflow.backend.dto;

import java.time.LocalDateTime;

/** 마스터 콘솔 한 칸에 들어갈 소개팅 요약. */
public record AiMatchMasterSummaryDto(
        long activeProfileCount,
        long matchedCount,
        long pendingRequestCount,
        long openReportCount,
        long pendingPhotoReviewCount,
        long meetupsToday,
        LocalDateTime nextMeetupAt,
        String nextMeetupPair
) {
}
