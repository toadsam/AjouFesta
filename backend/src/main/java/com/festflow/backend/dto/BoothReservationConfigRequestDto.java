package com.festflow.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record BoothReservationConfigRequestDto(
        @NotNull @Min(1) Integer maxReservationMinutes,
        @Valid List<ReservationTableUpsertDto> tables
) {
}

