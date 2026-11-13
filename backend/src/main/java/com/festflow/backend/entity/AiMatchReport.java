package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 참가자가 다른 참가자를 신고한 기록. 운영진이 보고 숨기기·삭제를 결정한다.
 * 신고한 사람은 상대에게 보이지 않는다.
 */
@Entity
@Table(name = "ai_match_reports")
public class AiMatchReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reporter_profile_id")
    private Long reporterProfileId;

    @Column(name = "reporter_nickname", length = 40)
    private String reporterNickname;

    @Column(name = "target_profile_id", nullable = false)
    private Long targetProfileId;

    @Column(name = "target_nickname", length = 40)
    private String targetNickname;

    @Column(nullable = false, length = 40)
    private String reason;

    @Column(length = 500)
    private String detail;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(length = 200)
    private String resolution;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    protected AiMatchReport() {
    }

    public AiMatchReport(Long reporterProfileId, String reporterNickname, Long targetProfileId, String targetNickname, String reason, String detail) {
        this.reporterProfileId = reporterProfileId;
        this.reporterNickname = reporterNickname;
        this.targetProfileId = targetProfileId;
        this.targetNickname = targetNickname;
        this.reason = reason;
        this.detail = detail;
    }

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = "OPEN";
        }
    }

    public void resolve(String resolution) {
        this.status = "RESOLVED";
        this.resolution = resolution;
        this.resolvedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getReporterProfileId() {
        return reporterProfileId;
    }

    public String getReporterNickname() {
        return reporterNickname;
    }

    public Long getTargetProfileId() {
        return targetProfileId;
    }

    public String getTargetNickname() {
        return targetNickname;
    }

    public String getReason() {
        return reason;
    }

    public String getDetail() {
        return detail;
    }

    public String getStatus() {
        return status == null ? "OPEN" : status;
    }

    public String getResolution() {
        return resolution;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }
}
