package com.festflow.backend.service;

import com.festflow.backend.dto.BoothLiveStatusRequestDto;
import com.festflow.backend.dto.BoothReorderRequestDto;
import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.BoothUpsertRequestDto;
import com.festflow.backend.dto.CongestionResponseDto;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.BoothReservation;
import com.festflow.backend.entity.BoothReservationTable;
import com.festflow.backend.entity.GpsLog;
import com.festflow.backend.entity.ReservationStatus;
import com.festflow.backend.repository.BoothOrderRepository;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.repository.BoothReservationRepository;
import com.festflow.backend.repository.BoothReservationTableRepository;
import com.festflow.backend.repository.GpsLogRepository;
import com.festflow.backend.repository.ReservationCheckInTokenRepository;
import com.festflow.backend.repository.StaffMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class BoothService {

    private static final double BOOTH_RADIUS_METERS = 80.0;
    private static final List<ReservationStatus> BLOCKING_RESERVATION_STATUSES = List.of(
            ReservationStatus.RESERVED,
            ReservationStatus.CHECKED_IN
    );

    private final BoothRepository boothRepository;
    private final GpsLogRepository gpsLogRepository;
    private final BoothReservationTableRepository boothReservationTableRepository;
    private final BoothReservationRepository boothReservationRepository;
    private final SimulationStateService simulationStateService;
    private final BoothOrderRepository boothOrderRepository;
    private final ReservationCheckInTokenRepository checkInTokenRepository;
    private final StaffMemberRepository staffMemberRepository;

    public BoothService(
            BoothRepository boothRepository,
            GpsLogRepository gpsLogRepository,
            BoothReservationTableRepository boothReservationTableRepository,
            BoothReservationRepository boothReservationRepository,
            SimulationStateService simulationStateService,
            BoothOrderRepository boothOrderRepository,
            ReservationCheckInTokenRepository checkInTokenRepository,
            StaffMemberRepository staffMemberRepository
    ) {
        this.boothRepository = boothRepository;
        this.gpsLogRepository = gpsLogRepository;
        this.boothReservationTableRepository = boothReservationTableRepository;
        this.boothReservationRepository = boothReservationRepository;
        this.simulationStateService = simulationStateService;
        this.boothOrderRepository = boothOrderRepository;
        this.checkInTokenRepository = checkInTokenRepository;
        this.staffMemberRepository = staffMemberRepository;
    }

    // 손님 화면이 부르는 목록은 아주 잠깐(1초) 같은 결과를 돌려 쓴다. 수천 명이 한꺼번에 열어도 DB 는 1초에 한 번만 읽는다.
    private static final long PUBLIC_LIST_TTL_MILLIS = 1_000;
    private volatile CachedBooths publicListCache;

    /** 손님용 목록. 최대 1초 묵은 값일 수 있다. 바꾼 직후의 값이 필요하면 {@link #getAllBooths()}. */
    public List<BoothResponseDto> getAllBoothsForVisitors() {
        long now = System.currentTimeMillis();
        CachedBooths cached = publicListCache;
        if (cached != null && now - cached.loadedAtMillis() < PUBLIC_LIST_TTL_MILLIS) {
            return cached.booths();
        }
        List<BoothResponseDto> booths = getAllBooths();
        publicListCache = new CachedBooths(booths, now);
        return booths;
    }

    /** 부스마다 테이블 · 예약을 따로 읽지 않고, 세 번의 조회로 전체를 만든다. */
    public List<BoothResponseDto> getAllBooths() {
        Map<Long, List<BoothReservationTable>> tablesByBooth = boothReservationTableRepository.findAll().stream()
                .collect(Collectors.groupingBy(table -> table.getBooth().getId()));
        Map<Long, List<BoothReservation>> reservationsByBooth = boothReservationRepository
                .findByStatusIn(BLOCKING_RESERVATION_STATUSES).stream()
                .collect(Collectors.groupingBy(reservation -> reservation.getBooth().getId()));
        return boothRepository.findAll().stream()
                .sorted(Comparator.comparing(Booth::getDisplayOrder).thenComparing(Booth::getId))
                .map(booth -> toDto(booth, summarize(
                        tablesByBooth.getOrDefault(booth.getId(), List.of()),
                        reservationsByBooth.getOrDefault(booth.getId(), List.of())
                )))
                .toList();
    }

    public BoothResponseDto getBoothById(Long boothId) {
        Booth booth = boothRepository.findById(boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다."));

        return toDto(booth);
    }

    public BoothResponseDto createBooth(BoothUpsertRequestDto requestDto) {
        int nextOrder = requestDto.displayOrder() != null
                ? requestDto.displayOrder()
                : boothRepository.findTopByOrderByDisplayOrderDesc().map(Booth::getDisplayOrder).orElse(0) + 1;

        // save() 뒤에 setter 를 부르면 트랜잭션이 없어 저장되지 않는다(메뉴판·운영 시간이 비던 원인).
        // 값을 다 채운 뒤 한 번만 저장한다.
        Booth booth = new Booth(
                requestDto.name(),
                requestDto.latitude(),
                requestDto.longitude(),
                requestDto.description(),
                nextOrder,
                requestDto.imageUrl() != null ? requestDto.imageUrl() : "https://picsum.photos/seed/festflow-default/800/450",
                requestDto.estimatedWaitMinutes(),
                requestDto.remainingStock(),
                requestDto.liveStatusMessage(),
                LocalDateTime.now()
        );
        booth.setBoothIntro(requestDto.boothIntro());
        booth.setMenuImageUrl(requestDto.menuImageUrl());
        booth.setMenuBoardJson(requestDto.menuBoardJson());
        booth.updateContentInfo(
                requestDto.category(),
                requestDto.dayPart(),
                requestDto.openTime(),
                requestDto.closeTime(),
                requestDto.tags(),
                requestDto.contentJson(),
                requestDto.reservationEnabled()
        );
        Booth saved = boothRepository.save(booth);
        return toDto(saved);
    }

    public BoothResponseDto updateBooth(Long boothId, BoothUpsertRequestDto requestDto) {
        Booth booth = boothRepository.findById(boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다."));

        booth.update(
                requestDto.name(),
                requestDto.latitude(),
                requestDto.longitude(),
                requestDto.description(),
                requestDto.displayOrder() != null ? requestDto.displayOrder() : booth.getDisplayOrder(),
                requestDto.imageUrl() != null ? requestDto.imageUrl() : booth.getImageUrl(),
                requestDto.estimatedWaitMinutes() != null ? requestDto.estimatedWaitMinutes() : booth.getEstimatedWaitMinutes(),
                requestDto.remainingStock() != null ? requestDto.remainingStock() : booth.getRemainingStock(),
                requestDto.liveStatusMessage() != null ? requestDto.liveStatusMessage() : booth.getLiveStatusMessage(),
                LocalDateTime.now()
        );
        booth.setBoothIntro(requestDto.boothIntro() != null ? requestDto.boothIntro() : booth.getBoothIntro());
        booth.setMenuImageUrl(requestDto.menuImageUrl() != null ? requestDto.menuImageUrl() : booth.getMenuImageUrl());
        booth.setMenuBoardJson(requestDto.menuBoardJson() != null ? requestDto.menuBoardJson() : booth.getMenuBoardJson());
        booth.updateContentInfo(
                requestDto.category() != null ? requestDto.category() : booth.getCategory(),
                requestDto.dayPart() != null ? requestDto.dayPart() : booth.getDayPart(),
                requestDto.openTime() != null ? requestDto.openTime() : booth.getOpenTime(),
                requestDto.closeTime() != null ? requestDto.closeTime() : booth.getCloseTime(),
                requestDto.tags() != null ? requestDto.tags() : booth.getTags(),
                requestDto.contentJson() != null ? requestDto.contentJson() : booth.getContentJson(),
                requestDto.reservationEnabled() != null ? requestDto.reservationEnabled() : booth.getReservationEnabled()
        );

        return toDto(boothRepository.save(booth));
    }

    public BoothResponseDto updateBoothImage(Long boothId, String imageUrl) {
        Booth booth = boothRepository.findById(boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다."));
        booth.setImageUrl(imageUrl);
        return toDto(boothRepository.save(booth));
    }
    public BoothResponseDto updateBoothMenuImage(Long boothId, String imageUrl) {
        Booth booth = boothRepository.findById(boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다."));
        booth.setMenuImageUrl(imageUrl);
        return toDto(boothRepository.save(booth));
    }
    public BoothResponseDto updateLiveStatus(Long boothId, BoothLiveStatusRequestDto requestDto) {
        Booth booth = boothRepository.findById(boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다."));

        booth.setEstimatedWaitMinutes(requestDto.estimatedWaitMinutes());
        booth.setRemainingStock(requestDto.remainingStock());
        booth.setLiveStatusMessage(requestDto.liveStatusMessage());
        booth.setBoothIntro(requestDto.boothIntro() != null ? requestDto.boothIntro() : booth.getBoothIntro());
        booth.setMenuImageUrl(requestDto.menuImageUrl() != null ? requestDto.menuImageUrl() : booth.getMenuImageUrl());
        booth.setMenuBoardJson(requestDto.menuBoardJson() != null ? requestDto.menuBoardJson() : booth.getMenuBoardJson());
        booth.updateContentInfo(
                requestDto.category() != null ? requestDto.category() : booth.getCategory(),
                requestDto.dayPart() != null ? requestDto.dayPart() : booth.getDayPart(),
                requestDto.openTime() != null ? requestDto.openTime() : booth.getOpenTime(),
                requestDto.closeTime() != null ? requestDto.closeTime() : booth.getCloseTime(),
                requestDto.tags() != null ? requestDto.tags() : booth.getTags(),
                requestDto.contentJson() != null ? requestDto.contentJson() : booth.getContentJson(),
                requestDto.reservationEnabled() != null ? requestDto.reservationEnabled() : booth.getReservationEnabled()
        );
        booth.setLiveStatusUpdatedAt(LocalDateTime.now());

        return toDto(boothRepository.save(booth));
    }

    public void reorderBooths(BoothReorderRequestDto requestDto) {
        int order = 1;
        for (Long id : requestDto.boothIds()) {
            Booth booth = boothRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다: " + id));
            booth.setDisplayOrder(order++);
            boothRepository.save(booth);
        }
    }

    // 부스에 딸린 테이블·예약·주문이 외래키로 묶여 있어서 부스만 지우면 실패한다. 딸린 것부터 지우고 부스를 지운다.
    @Transactional
    public void deleteBooth(Long boothId) {
        if (!boothRepository.existsById(boothId)) {
            throw new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다.");
        }
        List<BoothReservation> reservations = boothReservationRepository.findByBoothId(boothId);
        if (!reservations.isEmpty()) {
            checkInTokenRepository.deleteAll(
                    checkInTokenRepository.findByReservationIdIn(reservations.stream().map(BoothReservation::getId).toList())
            );
            boothReservationRepository.deleteAll(reservations);
        }
        boothOrderRepository.deleteAll(boothOrderRepository.findByBoothId(boothId));
        boothReservationTableRepository.deleteAll(boothReservationTableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(boothId));
        staffMemberRepository.findByAssignedBoothId(boothId).forEach(staff -> staff.setAssignedBoothId(null));
        boothRepository.flush();
        boothRepository.deleteById(boothId);
    }

    public CongestionResponseDto getCongestionByBoothId(Long boothId) {
        Booth booth = boothRepository.findById(boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다."));

        var simulated = simulationStateService.simulatedCongestion(booth.getId(), booth.getName());
        if (simulated.isPresent()) {
            return simulated.get();
        }

        LocalDateTime threshold = LocalDateTime.now().minusMinutes(15);
        List<GpsLog> recentLogs = gpsLogRepository.findByCreatedAtAfter(threshold);

        LocalDateTime now = LocalDateTime.now();
        double weightedScore = recentLogs.stream()
                .filter(log -> distanceInMeters(booth.getLatitude(), booth.getLongitude(), log.getLatitude(), log.getLongitude()) <= BOOTH_RADIUS_METERS)
                .mapToDouble(log -> timeWeight(log.getCreatedAt(), now))
                .sum();
        int weightedCount = (int) Math.round(weightedScore);

        return new CongestionResponseDto(booth.getId(), booth.getName(), convertLevel(weightedCount), weightedCount);
    }

    /** 위치 기록과 부스를 한 번씩만 읽어 전체 혼잡도를 만든다. */
    public List<CongestionResponseDto> getAllCongestions() {
        LocalDateTime now = LocalDateTime.now();
        List<GpsLog> recentLogs = gpsLogRepository.findByCreatedAtAfter(now.minusMinutes(15));
        return boothRepository.findAll().stream()
                .sorted(Comparator.comparing(Booth::getDisplayOrder).thenComparing(Booth::getId))
                .map(booth -> {
                    var simulated = simulationStateService.simulatedCongestion(booth.getId(), booth.getName());
                    if (simulated.isPresent()) {
                        return simulated.get();
                    }
                    double weightedScore = recentLogs.stream()
                            .filter(log -> distanceInMeters(booth.getLatitude(), booth.getLongitude(), log.getLatitude(), log.getLongitude()) <= BOOTH_RADIUS_METERS)
                            .mapToDouble(log -> timeWeight(log.getCreatedAt(), now))
                            .sum();
                    int weightedCount = (int) Math.round(weightedScore);
                    return new CongestionResponseDto(booth.getId(), booth.getName(), convertLevel(weightedCount), weightedCount);
                })
                .toList();
    }

    public CongestionResponseDto getMostCongestedBooth() {
        return getAllCongestions().stream()
                .max(Comparator.comparingInt(CongestionResponseDto::nearbyUserCount))
                .orElse(null);
    }

    private BoothResponseDto toDto(Booth booth) {
        return toDto(booth, getReservationSummary(booth));
    }

    private BoothResponseDto toDto(Booth booth, ReservationSummary reservationSummary) {
        return new BoothResponseDto(
                booth.getId(),
                booth.getName(),
                booth.getLatitude(),
                booth.getLongitude(),
                booth.getDescription(),
                booth.getDisplayOrder(),
                booth.getImageUrl(),
                booth.getEstimatedWaitMinutes(),
                booth.getRemainingStock(),
                booth.getLiveStatusMessage(),
                booth.getLiveStatusUpdatedAt(),
                booth.getBoothIntro(),
                booth.getMenuImageUrl(),
                booth.getMenuBoardJson(),
                booth.getCategory() != null ? booth.getCategory() : "\uC8FC\uC810",
                booth.getDayPart() != null ? booth.getDayPart() : "\uC57C\uAC04",
                booth.getOpenTime(),
                booth.getCloseTime(),
                booth.getTags(),
                booth.getContentJson(),
                booth.getReservationEnabled() != null ? booth.getReservationEnabled() : true,
                reservationSummary.tableCount(),
                reservationSummary.availableSeats(),
                reservationSummary.reservedTables(),
                reservationSummary.inUseTables()
        );
    }

    private ReservationSummary getReservationSummary(Booth booth) {
        List<BoothReservationTable> tables = boothReservationTableRepository
                .findByBoothIdOrderByDisplayOrderAscIdAsc(booth.getId());
        if (tables.isEmpty()) {
            return new ReservationSummary(0, 0, 0, 0);
        }
        return summarize(tables, boothReservationRepository
                .findByBoothIdAndStatusInOrderByExpiresAtAsc(booth.getId(), BLOCKING_RESERVATION_STATUSES));
    }

    private ReservationSummary summarize(List<BoothReservationTable> tables, List<BoothReservation> activeReservations) {
        if (tables.isEmpty()) {
            return new ReservationSummary(0, 0, 0, 0);
        }
        Set<Long> blockedTableIds = activeReservations.stream()
                .map(reservation -> reservation.getTable().getId())
                .collect(Collectors.toSet());

        int availableSeats = tables.stream()
                .filter(table -> !blockedTableIds.contains(table.getId()) && !table.isWalkInOccupied())
                .mapToInt(table -> Math.max(0, table.getAvailableSeats()))
                .sum();
        long walkInTables = tables.stream()
                .filter(table -> table.isWalkInOccupied() && !blockedTableIds.contains(table.getId()))
                .count();

        long reservedTables = activeReservations.stream()
                .filter(reservation -> reservation.getStatus() == ReservationStatus.RESERVED)
                .map(reservation -> reservation.getTable().getId())
                .distinct()
                .count();
        long inUseTables = activeReservations.stream()
                .filter(reservation -> reservation.getStatus() == ReservationStatus.CHECKED_IN)
                .map(reservation -> reservation.getTable().getId())
                .distinct()
                .count();

        return new ReservationSummary(
                tables.size(),
                availableSeats,
                (int) reservedTables,
                (int) (inUseTables + walkInTables)
        );
    }

    private record CachedBooths(List<BoothResponseDto> booths, long loadedAtMillis) {
    }

    private record ReservationSummary(
            int tableCount,
            int availableSeats,
            int reservedTables,
            int inUseTables
    ) {
    }

    private String convertLevel(int count) {
        if (count < 3) {
            return "여유";
        }
        if (count < 7) {
            return "보통";
        }
        if (count < 12) {
            return "혼잡";
        }
        return "매우혼잡";
    }

    // 최근 15분 GPS 로그에 시간 가중치를 적용한다.
    private double timeWeight(LocalDateTime createdAt, LocalDateTime now) {
        long seconds = Duration.between(createdAt, now).toSeconds();
        double ratio = Math.max(0.0, Math.min(1.0, seconds / 900.0));
        return 1.0 - (ratio * 0.7);
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

