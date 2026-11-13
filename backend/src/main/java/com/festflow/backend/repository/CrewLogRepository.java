package com.festflow.backend.repository;

import com.festflow.backend.entity.CrewLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CrewLogRepository extends JpaRepository<CrewLog, Long> {

    List<CrewLog> findTop40ByOrderByIdDesc();
}
