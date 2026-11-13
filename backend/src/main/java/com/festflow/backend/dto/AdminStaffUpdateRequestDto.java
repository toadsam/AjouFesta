package com.festflow.backend.dto;

public record AdminStaffUpdateRequestDto(
        String name,
        String team,
        String status,
        String currentTask,
        String currentNote,
        Long assignedBoothId,
        Double latitude,
        Double longitude
) {
}

