package com.festflow.backend.dto;

/** 메시지 보내기. content(직접 쓴 말)나 topicId(추천 주제) 중 하나. */
public record AiMatchChatSendDto(
        String content,
        String topicId
) {
}
