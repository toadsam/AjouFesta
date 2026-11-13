package com.festflow.backend.dto;

import java.util.List;

public record AiMatchMeetupSlotsDto(
        String date,
        List<String> dates,
        int slotMinutes,
        int holdMinutes,
        String boothName,
        List<AiMatchMeetupSlotDto> slots,
        /** 지금부터 이 분 안에 시작하는 칸은 고를 수 없다(SOON). */
        int leadMinutes,
        /** 날짜별 남은 칸. */
        List<AiMatchMeetupDayDto> days
) {
}
