package com.festflow.backend.dto;

import java.util.List;

public record SimulationPatchRequestDto(
        Integer tickSeconds,
        Integer jitterPercent,
        SimulationStagePatchDto stage,
        List<SimulationBoothPatchDto> booths
) {
}
