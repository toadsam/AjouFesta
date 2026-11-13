package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_match_requests")
public class AiMatchRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profile_id", nullable = false)
    private AiMatchProfile profile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_profile_id", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    @NotFound(action = NotFoundAction.IGNORE)
    private AiMatchProfile requesterProfile;

    @Column(nullable = false, length = 40)
    private String requesterNickname;

    @Column(nullable = false, length = 120)
    private String meetPlace;

    @Column(nullable = false, length = 500)
    private String message;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(length = 20)
    private String status;

    @Column(length = 40)
    private String statusReason;

    @Column(length = 30)
    private String connectionStatus;

    @Column(length = 1000)
    private String adminNote;

    @Column
    private LocalDateTime updatedAt;

    @Column(length = 120)
    private String meetupPlace;

    @Column
    private LocalDateTime meetupAt;

    @Column
    private Long meetupProposerProfileId;

    @Column(length = 40)
    private String meetupProposerNickname;

    /** 부스 현장 체크인. 도착 순간을 적는다. */
    @Column(name = "requester_arrived_at")
    private LocalDateTime requesterArrivedAt;

    @Column(name = "profile_arrived_at")
    private LocalDateTime profileArrivedAt;

    /**
     * 대기 장소 → 부스 안내 단계(사람마다). 대기 장소 도착(*_arrived_at) 다음에
     * 스태프 출발 → 스태프와 만남 → 부스 도착 순서로 채운다. 참가자 화면의 단계 바가 이 값을 읽는다.
     */
    @Column(name = "requester_staff_departed_at")
    private LocalDateTime requesterStaffDepartedAt;

    @Column(name = "requester_picked_up_at")
    private LocalDateTime requesterPickedUpAt;

    @Column(name = "requester_at_booth_at")
    private LocalDateTime requesterAtBoothAt;

    @Column(name = "profile_staff_departed_at")
    private LocalDateTime profileStaffDepartedAt;

    @Column(name = "profile_picked_up_at")
    private LocalDateTime profilePickedUpAt;

    @Column(name = "profile_at_booth_at")
    private LocalDateTime profileAtBoothAt;

    /** 약속 전 알림 문자를 보낸 시각. 한 번만 보내려고 적어 둔다. */
    @Column(name = "meetup_reminder_sent_at")
    private LocalDateTime meetupReminderSentAt;

    /** 블라인드 채팅이 열린 시각. 두 사람이 부스에 앉은 뒤 스태프가 '채팅 시작'을 누르면 채운다. */
    @Column(name = "chat_started_at")
    private LocalDateTime chatStartedAt;

    /** 채팅 뒤 얼굴 보기 선택. YES / NO / null(아직). */
    @Column(name = "requester_reveal", length = 5)
    private String requesterReveal;

    @Column(name = "profile_reveal", length = 5)
    private String profileReveal;

    /** 만남 결과. MET / NO_SHOW_REQUESTER / NO_SHOW_PROFILE / NO_SHOW_BOTH. null 이면 아직. */
    @Column(name = "meetup_outcome", length = 30)
    private String meetupOutcome;

    /**
     * 부스 시간을 못 잡은 두 사람이 "연락처를 주고받자"에 각자 동의한 시각.
     * 둘 다 있어야 서로 번호가 보인다. 한쪽만 동의한 동안은 상대에게 아무것도 안 넘어간다. 한 번 둘 다 동의하면 되돌리지 않는다.
     */
    @Column(name = "requester_contact_consent_at")
    private LocalDateTime requesterContactConsentAt;

    @Column(name = "profile_contact_consent_at")
    private LocalDateTime profileContactConsentAt;

    protected AiMatchRequest() {
    }

    public AiMatchRequest(
            AiMatchProfile profile,
            AiMatchProfile requesterProfile,
            String requesterNickname,
            String meetPlace,
            String message
    ) {
        this.profile = profile;
        this.requesterProfile = requesterProfile;
        this.requesterNickname = requesterNickname;
        this.meetPlace = meetPlace;
        this.message = message;
    }

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.status = "PENDING";
    }

    public Long getId() {
        return id;
    }

    public AiMatchProfile getProfile() {
        return profile;
    }

    public String getRequesterNickname() {
        return requesterNickname;
    }

    public AiMatchProfile getRequesterProfile() {
        return requesterProfile;
    }

    public String getMeetPlace() {
        return meetPlace;
    }

    public String getMessage() {
        return message;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getStatus() {
        return status == null ? "PENDING" : status;
    }

    public String getStatusReason() {
        return statusReason == null ? "" : statusReason;
    }

    public String getConnectionStatus() {
        if (!isMatchedStatus()) {
            return "";
        }
        return connectionStatus == null ? "WAITING" : connectionStatus;
    }

    public String getAdminNote() {
        return adminNote == null ? "" : adminNote;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public String getMeetupPlace() {
        return meetupPlace;
    }

    public LocalDateTime getMeetupAt() {
        return meetupAt;
    }

    public Long getMeetupProposerProfileId() {
        return meetupProposerProfileId;
    }

    public String getMeetupProposerNickname() {
        return meetupProposerNickname;
    }

    public void accept() {
        this.status = "ACCEPTED";
        this.statusReason = null;
        if (this.connectionStatus == null) {
            this.connectionStatus = "WAITING";
        }
        this.updatedAt = LocalDateTime.now();
    }

    public void reject() {
        this.status = "REJECTED";
        this.statusReason = null;
        this.updatedAt = LocalDateTime.now();
    }

    public void cancel() {
        this.status = "CANCELED";
        this.statusReason = "USER_CANCELED";
        this.updatedAt = LocalDateTime.now();
    }

    public void cancelForProfileDeleted() {
        this.status = "CANCELED";
        this.statusReason = "PROFILE_DELETED";
        this.updatedAt = LocalDateTime.now();
    }

    public void proposeMeetup(String meetupPlace, LocalDateTime meetupAt, Long proposerProfileId, String proposerNickname) {
        this.status = "PROPOSED";
        this.statusReason = null;
        if (this.connectionStatus == null) {
            this.connectionStatus = "WAITING";
        }
        this.meetupPlace = meetupPlace;
        this.meetupAt = meetupAt;
        this.meetupProposerProfileId = proposerProfileId;
        this.meetupProposerNickname = proposerNickname;
        clearEscort();
        this.meetupOutcome = null;
        this.updatedAt = LocalDateTime.now();
    }

    /** 약속을 없던 일로. 매칭(ACCEPTED)은 그대로 두고 시간만 다시 정하게 한다. */
    public void clearMeetup() {
        this.status = "ACCEPTED";
        this.statusReason = null;
        this.meetupPlace = null;
        this.meetupAt = null;
        this.meetupProposerProfileId = null;
        this.meetupProposerNickname = null;
        this.updatedAt = LocalDateTime.now();
    }

    public void confirmMeetup() {
        this.status = "CONFIRMED";
        this.statusReason = null;
        if (this.connectionStatus == null) {
            this.connectionStatus = "COMPLETED";
        }
        this.updatedAt = LocalDateTime.now();
    }

    public LocalDateTime getRequesterArrivedAt() {
        return requesterArrivedAt;
    }

    public LocalDateTime getProfileArrivedAt() {
        return profileArrivedAt;
    }

    public String getMeetupOutcome() {
        return meetupOutcome;
    }

    public LocalDateTime getRequesterStaffDepartedAt() {
        return requesterStaffDepartedAt;
    }

    public LocalDateTime getRequesterPickedUpAt() {
        return requesterPickedUpAt;
    }

    public LocalDateTime getRequesterAtBoothAt() {
        return requesterAtBoothAt;
    }

    public LocalDateTime getProfileStaffDepartedAt() {
        return profileStaffDepartedAt;
    }

    public LocalDateTime getProfilePickedUpAt() {
        return profilePickedUpAt;
    }

    public LocalDateTime getProfileAtBoothAt() {
        return profileAtBoothAt;
    }

    public LocalDateTime getMeetupReminderSentAt() {
        return meetupReminderSentAt;
    }

    public void markReminderSent() {
        this.meetupReminderSentAt = LocalDateTime.now();
    }

    /** 안내 단계 순서. NONE 은 아직 대기 장소에 안 온 상태. */
    public static final java.util.List<String> ESCORT_STAGES = java.util.List.of("NONE", "ARRIVED", "DEPARTED", "PICKED_UP", "AT_BOOTH");

    /**
     * 한 사람의 안내 단계를 stage 로 맞춘다. 그 단계까지 비어 있는 시각은 지금으로 채우고(이미 있으면 둔다),
     * 그 뒤 단계는 지운다. 그래서 한 칸 되돌리기도 같은 메서드로 된다.
     */
    public void setEscortStage(boolean requesterSide, String stage) {
        int target = ESCORT_STAGES.indexOf(stage);
        if (target < 0) {
            throw new IllegalArgumentException("unknown escort stage: " + stage);
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime[] current = requesterSide
                ? new LocalDateTime[]{requesterArrivedAt, requesterStaffDepartedAt, requesterPickedUpAt, requesterAtBoothAt}
                : new LocalDateTime[]{profileArrivedAt, profileStaffDepartedAt, profilePickedUpAt, profileAtBoothAt};
        LocalDateTime[] next = new LocalDateTime[4];
        for (int i = 0; i < 4; i++) {
            next[i] = i < target ? (current[i] != null ? current[i] : now) : null;
        }
        if (requesterSide) {
            requesterArrivedAt = next[0];
            requesterStaffDepartedAt = next[1];
            requesterPickedUpAt = next[2];
            requesterAtBoothAt = next[3];
        } else {
            profileArrivedAt = next[0];
            profileStaffDepartedAt = next[1];
            profilePickedUpAt = next[2];
            profileAtBoothAt = next[3];
        }
        this.updatedAt = now;
    }

    /** 지금 단계 이름(ESCORT_STAGES 중 하나). */
    public String escortStage(boolean requesterSide) {
        LocalDateTime[] values = requesterSide
                ? new LocalDateTime[]{requesterArrivedAt, requesterStaffDepartedAt, requesterPickedUpAt, requesterAtBoothAt}
                : new LocalDateTime[]{profileArrivedAt, profileStaffDepartedAt, profilePickedUpAt, profileAtBoothAt};
        int stage = 0;
        for (int i = 0; i < 4; i++) {
            if (values[i] != null) {
                stage = i + 1;
            }
        }
        return ESCORT_STAGES.get(stage);
    }

    public LocalDateTime getChatStartedAt() {
        return chatStartedAt;
    }

    public boolean bothAtBooth() {
        return requesterAtBoothAt != null && profileAtBoothAt != null;
    }

    public void startChat() {
        if (this.chatStartedAt == null) {
            this.chatStartedAt = LocalDateTime.now();
            this.updatedAt = this.chatStartedAt;
        }
    }

    public void resetChat() {
        this.chatStartedAt = null;
        this.requesterReveal = null;
        this.profileReveal = null;
    }

    public String getReveal(boolean requesterSide) {
        return requesterSide ? requesterReveal : profileReveal;
    }

    public void chooseReveal(boolean requesterSide, boolean reveal) {
        String value = reveal ? "YES" : "NO";
        if (requesterSide) {
            this.requesterReveal = value;
        } else {
            this.profileReveal = value;
        }
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 얼굴 보기 결과. 둘 다 골랐으면 둘 다 YES 일 때만 MATCH, 선택 시간이 지났는데 안 고른 사람이 있으면 NO_MATCH.
     * 아직 정해지지 않았으면 null — 한 명이 먼저 거절해도 상대가 고르기 전에는 알려 주지 않는다.
     */
    public String revealResult(LocalDateTime now, int chatMinutes, int chooseMinutes) {
        if (chatStartedAt == null) {
            return null;
        }
        if (requesterReveal != null && profileReveal != null) {
            return "YES".equals(requesterReveal) && "YES".equals(profileReveal) ? "MATCH" : "NO_MATCH";
        }
        return now.isAfter(chatStartedAt.plusMinutes((long) chatMinutes + chooseMinutes)) ? "NO_MATCH" : null;
    }

    /** 채팅 단계: NONE(아직 안 열림) · OPEN · CHOOSING · MATCH · NO_MATCH · CLOSED(선택 전에 만남이 끝남). */
    public String chatPhase(LocalDateTime now, int chatMinutes, int chooseMinutes) {
        if (chatStartedAt == null) {
            return "NONE";
        }
        String result = revealResult(now, chatMinutes, chooseMinutes);
        if (result != null && !now.isBefore(chatStartedAt.plusMinutes(chatMinutes))) {
            return result;
        }
        if ("MET".equals(meetupOutcome)) {
            return "CLOSED";
        }
        return now.isBefore(chatStartedAt.plusMinutes(chatMinutes)) ? "OPEN" : "CHOOSING";
    }

    private void clearEscort() {
        resetChat();
        this.requesterArrivedAt = null;
        this.profileArrivedAt = null;
        this.requesterStaffDepartedAt = null;
        this.requesterPickedUpAt = null;
        this.requesterAtBoothAt = null;
        this.profileStaffDepartedAt = null;
        this.profilePickedUpAt = null;
        this.profileAtBoothAt = null;
        this.meetupReminderSentAt = null;
    }

    public void markArrival(boolean requesterSide, boolean arrived) {
        if (arrived) {
            if ("NONE".equals(escortStage(requesterSide))) {
                setEscortStage(requesterSide, "ARRIVED");
            }
        } else {
            setEscortStage(requesterSide, "NONE");
        }
    }

    /** 두 사람이 부스에서 만났다. 연결 완료로 본다. */
    public void markMet() {
        LocalDateTime now = LocalDateTime.now();
        if (this.requesterArrivedAt == null) {
            this.requesterArrivedAt = now;
        }
        if (this.profileArrivedAt == null) {
            this.profileArrivedAt = now;
        }
        this.meetupOutcome = "MET";
        this.connectionStatus = "COMPLETED";
        this.updatedAt = now;
    }

    /** 노쇼. 약속은 지우고(슬롯 반납은 서비스가) 매칭은 남겨서 다시 잡을 수 있게 한다. */
    public void markNoShow(String outcome) {
        this.meetupOutcome = outcome;
        this.status = "ACCEPTED";
        this.statusReason = null;
        this.meetupPlace = null;
        this.meetupAt = null;
        this.meetupProposerProfileId = null;
        this.meetupProposerNickname = null;
        clearEscort();
        this.updatedAt = LocalDateTime.now();
    }

    public void updateConnectionStatus(String connectionStatus) {
        this.connectionStatus = connectionStatus;
        this.updatedAt = LocalDateTime.now();
    }

    public LocalDateTime getRequesterContactConsentAt() {
        return requesterContactConsentAt;
    }

    public LocalDateTime getProfileContactConsentAt() {
        return profileContactConsentAt;
    }

    public boolean hasContactConsent(boolean requesterSide) {
        return (requesterSide ? requesterContactConsentAt : profileContactConsentAt) != null;
    }

    /** 두 사람 다 동의해서 서로 번호를 볼 수 있는 상태. */
    public boolean isContactShared() {
        return requesterContactConsentAt != null && profileContactConsentAt != null;
    }

    /** 한 사람이 연락처 공유에 동의한다. 이미 했으면 그대로 둔다(시각을 덮어쓰지 않는다). */
    public void consentContactShare(boolean requesterSide) {
        LocalDateTime now = LocalDateTime.now();
        if (requesterSide) {
            if (requesterContactConsentAt == null) requesterContactConsentAt = now;
        } else if (profileContactConsentAt == null) {
            profileContactConsentAt = now;
        }
        this.updatedAt = now;
    }

    /**
     * 한 사람 눈에 보이는 연락처 공유 단계.
     * NONE(둘 다 아직) · WAITING(나만 동의, 상대 기다림) · ASKED(상대만 동의, 내 답 기다림) · SHARED(둘 다 동의).
     */
    public String contactShareState(boolean requesterSide) {
        boolean mine = hasContactConsent(requesterSide);
        boolean theirs = hasContactConsent(!requesterSide);
        if (mine && theirs) return "SHARED";
        if (mine) return "WAITING";
        if (theirs) return "ASKED";
        return "NONE";
    }

    public void updateAdminNote(String adminNote) {
        this.adminNote = adminNote;
        this.updatedAt = LocalDateTime.now();
    }

    private boolean isMatchedStatus() {
        String currentStatus = getStatus();
        return "ACCEPTED".equals(currentStatus) || "PROPOSED".equals(currentStatus) || "CONFIRMED".equals(currentStatus);
    }
}
