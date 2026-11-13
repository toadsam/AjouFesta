package com.festflow.backend.service;

import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.CongestionResponseDto;
import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.dto.LostItemResponseDto;
import com.festflow.backend.dto.NoticeResponseDto;
import com.festflow.backend.dto.StaffMemberResponseDto;
import com.festflow.backend.entity.BoothReservation;
import com.festflow.backend.entity.ReservationStatus;
import com.festflow.backend.repository.BoothReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class FestivalSnapshotService {

    private final BoothService boothService;
    private final EventService eventService;
    private final NoticeService noticeService;
    private final LostItemService lostItemService;
    private final StaffService staffService;
    private final BoothReservationRepository boothReservationRepository;

    public FestivalSnapshotService(
            BoothService boothService,
            EventService eventService,
            NoticeService noticeService,
            LostItemService lostItemService,
            StaffService staffService,
            BoothReservationRepository boothReservationRepository
    ) {
        this.boothService = boothService;
        this.eventService = eventService;
        this.noticeService = noticeService;
        this.lostItemService = lostItemService;
        this.staffService = staffService;
        this.boothReservationRepository = boothReservationRepository;
    }

    @Transactional(readOnly = true)
    public FestivalSnapshot current() {
        List<BoothResponseDto> booths = boothService.getAllBooths();
        List<CongestionResponseDto> congestions = safeCongestions();
        Map<Long, CongestionResponseDto> congestionByBoothId = congestions.stream()
                .collect(Collectors.toMap(CongestionResponseDto::boothId, Function.identity(), (a, b) -> a));
        List<BoothReservation> reservations = boothReservationRepository.findAll();
        List<EventResponseDto> events = eventService.getAllEvents();
        List<NoticeResponseDto> notices = noticeService.getActiveNotices();
        List<LostItemResponseDto> lostItems = lostItemService.getAll(true);
        List<StaffMemberResponseDto> staff = staffService.getAllStaffMembers();

        return new FestivalSnapshot(
                LocalDateTime.now(),
                booths,
                congestions,
                congestionByBoothId,
                reservations,
                events,
                notices,
                lostItems,
                staff
        );
    }

    private List<CongestionResponseDto> safeCongestions() {
        try {
            return boothService.getAllCongestions();
        } catch (Exception ex) {
            return List.of();
        }
    }

    public record FestivalSnapshot(
            LocalDateTime capturedAt,
            List<BoothResponseDto> booths,
            List<CongestionResponseDto> congestions,
            Map<Long, CongestionResponseDto> congestionByBoothId,
            List<BoothReservation> reservations,
            List<EventResponseDto> events,
            List<NoticeResponseDto> notices,
            List<LostItemResponseDto> lostItems,
            List<StaffMemberResponseDto> staff
    ) {
        public long reservationCount(Long boothId, ReservationStatus status) {
            return reservations.stream()
                    .filter(reservation -> reservation.getBooth().getId().equals(boothId))
                    .filter(reservation -> reservation.getStatus() == status)
                    .count();
        }

        public long activeReservationCount(Long boothId) {
            return reservations.stream()
                    .filter(reservation -> reservation.getBooth().getId().equals(boothId))
                    .filter(reservation -> reservation.getStatus() == ReservationStatus.RESERVED
                            || reservation.getStatus() == ReservationStatus.CHECKED_IN)
                    .count();
        }
    }
}
