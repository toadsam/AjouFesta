package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record ReservationCheckInTokenDto(
        String token,
        LocalDateTime expiresAt
) {
}
