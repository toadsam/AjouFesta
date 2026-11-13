package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record AiMatchAdminRequestDto(
        Long id,
        Long profileId,
        String profileNickname,
        String profilePhoneNumber,
        String profileOriginalImageUrl,
        String profileImageUrl,
        Long requesterProfileId,
        String requesterNickname,
        String requesterPhoneNumber,
        String requesterOriginalImageUrl,
        String requesterImageUrl,
        String meetPlace,
        String message,
        String status,
        String statusReason,
        String connectionStatus,
        String adminNote,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String meetupPlace,
        LocalDateTime meetupAt,
        String requesterWaitingPlace,
        String profileWaitingPlace,
        LocalDateTime requesterArrivedAt,
        LocalDateTime profileArrivedAt,
        String meetupOutcome,
        /** 시간 제안 중(PROPOSED)일 때 누가 언제 제안했고 상대 응답을 언제까지 기다리는지. 확정·미정이면 null. */
        Long meetupProposerProfileId,
        String meetupProposerNickname,
        LocalDateTime meetupProposedAt,
        LocalDateTime meetupHeldUntil,
        /** 연락처 공유에 각자 동의한 시각. 둘 다 있으면 참가자끼리 번호가 열린 것. */
        LocalDateTime requesterContactConsentAt,
        LocalDateTime profileContactConsentAt
) {
}
