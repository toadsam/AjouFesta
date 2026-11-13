package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "reservation_user_states")
public class ReservationUserState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String userKey;

    @Column(nullable = false)
    private Integer noShowCount;

    private LocalDateTime blockedUntil;

    protected ReservationUserState() {
    }

    public ReservationUserState(String userKey) {
        this.userKey = userKey;
        this.noShowCount = 0;
    }

    public void registerNoShow(LocalDateTime now) {
        this.noShowCount += 1;
        if (this.noShowCount >= 2) {
            this.blockedUntil = now.plusMinutes(30);
            this.noShowCount = 0;
        }
    }

    public boolean isBlocked(LocalDateTime now) {
        return blockedUntil != null && blockedUntil.isAfter(now);
    }

    public Long getId() {
        return id;
    }

    public String getUserKey() {
        return userKey;
    }

    public Integer getNoShowCount() {
        return noShowCount;
    }

    public LocalDateTime getBlockedUntil() {
        return blockedUntil;
    }
}

