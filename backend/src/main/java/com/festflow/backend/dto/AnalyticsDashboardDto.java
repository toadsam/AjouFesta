package com.festflow.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public record AnalyticsDashboardDto(
        LocalDateTime updatedAt,
        int minutesWindow,
        int sampleCount,
        AnalyticsOverviewDto overview,
        List<AnalyticsZoneCrowdDto> zones,
        List<AnalyticsTrendPointDto> trend,
        AnalyticsRecommendationDto recommendation
) {
}
