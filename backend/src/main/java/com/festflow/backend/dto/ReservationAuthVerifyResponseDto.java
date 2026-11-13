package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record ReservationAuthVerifyResponseDto(
        String reservationToken,
        String phoneNumber,
        LocalDateTime expiresAt
) {
}
