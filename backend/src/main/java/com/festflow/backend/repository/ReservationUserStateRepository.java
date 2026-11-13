package com.festflow.backend.repository;

import com.festflow.backend.entity.ReservationUserState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReservationUserStateRepository extends JpaRepository<ReservationUserState, Long> {
    Optional<ReservationUserState> findByUserKey(String userKey);
}

