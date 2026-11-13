package com.festflow.backend.dto;

/** 소개팅 첫 화면이 로그인 없이 읽는 운영 상태. 새 가입을 받는지와, 안 받을 때 띄울 문구. */
public record AiMatchStatusDto(
        boolean registrationOpen,
        String registrationClosedMessage
) {
}
