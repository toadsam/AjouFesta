package com.festflow.backend.dto;

public record SimulationFlowEventDto(
        String from,
        String to,
        int people,
        String reason
) {
}
