package com.festflow.backend.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 테이블 QR 로 들어온 주문 한 건.
 * 손님은 clientKey 로 자기 주문 상태를 조회하고, 스태프는 운영 키로 상태를 바꾼다.
 */
@Entity
@Table(name = "booth_orders", indexes = {
        @Index(name = "idx_booth_orders_booth_created", columnList = "booth_id, createdAt"),
        @Index(name = "idx_booth_orders_client_key", columnList = "clientKey")
})
public class BoothOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booth_id", nullable = false)
    private Booth booth;

    @Column(nullable = false, length = 40)
    private String tableLabel;

    @Column(length = 20)
    private String orderNo;

    @Column(nullable = false, length = 64)
    private String clientKey;

    @Column(nullable = false, length = 60)
    private String depositorName;

    @Column(length = 30)
    private String phoneNumber;

    @Column(length = 500)
    private String request;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;

    @Column(nullable = false)
    private Integer totalAmount;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime paidAt;

    private LocalDateTime readyAt;

    private LocalDateTime completedAt;

    private LocalDateTime canceledAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNo ASC")
    private List<BoothOrderItem> items = new ArrayList<>();

    protected BoothOrder() {
    }

    public BoothOrder(Booth booth, String tableLabel, String clientKey, String depositorName, String phoneNumber,
                      String request, PaymentMethod paymentMethod, LocalDateTime createdAt) {
        this.booth = booth;
        this.tableLabel = tableLabel;
        this.clientKey = clientKey;
        this.depositorName = depositorName;
        this.phoneNumber = phoneNumber;
        this.request = request;
        this.paymentMethod = paymentMethod;
        this.status = OrderStatus.PENDING_PAYMENT;
        this.totalAmount = 0;
        this.createdAt = createdAt;
    }

    public void addItem(String name, int unitPrice, int quantity) {
        BoothOrderItem item = new BoothOrderItem(this, items.size() + 1, name, unitPrice, quantity);
        items.add(item);
        totalAmount = items.stream().mapToInt(BoothOrderItem::lineTotal).sum();
    }

    public void assignOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    /** 모든 줄을 주방이 다 만들었나. 줄이 없으면(있을 수 없지만) 끝난 것으로 본다. */
    public boolean allItemsDone() {
        return items.stream().allMatch(BoothOrderItem::isDone);
    }

    /** 콘솔에서 '준비 완료'를 대신 누르거나 서빙이 끝나면 남은 줄도 모두 끝난 것으로 적는다. */
    public void markAllItemsDone(LocalDateTime at) {
        items.forEach(item -> item.markDone(at));
    }

    public void transitionTo(OrderStatus next, LocalDateTime at) {
        this.status = next;
        switch (next) {
            case PAID -> this.paidAt = this.paidAt == null ? at : this.paidAt;
            case PREPARING -> this.paidAt = this.paidAt == null ? at : this.paidAt;
            case READY -> {
                this.paidAt = this.paidAt == null ? at : this.paidAt;
                this.readyAt = at;
                markAllItemsDone(at);
            }
            case COMPLETED -> {
                this.paidAt = this.paidAt == null ? at : this.paidAt;
                this.readyAt = this.readyAt == null ? at : this.readyAt;
                this.completedAt = at;
                markAllItemsDone(at);
            }
            case CANCELED -> this.canceledAt = at;
            default -> {
            }
        }
    }

    public Long getId() {
        return id;
    }

    public Booth getBooth() {
        return booth;
    }

    public String getTableLabel() {
        return tableLabel;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public String getClientKey() {
        return clientKey;
    }

    public String getDepositorName() {
        return depositorName;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public String getRequest() {
        return request;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public Integer getTotalAmount() {
        return totalAmount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getPaidAt() {
        return paidAt;
    }

    public LocalDateTime getReadyAt() {
        return readyAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public LocalDateTime getCanceledAt() {
        return canceledAt;
    }

    public List<BoothOrderItem> getItems() {
        return items;
    }
}
