package com.festflow.backend.service;

import com.festflow.backend.dto.BoothReservationConfigRequestDto;
import com.festflow.backend.dto.BoothReservationDto;
import com.festflow.backend.dto.BoothReservationStateDto;
import com.festflow.backend.dto.ReservationCheckInTokenDto;
import com.festflow.backend.dto.ReservationCreateRequestDto;
import com.festflow.backend.dto.ReservationPenaltyDto;
import com.festflow.backend.dto.ReservationTableDto;
import com.festflow.backend.dto.ReservationTableUpsertDto;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.BoothReservation;
import com.festflow.backend.entity.BoothReservationTable;
import com.festflow.backend.entity.ReservationCheckInToken;
import com.festflow.backend.entity.ReservationStatus;
import com.festflow.backend.entity.ReservationUserState;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.repository.BoothReservationRepository;
import com.festflow.backend.repository.BoothReservationTableRepository;
import com.festflow.backend.repository.ReservationCheckInTokenRepository;
import com.festflow.backend.repository.ReservationUserStateRepository;
import com.festflow.backend.service.stream.StreamService;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

@Service
public class ReservationService {
    private static final List<ReservationStatus> BLOCKING_STATUSES = List.of(
            ReservationStatus.RESERVED,
            ReservationStatus.CHECKED_IN
    );

    private final BoothRepository boothRepository;
    private final BoothReservationTableRepository boothReservationTableRepository;
    private final BoothReservationRepository boothReservationRepository;
    private final ReservationUserStateRepository reservationUserStateRepository;
    private final ReservationCheckInTokenRepository checkInTokenRepository;
    private final ReservationAuthService reservationAuthService;
    private final StreamService streamService;

    public ReservationService(
            BoothRepository boothRepository,
            BoothReservationTableRepository boothReservationTableRepository,
            BoothReservationRepository boothReservationRepository,
            ReservationUserStateRepository reservationUserStateRepository,
            ReservationCheckInTokenRepository checkInTokenRepository,
            ReservationAuthService reservationAuthService,
            StreamService streamService
    ) {
        this.boothRepository = boothRepository;
        this.boothReservationTableRepository = boothReservationTableRepository;
        this.boothReservationRepository = boothReservationRepository;
        this.reservationUserStateRepository = reservationUserStateRepository;
        this.checkInTokenRepository = checkInTokenRepository;
        this.reservationAuthService = reservationAuthService;
        this.streamService = streamService;
    }

    @Transactional
    public BoothReservationStateDto getBoothReservationState(Long boothId, String authToken) {
        Booth booth = findBooth(boothId);
        LocalDateTime now = LocalDateTime.now();
        expireStaleReservations(now);

        List<BoothReservation> activeReservationEntities = boothReservationRepository
                .findByBoothIdAndStatusInOrderByExpiresAtAsc(boothId, BLOCKING_STATUSES);
        Map<Long, BoothReservation> blockingReservationByTableId = toBlockingReservationMap(activeReservationEntities);

        List<ReservationTableDto> tableDtos = boothReservationTableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(boothId).stream()
                .map(table -> toTableDto(table, blockingReservationByTableId.get(table.getId())))
                .toList();

        List<BoothReservationDto> activeReservations = activeReservationEntities.stream()
                .map(this::toReservationDto)
                .map(BoothReservationDto::masked)
                .toList();

        BoothReservationDto myReservation = null;
        ReservationPenaltyDto penalty = null;

        String userKey = reservationAuthService.resolveUserKeyOrNull(authToken);
        if (userKey != null) {
            myReservation = boothReservationRepository
                    .findFirstByUserKeyAndStatusInOrderByReservedAtDesc(userKey, BLOCKING_STATUSES)
                    .map(this::toReservationDto)
                    .orElse(null);

            penalty = reservationUserStateRepository.findByUserKey(userKey)
                    .map(state -> toPenaltyDto(state, now))
                    .orElse(new ReservationPenaltyDto(0, null, false));
        }

        return new BoothReservationStateDto(
                sanitizeReservationMinutes(booth.getMaxReservationMinutes()),
                tableDtos,
                activeReservations,
                myReservation,
                penalty
        );
    }

