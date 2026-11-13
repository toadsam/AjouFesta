package com.festflow.backend.dto;

public record StaffStatusUpdateRequestDto(
        String status,
        String currentTask,
        String currentNote,
        Double latitude,
        Double longitude,
        Boolean locationSharingEnabled
) {
}

