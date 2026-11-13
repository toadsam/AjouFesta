package com.festflow.backend.repository;

import com.festflow.backend.entity.CrewSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CrewSlotRepository extends JpaRepository<CrewSlot, Long> {

    List<CrewSlot> findAllByOrderByDayAscSortOrderAscIdAsc();
}
