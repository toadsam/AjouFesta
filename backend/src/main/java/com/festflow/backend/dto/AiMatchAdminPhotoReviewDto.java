package com.festflow.backend.dto;

/** 사진 검수. decision: APPROVED / REJECTED. 반려하면 목록에서 숨긴다. */
public record AiMatchAdminPhotoReviewDto(
        String decision,
        String reason
) {
}
