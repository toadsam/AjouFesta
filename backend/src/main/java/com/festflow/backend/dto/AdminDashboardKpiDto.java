package com.festflow.backend.dto;

public record AdminDashboardKpiDto(
        long todayVisitorCount,
        CongestionKpiDto mostCongestedBooth,
        EventResponseDto upcomingWithin30Minutes
) {
}
