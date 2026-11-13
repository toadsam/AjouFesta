package com.festflow.backend.dto;

import java.util.List;

public record BoothReservationStateDto(
        Integer maxReservationMinutes,
        List<ReservationTableDto> tables,
        List<BoothReservationDto> activeReservations,
        BoothReservationDto myReservation,
        ReservationPenaltyDto penalty
) {
}

