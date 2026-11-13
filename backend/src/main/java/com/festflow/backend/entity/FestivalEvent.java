package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "events")
public class FestivalEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(nullable = false)
    private String status;

    @Column(length = 20)
    private String statusOverride;

    @Column(length = 1000)
    private String imageUrl;

    @Column(length = 500)
    private String imageCredit;

    @Column(length = 100)
    private String imageFocus;

    @Column(length = 500)
    private String liveMessage;

    private Integer delayMinutes;

    private LocalDateTime statusUpdatedAt;

    protected FestivalEvent() {
    }

    public FestivalEvent(String title, LocalDateTime startTime, LocalDateTime endTime, String status) {
        this(title, startTime, endTime, status, null, null, null);
    }

    public FestivalEvent(String title, LocalDateTime startTime, LocalDateTime endTime, String status, String imageUrl, String imageCredit) {
        this(title, startTime, endTime, status, imageUrl, imageCredit, null);
    }

    public FestivalEvent(String title, LocalDateTime startTime, LocalDateTime endTime, String status, String imageUrl, String imageCredit, String imageFocus) {
        this.title = title;
        this.startTime = startTime;
        this.endTime = endTime;
        this.status = status;
        this.imageUrl = imageUrl;
        this.imageCredit = imageCredit;
        this.imageFocus = imageFocus;
    }

    public void update(String title, LocalDateTime startTime, LocalDateTime endTime, String imageUrl, String imageCredit, String imageFocus, String statusOverride, String liveMessage, Integer delayMinutes) {
        this.title = title;
        this.startTime = startTime;
        this.endTime = endTime;
        this.imageUrl = normalizeBlank(imageUrl);
        this.imageCredit = normalizeBlank(imageCredit);
        this.imageFocus = normalizeBlank(imageFocus);
        String nextStatusOverride = normalizeStatus(statusOverride);
        String nextLiveMessage = normalizeBlank(liveMessage);
        Integer nextDelayMinutes = delayMinutes != null && delayMinutes >= 0 ? delayMinutes : null;
        if (!same(this.statusOverride, nextStatusOverride)
                || !same(this.liveMessage, nextLiveMessage)
                || !same(this.delayMinutes, nextDelayMinutes)) {
            this.statusUpdatedAt = LocalDateTime.now();
        }
        this.statusOverride = nextStatusOverride;
        this.liveMessage = nextLiveMessage;
        this.delayMinutes = nextDelayMinutes;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getStatusOverride() {
        return statusOverride;
    }

    public void setStatusOverride(String statusOverride) {
        String nextStatusOverride = normalizeStatus(statusOverride);
        if (!same(this.statusOverride, nextStatusOverride)) {
            this.statusUpdatedAt = LocalDateTime.now();
        }
        this.statusOverride = nextStatusOverride;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public String getImageCredit() {
        return imageCredit;
    }

    public String getImageFocus() {
        return imageFocus;
    }

    public void setImage(String imageUrl, String imageCredit, String imageFocus) {
        this.imageUrl = normalizeBlank(imageUrl);
        this.imageCredit = normalizeBlank(imageCredit);
        this.imageFocus = normalizeBlank(imageFocus);
    }

    public String getLiveMessage() {
        return liveMessage;
    }

    public Integer getDelayMinutes() {
        return delayMinutes;
    }

    public LocalDateTime getStatusUpdatedAt() {
        return statusUpdatedAt;
    }

    private String normalizeBlank(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeStatus(String value) {
        String normalized = normalizeBlank(value);
        if (normalized == null) {
            return null;
        }
        if (normalized.equals("\uC608\uC815")
                || normalized.equals("\uB300\uAE30\uC911")
                || normalized.equals("\uACE7 \uC2DC\uC791")
                || normalized.equals("\uC9C0\uC5F0")
                || normalized.equals("\uC9C4\uD589\uC911")
                || normalized.equals("\uC885\uB8CC")
                || normalized.equals("\uCDE8\uC18C")) {
            return normalized;
        }
        return null;
    }

    private boolean same(Object left, Object right) {
        if (left == null) {
            return right == null;
        }
        return left.equals(right);
    }
}
