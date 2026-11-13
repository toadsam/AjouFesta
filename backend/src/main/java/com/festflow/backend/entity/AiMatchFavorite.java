package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "ai_match_favorites",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_ai_match_favorites_requester_target",
                columnNames = {"requester_profile_id", "favorite_profile_id"}
        )
)
public class AiMatchFavorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_profile_id", nullable = false)
    private AiMatchProfile requesterProfile;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "favorite_profile_id", nullable = false)
    private AiMatchProfile profile;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    protected AiMatchFavorite() {
    }

    public AiMatchFavorite(AiMatchProfile requesterProfile, AiMatchProfile profile) {
        this.requesterProfile = requesterProfile;
        this.profile = profile;
    }

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
