package com.festflow.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public record StageCrowdResponseDto(
        LocalDateTime updatedAt,
        int minutesWindow,
        int totalCrowdCount,
        List<StageZoneCrowdDto> zones
) {
}

