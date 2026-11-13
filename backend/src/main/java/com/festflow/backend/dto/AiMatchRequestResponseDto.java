package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record AiMatchRequestResponseDto(
        Long id,
        Long profileId,
        String profileNickname,
        String profileOriginalImageUrl,
        String profileImageUrl,
        Long requesterProfileId,
        String requesterNickname,
        String requesterOriginalImageUrl,
        String requesterImageUrl,
        String meetPlace,
        String message,
        String status,
        String statusReason,
        String meetupPlace,
        LocalDateTime meetupAt,
        Long meetupProposerProfileId,
        String meetupProposerNickname,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        /** 임시 잠금이 풀리는 시각. 확정됐거나 약속이 없으면 null. */
        LocalDateTime meetupHeldUntil,
        /** 블라인드 만남: 신청한 사람이 기다릴 곳 / 신청받은 사람이 기다릴 곳. */
        String requesterWaitingPlace,
        String profileWaitingPlace,
        /** 대기 장소 → 부스 안내 단계(NONE·ARRIVED·DEPARTED·PICKED_UP·AT_BOOTH)와 그 단계가 된 시각. */
        String requesterEscortStage,
        LocalDateTime requesterEscortStageAt,
        String profileEscortStage,
        LocalDateTime profileEscortStageAt,
        /** 만남 결과. MET / NO_SHOW_* / null. */
        String meetupOutcome,
        /** 블라인드 채팅 단계(NONE·OPEN·CHOOSING·MATCH·NO_MATCH·CLOSED). 끝난 채팅방을 다시 자동으로 열지 않으려고 준다. */
        String chatPhase,
        /** 연락처 공유에 각자 동의한 시각. 둘 다 있으면 서로 번호가 보인다. */
        LocalDateTime requesterContactConsentAt,
        LocalDateTime profileContactConsentAt,
        /** 두 사람 다 동의했을 때만, 이 응답을 받는 사람 눈에 보이는 상대 번호. 아니면 빈 문자열. */
        String sharedPhoneNumber
) {
}
