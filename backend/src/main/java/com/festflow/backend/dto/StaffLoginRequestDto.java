package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record StaffLoginRequestDto(
        @NotBlank String staffNo,
        @NotBlank String pin
) {
}

