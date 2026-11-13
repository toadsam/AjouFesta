package com.festflow.backend.service;

import com.festflow.backend.dto.BoothReservationStateDto;
import com.festflow.backend.dto.ReservationCreateRequestDto;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.BoothReservation;
import com.festflow.backend.entity.BoothReservationTable;
import com.festflow.backend.entity.ReservationStatus;
import com.festflow.backend.entity.ReservationUserState;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.repository.BoothReservationRepository;
import com.festflow.backend.repository.BoothReservationTableRepository;
import com.festflow.backend.repository.ReservationCheckInTokenRepository;
import com.festflow.backend.repository.ReservationUserStateRepository;
import com.festflow.backend.service.stream.StreamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @Mock
    private BoothRepository boothRepository;

    @Mock
    private BoothReservationTableRepository boothReservationTableRepository;

    @Mock
    private BoothReservationRepository boothReservationRepository;

    @Mock
    private ReservationUserStateRepository reservationUserStateRepository;

    @Mock
    private ReservationCheckInTokenRepository checkInTokenRepository;

    @Mock
    private ReservationAuthService reservationAuthService;

    @Mock
    private StreamService streamService;

    private ReservationService reservationService;

    @BeforeEach
    void setUp() {
        reservationService = new ReservationService(
                boothRepository,
                boothReservationTableRepository,
                boothReservationRepository,
                reservationUserStateRepository,
                checkInTokenRepository,
                reservationAuthService,
                streamService
        );
    }

    @Test
    void getBoothReservationStateMarksReservedAndCheckedInTablesAsBlocked() {
        Booth booth = booth(1L);
        BoothReservationTable reservedTable = table(10L, booth, "A", 4, 3);
        BoothReservationTable checkedInTable = table(11L, booth, "B", 4, 3);
        BoothReservation reserved = reservation(100L, booth, reservedTable, ReservationStatus.RESERVED);
        BoothReservation checkedIn = reservation(101L, booth, checkedInTable, ReservationStatus.RESERVED);
        checkedIn.markCheckedIn(LocalDateTime.now());

        given(boothRepository.findById(1L)).willReturn(Optional.of(booth));
        given(boothReservationRepository.findByStatusAndExpiresAtBefore(eq(ReservationStatus.RESERVED), any()))
                .willReturn(List.of());
        given(boothReservationRepository.findByBoothIdAndStatusInOrderByExpiresAtAsc(eq(1L), anyList()))
                .willReturn(List.of(reserved, checkedIn));
        given(boothReservationTableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(1L))
                .willReturn(List.of(reservedTable, checkedInTable));
        given(reservationAuthService.resolveUserKeyOrNull(null)).willReturn(null);

        BoothReservationStateDto state = reservationService.getBoothReservationState(1L, null);

        assertThat(state.tables()).hasSize(2);
        assertThat(state.tables().get(0).availableSeats()).isEqualTo(3);
        assertThat(state.tables().get(0).reservableSeats()).isZero();
        assertThat(state.tables().get(0).occupancyStatus()).isEqualTo("RESERVED");
        assertThat(state.tables().get(1).availableSeats()).isEqualTo(3);
        assertThat(state.tables().get(1).reservableSeats()).isZero();
        assertThat(state.tables().get(1).occupancyStatus()).isEqualTo("IN_USE");
        assertThat(state.activeReservations()).hasSize(2);
    }

    @Test
    void createReservationRejectsCheckedInTable() {
        Booth booth = booth(1L);
        BoothReservationTable table = table(10L, booth, "A", 4, 3);

        given(boothReservationRepository.findByStatusAndExpiresAtBefore(eq(ReservationStatus.RESERVED), any()))
                .willReturn(List.of());
        given(reservationAuthService.requireUserKey("token")).willReturn("01012345678");
        given(reservationUserStateRepository.findByUserKey("01012345678")).willReturn(Optional.empty());
        given(reservationUserStateRepository.save(any(ReservationUserState.class)))
                .willAnswer(invocation -> invocation.getArgument(0));
        given(boothReservationRepository.findFirstByUserKeyAndStatusInOrderByReservedAtDesc(eq("01012345678"), anyList()))
                .willReturn(Optional.empty());
        given(boothRepository.findById(1L)).willReturn(Optional.of(booth));
        given(boothReservationTableRepository.findByIdForUpdate(10L)).willReturn(Optional.of(table));
        given(boothReservationRepository.existsByTableIdAndStatusIn(eq(10L), anyList())).willReturn(true);

        assertThatThrownBy(() -> reservationService.createReservation(
                1L,
                new ReservationCreateRequestDto(10L, 1),
                "token"
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already reserved or in use");

        verify(boothReservationTableRepository, never()).save(table);
    }

    @Test
    void completeRestoresSeatsAndClearsBlockingStatus() {
        Booth booth = booth(1L);
        BoothReservationTable table = table(10L, booth, "A", 4, 3);
        BoothReservation reservation = reservation(100L, booth, table, ReservationStatus.RESERVED);
        reservation.markCheckedIn(LocalDateTime.now());

        given(boothReservationRepository.findByIdAndBoothId(100L, 1L)).willReturn(Optional.of(reservation));
        given(boothReservationRepository.save(any(BoothReservation.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        var completed = reservationService.complete(1L, 100L);

        assertThat(completed.status()).isEqualTo(ReservationStatus.COMPLETED);
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.COMPLETED);
        assertThat(table.getAvailableSeats()).isEqualTo(4);
        verify(boothReservationTableRepository).save(table);
        verify(streamService).publishReservations(completed.masked());
    }

    @Test
    void releaseTableCancelsReservedReservationAndRestoresSeats() {
        Booth booth = booth(1L);
        BoothReservationTable table = table(10L, booth, "A", 4, 3);
        BoothReservation reservation = reservation(100L, booth, table, ReservationStatus.RESERVED);

        given(boothReservationRepository.findByStatusAndExpiresAtBefore(eq(ReservationStatus.RESERVED), any()))
                .willReturn(List.of());
        given(boothReservationRepository.findFirstByBoothIdAndTableIdAndStatusInOrderByReservedAtDesc(eq(1L), eq(10L), anyList()))
                .willReturn(Optional.of(reservation));
        given(boothReservationRepository.save(any(BoothReservation.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        var released = reservationService.releaseTable(1L, 10L);

        assertThat(released.status()).isEqualTo(ReservationStatus.CANCELED);
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CANCELED);
        assertThat(table.getAvailableSeats()).isEqualTo(4);
        verify(boothReservationTableRepository).save(table);
        verify(streamService).publishReservations(released.masked());
    }

    @Test
    void releaseTableCompletesCheckedInReservationAndRestoresSeats() {
        Booth booth = booth(1L);
        BoothReservationTable table = table(10L, booth, "A", 4, 3);
        BoothReservation reservation = reservation(100L, booth, table, ReservationStatus.RESERVED);
        reservation.markCheckedIn(LocalDateTime.now());

        given(boothReservationRepository.findByStatusAndExpiresAtBefore(eq(ReservationStatus.RESERVED), any()))
                .willReturn(List.of());
        given(boothReservationRepository.findFirstByBoothIdAndTableIdAndStatusInOrderByReservedAtDesc(eq(1L), eq(10L), anyList()))
                .willReturn(Optional.of(reservation));
        given(boothReservationRepository.save(any(BoothReservation.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        var released = reservationService.releaseTable(1L, 10L);

        assertThat(released.status()).isEqualTo(ReservationStatus.COMPLETED);
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.COMPLETED);
        assertThat(table.getAvailableSeats()).isEqualTo(4);
        verify(boothReservationTableRepository).save(table);
        verify(streamService).publishReservations(released.masked());
    }

    @Test
    void occupyTableMarksWalkInAsInUseAndBlocksReservation() {
        Booth booth = booth(1L);
        BoothReservationTable table = table(10L, booth, "A", 4, 4);

        given(boothReservationRepository.findByStatusAndExpiresAtBefore(eq(ReservationStatus.RESERVED), any()))
                .willReturn(List.of());
        given(boothReservationTableRepository.findById(10L)).willReturn(Optional.of(table));
        given(boothReservationRepository.existsByTableIdAndStatusIn(eq(10L), anyList())).willReturn(false);

        var occupied = reservationService.occupyTable(1L, 10L);

        assertThat(table.isWalkInOccupied()).isTrue();
        assertThat(occupied.occupancyStatus()).isEqualTo("IN_USE");
        assertThat(occupied.reservableSeats()).isZero();
        verify(boothReservationTableRepository).save(table);
        verify(streamService).publishReservations(any());

        // 앉아 있는 동안은 손님이 예약할 수 없다.
        given(boothRepository.findById(1L)).willReturn(Optional.of(booth));
        given(reservationAuthService.requireUserKey("token")).willReturn("01012345678");
        given(reservationUserStateRepository.findByUserKey("01012345678")).willReturn(Optional.empty());
        given(reservationUserStateRepository.save(any(ReservationUserState.class)))
                .willAnswer(invocation -> invocation.getArgument(0));
        given(boothReservationRepository.findFirstByUserKeyAndStatusInOrderByReservedAtDesc(eq("01012345678"), anyList()))
                .willReturn(Optional.empty());
        given(boothReservationTableRepository.findByIdForUpdate(10L)).willReturn(Optional.of(table));

        assertThatThrownBy(() -> reservationService.createReservation(1L, new ReservationCreateRequestDto(10L, 2), "token"))
                .isInstanceOf(ResponseStatusException.class);
        verify(boothReservationRepository, never()).save(any(BoothReservation.class));
    }

    @Test
    void occupyTableRejectsReservedTable() {
        Booth booth = booth(1L);
        BoothReservationTable table = table(10L, booth, "A", 4, 4);

        given(boothReservationRepository.findByStatusAndExpiresAtBefore(eq(ReservationStatus.RESERVED), any()))
                .willReturn(List.of());
        given(boothReservationTableRepository.findById(10L)).willReturn(Optional.of(table));
        given(boothReservationRepository.existsByTableIdAndStatusIn(eq(10L), anyList())).willReturn(true);

        assertThatThrownBy(() -> reservationService.occupyTable(1L, 10L))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(table.isWalkInOccupied()).isFalse();
    }

    @Test
    void releaseTableClearsWalkInWithoutTouchingReservations() {
        Booth booth = booth(1L);
        BoothReservationTable table = table(10L, booth, "A", 4, 4);
        table.occupyWalkIn(LocalDateTime.now());

        given(boothReservationRepository.findByStatusAndExpiresAtBefore(eq(ReservationStatus.RESERVED), any()))
                .willReturn(List.of());
        given(boothReservationTableRepository.findById(10L)).willReturn(Optional.of(table));

        var released = reservationService.releaseTable(1L, 10L);

        assertThat(released).isNull();
        assertThat(table.isWalkInOccupied()).isFalse();
        verify(boothReservationTableRepository).save(table);
        verify(boothReservationRepository, never()).findFirstByBoothIdAndTableIdAndStatusInOrderByReservedAtDesc(any(), any(), anyList());
    }

    private Booth booth(Long id) {
        Booth booth = new Booth(
                "Booth",
                37.0,
                127.0,
                "desc",
                1,
                "img",
                0,
                0,
                null,
                null,
                10
        );
        ReflectionTestUtils.setField(booth, "id", id);
        return booth;
    }

    private BoothReservationTable table(Long id, Booth booth, String name, int totalSeats, int availableSeats) {
        BoothReservationTable table = new BoothReservationTable(booth, name, totalSeats, availableSeats, id.intValue());
        ReflectionTestUtils.setField(table, "id", id);
        return table;
    }

    private BoothReservation reservation(
            Long id,
            Booth booth,
            BoothReservationTable table,
            ReservationStatus status
    ) {
        BoothReservation reservation = new BoothReservation(
                booth,
                table,
                "01012345678",
                1,
                status,
                LocalDateTime.now(),
                LocalDateTime.now().plusMinutes(10)
        );
        ReflectionTestUtils.setField(reservation, "id", id);
        return reservation;
    }
}
