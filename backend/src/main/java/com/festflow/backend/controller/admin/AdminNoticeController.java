package com.festflow.backend.controller.admin;

import com.festflow.backend.dto.NoticeResponseDto;
import com.festflow.backend.dto.NoticeUpsertRequestDto;
import com.festflow.backend.service.AuditLogService;
import com.festflow.backend.service.NoticeService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/notices")
public class AdminNoticeController {

    private final NoticeService noticeService;
    private final AuditLogService auditLogService;

    public AdminNoticeController(NoticeService noticeService, AuditLogService auditLogService) {
        this.noticeService = noticeService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<NoticeResponseDto> getAllNotices() {
        return noticeService.getAllNotices();
    }

    @PostMapping
    public NoticeResponseDto createNotice(@Valid @RequestBody NoticeUpsertRequestDto requestDto, Authentication authentication) {
        NoticeResponseDto created = noticeService.createNotice(requestDto);
        auditLogService.log(authentication.getName(), "CREATE", "NOTICE", created.id(), created.title());
        return created;
    }

    @PutMapping("/{id}")
    public NoticeResponseDto updateNotice(@PathVariable Long id, @Valid @RequestBody NoticeUpsertRequestDto requestDto, Authentication authentication) {
        NoticeResponseDto updated = noticeService.updateNotice(id, requestDto);
        auditLogService.log(authentication.getName(), "UPDATE", "NOTICE", id, updated.title());
        return updated;
    }

    @DeleteMapping("/{id}")
    public void deleteNotice(@PathVariable Long id, Authentication authentication) {
        noticeService.deleteNotice(id);
        auditLogService.log(authentication.getName(), "DELETE", "NOTICE", id, "공지 삭제");
    }
}
