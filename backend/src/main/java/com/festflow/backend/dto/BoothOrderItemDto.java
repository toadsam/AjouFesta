package com.festflow.backend.dto;

import java.time.LocalDateTime;

/** lineNo: 주문 안 줄 번호(1부터). doneAt: 그 메뉴 주방이 다 만든 시각, 아직이면 null. */
public record BoothOrderItemDto(
        Integer lineNo,
        String name,
        Integer unitPrice,
        Integer quantity,
        Integer lineTotal,
        LocalDateTime doneAt
) {
}
