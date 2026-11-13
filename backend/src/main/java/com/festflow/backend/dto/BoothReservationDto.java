package com.festflow.backend.dto;

import com.festflow.backend.entity.ReservationStatus;

import java.time.LocalDateTime;

public record BoothReservationDto(
        Long id,
        Long boothId,
        Long tableId,
        String tableName,
        String userKey,
        Integer seatCount,
        ReservationStatus status,
        LocalDateTime reservedAt,
        LocalDateTime expiresAt,
        LocalDateTime checkedInAt,
        LocalDateTime expiredAt,
        LocalDateTime calledAt
) {

    /** 공개 화면·SSE 용. 전화번호는 뒤 4자리만 남긴다. */
    public BoothReservationDto masked() {
        return new BoothReservationDto(id, boothId, tableId, tableName, maskUserKey(userKey), seatCount, status, reservedAt, expiresAt, checkedInAt, expiredAt, calledAt);
    }

    private static String maskUserKey(String value) {
        if (value == null || value.length() < 4) {
            return value == null ? null : "****";
        }
        return "****" + value.substring(value.length() - 4);
    }
}
