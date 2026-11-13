package com.festflow.backend.dto;

/** 추천 주제. 누르면 id 로 보내고, 서버가 글을 찾아 주제 카드로 올린다. */
public record AiMatchChatTopicDto(
        String id,
        String text
) {
}
