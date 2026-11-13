package com.festflow.backend.dto;

import java.util.List;

public record AiMatchMeetupScheduleDto(
        String date,
        List<String> dates,
        String boothName,
        int totalSlots,
        int slotMinutes,
        /** 그날 부스 여는 시각 · 마지막 칸 시작 시각(날짜마다 다르다). 한눈에 표의 줄을 만들 때 쓴다. */
        String openTime,
        String lastSlotTime,
        /** 시간표를 만든 서버 시각. 화면 시계와 어긋나도 남은 시간을 맞게 보여 주려고 준다. */
        java.time.LocalDateTime serverNow,
        List<AiMatchMeetupScheduleItemDto> items,
        /** 날짜별 남은 칸. 칸이 모자라기 전에 운영진이 알 수 있게. */
        List<AiMatchMeetupDayDto> days
) {
}