    @Transactional
    public BoothReservationStateDto upsertBoothReservationConfig(Long boothId, BoothReservationConfigRequestDto requestDto) {
        Booth booth = findBooth(boothId);
        booth.setMaxReservationMinutes(sanitizeReservationMinutes(requestDto.maxReservationMinutes()));
        boothRepository.save(booth);

        List<ReservationTableUpsertDto> requestTables = requestDto.tables() == null ? List.of() : requestDto.tables();
        List<BoothReservationTable> existingTables = boothReservationTableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(boothId);
        Map<Long, BoothReservationTable> existingById = new HashMap<>();
        for (BoothReservationTable table : existingTables) {
            existingById.put(table.getId(), table);
        }

        List<BoothReservationTable> toSave = new ArrayList<>();
        List<Long> keepIds = new ArrayList<>();

        for (int i = 0; i < requestTables.size(); i++) {
            ReservationTableUpsertDto dto = requestTables.get(i);
            int totalSeats = sanitizeTotalSeats(dto.totalSeats());
            int availableSeats = sanitizeAvailableSeats(dto.availableSeats(), totalSeats);
            String tableName = (dto.tableName() == null || dto.tableName().isBlank()) ? "Table " + (i + 1) : dto.tableName().trim();

            if (dto.id() != null && existingById.containsKey(dto.id())) {
                BoothReservationTable target = existingById.get(dto.id());
                target.update(tableName, totalSeats, availableSeats, i + 1);
                toSave.add(target);
                keepIds.add(target.getId());
            } else {
                toSave.add(new BoothReservationTable(booth, tableName, totalSeats, availableSeats, i + 1));
            }
        }

        for (BoothReservationTable table : existingTables) {
            if (!keepIds.contains(table.getId())) {
                if (boothReservationRepository.existsByTableIdAndStatusIn(table.getId(), BLOCKING_STATUSES)) {
                    throw new ResponseStatusException(CONFLICT, "Cannot remove a table that is reserved or in use.");
                }
                boothReservationTableRepository.delete(table);
            }
        }

        boothReservationTableRepository.saveAll(toSave);
        BoothReservationStateDto state = getBoothReservationState(boothId, null);
        streamService.publishReservations(Map.of("boothId", boothId, "status", "CONFIG_UPDATED"));
        return state;
    }

