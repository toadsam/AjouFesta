package com.festflow.backend.dto;

/** 운영진이 소개팅 새 가입을 받을지(true) 막을지(false) 바꾼다. */
public record AiMatchRegistrationUpdateDto(
        Boolean open
) {
}
