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

@Entity
@Table(name = "staff_sessions")
public class StaffSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "staff_member_id", nullable = false)
    private StaffMember staffMember;

    @Column(nullable = false, unique = true, length = 120)
    private String token;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private LocalDateTime lastSeenAt;

    protected StaffSession() {
    }

    public StaffSession(StaffMember staffMember, String token, LocalDateTime createdAt, LocalDateTime expiresAt) {
        this.staffMember = staffMember;
        this.token = token;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.lastSeenAt = createdAt;
    }

    public void touch(LocalDateTime now) {
        this.lastSeenAt = now;
    }

    public Long getId() {
        return id;
    }

    public StaffMember getStaffMember() {
        return staffMember;
    }

    public String getToken() {
        return token;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }
}

