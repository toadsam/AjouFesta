package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record ReservationPenaltyDto(
        Integer noShowCount,
        LocalDateTime blockedUntil,
        boolean blocked
) {
}

