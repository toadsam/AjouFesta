package com.festflow.backend.controller;

import com.festflow.backend.dto.TranslateMetricsDto;
import com.festflow.backend.dto.TranslateRequestDto;
import com.festflow.backend.dto.TranslateResponseDto;
import com.festflow.backend.service.TranslateMetricsService;
import com.festflow.backend.service.TranslateService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/translate")
public class TranslateController {

    private final TranslateService translateService;
    private final TranslateMetricsService metricsService;

    public TranslateController(TranslateService translateService, TranslateMetricsService metricsService) {
        this.translateService = translateService;
        this.metricsService = metricsService;
    }

    @PostMapping
    public TranslateResponseDto translate(@Valid @RequestBody TranslateRequestDto requestDto) {
        try {
            TranslateResponseDto response = translateService.translate(requestDto);
            metricsService.recordSuccess(response.latencyMs());
            return response;
        } catch (RuntimeException error) {
            metricsService.recordFailure();
            throw error;
        }
    }

    @GetMapping("/metrics")
    public TranslateMetricsDto metrics() {
        return metricsService.snapshot();
    }
}

