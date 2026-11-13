package com.festflow.backend.repository;

import com.festflow.backend.entity.StaffSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface StaffSessionRepository extends JpaRepository<StaffSession, Long> {
    Optional<StaffSession> findByToken(String token);

    void deleteByExpiresAtBefore(LocalDateTime threshold);
}

