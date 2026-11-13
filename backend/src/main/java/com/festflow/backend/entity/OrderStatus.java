package com.festflow.backend.entity;

/**
 * 부스 테이블 주문 상태. 순서가 곧 진행 순서다 (CANCELED 제외).
 */
public enum OrderStatus {
    PENDING_PAYMENT,
    PAID,
    PREPARING,
    READY,
    COMPLETED,
    CANCELED;

    public boolean isTerminal() {
        return this == COMPLETED || this == CANCELED;
    }

    public boolean isActive() {
        return !isTerminal();
    }
}
