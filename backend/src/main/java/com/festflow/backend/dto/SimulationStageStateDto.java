package com.festflow.backend.dto;

public record SimulationStageStateDto(
        String zoneKey,
        String zoneName,
        int currentPeople,
        int previousPeople,
        int incomingPerMinute,
        int outgoingPerMinute,
        int capacityHint,
        String congestionLevel
) {
}
