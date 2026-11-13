package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

/**
 * 소개팅 부스 15분 슬롯 하나를 잡은 기록. 부스는 한 번에 한 쌍만 받으므로 slot_at 이 유니크다.
 * 동시에 두 쌍이 같은 시간을 고르면 DB 가 한쪽을 막는다.
 * heldUntil 이 있으면 임시 잠금(상대 확정 대기), null 이면 확정.
 */
@Entity
@Table(
        name = "ai_match_meetup_slots",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_ai_match_meetup_slot_at", columnNames = "slot_at"),
                @UniqueConstraint(name = "uk_ai_match_meetup_slot_request", columnNames = "request_id")
        }
)
public class AiMatchMeetupSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "slot_at", nullable = false)
    private LocalDateTime slotAt;

    @Column(name = "request_id", nullable = false)
    private Long requestId;

    @Column(name = "held_until")
    private LocalDateTime heldUntil;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected AiMatchMeetupSlot() {
    }

    public AiMatchMeetupSlot(LocalDateTime slotAt, Long requestId, LocalDateTime heldUntil) {
        this.slotAt = slotAt;
        this.requestId = requestId;
        this.heldUntil = heldUntil;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public LocalDateTime getSlotAt() {
        return slotAt;
    }

    public Long getRequestId() {
        return requestId;
    }

    public LocalDateTime getHeldUntil() {
        return heldUntil;
    }

    /** 이 칸을 제안(또는 확정)한 시각. 운영진 화면에서 '언제 제안했는지'로 보여 준다. */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public boolean isConfirmed() {
        return heldUntil == null;
    }

    public void confirm() {
        this.heldUntil = null;
    }
}
