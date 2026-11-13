package com.festflow.backend.dto;

import java.time.LocalDateTime;

/** 운영진 시간표 한 줄. 누가 어디서 기다리는지, 확정인지 임시인지. */
public record AiMatchMeetupScheduleItemDto(
        LocalDateTime slotAt,
        boolean confirmed,
        LocalDateTime heldUntil,
        Long requestId,
        String connectionStatus,
        String requesterNickname,
        String requesterGender,
        String requesterPhoneNumber,
        String requesterWaitingPlace,
        String profileNickname,
        String profileGender,
        String profilePhoneNumber,
        String profileWaitingPlace,
        LocalDateTime requesterArrivedAt,
        LocalDateTime profileArrivedAt,
        String meetupOutcome,
        String requesterEscortStage,
        LocalDateTime requesterEscortStageAt,
        String profileEscortStage,
        LocalDateTime profileEscortStageAt,
        LocalDateTime reminderSentAt,
        /** 블라인드 채팅 단계(NONE·OPEN·CHOOSING·MATCH·NO_MATCH·CLOSED)와 채팅이 끝나는 시각. */
        String chatPhase,
        LocalDateTime chatEndsAt
) {
}
