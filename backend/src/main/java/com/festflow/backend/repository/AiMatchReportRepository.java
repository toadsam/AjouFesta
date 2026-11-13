package com.festflow.backend.repository;

import com.festflow.backend.entity.AiMatchReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiMatchReportRepository extends JpaRepository<AiMatchReport, Long> {
    List<AiMatchReport> findAllByOrderByCreatedAtDesc();

    long countByStatus(String status);

    boolean existsByReporterProfileIdAndTargetProfileIdAndStatus(Long reporterProfileId, Long targetProfileId, String status);

    void deleteAllByReporterProfileIdOrTargetProfileId(Long reporterProfileId, Long targetProfileId);
}
