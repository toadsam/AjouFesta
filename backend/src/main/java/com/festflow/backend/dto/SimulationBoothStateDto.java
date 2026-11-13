package com.festflow.backend.dto;

public record SimulationBoothStateDto(
        Long boothId,
        String boothName,
        int currentPeople,
        int previousPeople,
        int incomingPerMinute,
        int outgoingPerMinute,
        int servicePerMinute,
        int estimatedWaitMinutes,
        String congestionLevel,
        Integer remainingStock
) {
}