    @Transactional
    public BoothReservationDto createReservation(Long boothId, ReservationCreateRequestDto requestDto, String authToken) {
        LocalDateTime now = LocalDateTime.now();
        expireStaleReservations(now);

        String userKey = reservationAuthService.requireUserKey(authToken);

        ReservationUserState userState = reservationUserStateRepository.findByUserKey(userKey)
                .orElseGet(() -> reservationUserStateRepository.save(new ReservationUserState(userKey)));

        if (userState.isBlocked(now)) {
            throw new ResponseStatusException(TOO_MANY_REQUESTS, "Reservation is temporarily blocked due to repeated no-shows.");
        }

        Optional<BoothReservation> activeReservation = boothReservationRepository
                .findFirstByUserKeyAndStatusInOrderByReservedAtDesc(userKey, BLOCKING_STATUSES);
        if (activeReservation.isPresent()) {
            throw new ResponseStatusException(CONFLICT, "Only one active reservation is allowed per user.");
        }

        Booth booth = findBooth(boothId);
        BoothReservationTable table = boothReservationTableRepository.findByIdForUpdate(requestDto.tableId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Table not found."));

        if (!table.getBooth().getId().equals(boothId)) {
            throw new ResponseStatusException(CONFLICT, "Selected table does not belong to this booth.");
        }
        if (boothReservationRepository.existsByTableIdAndStatusIn(table.getId(), BLOCKING_STATUSES)) {
            throw new ResponseStatusException(CONFLICT, "Selected table is already reserved or in use.");
        }

        if (table.isWalkInOccupied()) {
            throw new ResponseStatusException(CONFLICT, "지금 손님이 앉아 있는 테이블이에요.");
        }
        int seatCount = requestDto.seatCount() == null ? 1 : Math.max(1, requestDto.seatCount());
        if (table.getAvailableSeats() < seatCount) {
            throw new ResponseStatusException(CONFLICT, "Not enough available seats in this table.");
        }

        table.setAvailableSeats(table.getAvailableSeats() - seatCount);
        boothReservationTableRepository.save(table);

        BoothReservation created = boothReservationRepository.save(new BoothReservation(
                booth,
                table,
                userKey,
                seatCount,
                ReservationStatus.RESERVED,
                now,
                now.plusMinutes(sanitizeReservationMinutes(booth.getMaxReservationMinutes()))
        ));

        BoothReservationDto dto = toReservationDto(created);
        streamService.publishReservations(dto.masked());
        return dto;
    }

    /** 자리가 나서 손님을 부른다. 손님 화면에 "지금 들어오세요"가 뜬다. 예약 상태는 그대로다. */
    @Transactional
    public BoothReservationDto call(Long boothId, Long reservationId) {
        LocalDateTime now = LocalDateTime.now();
        BoothReservation reservation = boothReservationRepository.findByIdAndBoothId(reservationId, boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Reservation not found."));
        if (reservation.getStatus() != ReservationStatus.RESERVED) {
            throw new ResponseStatusException(CONFLICT, "체크인 전 예약만 호출할 수 있어요.");
        }
        reservation.markCalled(now);
        boothReservationRepository.save(reservation);
        BoothReservationDto dto = toReservationDto(reservation);
        streamService.publishReservations(dto.masked());
        return dto;
    }

    @Transactional
    public BoothReservationDto complete(Long boothId, Long reservationId) {
        BoothReservation reservation = boothReservationRepository.findByIdAndBoothId(reservationId, boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Reservation not found."));

        if (reservation.getStatus() != ReservationStatus.CHECKED_IN) {
            throw new ResponseStatusException(CONFLICT, "Only checked-in reservations can be completed.");
        }

        reservation.markCompleted();
        boothReservationRepository.save(reservation);
        restoreReservationSeats(reservation);

        BoothReservationDto dto = toReservationDto(reservation);
        streamService.publishReservations(dto.masked());
        return dto;
    }

    /**
     * 입구 스태프가 워크인 손님을 앉힐 때. 예약이 걸린 테이블은 먼저 체크인하거나 비워야 한다.
     * 자리 현황 화면(한 손 조작)에서 쓴다.
     */
    @Transactional
    public ReservationTableDto occupyTable(Long boothId, Long tableId) {
        LocalDateTime now = LocalDateTime.now();
        expireStaleReservations(now);

        BoothReservationTable table = boothReservationTableRepository.findById(tableId)
                .filter(found -> found.getBooth().getId().equals(boothId))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Table not found."));
        if (boothReservationRepository.existsByTableIdAndStatusIn(tableId, BLOCKING_STATUSES)) {
            throw new ResponseStatusException(CONFLICT, "예약이 걸린 테이블이에요. 먼저 체크인하거나 비워 주세요.");
        }
        table.occupyWalkIn(now);
        boothReservationTableRepository.save(table);
        streamService.publishReservations(Map.of("boothId", boothId, "tableId", tableId, "status", "WALK_IN"));
        return toTableDto(table);
    }

    @Transactional
    public BoothReservationDto releaseTable(Long boothId, Long tableId) {
        LocalDateTime now = LocalDateTime.now();
        expireStaleReservations(now);

        BoothReservationTable walkInTable = boothReservationTableRepository.findById(tableId)
                .filter(found -> found.getBooth().getId().equals(boothId) && found.isWalkInOccupied())
                .orElse(null);
        if (walkInTable != null) {
            walkInTable.clearWalkIn();
            boothReservationTableRepository.save(walkInTable);
            streamService.publishReservations(Map.of("boothId", boothId, "tableId", tableId, "status", "RELEASED"));
            return null;
        }

        BoothReservation reservation = boothReservationRepository
                .findFirstByBoothIdAndTableIdAndStatusInOrderByReservedAtDesc(boothId, tableId, BLOCKING_STATUSES)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Active table reservation not found."));

        if (reservation.getStatus() == ReservationStatus.CHECKED_IN) {
            reservation.markCompleted();
        } else {
            reservation.markCancelled(now);
        }

        boothReservationRepository.save(reservation);
        restoreReservationSeats(reservation);

        BoothReservationDto dto = toReservationDto(reservation);
        streamService.publishReservations(dto.masked());
        return dto;
    }

    @Transactional
    public ReservationCheckInTokenDto issueCheckInToken(Long boothId, Long reservationId, String authToken) {
        LocalDateTime now = LocalDateTime.now();
        expireStaleReservations(now);
        String userKey = reservationAuthService.requireUserKey(authToken);

        BoothReservation reservation = boothReservationRepository.findByIdAndBoothId(reservationId, boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Reservation not found."));

        if (reservation.getStatus() != ReservationStatus.RESERVED) {
            throw new ResponseStatusException(CONFLICT, "Reservation is no longer active.");
        }
        if (!reservation.getUserKey().equals(userKey)) {
            throw new ResponseStatusException(CONFLICT, "Reservation does not belong to the current user.");
        }
        if (reservation.getExpiresAt().isBefore(now)) {
            expireReservation(reservation, now);
            throw new ResponseStatusException(CONFLICT, "Reservation has expired.");
        }

        Optional<ReservationCheckInToken> existing = checkInTokenRepository
                .findFirstByReservationIdAndUsedAtIsNullAndExpiresAtAfterOrderByIdDesc(reservation.getId(), now);
        if (existing.isPresent()) {
            return new ReservationCheckInTokenDto(existing.get().getToken(), existing.get().getExpiresAt());
        }

        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        ReservationCheckInToken created = checkInTokenRepository.save(new ReservationCheckInToken(
                reservation,
                token,
                now,
                now.plusSeconds(60)
        ));

        return new ReservationCheckInTokenDto(created.getToken(), created.getExpiresAt());
    }

    @Transactional
    public BoothReservationDto checkIn(Long boothId, Long reservationId) {
        LocalDateTime now = LocalDateTime.now();
        expireStaleReservations(now);

        BoothReservation reservation = boothReservationRepository.findByIdAndBoothId(reservationId, boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Reservation not found."));

        if (reservation.getStatus() != ReservationStatus.RESERVED) {
            throw new ResponseStatusException(CONFLICT, "Reservation is no longer active.");
        }

        if (reservation.getExpiresAt().isBefore(now)) {
            expireReservation(reservation, now);
            throw new ResponseStatusException(CONFLICT, "Reservation has expired.");
        }

        reservation.markCheckedIn(now);
        boothReservationRepository.save(reservation);
        BoothReservationDto dto = toReservationDto(reservation);
        streamService.publishReservations(dto.masked());
        return dto;
    }

    @Transactional
    public BoothReservationDto checkInByToken(Long boothId, String token) {
        LocalDateTime now = LocalDateTime.now();
        expireStaleReservations(now);

        ReservationCheckInToken checkInToken = checkInTokenRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Check-in token not found."));

        if (checkInToken.isUsed()) {
            throw new ResponseStatusException(CONFLICT, "Check-in token is already used.");
        }
        if (checkInToken.isExpired(now)) {
            throw new ResponseStatusException(CONFLICT, "Check-in token has expired.");
        }

        BoothReservation reservation = checkInToken.getReservation();
        if (!reservation.getBooth().getId().equals(boothId)) {
            throw new ResponseStatusException(CONFLICT, "Check-in token belongs to another booth.");
        }

        BoothReservationDto checkedIn = checkIn(boothId, reservation.getId());
        checkInToken.markUsed(now);
        checkInTokenRepository.save(checkInToken);
        return checkedIn;
    }

    private void expireStaleReservations(LocalDateTime now) {
        List<BoothReservation> expired = boothReservationRepository.findByStatusAndExpiresAtBefore(ReservationStatus.RESERVED, now);
        for (BoothReservation reservation : expired) {
            expireReservation(reservation, now);
        }
    }

    private void expireReservation(BoothReservation reservation, LocalDateTime now) {
        if (reservation.getStatus() != ReservationStatus.RESERVED) {
            return;
        }

        reservation.markExpired(now);
        boothReservationRepository.save(reservation);
        restoreReservationSeats(reservation);
        registerNoShow(reservation, now);
        streamService.publishReservations(toReservationDto(reservation).masked());
    }

    private void restoreReservationSeats(BoothReservation reservation) {
        BoothReservationTable table = reservation.getTable();
        int restoredSeats = Math.min(table.getTotalSeats(), table.getAvailableSeats() + reservation.getSeatCount());
        table.setAvailableSeats(restoredSeats);
        boothReservationTableRepository.save(table);
    }

    private void registerNoShow(BoothReservation reservation, LocalDateTime now) {
        ReservationUserState userState = reservationUserStateRepository.findByUserKey(reservation.getUserKey())
                .orElseGet(() -> new ReservationUserState(reservation.getUserKey()));
        userState.registerNoShow(now);
        reservationUserStateRepository.save(userState);
    }

    private Booth findBooth(Long boothId) {
        return boothRepository.findById(boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Booth not found."));
    }

    private ReservationTableDto toTableDto(BoothReservationTable table) {
        return toTableDto(table, null);
    }

    private ReservationTableDto toTableDto(BoothReservationTable table, BoothReservation blockingReservation) {
        String occupancyStatus = resolveOccupancyStatus(table, blockingReservation);
        String occupancyLabel = resolveOccupancyLabel(occupancyStatus);
        int reservableSeats = (blockingReservation == null && !table.isWalkInOccupied()) ? table.getAvailableSeats() : 0;

        return new ReservationTableDto(
                table.getId(),
                table.getTableName(),
                table.getTotalSeats(),
                table.getAvailableSeats(),
                table.getDisplayOrder(),
                reservableSeats,
                occupancyStatus,
                occupancyLabel,
                blockingReservation == null ? null : blockingReservation.getId(),
                occupiedSince(table, blockingReservation)
        );
    }

    /** 손님이 앉은 시각. 워크인·주문으로 앉았으면 그때, 예약 손님이면 체크인한 때. 비어 있으면 null. */
    private static LocalDateTime occupiedSince(BoothReservationTable table, BoothReservation blockingReservation) {
        if (table.isWalkInOccupied()) {
            return table.getWalkInSince();
        }
        if (blockingReservation != null && blockingReservation.getStatus() == ReservationStatus.CHECKED_IN) {
            return blockingReservation.getCheckedInAt();
        }
        return null;
    }

    private Map<Long, BoothReservation> toBlockingReservationMap(List<BoothReservation> reservations) {
        Map<Long, BoothReservation> byTableId = new HashMap<>();
        for (BoothReservation reservation : reservations) {
            Long tableId = reservation.getTable().getId();
            BoothReservation existing = byTableId.get(tableId);
            if (existing == null || reservation.getStatus() == ReservationStatus.CHECKED_IN) {
                byTableId.put(tableId, reservation);
            }
        }
        return byTableId;
    }

    private String resolveOccupancyStatus(BoothReservationTable table, BoothReservation blockingReservation) {
        // 워크인 손님이 앉아 있으면 예약 여부와 상관없이 이용 중이다.
        if (table.isWalkInOccupied()) {
            return "IN_USE";
        }
        if (blockingReservation != null && blockingReservation.getStatus() == ReservationStatus.CHECKED_IN) {
            return "IN_USE";
        }
        if (blockingReservation != null) {
            return "RESERVED";
        }
        if (table.getAvailableSeats() <= 0) {
            return "FULL";
        }
        return "AVAILABLE";
    }

    private String resolveOccupancyLabel(String occupancyStatus) {
        return switch (occupancyStatus) {
            case "IN_USE" -> "\uC774\uC6A9\uC911";
            case "RESERVED" -> "\uC608\uC57D\uC911";
            case "FULL" -> "\uB9C8\uAC10";
            default -> "\uC608\uC57D \uAC00\uB2A5";
        };
    }

    private BoothReservationDto toReservationDto(BoothReservation reservation) {
        return new BoothReservationDto(
                reservation.getId(),
                reservation.getBooth().getId(),
                reservation.getTable().getId(),
                reservation.getTable().getTableName(),
                reservation.getUserKey(),
                reservation.getSeatCount(),
                reservation.getStatus(),
                reservation.getReservedAt(),
                reservation.getExpiresAt(),
                reservation.getCheckedInAt(),
                reservation.getExpiredAt(),
                reservation.getCalledAt()
        );
    }

    private ReservationPenaltyDto toPenaltyDto(ReservationUserState state, LocalDateTime now) {
        return new ReservationPenaltyDto(
                state.getNoShowCount(),
                state.getBlockedUntil(),
                state.isBlocked(now)
        );
    }

    private int sanitizeReservationMinutes(Integer rawMinutes) {
        if (rawMinutes == null || rawMinutes < 1) {
            return 10;
        }
        return Math.min(rawMinutes, 120);
    }

    private int sanitizeTotalSeats(Integer rawTotalSeats) {
        if (rawTotalSeats == null || rawTotalSeats < 1) {
            return 1;
        }
        return Math.min(rawTotalSeats, 30);
    }

    private int sanitizeAvailableSeats(Integer rawAvailableSeats, int totalSeats) {
        if (rawAvailableSeats == null) {
            return totalSeats;
        }
        if (rawAvailableSeats < 0) {
            return 0;
        }
        return Math.min(rawAvailableSeats, totalSeats);
    }
}
