package com.festflow.backend.controller;

import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import com.festflow.backend.dto.ReservationAuthSendCodeRequestDto;
import com.festflow.backend.dto.ReservationAuthSendCodeResponseDto;
import com.festflow.backend.dto.ReservationAuthVerifyRequestDto;
import com.festflow.backend.dto.ReservationAuthVerifyResponseDto;
import com.festflow.backend.service.ReservationAuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reservations/auth")
public class ReservationAuthController {

    @Value("${app.reservations.enabled:false}")
    private boolean reservationsEnabled;

    private void ensureReservationsEnabled() {
        if (!reservationsEnabled) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "예약 기능은 운영하지 않습니다.");
        }
    }

    private final ReservationAuthService reservationAuthService;

    public ReservationAuthController(ReservationAuthService reservationAuthService) {
        this.reservationAuthService = reservationAuthService;
    }

    @PostMapping("/send-code")
    public ReservationAuthSendCodeResponseDto sendCode(@Valid @RequestBody ReservationAuthSendCodeRequestDto requestDto) {
        ensureReservationsEnabled();
        return reservationAuthService.sendCode(requestDto.phoneNumber());
    }

    @PostMapping("/verify-code")
    public ReservationAuthVerifyResponseDto verifyCode(@Valid @RequestBody ReservationAuthVerifyRequestDto requestDto) {
        ensureReservationsEnabled();
        return reservationAuthService.verifyCode(requestDto.phoneNumber(), requestDto.code());
    }
}

