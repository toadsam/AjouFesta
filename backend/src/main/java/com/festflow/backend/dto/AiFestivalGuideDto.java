package com.festflow.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public record AiFestivalGuideDto(
        LocalDateTime generatedAt,
        String headline,
        String summary,
        List<AiBoothRecommendationDto> recommendedNow,
        List<AiBoothRecommendationDto> avoidNow,
        List<AiBoothRecommendationDto> recommendedLater,
        List<String> userActions,
        List<String> operatorAlerts
) {
}
