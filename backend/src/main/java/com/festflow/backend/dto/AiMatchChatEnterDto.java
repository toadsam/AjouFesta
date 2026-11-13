package com.festflow.backend.dto;

/** 채팅방 입장 결과. token 은 이후 요청의 X-Chat-Token 헤더에 넣는다(매번 비밀번호를 확인하지 않으려고). */
public record AiMatchChatEnterDto(
        String token,
        AiMatchChatStateDto state
) {
}
