package com.festflow.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record OrderCreateItemDto(
        @NotBlank String name,
        @Min(1) @Max(20) Integer quantity
) {
}
