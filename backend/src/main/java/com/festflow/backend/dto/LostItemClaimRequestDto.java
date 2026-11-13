package com.festflow.backend.dto;

public record LostItemClaimRequestDto(
        String claimantName,
        String claimantContact,
        String claimantNote
) {
}
