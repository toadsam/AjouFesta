package com.festflow.backend.controller.analytics;

import com.festflow.backend.dto.AnalyticsDashboardDto;
import com.festflow.backend.dto.HeatPointDto;
import com.festflow.backend.dto.PopularBoothDto;
import com.festflow.backend.dto.StageCrowdResponseDto;
import com.festflow.backend.dto.TrafficHourlyDto;
import com.festflow.backend.service.analytics.AnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/traffic-hourly")
    public List<TrafficHourlyDto> trafficHourly() {
        return analyticsService.trafficHourly();
    }

    @GetMapping("/popular-booths")
    public List<PopularBoothDto> popularBooths() {
        return analyticsService.popularBooths();
    }

    @GetMapping("/congestion-heatmap")
    public List<HeatPointDto> congestionHeatmap() {
        return analyticsService.congestionHeatmap();
    }

    @GetMapping("/stage-crowd")
    public StageCrowdResponseDto stageCrowd(@RequestParam(defaultValue = "10") int minutes) {
        return analyticsService.stageCrowd(minutes);
    }

    @GetMapping("/dashboard")
    public AnalyticsDashboardDto dashboard(@RequestParam(defaultValue = "15") int minutes) {
        return analyticsService.dashboard(minutes);
    }
}
