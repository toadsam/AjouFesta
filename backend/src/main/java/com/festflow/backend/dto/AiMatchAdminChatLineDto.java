package com.festflow.backend.dto;

import java.time.LocalDateTime;

/** 운영진이 신고 확인용으로 보는 채팅 한 줄. */
public record AiMatchAdminChatLineDto(
        Long id,
        String senderNickname,
        String type,
        String content,
        LocalDateTime createdAt
) {
}
