package com.festflow.backend.dto;

public record CongestionResponseDto(
        Long boothId,
        String boothName,
        String level,
        int nearbyUserCount
) {
}

