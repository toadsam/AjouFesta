package com.festflow.backend.dto;

public record LoginResponseDto(
        String token,
        String username
) {
}
