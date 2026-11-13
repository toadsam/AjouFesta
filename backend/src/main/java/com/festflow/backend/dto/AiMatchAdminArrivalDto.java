package com.festflow.backend.dto;

/** 부스 현장 체크인. side: REQUESTER / PROFILE. arrived=false 면 체크 취소. */
public record AiMatchAdminArrivalDto(
        String side,
        boolean arrived
) {
}
