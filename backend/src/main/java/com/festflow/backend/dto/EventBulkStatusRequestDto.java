package com.festflow.backend.dto;

import java.util.List;

/** 공연 여러 개의 상태를 한 번에. statusOverride 가 비면 자동 상태로 되돌린다. */
public record EventBulkStatusRequestDto(
        List<Long> eventIds,
        String statusOverride,
        Integer delayMinutes,
        String liveMessage
) {
}
