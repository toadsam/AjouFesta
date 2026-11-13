package com.festflow.backend.repository;

import com.festflow.backend.entity.AiMatchChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AiMatchChatMessageRepository extends JpaRepository<AiMatchChatMessage, Long> {

    /** 이번 채팅(since 이후)에서 afterId 다음 메시지들. */
    List<AiMatchChatMessage> findAllByRequestIdAndIdGreaterThanAndCreatedAtGreaterThanEqualOrderByIdAsc(
            Long requestId, Long afterId, LocalDateTime since);

    List<AiMatchChatMessage> findAllByRequestIdOrderByIdAsc(Long requestId);

    long countByRequestIdAndTypeAndCreatedAtGreaterThanEqual(Long requestId, String type, LocalDateTime since);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from AiMatchChatMessage m where m.createdAt < :before")
    int deleteAllOlderThan(@Param("before") LocalDateTime before);

    /** 프로필을 지울 때 그 프로필이 낀 신청의 채팅도 같이 지운다(신청을 지우기 전에 불러야 한다). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            delete from ai_match_chat_messages
            where request_id in (
                select id from ai_match_requests
                where profile_id in (:profileIds)
                   or requester_profile_id in (:profileIds)
                   or meetup_proposer_profile_id in (:profileIds)
            )
            """, nativeQuery = true)
    int deleteAllForProfileIds(@Param("profileIds") List<Long> profileIds);
}
