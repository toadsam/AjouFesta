package com.festflow.backend.dto;

import java.time.LocalDateTime;
import java.time.LocalTime;

public record BoothResponseDto(
        Long id,
        String name,
        double latitude,
        double longitude,
        String description,
        Integer displayOrder,
        String imageUrl,
        Integer estimatedWaitMinutes,
        Integer remainingStock,
        String liveStatusMessage,
        LocalDateTime liveStatusUpdatedAt,
        String boothIntro,
        String menuImageUrl,
        String menuBoardJson,
        String category,
        String dayPart,
        LocalTime openTime,
        LocalTime closeTime,
        String tags,
        String contentJson,
        Boolean reservationEnabled,
        Integer reservationTableCount,
        Integer reservationAvailableSeats,
        Integer reservationReservedTables,
        Integer reservationInUseTables
) {
}

