package com.festflow.backend.entity;

/**
 * 결제 수단. 현재 실제로 접수되는 것은 BANK_TRANSFER 뿐이다.
 * CARD / EASY_PAY 는 PG 계약이 생기면 열기 위해 자리만 잡아 둔다.
 */
public enum PaymentMethod {
    BANK_TRANSFER,
    CARD,
    EASY_PAY
}
