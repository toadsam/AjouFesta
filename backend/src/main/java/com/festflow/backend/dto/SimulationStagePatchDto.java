package com.festflow.backend.dto;

public record SimulationStagePatchDto(
        Integer currentPeople,
        Integer incomingPerMinute,
        Integer outgoingPerMinute
) {
}
