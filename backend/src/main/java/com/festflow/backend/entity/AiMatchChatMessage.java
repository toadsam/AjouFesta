package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 소개팅 부스 블라인드 채팅 한 줄. 부스에 앉은 두 사람이 얼굴을 보기 전 10분 동안 나눈다.
 * type: TEXT(사람이 쓴 말) · TOPIC(추천 주제 카드). 축제가 끝나면 보관 기한이 지난 것부터 지운다.
 */
@Entity
@Table(name = "ai_match_chat_messages", indexes = @Index(name = "idx_ai_match_chat_request", columnList = "request_id, id"))
public class AiMatchChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false)
    private Long requestId;

    @Column(name = "sender_profile_id", nullable = false)
    private Long senderProfileId;

    @Column(nullable = false, length = 10)
    private String type;

    @Column(nullable = false, length = 500)
    private String content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected AiMatchChatMessage() {
    }

    public AiMatchChatMessage(Long requestId, Long senderProfileId, String type, String content) {
        this.requestId = requestId;
        this.senderProfileId = senderProfileId;
        this.type = type;
        this.content = content;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getRequestId() {
        return requestId;
    }

    public Long getSenderProfileId() {
        return senderProfileId;
    }

    public String getType() {
        return type;
    }

    public String getContent() {
        return content;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
