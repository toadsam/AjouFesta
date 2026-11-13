package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "reservation_user_accounts")
public class ReservationUserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String phoneNumber;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime lastVerifiedAt;

    protected ReservationUserAccount() {
    }

    public ReservationUserAccount(String phoneNumber, LocalDateTime now) {
        this.phoneNumber = phoneNumber;
        this.createdAt = now;
        this.lastVerifiedAt = now;
    }

    public void markVerified(LocalDateTime now) {
        this.lastVerifiedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }
}

