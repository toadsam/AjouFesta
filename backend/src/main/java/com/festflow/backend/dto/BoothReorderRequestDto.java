package com.festflow.backend.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record BoothReorderRequestDto(
        @NotEmpty List<Long> boothIds
) {
}
