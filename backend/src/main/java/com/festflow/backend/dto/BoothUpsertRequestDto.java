package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;

public record BoothUpsertRequestDto(
        @NotBlank String name,
        @NotNull Double latitude,
        @NotNull Double longitude,
        @NotBlank String description,
        Integer displayOrder,
        String imageUrl,
        Integer estimatedWaitMinutes,
        Integer remainingStock,
        String liveStatusMessage,
        String boothIntro,
        String menuImageUrl,
        String menuBoardJson,
        String category,
        String dayPart,
        LocalTime openTime,
        LocalTime closeTime,
        String tags,
        String contentJson,
        Boolean reservationEnabled
) {
}
