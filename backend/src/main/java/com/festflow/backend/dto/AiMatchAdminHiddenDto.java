package com.festflow.backend.dto;

/** 목록에서 숨기기. 숨겨도 본인은 로그인·신청함 확인이 된다. */
public record AiMatchAdminHiddenDto(
        boolean hidden,
        String reason
) {
}
