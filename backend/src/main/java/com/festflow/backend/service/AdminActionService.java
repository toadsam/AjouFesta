package com.festflow.backend.service;

import com.festflow.backend.dto.CongestionResponseDto;
import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.dto.NoticeResponseDto;
import com.festflow.backend.dto.NoticeUpsertRequestDto;
import org.springframework.stereotype.Service;

@Service
public class AdminActionService {

    private final BoothService boothService;
    private final EventService eventService;
    private final NoticeService noticeService;

    public AdminActionService(BoothService boothService, EventService eventService, NoticeService noticeService) {
        this.boothService = boothService;
        this.eventService = eventService;
        this.noticeService = noticeService;
    }

    public NoticeResponseDto publishCongestionReliefNotice() {
        CongestionResponseDto mostCongested = boothService.getMostCongestedBooth();
        String targetBooth = mostCongested != null ? mostCongested.boothName() : "현장 전체";

        return noticeService.createNotice(new NoticeUpsertRequestDto(
                "혼잡 완화 안내",
                targetBooth + " 주변이 매우 붐빕니다. 중앙광장 우회 동선을 이용해 주세요.",
                "긴급",
                true
        ));
    }

    public NoticeResponseDto publishEventStartNotice(Long eventId) {
        EventResponseDto event = eventService.getEventById(eventId);

        return noticeService.createNotice(new NoticeUpsertRequestDto(
                "공연 시작 안내",
                "지금부터 '" + event.title() + "' 공연이 시작됩니다. 관객석으로 이동해 주세요.",
                "긴급",
                true
        ));
    }
}
