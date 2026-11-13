package com.festflow.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 블라인드 채팅방 상태.
 * phase: WAITING(둘 다 부스에 앉기 전) · OPEN(채팅 중) · CHOOSING(얼굴 보기 선택) · MATCH · NO_MATCH · CLOSED.
 * 시계는 서버 기준이라 serverNow 와 함께 준다. messages 는 afterId 다음 것만, topics 는 처음 받을 때만 채운다.
 */
public record AiMatchChatStateDto(
        Long requestId,
        String phase,
        LocalDateTime serverNow,
        LocalDateTime startedAt,
        LocalDateTime endsAt,
        LocalDateTime chooseUntil,
        String partnerNickname,
        Long partnerProfileId,
        /** 내가 고른 것. 아직이면 null. 상대가 고른 것은 결과가 날 때까지 알려 주지 않는다. */
        Boolean myChoice,
        List<AiMatchChatMessageDto> messages,
        List<AiMatchChatTopicDto> topics
) {
}
