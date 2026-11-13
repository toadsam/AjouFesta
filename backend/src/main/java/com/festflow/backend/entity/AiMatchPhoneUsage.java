package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "ai_match_phone_usages",
        uniqueConstraints = @UniqueConstraint(name = "uk_ai_match_phone_usages_phone", columnNames = "phone_number")
)
public class AiMatchPhoneUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "phone_number", nullable = false, length = 20, unique = true)
    private String phoneNumber;

    @Column(nullable = false)
    private int successfulImageConversionCount;

    @Column(nullable = false)
    private boolean blocked;

    private LocalDateTime blockedAt;

    private LocalDateTime cooldownUntil;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    protected AiMatchPhoneUsage() {
    }

    public AiMatchPhoneUsage(String phoneNumber) {
        this.phoneNumber = phoneNumber;
        this.successfulImageConversionCount = 0;
        this.blocked = false;
    }

    @PrePersist
    public void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public int getSuccessfulImageConversionCount() {
        return successfulImageConversionCount;
    }

    public boolean isBlocked() {
        return blocked;
    }

    public void recordSuccessfulImageConversion() {
        this.successfulImageConversionCount += 1;
    }

    /** 미리 잡아 둔 변환 횟수를 돌려준다(변환이 실패했을 때). */
    public void releaseImageConversion() {
        this.successfulImageConversionCount = Math.max(0, this.successfulImageConversionCount - 1);
    }

    public boolean isInCooldown() {
        return cooldownUntil != null && cooldownUntil.isAfter(LocalDateTime.now());
    }

    public void startCooldown(int hours) {
        this.cooldownUntil = LocalDateTime.now().plusHours(hours);
    }

    public void block() {
        this.blocked = true;
        if (this.blockedAt == null) {
            this.blockedAt = LocalDateTime.now();
        }
    }
}
