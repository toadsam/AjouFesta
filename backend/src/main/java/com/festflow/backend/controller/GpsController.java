package com.festflow.backend.controller;

import com.festflow.backend.dto.GpsLogRequestDto;
import com.festflow.backend.dto.GpsLogResponseDto;
import com.festflow.backend.service.GpsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gps")
public class GpsController {

    private final GpsService gpsService;

    public GpsController(GpsService gpsService) {
        this.gpsService = gpsService;
    }

    @PostMapping
    public GpsLogResponseDto saveGps(@Valid @RequestBody GpsLogRequestDto requestDto) {
        return gpsService.saveGpsLog(requestDto);
    }
}

