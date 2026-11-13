package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record NoticeUpsertRequestDto(
        @NotBlank String title,
        @NotBlank String content,
        @NotBlank String category,
        boolean active
) {
}
