package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record StaffLoginResponseDto(
        String staffToken,
        LocalDateTime expiresAt,
        StaffMemberResponseDto me
) {
}

