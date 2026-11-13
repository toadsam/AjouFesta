package com.festflow.backend.service.analytics;

import com.festflow.backend.dto.AnalyticsDashboardDto;
import com.festflow.backend.dto.AnalyticsOverviewDto;
import com.festflow.backend.dto.AnalyticsRecommendationDto;
import com.festflow.backend.dto.AnalyticsTrendPointDto;
import com.festflow.backend.dto.AnalyticsZoneCrowdDto;
import com.festflow.backend.dto.HeatPointDto;
import com.festflow.backend.dto.PopularBoothDto;
import com.festflow.backend.dto.StageCrowdResponseDto;
import com.festflow.backend.dto.StageZoneCrowdDto;
import com.festflow.backend.dto.TrafficHourlyDto;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.GpsLog;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.repository.GpsLogRepository;
import com.festflow.backend.service.SimulationStateService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AnalyticsService {

    private record StageZone(String key, String name, double latitude, double longitude, int radiusMeters, int capacityHint) {
    }

    private record CrowdZone(String key, String name, double latitude, double longitude, int radiusMeters, int capacityHint) {
    }

    private static final List<StageZone> STAGE_ZONES = List.of(
            new StageZone("open-air-theater", "\uC544\uC8FC\uB300 \uB178\uCC9C\uADF9\uC7A5", 37.281785, 127.045501, 55, 4000)
    );

    private static final List<CrowdZone> CROWD_ZONES = List.of(
            new CrowdZone("ajou-square", "Ajou Plaza", 37.282610, 127.044430, 90, 80),
            new CrowdZone("lawn-square", "Lawn Plaza", 37.281785, 127.045501, 85, 110),
            new CrowdZone("gym-front", "Gym Front", 37.283740, 127.044240, 90, 95),
            new CrowdZone("student-hall", "Student Hall", 37.282840, 127.043050, 80, 75),
            new CrowdZone("seongho-hall", "Seongho Hall", 37.283500, 127.046080, 85, 80),
            new CrowdZone("rear-gate", "Rear Gate Street", 37.280950, 127.044020, 110, 100)
    );

    private final GpsLogRepository gpsLogRepository;
    private final BoothRepository boothRepository;
    private final SimulationStateService simulationStateService;

    public AnalyticsService(
            GpsLogRepository gpsLogRepository,
            BoothRepository boothRepository,
            SimulationStateService simulationStateService
    ) {
        this.gpsLogRepository = gpsLogRepository;
        this.boothRepository = boothRepository;
        this.simulationStateService = simulationStateService;
    }

    public List<TrafficHourlyDto> trafficHourly() {
        LocalDateTime from = LocalDateTime.now().minusHours(24);
        List<GpsLog> logs = gpsLogRepository.findByCreatedAtAfter(from);

        Map<String, Long> countMap = new HashMap<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MM-dd HH:00");
        for (GpsLog log : logs) {
            String key = log.getCreatedAt().withMinute(0).withSecond(0).withNano(0).format(formatter);
            countMap.put(key, countMap.getOrDefault(key, 0L) + 1);
        }

        return countMap.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new TrafficHourlyDto(entry.getKey(), entry.getValue()))
                .toList();
    }

    public List<PopularBoothDto> popularBooths() {
        if (simulationStateService.isRunning()) {
            return simulationStateService.boothSnapshots(boothRepository.findAll()).stream()
                    .map(item -> new PopularBoothDto(item.boothId(), item.boothName(), item.currentPeople()))
                    .sorted(Comparator.comparing(PopularBoothDto::score).reversed())
                    .limit(10)
                    .toList();
        }

        LocalDateTime from = LocalDateTime.now().minusMinutes(60);
        List<GpsLog> logs = gpsLogRepository.findByCreatedAtAfter(from);
        List<Booth> booths = boothRepository.findAll();

        return booths.stream()
                .map(booth -> {
                    long score = logs.stream()
                            .filter(log -> distanceInMeters(booth.getLatitude(), booth.getLongitude(), log.getLatitude(), log.getLongitude()) <= 100)
                            .count();
                    return new PopularBoothDto(booth.getId(), booth.getName(), score);
                })
                .sorted(Comparator.comparing(PopularBoothDto::score).reversed())
                .limit(10)
                .toList();
    }

    public List<HeatPointDto> congestionHeatmap() {
        if (simulationStateService.isRunning()) {
            return simulationStateService.boothSnapshots(boothRepository.findAll()).stream()
                    .map(item -> new HeatPointDto(item.latitude(), item.longitude(), item.currentPeople()))
                    .sorted(Comparator.comparing(HeatPointDto::intensity).reversed())
                    .toList();
        }

        LocalDateTime from = LocalDateTime.now().minusMinutes(60);
        List<GpsLog> logs = gpsLogRepository.findByCreatedAtAfter(from);
        Map<String, Long> cells = new HashMap<>();

        for (GpsLog log : logs) {
            double lat = Math.round(log.getLatitude() * 1000.0) / 1000.0;
            double lng = Math.round(log.getLongitude() * 1000.0) / 1000.0;
            String key = lat + "," + lng;
            cells.put(key, cells.getOrDefault(key, 0L) + 1);
        }

        return cells.entrySet().stream()
                .map(entry -> {
                    String[] split = entry.getKey().split(",");
                    return new HeatPointDto(Double.parseDouble(split[0]), Double.parseDouble(split[1]), entry.getValue());
                })
                .sorted(Comparator.comparing(HeatPointDto::intensity).reversed())
                .toList();
    }

    public StageCrowdResponseDto stageCrowd(int minutesWindow) {
        int minutes = Math.max(1, Math.min(60, minutesWindow));
        if (simulationStateService.isRunning()) {
            List<StageZoneCrowdDto> zones = simulationStateService.stageSnapshot()
                    .map(stage -> List.of(new StageZoneCrowdDto(
                            stage.zoneKey(),
                            stage.zoneName(),
                            stage.latitude(),
                            stage.longitude(),
                            stage.radiusMeters(),
                            stage.currentPeople(),
                            stage.capacityHint(),
                            stage.congestionLevel()
                    )))
                    .orElseGet(() -> {
                        List<SimulationStateService.SimulationBoothSnapshot> snapshots =
                                simulationStateService.boothSnapshots(boothRepository.findAll());
                        return STAGE_ZONES.stream()
                                .map(zone -> {
                                    int count = snapshots.stream()
                                            .filter(item -> distanceInMeters(zone.latitude(), zone.longitude(), item.latitude(), item.longitude()) <= zone.radiusMeters())
                                            .mapToInt(SimulationStateService.SimulationBoothSnapshot::currentPeople)
                                            .sum();
                                    return new StageZoneCrowdDto(
                                            zone.key(),
                                            zone.name(),
                                            zone.latitude(),
                                            zone.longitude(),
                                            zone.radiusMeters(),
                                            count,
                                            zone.capacityHint(),
                                            resolveLevel(count, zone.capacityHint())
                                    );
                                })
                                .toList();
                    });
            int total = zones.stream().mapToInt(StageZoneCrowdDto::crowdCount).sum();
            return new StageCrowdResponseDto(LocalDateTime.now(), minutes, total, zones);
        }

        LocalDateTime from = LocalDateTime.now().minusMinutes(minutes);
        List<GpsLog> logs = gpsLogRepository.findByCreatedAtAfter(from);

        List<StageZoneCrowdDto> zones = STAGE_ZONES.stream()
                .map(zone -> {
                    int count = (int) logs.stream()
                            .filter(log -> distanceInMeters(zone.latitude(), zone.longitude(), log.getLatitude(), log.getLongitude()) <= zone.radiusMeters())
                            .count();
                    return new StageZoneCrowdDto(
                            zone.key(),
                            zone.name(),
                            zone.latitude(),
                            zone.longitude(),
                            zone.radiusMeters(),
                            count,
                            zone.capacityHint(),
                            resolveLevel(count, zone.capacityHint())
                    );
                })
                .toList();

        int total = zones.stream().mapToInt(StageZoneCrowdDto::crowdCount).sum();
        return new StageCrowdResponseDto(LocalDateTime.now(), minutes, total, zones);
    }

    public AnalyticsDashboardDto dashboard(int minutesWindow) {
        int minutes = Math.max(5, Math.min(60, minutesWindow));
        if (simulationStateService.isRunning()) {
            return simulatedDashboard(minutes);
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime currentFrom = now.minusMinutes(minutes);
        LocalDateTime previousFrom = now.minusMinutes(minutes * 2L);

        List<GpsLog> recentLogs = gpsLogRepository.findByCreatedAtAfter(previousFrom);
        List<GpsLog> currentLogs = recentLogs.stream()
                .filter(log -> !log.getCreatedAt().isBefore(currentFrom))
                .toList();
        List<GpsLog> previousLogs = recentLogs.stream()
                .filter(log -> log.getCreatedAt().isBefore(currentFrom))
                .toList();

        List<AnalyticsZoneCrowdDto> zones = CROWD_ZONES.stream()
                .map(zone -> zoneCrowd(zone, currentLogs, previousLogs))
                .toList();

        int totalCapacity = CROWD_ZONES.stream().mapToInt(CrowdZone::capacityHint).sum();
        int currentCount = countInAnyZone(currentLogs);
        int previousCount = countInAnyZone(previousLogs);
        int currentPercent = toPercent(currentCount, totalCapacity);
        int previousPercent = toPercent(previousCount, totalCapacity);
        AnalyticsOverviewDto overview = new AnalyticsOverviewDto(
                currentPercent,
                levelForPercent(currentPercent),
                currentPercent - previousPercent,
                currentCount,
                previousCount
        );

        List<AnalyticsTrendPointDto> trend = todayTrend(now, totalCapacity);
        AnalyticsRecommendationDto recommendation = recommendLowCrowdTime(trend);

        return new AnalyticsDashboardDto(
                now,
                minutes,
                currentLogs.size(),
                overview,
                zones,
                trend,
                recommendation
        );
    }

    private AnalyticsDashboardDto simulatedDashboard(int minutes) {
        LocalDateTime now = LocalDateTime.now();
        List<SimulationStateService.SimulationBoothSnapshot> snapshots =
                simulationStateService.boothSnapshots(boothRepository.findAll());

        List<AnalyticsZoneCrowdDto> zones = CROWD_ZONES.stream()
                .map(zone -> simulatedZoneCrowd(zone, snapshots))
                .toList();

        int totalCapacity = CROWD_ZONES.stream().mapToInt(CrowdZone::capacityHint).sum();
        int currentCount = countInAnyZoneSnapshots(snapshots, false);
        int previousCount = countInAnyZoneSnapshots(snapshots, true);
        int currentPercent = toPercent(currentCount, totalCapacity);
        int previousPercent = toPercent(previousCount, totalCapacity);

        AnalyticsOverviewDto overview = new AnalyticsOverviewDto(
                currentPercent,
                levelForPercent(currentPercent),
                currentPercent - previousPercent,
                currentCount,
                previousCount
        );
        List<AnalyticsTrendPointDto> trend = simulatedTrend(now, totalCapacity, currentPercent, currentCount);

        return new AnalyticsDashboardDto(
                now,
                minutes,
                currentCount,
                overview,
                zones,
                trend,
                recommendLowCrowdTime(trend)
        );
    }

    private AnalyticsZoneCrowdDto simulatedZoneCrowd(
            CrowdZone zone,
            List<SimulationStateService.SimulationBoothSnapshot> snapshots
    ) {
        int currentCount = snapshots.stream()
                .filter(item -> distanceInMeters(zone.latitude(), zone.longitude(), item.latitude(), item.longitude()) <= zone.radiusMeters())
                .mapToInt(SimulationStateService.SimulationBoothSnapshot::currentPeople)
                .sum();
        int previousCount = snapshots.stream()
                .filter(item -> distanceInMeters(zone.latitude(), zone.longitude(), item.latitude(), item.longitude()) <= zone.radiusMeters())
                .mapToInt(SimulationStateService.SimulationBoothSnapshot::previousPeople)
                .sum();
        int currentPercent = toPercent(currentCount, zone.capacityHint());
        int previousPercent = toPercent(previousCount, zone.capacityHint());

        return new AnalyticsZoneCrowdDto(
                zone.key(),
                zone.name(),
                zone.latitude(),
                zone.longitude(),
                zone.radiusMeters(),
                currentCount,
                previousCount,
                currentPercent,
                currentPercent - previousPercent,
                levelForPercent(currentPercent)
        );
    }

    private List<AnalyticsTrendPointDto> simulatedTrend(
            LocalDateTime now,
            int totalCapacity,
            int currentPercent,
            int currentCount
    ) {
        LocalDateTime startOfDay = now.toLocalDate().atStartOfDay();
        List<AnalyticsTrendPointDto> result = new ArrayList<>();
        int currentHourBlock = (now.getHour() / 3) * 3;

        for (int hour = 0; hour < 24; hour += 3) {
            LocalDateTime from = startOfDay.plusHours(hour);
            LocalDateTime to = from.plusHours(3);
            boolean current = hour == currentHourBlock;
            int distance = Math.abs(hour - currentHourBlock) / 3;
            int percent = current
                    ? currentPercent
                    : Math.max(0, Math.min(100, currentPercent - (distance * 6) + (hour % 2 == 0 ? 3 : -2)));
            long count = current ? currentCount : Math.round(totalCapacity * (percent / 100.0));
            result.add(new AnalyticsTrendPointDto(
                    String.format("%02d\uC2DC", hour),
                    from.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm")),
                    to.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm")),
                    percent,
                    count,
                    current
            ));
        }

        return result;
    }

    private int countInAnyZoneSnapshots(List<SimulationStateService.SimulationBoothSnapshot> snapshots, boolean previous) {
        return snapshots.stream()
                .filter(item -> CROWD_ZONES.stream()
                        .anyMatch(zone -> distanceInMeters(zone.latitude(), zone.longitude(), item.latitude(), item.longitude()) <= zone.radiusMeters()))
                .mapToInt(item -> previous ? item.previousPeople() : item.currentPeople())
                .sum();
    }

    private AnalyticsZoneCrowdDto zoneCrowd(CrowdZone zone, List<GpsLog> currentLogs, List<GpsLog> previousLogs) {
        int currentCount = countInZone(currentLogs, zone);
        int previousCount = countInZone(previousLogs, zone);
        int currentPercent = toPercent(currentCount, zone.capacityHint());
        int previousPercent = toPercent(previousCount, zone.capacityHint());

        return new AnalyticsZoneCrowdDto(
                zone.key(),
                zone.name(),
                zone.latitude(),
                zone.longitude(),
                zone.radiusMeters(),
                currentCount,
                previousCount,
                currentPercent,
                currentPercent - previousPercent,
                levelForPercent(currentPercent)
        );
    }

    private List<AnalyticsTrendPointDto> todayTrend(LocalDateTime now, int totalCapacity) {
        LocalDateTime startOfDay = now.toLocalDate().atStartOfDay();
        List<GpsLog> todayLogs = gpsLogRepository.findByCreatedAtAfter(startOfDay.minusSeconds(1));
        List<AnalyticsTrendPointDto> result = new ArrayList<>();

        for (int hour = 0; hour < 24; hour += 3) {
            LocalDateTime from = startOfDay.plusHours(hour);
            LocalDateTime to = from.plusHours(3);
            long count = todayLogs.stream()
                    .filter(log -> !log.getCreatedAt().isBefore(from) && log.getCreatedAt().isBefore(to))
                    .filter(this::isInAnyZone)
                    .count();
            int percent = toPercent(count, totalCapacity);
            boolean current = !now.isBefore(from) && now.isBefore(to);
            result.add(new AnalyticsTrendPointDto(
                    String.format("%02d\uC2DC", hour),
                    from.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm")),
                    to.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm")),
                    percent,
                    count,
                    current
            ));
        }

        return result;
    }

    private AnalyticsRecommendationDto recommendLowCrowdTime(List<AnalyticsTrendPointDto> trend) {
        long measuredCount = trend.stream().mapToLong(AnalyticsTrendPointDto::count).sum();
        if (measuredCount == 0) {
            return new AnalyticsRecommendationDto(null, null, 0, "NO_DATA");
        }

        AnalyticsTrendPointDto best = trend.stream()
                .min(Comparator
                        .comparingInt(AnalyticsTrendPointDto::percent)
                        .thenComparing(AnalyticsTrendPointDto::startTime))
                .orElse(null);

        if (best == null) {
            return new AnalyticsRecommendationDto(null, null, 0, "NO_DATA");
        }

        LocalTime start = LocalTime.parse(best.startTime());
        LocalTime end = start.plusHours(1);
        return new AnalyticsRecommendationDto(
                start.format(DateTimeFormatter.ofPattern("HH:mm")),
                end.format(DateTimeFormatter.ofPattern("HH:mm")),
                best.percent(),
                "LOWEST_TODAY"
        );
    }

    private int countInZone(List<GpsLog> logs, CrowdZone zone) {
        return (int) logs.stream()
                .filter(log -> distanceInMeters(zone.latitude(), zone.longitude(), log.getLatitude(), log.getLongitude()) <= zone.radiusMeters())
                .count();
    }

    private int countInAnyZone(List<GpsLog> logs) {
        return (int) logs.stream()
                .filter(this::isInAnyZone)
                .count();
    }

    private boolean isInAnyZone(GpsLog log) {
        return CROWD_ZONES.stream()
                .anyMatch(zone -> distanceInMeters(zone.latitude(), zone.longitude(), log.getLatitude(), log.getLongitude()) <= zone.radiusMeters());
    }

    private int toPercent(long count, int capacityHint) {
        if (capacityHint <= 0 || count <= 0) {
            return 0;
        }
        return Math.min(100, Math.max(0, (int) Math.round((count * 100.0) / capacityHint)));
    }

    private String levelForPercent(int percent) {
        if (percent < 35) {
            return "LOW";
        }
        if (percent < 65) {
            return "NORMAL";
        }
        if (percent < 85) {
            return "BUSY";
        }
        return "PACKED";
    }

    private String resolveLevel(int count, int capacityHint) {
        double ratio = capacityHint <= 0 ? 0.0 : (double) count / capacityHint;
        if (ratio < 0.35) {
            return "\uC5EC\uC720";
        }
        if (ratio < 0.65) {
            return "\uBCF4\uD1B5";
        }
        if (ratio < 0.9) {
            return "\uD63C\uC7A1";
        }
        return "\uB9E4\uC6B0 \uD63C\uC7A1";
    }

    private double distanceInMeters(double lat1, double lon1, double lat2, double lon2) {
        double earthRadius = 6_371_000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadius * c;
    }
}
