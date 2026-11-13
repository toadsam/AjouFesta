package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record AiMatchMeetupProposalDto(
        String nickname,
        String pin,
        String meetupPlace,
        LocalDateTime meetupAt
) {
}
