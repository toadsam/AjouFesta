package com.festflow.backend.dto;

public record AnalyticsOverviewDto(
        int percent,
        String level,
        int deltaPercent,
        int currentCount,
        int previousCount
) {
}
