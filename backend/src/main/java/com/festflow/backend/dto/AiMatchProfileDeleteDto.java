package com.festflow.backend.dto;

public record AiMatchProfileDeleteDto(
        String currentNickname,
        String nickname,
        String pin
) {
}
