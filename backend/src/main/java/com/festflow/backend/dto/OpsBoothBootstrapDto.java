package com.festflow.backend.dto;

public record OpsBoothBootstrapDto(
        BoothResponseDto booth,
        CongestionResponseDto congestion,
        BoothReservationStateDto reservations
) {
}
