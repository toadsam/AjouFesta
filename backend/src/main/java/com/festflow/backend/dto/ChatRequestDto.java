package com.festflow.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatRequestDto(
        // 질문은 그대로 OpenAI 로 간다. 길이를 막지 않으면 남이 긴 글을 보내 비용을 쓰게 할 수 있다.
        @NotBlank @Size(max = 500) String question
) {
}

