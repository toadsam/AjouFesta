package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record AiMatchAdminPhonePurgeRequestDto(
        @NotBlank String phoneNumber
) {
}
