package com.festflow.backend.repository;

import com.festflow.backend.entity.CrewNotice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CrewNoticeRepository extends JpaRepository<CrewNotice, Long> {

    List<CrewNotice> findAllByOrderByDayAscIdAsc();
}
