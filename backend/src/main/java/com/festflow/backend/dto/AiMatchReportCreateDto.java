package com.festflow.backend.dto;

/** 참가자 신고. nickname·pin 으로 본인 확인. reason 은 정해진 값 중 하나. */
public record AiMatchReportCreateDto(
        String nickname,
        String pin,
        String reason,
        String detail
) {
}
