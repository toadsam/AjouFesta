package com.festflow.backend.repository;

import com.festflow.backend.entity.AiMatchMeetupSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AiMatchMeetupSlotRepository extends JpaRepository<AiMatchMeetupSlot, Long> {

    Optional<AiMatchMeetupSlot> findByRequestId(Long requestId);

    Optional<AiMatchMeetupSlot> findBySlotAt(LocalDateTime slotAt);

    List<AiMatchMeetupSlot> findAllByRequestIdIn(Collection<Long> requestIds);

    List<AiMatchMeetupSlot> findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(LocalDateTime from, LocalDateTime to);

    // clearAutomatically 는 쓰지 않는다. 같은 트랜잭션에서 들고 있는 AiMatchRequest 가 떨어져 나가면 상태 변경이 저장되지 않는다.
    @Modifying(flushAutomatically = true)
    @Query("delete from AiMatchMeetupSlot slot where slot.heldUntil is not null and slot.heldUntil < :now")
    int deleteExpiredHolds(@Param("now") LocalDateTime now);

    @Modifying(flushAutomatically = true)
    @Query("delete from AiMatchMeetupSlot slot where slot.requestId = :requestId")
    int deleteByRequestIdNow(@Param("requestId") Long requestId);

    /** 신청이 취소·삭제돼 더는 약속 상태가 아닌데 남은 슬롯을 치운다. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            delete from ai_match_meetup_slots
            where request_id not in (
                select id from ai_match_requests where status in ('PROPOSED', 'CONFIRMED')
            )
            """, nativeQuery = true)
    int deleteOrphans();
}
