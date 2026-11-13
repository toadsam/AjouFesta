package com.festflow.backend.dto;

public record SimulationBoothPatchDto(
        Long boothId,
        Integer currentPeople,
        Integer incomingPerMinute,
        Integer outgoingPerMinute,
        Integer servicePerMinute
) {
}
