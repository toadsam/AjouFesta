package com.festflow.backend.dto;

import java.time.LocalDateTime;

public record StaffMemberResponseDto(
        Long id,
        String staffNo,
        String name,
        String team,
        String status,
        String statusLabel,
        String currentTask,
        String currentNote,
        Long assignedBoothId,
        Double latitude,
        Double longitude,
        Boolean locationSharingEnabled,
        LocalDateTime lastUpdatedAt
) {
}

