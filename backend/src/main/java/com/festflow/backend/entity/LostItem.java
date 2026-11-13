package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "lost_items")
public class LostItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(nullable = false, length = 40)
    private String category;

    @Column(nullable = false, length = 120)
    private String foundLocation;

    @Column(length = 120)
    private String finderContact;

    @Column(length = 1000)
    private String imageUrl;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(nullable = false, length = 30)
    private String reporterType;

    @Column(nullable = false, length = 80)
    private String reporterRef;

    @Column(length = 500)
    private String resolveNote;

    @Column(length = 120)
    private String claimantName;

    @Column(length = 120)
    private String claimantContact;

    @Column(length = 1000)
    private String claimantNote;

    private LocalDateTime claimedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    protected LostItem() {
    }

    public LostItem(
            String title,
            String description,
            String category,
            String foundLocation,
            String finderContact,
            String imageUrl,
            String status,
            String reporterType,
            String reporterRef
    ) {
        this.title = title;
        this.description = description;
        this.category = category;
        this.foundLocation = foundLocation;
        this.finderContact = finderContact;
        this.imageUrl = imageUrl;
        this.status = status;
        this.reporterType = reporterType;
        this.reporterRef = reporterRef;
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

    public void update(
            String title,
            String description,
            String category,
            String foundLocation,
            String finderContact,
            String imageUrl,
            String status,
            String resolveNote
    ) {
        this.title = title;
        this.description = description;
        this.category = category;
        this.foundLocation = foundLocation;
        this.finderContact = finderContact;
        this.imageUrl = imageUrl;
        this.status = status;
        this.resolveNote = resolveNote;
    }

    public void markClaim(String claimantName, String claimantContact, String claimantNote, String status) {
        this.claimantName = claimantName;
        this.claimantContact = claimantContact;
        this.claimantNote = claimantNote;
        this.claimedAt = LocalDateTime.now();
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getCategory() {
        return category;
    }

    public String getFoundLocation() {
        return foundLocation;
    }

    public String getFinderContact() {
        return finderContact;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public String getStatus() {
        return status;
    }

    public String getReporterType() {
        return reporterType;
    }

    public String getReporterRef() {
        return reporterRef;
    }

    public String getResolveNote() {
        return resolveNote;
    }

    public String getClaimantName() {
        return claimantName;
    }

    public String getClaimantContact() {
        return claimantContact;
    }

    public String getClaimantNote() {
        return claimantNote;
    }

    public LocalDateTime getClaimedAt() {
        return claimedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}

