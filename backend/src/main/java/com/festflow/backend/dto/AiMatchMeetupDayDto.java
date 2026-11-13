package com.festflow.backend.dto;

/** 축제 하루의 부스 칸 현황. freeSlots 는 지금 새로 잡을 수 있는 칸(지난 칸·곧 시작하는 칸·겹치는 칸 제외). */
public record AiMatchMeetupDayDto(
        String date,
        int totalSlots,
        int freeSlots,
        int confirmedSlots,
        int heldSlots
) {
}
