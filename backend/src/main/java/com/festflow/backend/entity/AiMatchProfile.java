package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "ai_match_profiles")
public class AiMatchProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String nickname;

    @Column(nullable = false, length = 20)
    private String gender;

    @Column(nullable = false, length = 500)
    private String intro;

    @Column(length = 255)
    private String pinHash;

    @Column(length = 30)
    private String phoneNumber;

    @Column(nullable = false, length = 120)
    private String meetPlace;

    @Column(nullable = false, length = 1000)
    private String originalImageUrl;

    @Column(nullable = false, length = 1000)
    private String generatedImageUrl;

    @Column(nullable = false)
    private boolean consent;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    /**
     * 사주용 실명. 다른 참가자에게도, 관리자 화면에도 내보내지 않는다.
     * 기존 프로필에는 없으므로 null 을 허용한다.
     */
    @Column(length = 40)
    private String realName;

    /** 양력 생년월일. 사주를 세우는 데만 쓰고 공개하지 않는다. */
    private LocalDate birthDate;

    /** 태어난 시간. 모르면 null 이고 시주 없이 세 기둥만 나온다. */
    private LocalTime birthTime;

    /** AI가 쓴 사주 풀이. 매번 다시 부르지 않도록 저장해 둔다. */
    @Column(length = 2000)
    private String sajuReading;

    /** 운영진이 목록에서 숨김. 본인 로그인은 된다. */
    @Column(name = "hidden")
    private Boolean hidden;

    @Column(name = "hidden_reason", length = 200)
    private String hiddenReason;

    /** 사진 검수. null/PENDING 검수 전, APPROVED, REJECTED. */
    @Column(name = "photo_review", length = 20)
    private String photoReview;

    protected AiMatchProfile() {
    }

    public AiMatchProfile(
            String nickname,
            String gender,
            String intro,
            String pinHash,
            String phoneNumber,
            String meetPlace,
            String originalImageUrl,
            String generatedImageUrl,
            boolean consent
    ) {
        this.nickname = nickname;
        this.gender = gender;
        this.intro = intro;
        this.pinHash = pinHash;
        this.phoneNumber = phoneNumber;
        this.meetPlace = meetPlace;
        this.originalImageUrl = originalImageUrl;
        this.generatedImageUrl = generatedImageUrl;
        this.consent = consent;
        this.status = "ACTIVE";
    }

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getNickname() {
        return nickname;
    }

    public String getGender() {
        return gender;
    }

    public String getIntro() {
        return intro;
    }

    public String getPinHash() {
        return pinHash;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public String getMeetPlace() {
        return meetPlace;
    }

    public String getOriginalImageUrl() {
        return originalImageUrl;
    }

    public String getGeneratedImageUrl() {
        return generatedImageUrl;
    }

    public boolean isConsent() {
        return consent;
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void updateProfile(
            String nickname,
            String gender,
            String intro,
            String meetPlace,
            String phoneNumber,
            String originalImageUrl,
            String generatedImageUrl
    ) {
        this.nickname = nickname;
        this.gender = gender;
        this.intro = intro;
        this.meetPlace = meetPlace;
        if (phoneNumber != null) {
            this.phoneNumber = phoneNumber;
        }
        if (originalImageUrl != null) {
            this.originalImageUrl = originalImageUrl;
        }
        if (generatedImageUrl != null) {
            if (!generatedImageUrl.equals(this.generatedImageUrl)) {
                // 공개 사진이 바뀌면 다시 검수 대기로 돌린다.
                this.photoReview = "PENDING";
            }
            this.generatedImageUrl = generatedImageUrl;
        }
    }

    public String getRealName() {
        return realName;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public LocalTime getBirthTime() {
        return birthTime;
    }

    public String getSajuReading() {
        return sajuReading;
    }

    /** 사주가 세워져 있는가. 기능이 생기기 전에 가입한 프로필은 없을 수 있다. */
    public boolean isHidden() {
        return Boolean.TRUE.equals(hidden);
    }

    public String getHiddenReason() {
        return hiddenReason;
    }

    public void setHidden(boolean hidden, String reason) {
        this.hidden = hidden;
        this.hiddenReason = hidden ? reason : null;
    }

    public String getPhotoReview() {
        return photoReview == null || photoReview.isBlank() ? "PENDING" : photoReview;
    }

    public void setPhotoReview(String photoReview) {
        this.photoReview = photoReview;
    }

    public boolean hasSaju() {
        return birthDate != null;
    }

    public void updateSaju(String realName, LocalDate birthDate, LocalTime birthTime, String sajuReading) {
        this.realName = realName;
        this.birthDate = birthDate;
        this.birthTime = birthTime;
        this.sajuReading = sajuReading;
    }

    public void deactivate() {
        this.status = "DELETED";
        this.pinHash = null;
        // 탈퇴하면 사주에 쓰인 실명과 생년월일도 함께 지운다.
        this.realName = null;
        this.birthDate = null;
        this.birthTime = null;
        this.sajuReading = null;
    }
}
