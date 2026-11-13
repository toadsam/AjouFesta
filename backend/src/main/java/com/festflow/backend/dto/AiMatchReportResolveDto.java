package com.festflow.backend.dto;

/** 신고 처리. action: DISMISS(문제 없음) / HIDE(대상 숨김) / DELETE(대상 삭제). */
public record AiMatchReportResolveDto(
        String action,
        String note
) {
}
