package com.festflow.backend.dto;

public record OpsBoothSummaryItemDto(
        String name,
        long quantity,
        long amount
) {
}
