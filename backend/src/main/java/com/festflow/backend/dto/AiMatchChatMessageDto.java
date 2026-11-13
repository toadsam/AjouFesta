package com.festflow.backend.dto;

import java.time.LocalDateTime;

/** 채팅 한 줄. type: TEXT / TOPIC. mine 은 보는 사람이 보낸 것인지. */
public record AiMatchChatMessageDto(
        Long id,
        String type,
        boolean mine,
        String content,
        LocalDateTime createdAt
) {
}
