package com.festflow.backend.repository;

import com.festflow.backend.entity.AiMatchProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiMatchProfileRepository extends JpaRepository<AiMatchProfile, Long> {
    List<AiMatchProfile> findAllByStatusOrderByCreatedAtDesc(String status);

    boolean existsByNicknameIgnoreCaseAndStatus(String nickname, String status);

    boolean existsByNicknameIgnoreCaseAndStatusAndIdNot(String nickname, String status, Long id);

    Optional<AiMatchProfile> findByNicknameIgnoreCaseAndStatus(String nickname, String status);
}
