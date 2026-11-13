package com.festflow.backend.repository;

import com.festflow.backend.entity.ReservationVerificationCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface ReservationVerificationCodeRepository extends JpaRepository<ReservationVerificationCode, Long> {
    Optional<ReservationVerificationCode> findFirstByPhoneNumberOrderByCreatedAtDesc(String phoneNumber);

    long countByPhoneNumberAndCreatedAtAfter(String phoneNumber, LocalDateTime threshold);
}
