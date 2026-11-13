package com.festflow.backend.repository;

import com.festflow.backend.entity.AiMatchPhoneUsage;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AiMatchPhoneUsageRepository extends JpaRepository<AiMatchPhoneUsage, Long> {
    Optional<AiMatchPhoneUsage> findByPhoneNumber(String phoneNumber);

    long deleteByPhoneNumber(String phoneNumber);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select usage from AiMatchPhoneUsage usage where usage.phoneNumber = :phoneNumber")
    Optional<AiMatchPhoneUsage> findByPhoneNumberForUpdate(@Param("phoneNumber") String phoneNumber);
}
