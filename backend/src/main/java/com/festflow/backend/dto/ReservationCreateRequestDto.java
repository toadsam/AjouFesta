package com.festflow.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ReservationCreateRequestDto(
        @NotNull Long tableId,
        @Min(1) Integer seatCount
) {
}

