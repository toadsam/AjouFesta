package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "booth_reservations")
public class BoothReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booth_id", nullable = false)
    private Booth booth;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "table_id", nullable = false)
    private BoothReservationTable table;

    @Column(nullable = false)
    private String userKey;

    @Column(nullable = false)
    private Integer seatCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReservationStatus status;

    @Column(nullable = false)
    private LocalDateTime reservedAt;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    private LocalDateTime checkedInAt;

    private LocalDateTime expiredAt;

    /** 스태프가 "다음 팀 들어오세요" 호출한 시각. */
    private LocalDateTime calledAt;

    protected BoothReservation() {
    }

    public BoothReservation(Booth booth, BoothReservationTable table, String userKey, Integer seatCount,
                            ReservationStatus status, LocalDateTime reservedAt, LocalDateTime expiresAt) {
        this.booth = booth;
        this.table = table;
        this.userKey = userKey;
        this.seatCount = seatCount;
        this.status = status;
        this.reservedAt = reservedAt;
        this.expiresAt = expiresAt;
    }

    public void markCalled(LocalDateTime calledAt) {
        this.calledAt = calledAt;
    }

    public LocalDateTime getCalledAt() {
        return calledAt;
    }

    public void markCheckedIn(LocalDateTime checkedInAt) {
        this.status = ReservationStatus.CHECKED_IN;
        this.checkedInAt = checkedInAt;
    }

    public void markExpired(LocalDateTime expiredAt) {
        this.status = ReservationStatus.EXPIRED;
        this.expiredAt = expiredAt;
    }

    public void markCompleted() {
        this.status = ReservationStatus.COMPLETED;
    }

    public void markCancelled(LocalDateTime cancelledAt) {
        this.status = ReservationStatus.CANCELED;
        this.expiredAt = cancelledAt;
    }

    public Long getId() {
        return id;
    }

    public Booth getBooth() {
        return booth;
    }

    public BoothReservationTable getTable() {
        return table;
    }

    public String getUserKey() {
        return userKey;
    }

    public Integer getSeatCount() {
        return seatCount;
    }

    public ReservationStatus getStatus() {
        return status;
    }

    public LocalDateTime getReservedAt() {
        return reservedAt;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public LocalDateTime getCheckedInAt() {
        return checkedInAt;
    }

    public LocalDateTime getExpiredAt() {
        return expiredAt;
    }
}

