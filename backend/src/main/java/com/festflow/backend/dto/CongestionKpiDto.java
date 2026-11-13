package com.festflow.backend.dto;

public record CongestionKpiDto(
        Long boothId,
        String boothName,
        String level,
        int score
) {
}
