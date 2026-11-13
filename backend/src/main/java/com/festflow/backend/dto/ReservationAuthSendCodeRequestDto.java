package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ReservationAuthSendCodeRequestDto(
        @NotBlank String phoneNumber
) {
}
