package com.festflow.backend.service;

import com.festflow.backend.dto.AiBoothRecommendationDto;
import com.festflow.backend.dto.AiFestivalGuideDto;
import com.festflow.backend.dto.AiModelPredictionDto;
import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.CongestionResponseDto;
import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.entity.ReservationStatus;
import com.festflow.backend.repository.BoothReservationRepository;
import com.festflow.backend.repository.GpsLogRepository;
import com.festflow.backend.service.FestivalSnapshotService.FestivalSnapshot;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiCongestionService {

    private final FestivalSnapshotService snapshotService;
    private final AiDecisionLogService decisionLogService;
    private final PythonCongestionModelService pythonCongestionModelService;
    private final GpsLogRepository gpsLogRepository;
    private final BoothReservationRepository boothReservationRepository;

    public AiCongestionService(
            FestivalSnapshotService snapshotService,
            AiDecisionLogService decisionLogService,
            PythonCongestionModelService pythonCongestionModelService,
            GpsLogRepository gpsLogRepository,
            BoothReservationRepository boothReservationRepository
    ) {
        this.snapshotService = snapshotService;
        this.decisionLogService = decisionLogService;
        this.pythonCongestionModelService = pythonCongestionModelService;
        this.gpsLogRepository = gpsLogRepository;
        this.boothReservationRepository = boothReservationRepository;
    }

    public AiFestivalGuideDto guide() {
        FestivalSnapshot snapshot = snapshotService.current();
        List<AiBoothRecommendationDto> insights = analyze(snapshot);

        List<AiBoothRecommendationDto> recommendedNow = insights.stream()
                .filter(this::isVisitorDestination)
                .filter(AiBoothRecommendationDto::recommendedNow)
                .sorted(Comparator
                        .comparingInt(AiBoothRecommendationDto::riskScore)
                        .thenComparing(dto -> value(dto.waitMinutes())))
                .limit(3)
                .toList();

        List<AiBoothRecommendationDto> avoidNow = insights.stream()
                .filter(dto -> dto.riskScore() >= 60)
                .sorted(Comparator.comparingInt(AiBoothRecommendationDto::riskScore).reversed())
                .limit(3)
                .toList();

        List<AiBoothRecommendationDto> recommendedLater = insights.stream()
                .filter(this::isVisitorDestination)
                .filter(dto -> dto.riskScore() < 70)
                .sorted(Comparator
                        .comparing((AiBoothRecommendationDto dto) -> modelLevelRank(dto.predictedLevel()))
                        .thenComparingInt(AiBoothRecommendationDto::riskScore))
                .limit(3)
                .toList();

        AiFestivalGuideDto guide = new AiFestivalGuideDto(
                snapshot.capturedAt(),
                headline(insights, recommendedNow, avoidNow),
                summary(insights, recommendedNow, avoidNow),
                recommendedNow,
                avoidNow,
                recommendedLater,
                userActions(recommendedNow, avoidNow, snapshot),
                operatorAlerts(insights, snapshot)
        );
        recordGuideDecision(guide);
        return guide;
    }

    public List<AiBoothRecommendationDto> analyzeCurrent() {
        return analyze(snapshotService.current());
    }

    private List<AiBoothRecommendationDto> analyze(FestivalSnapshot snapshot) {
        boolean eventSoon = hasEventStartingSoon(snapshot.events(), snapshot.capturedAt());
        Map<Long, AiModelPredictionDto> modelPredictions = modelPredictions(snapshot, eventSoon);
        return snapshot.booths().stream()
                .map(booth -> analyzeBooth(snapshot, booth, eventSoon, modelPredictions.get(booth.id())))
                .sorted(Comparator.comparingInt(AiBoothRecommendationDto::riskScore).reversed())
                .toList();
    }

    private void recordGuideDecision(AiFestivalGuideDto guide) {
        List<String> reasons = guide.recommendedNow().stream()
                .limit(3)
                .flatMap(dto -> dto.reasons().stream().limit(2))
                .toList();
        decisionLogService.record(
                "FESTIVAL_GUIDE",
                guide.headline(),
                guide.summary(),
                reasons,
                guide.operatorAlerts().stream().limit(3).toList()
        );
    }

    private AiBoothRecommendationDto analyzeBooth(
            FestivalSnapshot snapshot,
            BoothResponseDto booth,
            boolean eventSoon,
            AiModelPredictionDto modelPrediction
    ) {
        CongestionResponseDto congestion = snapshot.congestionByBoothId().get(booth.id());
        int crowdCount = congestion == null ? 0 : congestion.nearbyUserCount();
        long activeReservations = snapshot.activeReservationCount(booth.id());
        long checkedInReservations = snapshot.reservationCount(booth.id(), ReservationStatus.CHECKED_IN);
        int tableCount = value(booth.reservationTableCount());
        int availableSeats = value(booth.reservationAvailableSeats());
        int waitMinutes = value(booth.estimatedWaitMinutes());
        int remainingStock = booth.remainingStock() == null ? 99 : Math.max(0, booth.remainingStock());

        int riskScore = 0;
        riskScore += Math.min(30, crowdCount * 5);
        riskScore += Math.min(20, waitMinutes / 2);
        riskScore += Math.min(20, (int) activeReservations * 5);
        if (tableCount > 0) {
            riskScore += Math.min(15, (int) Math.round((activeReservations * 15.0) / tableCount));
        }
        if (availableSeats <= 0 && Boolean.TRUE.equals(booth.reservationEnabled())) {
            riskScore += 12;
        } else if (availableSeats <= 3 && Boolean.TRUE.equals(booth.reservationEnabled())) {
            riskScore += 8;
        } else if (availableSeats >= 10) {
            riskScore -= 5;
        }
        if (remainingStock <= 0) {
            riskScore += 15;
        } else if (remainingStock <= 10) {
            riskScore += 8;
        }
        if (eventSoon) {
            riskScore += 6;
        }
        riskScore = Math.max(0, Math.min(100, riskScore));

        int predictedScore = Math.min(100, riskScore + (eventSoon ? 8 : 0) + (activeReservations >= 2 ? 5 : 0));
        String fallbackPredictedLevel = displayPredictedLevel(predictedScore);
        TemporalFeatures temporal = temporalFeatures(snapshot, booth, eventSoon);
        List<String> modelFactors = modelFactors(booth, crowdCount, activeReservations, checkedInReservations, availableSeats, waitMinutes, remainingStock, eventSoon, temporal);
        AiModelPredictionDto aiModel = modelPrediction != null
                ? modelPrediction
                : AiModelPredictionDto.fallback(fallbackPredictedLevel, modelFactors, "MODEL_UNAVAILABLE");
        String finalPredictedLevel = aiModel.displayPredictedLevel() == null ? fallbackPredictedLevel : aiModel.displayPredictedLevel();
        boolean recommendedNow = riskScore <= 45
                && waitMinutes <= 15
                && remainingStock > 0
                && (!Boolean.TRUE.equals(booth.reservationEnabled()) || availableSeats > 0);

        return new AiBoothRecommendationDto(
                booth.id(),
                booth.name(),
                booth.category(),
                congestion == null ? "UNKNOWN" : congestion.level(),
                finalPredictedLevel,
                riskLevel(riskScore),
                riskScore,
                crowdCount,
                (int) activeReservations,
                (int) checkedInReservations,
                booth.reservationAvailableSeats(),
                booth.estimatedWaitMinutes(),
                booth.remainingStock(),
                recommendedNow,
                reasons(booth, crowdCount, activeReservations, checkedInReservations, availableSeats, waitMinutes, remainingStock, eventSoon, riskScore),
                aiModel
        );
    }

    private Map<Long, AiModelPredictionDto> modelPredictions(FestivalSnapshot snapshot, boolean eventSoon) {
        List<PythonCongestionModelService.ModelPredictionRequest> requests = snapshot.booths().stream()
                .map(booth -> {
                    CongestionResponseDto congestion = snapshot.congestionByBoothId().get(booth.id());
                    int crowdCount = congestion == null ? 0 : congestion.nearbyUserCount();
                    long activeReservations = snapshot.activeReservationCount(booth.id());
                    long checkedInReservations = snapshot.reservationCount(booth.id(), ReservationStatus.CHECKED_IN);
                    int availableSeats = value(booth.reservationAvailableSeats());
                    int waitMinutes = value(booth.estimatedWaitMinutes());
                    int remainingStock = booth.remainingStock() == null ? 99 : Math.max(0, booth.remainingStock());
                    TemporalFeatures temporal = temporalFeatures(snapshot, booth, eventSoon);
                    List<String> factors = modelFactors(booth, crowdCount, activeReservations, checkedInReservations, availableSeats, waitMinutes, remainingStock, eventSoon, temporal);
                    return new PythonCongestionModelService.ModelPredictionRequest(
                            booth.id(),
                            modelFeatures(snapshot, booth, crowdCount, activeReservations, checkedInReservations, availableSeats, waitMinutes, remainingStock, eventSoon, temporal),
                            factors
                    );
                })
                .toList();
        return pythonCongestionModelService.predictBatch(requests);
    }

    private TemporalFeatures temporalFeatures(FestivalSnapshot snapshot, BoothResponseDto booth, boolean eventSoon) {
        LocalDateTime now = snapshot.capturedAt();
        int currentGps5m = gpsNearbyBetween(booth, now.minusMinutes(5), now);
        int previousGps5m = gpsNearbyBetween(booth, now.minusMinutes(10), now.minusMinutes(5));
        int currentGps15m = gpsNearbyBetween(booth, now.minusMinutes(15), now);
        int previousGps15m = gpsNearbyBetween(booth, now.minusMinutes(30), now.minusMinutes(15));
        int reservationDelta15m = (int) boothReservationRepository.countByBoothIdAndReservedAtBetween(
                booth.id(),
                now.minusMinutes(15),
                now
        );
        int checkedInDelta15m = (int) boothReservationRepository.countByBoothIdAndCheckedInAtBetween(
                booth.id(),
                now.minusMinutes(15),
                now
        );
        int waitDelta15m = (int) Math.round(
                ((currentGps15m - previousGps15m) * 0.2)
                        + (reservationDelta15m * 0.9)
                        + (eventSoon ? 5 : 0)
        );
        return new TemporalFeatures(
                currentGps5m - previousGps5m,
                currentGps15m - previousGps15m,
                reservationDelta15m,
                checkedInDelta15m,
                waitDelta15m
        );
    }

    private int gpsNearbyBetween(BoothResponseDto booth, LocalDateTime from, LocalDateTime to) {
        return (int) gpsLogRepository.findByCreatedAtAfter(from).stream()
                .filter(log -> log.getCreatedAt() != null && !log.getCreatedAt().isBefore(from) && log.getCreatedAt().isBefore(to))
                .filter(log -> distanceInMeters(booth.latitude(), booth.longitude(), log.getLatitude(), log.getLongitude()) <= 80.0)
                .count();
    }

    private Map<String, Object> modelFeatures(
            FestivalSnapshot snapshot,
            BoothResponseDto booth,
            int crowdCount,
            long activeReservations,
            long checkedInReservations,
            int availableSeats,
            int waitMinutes,
            int remainingStock,
            boolean eventSoon,
            TemporalFeatures temporal
    ) {
        int hour = snapshot.capturedAt().getHour();
        int stageCapacity = 4000;
        String artistPopularity = artistPopularity(snapshot.events(), snapshot.capturedAt(), eventSoon);
        int expectedStageCrowd = expectedStageCrowd(hour, artistPopularity, eventSoon);

        Map<String, Object> features = new HashMap<>();
        features.put("scenario_day", snapshot.capturedAt().getDayOfYear());
        features.put("hour", hour);
        features.put("is_peak_time", isPeakTime(hour) ? 1 : 0);
        features.put("artist_popularity_score", popularityScore(artistPopularity));
        features.put("stage_capacity", stageCapacity);
        features.put("expected_stage_crowd", expectedStageCrowd);
        features.put("stage_load_ratio", Math.round((expectedStageCrowd / (double) stageCapacity) * 1000.0) / 1000.0);
        features.put("is_night_booth", isNightBooth(booth, hour) ? 1 : 0);
        features.put("event_soon", eventSoon ? 1 : 0);
        features.put("minutes_to_next_event", minutesToNextEvent(snapshot.events(), snapshot.capturedAt()));
        features.put("gps_count_nearby", crowdCount);
        features.put("gps_delta_5m", temporal.gpsDelta5m());
        features.put("gps_delta_15m", temporal.gpsDelta15m());
        features.put("reservation_count", (int) activeReservations);
        features.put("reservation_delta_15m", temporal.reservationDelta15m());
        features.put("checked_in_count", (int) checkedInReservations);
        features.put("checked_in_delta_15m", temporal.checkedInDelta15m());
        features.put("available_seats", availableSeats);
        features.put("wait_minutes", waitMinutes);
        features.put("wait_delta_15m", temporal.waitDelta15m());
        features.put("remaining_stock", remainingStock);
        features.put("event_count_context", snapshot.events().size());
        features.put("zone_type", zoneType(booth));
        features.put("artist_popularity", artistPopularity);
        return features;
    }

    private List<String> modelFactors(
            BoothResponseDto booth,
            int crowdCount,
            long activeReservations,
            long checkedInReservations,
            int availableSeats,
            int waitMinutes,
            int remainingStock,
            boolean eventSoon,
            TemporalFeatures temporal
    ) {
        List<String> factors = new ArrayList<>();
        factors.add("GPS 추정 인원 " + crowdCount + "명");
        factors.add("대기 시간 " + waitMinutes + "분");
        factors.add("GPS 변화량 5분 " + signed(temporal.gpsDelta5m()) + " / 15분 " + signed(temporal.gpsDelta15m()));
        factors.add("예약 증가 15분 +" + temporal.reservationDelta15m() + "건 / 체크인 증가 +" + temporal.checkedInDelta15m() + "건");
        factors.add("추정 대기 변화 15분 " + signed(temporal.waitDelta15m()) + "분");
        if (Boolean.TRUE.equals(booth.reservationEnabled())) {
            factors.add("예약 " + activeReservations + "건 / 체크인 " + checkedInReservations + "건");
            factors.add("예약 가능 좌석 " + availableSeats + "석");
        }
        if (eventSoon) {
            factors.add("30분 내 공연 시작");
        }
        if (remainingStock <= 10) {
            factors.add(remainingStock <= 0 ? "재고 소진" : "재고 10개 이하");
        }
        factors.add("구역 유형 " + zoneType(booth));
        return factors;
    }

    private List<String> reasons(
            BoothResponseDto booth,
            int crowdCount,
            long activeReservations,
            long checkedInReservations,
            int availableSeats,
            int waitMinutes,
            int remainingStock,
            boolean eventSoon,
            int riskScore
    ) {
        List<String> reasons = new ArrayList<>();
        reasons.add("현재 주변 감지 인원 " + crowdCount + "명");
        if (waitMinutes > 0) {
            reasons.add("운영자가 입력한 예상 대기 " + waitMinutes + "분");
        }
        if (Boolean.TRUE.equals(booth.reservationEnabled())) {
            reasons.add("활성 예약 " + activeReservations + "건, 체크인 " + checkedInReservations + "건");
            reasons.add("예약 가능 좌석 " + availableSeats + "석");
        }
        if (remainingStock <= 10) {
            reasons.add(remainingStock <= 0 ? "재고 소진 상태" : "재고 10개 이하");
        }
        if (eventSoon) {
            reasons.add("30분 내 공연 시작 영향 반영");
        }
        if (riskScore <= 45) {
            reasons.add("AI 판단: 지금 방문 부담이 낮음");
        } else if (riskScore >= 75) {
            reasons.add("AI 판단: 혼잡 위험이 높아 우회 권장");
        } else {
            reasons.add("AI 판단: 상황 확인 후 방문 권장");
        }
        return reasons;
    }

    private boolean hasEventStartingSoon(List<EventResponseDto> events, LocalDateTime now) {
        return events.stream()
                .map(EventResponseDto::startTime)
                .filter(startTime -> startTime != null && !startTime.isBefore(now.minusMinutes(5)))
                .anyMatch(startTime -> Duration.between(now, startTime).toMinutes() <= 30);
    }

    private String headline(
            List<AiBoothRecommendationDto> insights,
            List<AiBoothRecommendationDto> recommendedNow,
            List<AiBoothRecommendationDto> avoidNow
    ) {
        if (!avoidNow.isEmpty()) {
            return avoidNow.get(0).boothName() + " 주변 혼잡 위험이 높습니다.";
        }
        if (!recommendedNow.isEmpty()) {
            return recommendedNow.get(0).boothName() + " 방문을 먼저 추천합니다.";
        }
        if (insights.isEmpty()) {
            return "AI가 축제 데이터를 수집하는 중입니다.";
        }
        return "현재 축제 상황은 안정적으로 보입니다.";
    }

    private boolean isVisitorDestination(AiBoothRecommendationDto dto) {
        String category = dto.category() == null ? "" : dto.category();
        if (category.contains("응급")
                || category.contains("안내")
                || category.contains("편의")
                || category.contains("상담")
                || category.contains("의무실")
                || category.contains("쉼터")
                || category.contains("휴식")
                || category.contains("분실물")) {
            return false;
        }
        return dto.waitMinutes() != null && dto.waitMinutes() > 0
                || dto.availableSeats() != null && dto.availableSeats() > 0
                || category.contains("주점")
                || category.contains("푸드")
                || category.contains("체험")
                || category.contains("이벤트")
                || category.contains("공연")
                || category.contains("굿즈")
                || category.contains("음식");
    }

    private String summary(
            List<AiBoothRecommendationDto> insights,
            List<AiBoothRecommendationDto> recommendedNow,
            List<AiBoothRecommendationDto> avoidNow
    ) {
        if (insights.isEmpty()) {
            return "부스 데이터가 아직 없어 AI 추천을 만들 수 없습니다.";
        }
        String best = recommendedNow.isEmpty() ? "추천 후보 없음" : recommendedNow.get(0).boothName();
        String risky = avoidNow.isEmpty() ? "즉시 우회가 필요한 부스 없음" : avoidNow.get(0).boothName();
        return "AI가 혼잡도, 예약, 체크인, 대기시간, 재고, 공연 임박도를 종합했습니다. 지금 추천: "
                + best + " / 주의: " + risky;
    }

    private List<String> userActions(
            List<AiBoothRecommendationDto> recommendedNow,
            List<AiBoothRecommendationDto> avoidNow,
            FestivalSnapshot snapshot
    ) {
        List<String> actions = new ArrayList<>();
        if (!recommendedNow.isEmpty()) {
            AiBoothRecommendationDto best = recommendedNow.get(0);
            actions.add(best.boothName() + "를 먼저 확인하세요. " + String.join(", ", best.reasons().stream().limit(2).toList()));
        }
        if (!avoidNow.isEmpty()) {
            actions.add(avoidNow.get(0).boothName() + " 주변은 혼잡 위험이 높아 우회 동선을 추천합니다.");
        }
        snapshot.events().stream()
                .filter(event -> event.startTime() != null)
                .filter(event -> !event.startTime().isBefore(snapshot.capturedAt()))
                .min(Comparator.comparing(EventResponseDto::startTime))
                .ifPresent(event -> actions.add("다음 공연 전에는 이동 시간을 여유 있게 잡으세요: " + event.title()));
        if (actions.isEmpty()) {
            actions.add("지도에서 가까운 부스를 확인하고 대기시간이 짧은 곳부터 방문하세요.");
        }
        return actions;
    }

    private List<String> operatorAlerts(List<AiBoothRecommendationDto> insights, FestivalSnapshot snapshot) {
        List<String> alerts = new ArrayList<>();
        insights.stream()
                .filter(dto -> dto.riskScore() >= 75)
                .limit(3)
                .forEach(dto -> alerts.add(dto.boothName() + " 혼잡 위험 " + dto.riskScore() + "점: 우회 공지 또는 대기열 정리가 필요합니다."));
        insights.stream()
                .filter(dto -> dto.remainingStock() != null && dto.remainingStock() <= 10)
                .limit(2)
                .forEach(dto -> alerts.add(dto.boothName() + " 재고 부족 가능성: 운영자 확인이 필요합니다."));
        long urgentStaff = snapshot.staff().stream()
                .filter(staff -> "URGENT".equals(staff.status()))
                .count();
        if (urgentStaff > 0) {
            alerts.add("긴급 상태 스태프 " + urgentStaff + "명: 위치와 메모를 우선 확인하세요.");
        }
        if (alerts.isEmpty()) {
            alerts.add("즉시 조치가 필요한 AI 경보는 없습니다.");
        }
        return alerts;
    }

    private boolean isPeakTime(int hour) {
        return hour >= 18 && hour <= 22;
    }

    private boolean isNightBooth(BoothResponseDto booth, int hour) {
        String text = normalize(booth.category() + " " + booth.dayPart() + " " + booth.name() + " " + booth.tags());
        return hour >= 18 && (text.contains("주점")
                || text.contains("야간")
                || text.contains("푸드")
                || text.contains("food")
                || text.contains("pub")
                || text.contains("bar"));
    }

    private String zoneType(BoothResponseDto booth) {
        String text = normalize(booth.category() + " " + booth.name() + " " + booth.tags());
        if (text.contains("공연") || text.contains("무대") || text.contains("stage")) {
            return "STAGE";
        }
        if (text.contains("주점") || text.contains("pub") || text.contains("bar")) {
            return "PUB";
        }
        if (text.contains("푸드") || text.contains("음식") || text.contains("food") || text.contains("카페") || text.contains("디저트")) {
            return "FOOD";
        }
        if (text.contains("체험") || text.contains("이벤트") || text.contains("experience")) {
            return "EXPERIENCE";
        }
        if (text.contains("굿즈") || text.contains("goods")) {
            return "GOODS";
        }
        return "SAFETY";
    }

    private String artistPopularity(List<EventResponseDto> events, LocalDateTime now, boolean eventSoon) {
        int hour = now.getHour();
        if (eventSoon && isPeakTime(hour)) {
            return "HIGH";
        }
        boolean hasCurrentOrSoonEvent = events.stream()
                .filter(event -> event.startTime() != null)
                .anyMatch(event -> {
                    long minutes = Duration.between(now, event.startTime()).toMinutes();
                    return minutes >= -30 && minutes <= 60;
                });
        if (hasCurrentOrSoonEvent && isPeakTime(hour)) {
            return "MEDIUM";
        }
        return isPeakTime(hour) ? "MEDIUM" : "LOW";
    }

    private int popularityScore(String popularity) {
        return switch (popularity) {
            case "HIGH" -> 3;
            case "MEDIUM" -> 2;
            default -> 1;
        };
    }

    private int expectedStageCrowd(int hour, String artistPopularity, boolean eventSoon) {
        if (!isPeakTime(hour)) {
            return eventSoon ? 1100 : 450;
        }
        return switch (artistPopularity) {
            case "HIGH" -> 3800;
            case "MEDIUM" -> 2500;
            default -> 900;
        };
    }

    private int minutesToNextEvent(List<EventResponseDto> events, LocalDateTime now) {
        return events.stream()
                .map(EventResponseDto::startTime)
                .filter(startTime -> startTime != null && !startTime.isBefore(now.minusMinutes(5)))
                .mapToInt(startTime -> (int) Math.max(0, Duration.between(now, startTime).toMinutes()))
                .min()
                .orElse(180);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private String signed(int value) {
        return value >= 0 ? "+" + value : String.valueOf(value);
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

    private String displayPredictedLevel(int score) {
        if (score >= 75) return "매우 혼잡";
        if (score >= 55) return "혼잡";
        if (score >= 30) return "보통";
        return "여유";
    }

    private int modelLevelRank(String level) {
        String normalized = normalize(level);
        if (normalized.contains("low") || normalized.contains("여유")) return 0;
        if (normalized.contains("normal") || normalized.contains("보통")) return 1;
        if (normalized.contains("very_busy") || normalized.contains("매우")) return 3;
        if (normalized.contains("busy") || normalized.contains("혼잡")) return 2;
        return 4;
    }

    private String riskLevel(int score) {
        if (score >= 75) return "RISK";
        if (score >= 55) return "BUSY";
        if (score >= 30) return "NORMAL";
        return "LOW";
    }

    private String predictedLevel(int score) {
        if (score >= 75) return "매우 혼잡";
        if (score >= 55) return "혼잡";
        if (score >= 30) return "보통";
        return "여유";
    }

    private int levelRank(String level) {
        return switch (level) {
            case "여유" -> 0;
            case "보통" -> 1;
            case "혼잡" -> 2;
            case "매우 혼잡" -> 3;
            default -> 4;
        };
    }

    private int value(Integer value) {
        return value == null ? 0 : Math.max(0, value);
    }

    private record TemporalFeatures(
            int gpsDelta5m,
            int gpsDelta15m,
            int reservationDelta15m,
            int checkedInDelta15m,
            int waitDelta15m
    ) {
    }
}
