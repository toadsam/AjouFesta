package com.festflow.backend.dto;

public record StageZoneCrowdDto(
        String zoneKey,
        String zoneName,
        double latitude,
        double longitude,
        int radiusMeters,
        int crowdCount,
        int capacityHint,
        String level
) {
}

