package com.festflow.backend.repository;

import com.festflow.backend.entity.BoothReservationTable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BoothReservationTableRepository extends JpaRepository<BoothReservationTable, Long> {
    List<BoothReservationTable> findByBoothIdOrderByDisplayOrderAscIdAsc(Long boothId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from BoothReservationTable t where t.id = :id")
    Optional<BoothReservationTable> findByIdForUpdate(@Param("id") Long id);
}

