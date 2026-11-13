package com.festflow.backend.repository;

import com.festflow.backend.entity.CrewSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CrewSnapshotRepository extends JpaRepository<CrewSnapshot, Long> {

    Optional<CrewSnapshot> findTopByOrderByIdDesc();

    List<CrewSnapshot> findAllByOrderByIdDesc();
}
