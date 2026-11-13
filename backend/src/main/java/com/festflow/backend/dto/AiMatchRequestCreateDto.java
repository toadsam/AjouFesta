package com.festflow.backend.dto;

public record AiMatchRequestCreateDto(
        String requesterNickname,
        String requesterPin,
        String meetPlace,
        String message
) {
}
