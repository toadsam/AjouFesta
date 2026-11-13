package com.festflow.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SimulationStatusDto(
        boolean enabled,
        boolean running,
        String scenario,
        int tickSeconds,
        int jitterPercent,
        LocalDateTime updatedAt,
        int totalPeople,
        List<SimulationBoothStateDto> booths,
        SimulationStageStateDto stage,
        List<SimulationFlowEventDto> flowEvents
) {
}
