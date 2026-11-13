package com.festflow.backend.repository;

import com.festflow.backend.entity.GpsLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface GpsLogRepository extends JpaRepository<GpsLog, Long> {
    List<GpsLog> findByCreatedAtAfter(LocalDateTime threshold);
    long countByCreatedAtBetween(LocalDateTime from, LocalDateTime to);
}

