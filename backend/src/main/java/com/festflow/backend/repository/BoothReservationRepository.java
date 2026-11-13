package com.festflow.backend.repository;

import com.festflow.backend.entity.BoothReservation;
import com.festflow.backend.entity.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BoothReservationRepository extends JpaRepository<BoothReservation, Long> {
    List<BoothReservation> findByBoothIdAndStatusOrderByExpiresAtAsc(Long boothId, ReservationStatus status);

    List<BoothReservation> findByBoothIdAndStatusInOrderByExpiresAtAsc(Long boothId, List<ReservationStatus> statuses);

    Optional<BoothReservation> findByIdAndBoothId(Long id, Long boothId);

    List<BoothReservation> findByBoothId(Long boothId);

    List<BoothReservation> findByStatusIn(List<ReservationStatus> statuses);

    Optional<BoothReservation> findFirstByBoothIdAndTableIdAndStatusInOrderByReservedAtDesc(
            Long boothId,
            Long tableId,
            List<ReservationStatus> statuses
    );

    Optional<BoothReservation> findFirstByUserKeyAndStatusOrderByReservedAtDesc(String userKey, ReservationStatus status);

    Optional<BoothReservation> findFirstByUserKeyAndStatusInOrderByReservedAtDesc(String userKey, List<ReservationStatus> statuses);

    boolean existsByTableIdAndStatus(Long tableId, ReservationStatus status);

    boolean existsByTableIdAndStatusIn(Long tableId, List<ReservationStatus> statuses);

    List<BoothReservation> findByStatusAndExpiresAtBefore(ReservationStatus status, LocalDateTime expiresAt);

    long countByBoothIdAndReservedAtBetween(Long boothId, LocalDateTime from, LocalDateTime to);

    List<BoothReservation> findByBoothIdAndReservedAtBetween(Long boothId, LocalDateTime from, LocalDateTime to);

    long countByBoothIdAndCheckedInAtBetween(Long boothId, LocalDateTime from, LocalDateTime to);
}

