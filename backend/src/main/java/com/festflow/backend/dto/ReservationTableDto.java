package com.festflow.backend.dto;

public record ReservationTableDto(
        Long id,
        String tableName,
        Integer totalSeats,
        Integer availableSeats,
        Integer displayOrder,
        Integer reservableSeats,
        String occupancyStatus,
        String occupancyLabel,
        Long activeReservationId,
        /** 손님이 앉은 시각(이용 중일 때만). 스태프 화면에서 '앉은 지 몇 분'을 보여 준다. */
        java.time.LocalDateTime occupiedSince
) {
}

