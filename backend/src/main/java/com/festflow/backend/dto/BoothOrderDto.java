package com.festflow.backend.dto;

import com.festflow.backend.entity.OrderStatus;
import com.festflow.backend.entity.PaymentMethod;

import java.time.LocalDateTime;
import java.util.List;

public record BoothOrderDto(
        Long id,
        String orderNo,
        Long boothId,
        String boothName,
        String tableLabel,
        String depositorName,
        String phoneNumber,
        String request,
        PaymentMethod paymentMethod,
        OrderStatus status,
        Integer totalAmount,
        LocalDateTime createdAt,
        LocalDateTime paidAt,
        LocalDateTime readyAt,
        LocalDateTime completedAt,
        LocalDateTime canceledAt,
        List<BoothOrderItemDto> items,
        String clientKey
) {
    public BoothOrderDto withoutClientKey() {
        return new BoothOrderDto(id, orderNo, boothId, boothName, tableLabel, depositorName, phoneNumber, request,
                paymentMethod, status, totalAmount, createdAt, paidAt, readyAt, completedAt, canceledAt, items, null);
    }

    /** 공개 SSE 용. 손님 이름·전화·요청 사항은 내보내지 않는다. */
    public BoothOrderDto forPublicStream() {
        return new BoothOrderDto(id, orderNo, boothId, boothName, tableLabel, null, null, null,
                paymentMethod, status, totalAmount, createdAt, paidAt, readyAt, completedAt, canceledAt, items, null);
    }
}
