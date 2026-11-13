package com.festflow.backend.dto;

import jakarta.validation.constraints.Min;

public record ReservationTableUpsertDto(
        Long id,
        String tableName,
        @Min(1) Integer totalSeats,
        @Min(0) Integer availableSeats
) {
}

