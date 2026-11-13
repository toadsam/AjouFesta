package com.festflow.backend.dto;

import java.util.List;

/**
 * 부스 운영 콘솔의 주문 탭 한 화면 분량: 설정 + 오늘 주문 목록.
 */
public record OpsBoothOrdersDto(
        Boolean orderEnabled,
        String bankAccount,
        String bankHolder,
        List<BoothOrderDto> orders
) {
}
