package com.festflow.backend.dto;

/** 가입 화면에서 닉네임을 칠 때마다 물어보는 응답. */
public record AiMatchNicknameCheckDto(
        String nickname,
        boolean available,
        String message
) {
}
