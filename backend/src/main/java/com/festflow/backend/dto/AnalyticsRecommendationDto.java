package com.festflow.backend.dto;

public record AnalyticsRecommendationDto(
        String startTime,
        String endTime,
        int expectedPercent,
        String reason
) {
}
