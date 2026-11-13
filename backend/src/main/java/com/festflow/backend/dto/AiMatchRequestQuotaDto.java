package com.festflow.backend.dto;

/** 한 사람이 보낼 수 있는 데이트 신청 횟수. 상대가 계정을 지워서 닫힌 신청은 세지 않는다. */
public record AiMatchRequestQuotaDto(
        int limit,
        int used,
        int remaining
) {
}
