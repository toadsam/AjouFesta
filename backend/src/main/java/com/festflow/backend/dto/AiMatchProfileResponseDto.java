package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record AiMatchProfileResponseDto(
        Long id,
        String nickname,
        String gender,
        String intro,
        String meetPlace,
        String originalImageUrl,
        String generatedImageUrl,
        LocalDateTime createdAt,
        /** 사주. 기능이 생기기 전에 가입한 프로필은 null 이다. */
        SajuDto saju,
        /** 보는 사람과의 궁합. 목록/상세를 볼 때만 채워지고, 그 외에는 null 이다. */
        SajuCompatibilityDto compatibility
) {
}
