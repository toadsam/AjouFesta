package com.festflow.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 부스 운영 콘솔의 '지난 주문' 한 화면 분량. 영업일(06:00 ~ 다음 날 06:00) 하나의 주문 전부와,
 * 주문이 있었던 영업일 목록(최근 순 — 날짜 고르기 칩에 쓴다).
 */
public record OpsBoothOrderHistoryDto(
        String date,
        LocalDateTime from,
        LocalDateTime to,
        List<OpsBoothOrderHistoryDayDto> days,
        long orderCount,
        long completedOrderCount,
        long canceledOrderCount,
        long paidRevenue,
        List<BoothOrderDto> orders
) {
    /** 주문이 있었던 영업일 하나: 날짜 · 주문 수 · 입금 확인 매출. */
    public record OpsBoothOrderHistoryDayDto(String date, long orderCount, long paidRevenue) {
    }
}
