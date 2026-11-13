package com.festflow.backend.repository;

import com.festflow.backend.entity.FestivalEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventRepository extends JpaRepository<FestivalEvent, Long> {
}

