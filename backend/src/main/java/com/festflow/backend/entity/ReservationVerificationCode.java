package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDateTime;

@Entity
@Table(name = "reservation_verification_codes")
public class ReservationVerificationCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String phoneNumber;

    @Column(nullable = false, length = 120)
    private String code;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @ColumnDefault("0")
    private Integer failedAttempts = 0;

    private LocalDateTime usedAt;

    protected ReservationVerificationCode() {
    }

    public ReservationVerificationCode(String phoneNumber, String code, LocalDateTime expiresAt, LocalDateTime createdAt) {
        this.phoneNumber = phoneNumber;
        this.code = code;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
        this.failedAttempts = 0;
    }

    public boolean isExpired(LocalDateTime now) {
        return expiresAt.isBefore(now);
    }

    public boolean isUsed() {
        return usedAt != null;
    }

    public void markUsed(LocalDateTime now) {
        this.usedAt = now;
    }

    public int incrementFailedAttempts() {
        this.failedAttempts = getFailedAttempts() + 1;
        return getFailedAttempts();
    }

    public String getCode() {
        return code;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public int getFailedAttempts() {
        return failedAttempts == null ? 0 : failedAttempts;
    }
}
