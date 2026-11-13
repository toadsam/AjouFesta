package com.festflow.backend.dto;

public record AnalyticsZoneCrowdDto(
        String zoneKey,
        String zoneName,
        double latitude,
        double longitude,
        int radiusMeters,
        int currentCount,
        int previousCount,
        int percent,
        int deltaPercent,
        String level
) {
}
