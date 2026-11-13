package com.festflow.backend.repository;

import com.festflow.backend.entity.ReservationCheckInToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ReservationCheckInTokenRepository extends JpaRepository<ReservationCheckInToken, Long> {
    Optional<ReservationCheckInToken> findByToken(String token);

    List<ReservationCheckInToken> findByReservationIdIn(Collection<Long> reservationIds);

    Optional<ReservationCheckInToken> findFirstByReservationIdAndUsedAtIsNullAndExpiresAtAfterOrderByIdDesc(Long reservationId, LocalDateTime now);
}

