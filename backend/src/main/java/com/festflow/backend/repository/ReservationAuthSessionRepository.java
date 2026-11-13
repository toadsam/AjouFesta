package com.festflow.backend.repository;

import com.festflow.backend.entity.ReservationAuthSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReservationAuthSessionRepository extends JpaRepository<ReservationAuthSession, Long> {
    Optional<ReservationAuthSession> findByToken(String token);
}

