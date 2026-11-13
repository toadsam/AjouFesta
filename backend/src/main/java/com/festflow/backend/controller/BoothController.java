package com.festflow.backend.controller;

import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.ReservationCheckInTokenDto;
import com.festflow.backend.dto.BoothReservationDto;
import com.festflow.backend.dto.BoothReservationStateDto;
import com.festflow.backend.dto.CongestionResponseDto;
import com.festflow.backend.dto.ReservationCreateRequestDto;
import com.festflow.backend.service.BoothService;
import com.festflow.backend.service.ReservationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/booths")
public class BoothController {

    @Value("${app.reservations.enabled:false}")
    private boolean reservationsEnabled;

    private void ensureReservationsEnabled() {
        if (!reservationsEnabled) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "예약 기능은 운영하지 않습니다.");
        }
    }

    private final BoothService boothService;
    private final ReservationService reservationService;

    public BoothController(BoothService boothService, ReservationService reservationService) {
        this.boothService = boothService;
        this.reservationService = reservationService;
    }

    @GetMapping
    public List<BoothResponseDto> getBooths() {
        return boothService.getAllBoothsForVisitors();
    }

    @GetMapping("/{id}")
    public BoothResponseDto getBooth(@PathVariable Long id) {
        return boothService.getBoothById(id);
    }

    @GetMapping("/{id}/congestion")
    public CongestionResponseDto getCongestion(@PathVariable Long id) {
        return boothService.getCongestionByBoothId(id);
    }

    @GetMapping("/{id}/reservations")
    public BoothReservationStateDto getReservationState(
            @PathVariable Long id,
            @RequestHeader(value = "X-Reservation-Token", required = false) String reservationToken
    ) {
        return reservationService.getBoothReservationState(id, reservationToken);
    }

    @PostMapping("/{id}/reservations")
    public BoothReservationDto createReservation(
            @PathVariable Long id,
            @RequestHeader(value = "X-Reservation-Token", required = false) String reservationToken,
            @Valid @RequestBody ReservationCreateRequestDto requestDto
    ) {
        ensureReservationsEnabled();
        return reservationService.createReservation(id, requestDto, reservationToken);
    }

    @PostMapping("/{id}/reservations/{reservationId}/check-in-token")
    public ReservationCheckInTokenDto createCheckInToken(
            @PathVariable Long id,
            @PathVariable Long reservationId,
            @RequestHeader(value = "X-Reservation-Token", required = false) String reservationToken
    ) {
        ensureReservationsEnabled();
        return reservationService.issueCheckInToken(id, reservationId, reservationToken);
    }
}

