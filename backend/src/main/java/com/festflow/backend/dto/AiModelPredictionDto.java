package com.festflow.backend.dto;

import java.util.List;

public record AiModelPredictionDto(
        String modelType,
        String rawPredictedLevel,
        String displayPredictedLevel,
        Double confidence,
        boolean modelBased,
        String driftStatus,
        Double driftScore,
        List<String> driftWarnings,
        List<String> factors,
        String error
) {
    public static AiModelPredictionDto fallback(String displayPredictedLevel, List<String> factors, String error) {
        return new AiModelPredictionDto(
                "RULE_FALLBACK",
                null,
                displayPredictedLevel,
                null,
                false,
                "UNKNOWN",
                null,
                List.of(),
                factors,
                error
        );
    }
}
