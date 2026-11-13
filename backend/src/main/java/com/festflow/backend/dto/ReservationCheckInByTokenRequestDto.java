package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ReservationCheckInByTokenRequestDto(
        @NotBlank String token
) {
}
