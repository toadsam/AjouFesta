package com.festflow.backend.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** 부스 마감 정산 한 장. 영업일은 06:00 부터 다음 날 06:00 까지. */
public record OpsBoothSummaryDto(
        String date,
        LocalDateTime from,
        LocalDateTime to,
        long orderCount,
        long completedOrderCount,
        long canceledOrderCount,
        long revenue,
        long completedRevenue,
        List<OpsBoothSummaryItemDto> topItems,
        long reservationCount,
        long checkedInCount,
        long noShowCount,
        long tableTurns,
        double averageWaitMinutes,
        String peakHour,
        Map<String, Long> ordersByHour
) {
}
