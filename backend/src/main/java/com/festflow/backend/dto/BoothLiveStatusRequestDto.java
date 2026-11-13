package com.festflow.backend.dto;

import java.time.LocalTime;

public record BoothLiveStatusRequestDto(
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
