package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 주문 한 줄(메뉴 하나 · 수량). 주방이 메뉴별로 나뉘어 있어 줄마다 '다 만들었음'(doneAt)을 따로 둔다.
 * 모든 줄이 끝나면 주문이 READY(서빙 가능)가 된다 — OrderService.markItemDone.
 */
@Entity
@Table(name = "booth_order_items")
public class BoothOrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private BoothOrder order;

    @Column(nullable = false)
    private Integer lineNo;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    private Integer unitPrice;

    @Column(nullable = false)
    private Integer quantity;

    /** 이 줄을 맡은 주방이 다 만든 시각. null 이면 아직. */
    private LocalDateTime doneAt;

    protected BoothOrderItem() {
    }

    public BoothOrderItem(BoothOrder order, Integer lineNo, String name, Integer unitPrice, Integer quantity) {
        this.order = order;
        this.lineNo = lineNo;
        this.name = name;
        this.unitPrice = unitPrice;
        this.quantity = quantity;
    }

    public int lineTotal() {
        return unitPrice * quantity;
    }

    public boolean isDone() {
        return doneAt != null;
    }

    /** 이미 끝난 줄은 처음 끝난 시각을 그대로 둔다(두 번 눌러도 바뀌지 않게). */
    public void markDone(LocalDateTime at) {
        if (doneAt == null) doneAt = at;
    }

    public Long getId() {
        return id;
    }

    public BoothOrder getOrder() {
        return order;
    }

    public Integer getLineNo() {
        return lineNo;
    }

    public String getName() {
        return name;
    }

    public Integer getUnitPrice() {
        return unitPrice;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public LocalDateTime getDoneAt() {
        return doneAt;
    }
}
