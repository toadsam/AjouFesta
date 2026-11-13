package com.festflow.backend.repository;

import com.festflow.backend.entity.Notice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NoticeRepository extends JpaRepository<Notice, Long> {
    List<Notice> findByActiveTrueOrderByCreatedAtDesc();

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update Notice n set n.viewCount = coalesce(n.viewCount, 0) + 1 where n.id = :id")
    int incrementViewCount(@org.springframework.data.repository.query.Param("id") Long id);
}
