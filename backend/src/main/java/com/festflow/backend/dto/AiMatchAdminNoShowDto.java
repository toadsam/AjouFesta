package com.festflow.backend.dto;

/** 노쇼 처리. side: REQUESTER / PROFILE / BOTH. 슬롯은 바로 반납된다. */
public record AiMatchAdminNoShowDto(
        String side
) {
}
