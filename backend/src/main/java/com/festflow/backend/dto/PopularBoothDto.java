package com.festflow.backend.dto;

public record PopularBoothDto(
        Long boothId,
        String boothName,
        long score
) {
}
