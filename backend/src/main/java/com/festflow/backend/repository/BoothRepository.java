package com.festflow.backend.repository;

import com.festflow.backend.entity.Booth;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface BoothRepository extends JpaRepository<Booth, Long> {
    Optional<Booth> findTopByOrderByDisplayOrderDesc();

    /** 부스 행을 잠그고 읽는다. 같은 부스의 주문을 한 줄로 세워 주문번호 · 테이블 한도가 겹치지 않게 한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booth b where b.id = :id")
    Optional<Booth> findByIdForUpdate(@Param("id") Long id);
}

