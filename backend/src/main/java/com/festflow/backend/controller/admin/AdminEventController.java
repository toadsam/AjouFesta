package com.festflow.backend.controller.admin;

import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.dto.EventUpsertRequestDto;
import com.festflow.backend.service.AuditLogService;
import com.festflow.backend.service.EventService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/events")
public class AdminEventController {

    private final EventService eventService;
    private final AuditLogService auditLogService;

    public AdminEventController(EventService eventService, AuditLogService auditLogService) {
        this.eventService = eventService;
        this.auditLogService = auditLogService;
    }

    @PostMapping
    public EventResponseDto createEvent(@Valid @RequestBody EventUpsertRequestDto requestDto, Authentication authentication) {
        EventResponseDto created = eventService.createEvent(requestDto);
        auditLogService.log(authentication.getName(), "CREATE", "EVENT", created.id(), created.title());
        return created;
    }

    @PutMapping("/{id}")
    public EventResponseDto updateEvent(@PathVariable Long id, @Valid @RequestBody EventUpsertRequestDto requestDto, Authentication authentication) {
        EventResponseDto updated = eventService.updateEvent(id, requestDto);
        auditLogService.log(authentication.getName(), "UPDATE", "EVENT", id, updated.title());
        return updated;
    }

    @PutMapping("/bulk-status")
    public java.util.List<EventResponseDto> bulkUpdateStatus(@RequestBody com.festflow.backend.dto.EventBulkStatusRequestDto requestDto, Authentication authentication) {
        java.util.List<EventResponseDto> updated = eventService.bulkUpdateStatus(requestDto);
        auditLogService.log(authentication.getName(), "BULK_STATUS", "EVENT", null,
                (requestDto.statusOverride() == null || requestDto.statusOverride().isBlank() ? "auto" : requestDto.statusOverride()) + " x" + updated.size());
        return updated;
    }

    @DeleteMapping("/{id}")
    public void deleteEvent(@PathVariable Long id, Authentication authentication) {
        eventService.deleteEvent(id);
        auditLogService.log(authentication.getName(), "DELETE", "EVENT", id, "공연 삭제");
    }
}
