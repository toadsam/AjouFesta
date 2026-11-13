package com.festflow.backend.controller;

import com.festflow.backend.dto.NoticeResponseDto;
import com.festflow.backend.service.NoticeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {

    private final NoticeService noticeService;

    public NoticeController(NoticeService noticeService) {
        this.noticeService = noticeService;
    }

    @org.springframework.web.bind.annotation.PostMapping("/{id}/view")
    public void recordView(@org.springframework.web.bind.annotation.PathVariable Long id) {
        noticeService.recordView(id);
    }

    @GetMapping("/active")
    public List<NoticeResponseDto> activeNotices() {
        return noticeService.getActiveNotices();
    }
}
