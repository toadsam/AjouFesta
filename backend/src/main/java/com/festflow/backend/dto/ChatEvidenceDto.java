package com.festflow.backend.dto;

public record ChatEvidenceDto(
        String type,
        Long id,
        String label,
        String reason,
        String updatedAt
) {
}
