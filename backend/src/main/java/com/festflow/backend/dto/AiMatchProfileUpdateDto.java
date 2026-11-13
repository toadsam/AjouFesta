package com.festflow.backend.dto;

public record AiMatchProfileUpdateDto(
        String currentNickname,
        String nickname,
        String gender,
        String intro,
        String phoneNumber,
        String meetPlace,
        String originalImageUrl,
        String generatedImageUrl,
        String pin,
        /** 사주용. 실명과 생년월일은 저장만 하고 공개하지 않는다. */
        String realName,
        String birthDate,
        String birthTime
) {
}
