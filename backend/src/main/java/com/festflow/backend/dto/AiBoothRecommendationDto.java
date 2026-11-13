package com.festflow.backend.dto;

import java.util.List;

public record AiBoothRecommendationDto(
        Long boothId,
        String boothName,
        String category,
        String currentLevel,
        String predictedLevel,
        String riskLevel,
        int riskScore,
        int currentCrowdCount,
        int activeReservationCount,
        int checkedInReservationCount,
        Integer availableSeats,
        Integer waitMinutes,
        Integer remainingStock,
        boolean recommendedNow,
        List<String> reasons,
        AiModelPredictionDto aiModel
) {
}
