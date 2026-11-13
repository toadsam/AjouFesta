package com.festflow.backend.repository;

import com.festflow.backend.entity.AiMatchRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AiMatchRequestRepository extends JpaRepository<AiMatchRequest, Long> {
    List<AiMatchRequest> findAllByOrderByCreatedAtDesc();

    List<AiMatchRequest> findAllByProfileIdOrderByCreatedAtDesc(Long profileId);

    List<AiMatchRequest> findAllByRequesterProfileIdOrderByCreatedAtDesc(Long requesterProfileId);

    List<AiMatchRequest> findAllByProfileIdOrRequesterProfileId(Long profileId, Long requesterProfileId);

    boolean existsByRequesterProfileIdAndProfileIdAndStatus(Long requesterProfileId, Long profileId, String status);

    Optional<AiMatchRequest> findByIdAndProfileId(Long id, Long profileId);

    Optional<AiMatchRequest> findByIdAndRequesterProfileId(Long id, Long requesterProfileId);

    /**
     * 신청 행을 잠그고 읽는다. 두 사람이 거의 동시에 누르는 것(연락처 공유 동의)을 한 줄로 세워,
     * 나중 저장이 먼저 저장된 상대 칸을 null 로 덮어쓰지 않게 한다(엔티티 저장은 모든 칸을 한꺼번에 쓴다).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from AiMatchRequest r where r.id = :id")
    Optional<AiMatchRequest> findByIdForUpdate(@Param("id") Long id);

    List<AiMatchRequest> findAllByStatusAndMeetupAtBetweenAndMeetupReminderSentAtIsNull(
            String status, java.time.LocalDateTime from, java.time.LocalDateTime to);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            delete from ai_match_requests
            where profile_id in (:profileIds)
               or requester_profile_id in (:profileIds)
               or meetup_proposer_profile_id in (:profileIds)
            """, nativeQuery = true)
    int deleteAllReferencingProfileIds(@Param("profileIds") List<Long> profileIds);
}
