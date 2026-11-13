package com.festflow.backend.repository;

import com.festflow.backend.entity.ReservationUserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReservationUserAccountRepository extends JpaRepository<ReservationUserAccount, Long> {
    Optional<ReservationUserAccount> findByPhoneNumber(String phoneNumber);
}

