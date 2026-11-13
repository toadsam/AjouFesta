package com.festflow.backend.dto;

public record AnalyticsTrendPointDto(
        String label,
        String startTime,
        String endTime,
        int percent,
        long count,
        boolean current
) {
}
