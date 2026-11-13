package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record ReservationAuthSendCodeResponseDto(
        String phoneNumber,
        LocalDateTime expiresAt
) {
}
