package com.festflow.backend.dto;

/** 채팅방에 들어온 사람. 서버 안에서만 쓴다. */
public record AiMatchChatParticipantDto(
        Long requestId,
        Long profileId,
        boolean requesterSide
) {
}
