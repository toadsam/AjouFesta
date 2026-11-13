package com.festflow.backend.dto;

public record HeatPointDto(
        double latitude,
        double longitude,
        long intensity
) {
}
