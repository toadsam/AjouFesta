package com.festflow.backend.service;

import com.festflow.backend.dto.AdminDashboardKpiDto;
import com.festflow.backend.dto.CongestionKpiDto;
import com.festflow.backend.dto.CongestionResponseDto;
import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.repository.GpsLogRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

@Service
public class AdminDashboardService {

    private static final Set<String> UPCOMING_STATUSES = Set.of(
            "\uC608\uC815",
            "\uB300\uAE30\uC911",
            "\uACE7 \uC2DC\uC791"
    );

    private final GpsLogRepository gpsLogRepository;
    private final BoothService boothService;
    private final EventService eventService;

    public AdminDashboardService(GpsLogRepository gpsLogRepository, BoothService boothService, EventService eventService) {
        this.gpsLogRepository = gpsLogRepository;
        this.boothService = boothService;
        this.eventService = eventService;
    }

    public AdminDashboardKpiDto getKpis() {
        LocalDateTime now = LocalDateTime.now();

        // 오늘 00:00부터 현재까지 들어온 GPS 로그 수를 "오늘 총 방문자" 지표로 사용한다.
        LocalDateTime startOfDay = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        long todayVisitors = gpsLogRepository.countByCreatedAtBetween(startOfDay, now);

        // 현재 시점 기준 가장 혼잡한 부스를 계산한다.
        List<CongestionResponseDto> congestions = boothService.getAllCongestions();
        CongestionKpiDto mostCongested = congestions.stream()
                .max(Comparator.comparingInt(CongestionResponseDto::nearbyUserCount))
                .map(item -> new CongestionKpiDto(item.boothId(), item.boothName(), item.level(), item.nearbyUserCount()))
                .orElse(null);

        // 30분 이내 시작 예정 공연 중 가장 가까운 공연을 KPI로 노출한다.
        EventResponseDto upcoming = eventService.getAllEvents().stream()
                .filter(event -> UPCOMING_STATUSES.contains(event.status()))
                .filter(event -> event.startTime() != null)
                .filter(event -> !event.startTime().isBefore(now) && !event.startTime().isAfter(now.plusMinutes(30)))
                .min(Comparator.comparing(EventResponseDto::startTime))
                .orElse(null);

        return new AdminDashboardKpiDto(todayVisitors, mostCongested, upcoming);
    }
}
