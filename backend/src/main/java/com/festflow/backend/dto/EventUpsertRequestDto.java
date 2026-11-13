package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record EventUpsertRequestDto(
        @NotBlank String title,
        @NotNull LocalDateTime startTime,
        @NotNull LocalDateTime endTime,
        String imageUrl,
        String imageCredit,
        String imageFocus,
        String statusOverride,
        String liveMessage,
        Integer delayMinutes
) {
}
