package com.festflow.backend.dto;

public record TranslateMetricsDto(
        long totalRequests,
        long successCount,
        long failCount,
        double successRate,
        double averageLatencyMs
) {
}

