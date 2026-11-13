package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ReservationAuthVerifyRequestDto(
        @NotBlank String phoneNumber,
        @NotBlank String code
) {
}
