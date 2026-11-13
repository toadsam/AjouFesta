package com.festflow.backend.controller.admin;

import com.festflow.backend.dto.AiMatchAdminOverviewDto;
import com.festflow.backend.dto.AiMatchAdminArrivalDto;
import com.festflow.backend.dto.AiMatchAdminEscortDto;
import com.festflow.backend.dto.AiMatchAdminHiddenDto;
import com.festflow.backend.dto.AiMatchAdminNoShowDto;
import com.festflow.backend.dto.AiMatchAdminPhotoReviewDto;
import com.festflow.backend.dto.AiMatchAdminProfileDto;
import com.festflow.backend.dto.AiMatchReportDto;
import com.festflow.backend.dto.AiMatchReportResolveDto;
import com.festflow.backend.dto.AiMatchMeetupScheduleDto;
import com.festflow.backend.dto.AiMatchAdminNoteUpdateDto;
import com.festflow.backend.dto.AiMatchAdminPhonePurgeRequestDto;
import com.festflow.backend.dto.AiMatchAdminPhonePurgeResponseDto;
import com.festflow.backend.dto.AiMatchAdminRequestDto;
import com.festflow.backend.dto.AiMatchConnectionStatusUpdateDto;
import com.festflow.backend.service.AiMatchService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/ai-match")
public class AdminAiMatchController {

    private final AiMatchService aiMatchService;
    private final com.festflow.backend.service.AiMatchChatService aiMatchChatService;

    public AdminAiMatchController(AiMatchService aiMatchService, com.festflow.backend.service.AiMatchChatService aiMatchChatService) {
        this.aiMatchService = aiMatchService;
        this.aiMatchChatService = aiMatchChatService;
    }

    @GetMapping("/overview")
    public AiMatchAdminOverviewDto getOverview() {
        return aiMatchService.getAdminOverview();
    }

    /** 새 가입 받기 / 막기 스위치. 사람이 너무 많을 때 끈다. 이미 가입한 사람은 영향 없다. */
    @PutMapping("/registration")
    public com.festflow.backend.dto.AiMatchStatusDto setRegistrationOpen(
            @RequestBody com.festflow.backend.dto.AiMatchRegistrationUpdateDto requestDto
    ) {
        return aiMatchService.setRegistrationOpen(requestDto);
    }

    @PutMapping("/requests/{requestId}/connection-status")
    public AiMatchAdminRequestDto updateConnectionStatus(
            @PathVariable Long requestId,
            @RequestBody AiMatchConnectionStatusUpdateDto requestDto
    ) {
        return aiMatchService.updateConnectionStatus(requestId, requestDto);
    }

    @PutMapping("/requests/{requestId}/admin-note")
    public AiMatchAdminRequestDto updateAdminNote(
            @PathVariable Long requestId,
            @RequestBody AiMatchAdminNoteUpdateDto requestDto
    ) {
        return aiMatchService.updateAdminNote(requestId, requestDto);
    }

    @DeleteMapping("/profiles/{profileId}")
    public void deleteProfile(@PathVariable Long profileId) {
        aiMatchService.deleteProfileByAdmin(profileId);
    }

    @PostMapping("/phone-purge")
    public AiMatchAdminPhonePurgeResponseDto purgeByPhoneNumber(
            @Valid @RequestBody AiMatchAdminPhonePurgeRequestDto requestDto
    ) {
        return aiMatchService.purgeByPhoneNumber(requestDto);
    }

    @PostMapping("/reset")
    public com.festflow.backend.dto.AiMatchAdminResetResultDto resetAll(
            @RequestBody(required = false) com.festflow.backend.dto.AiMatchAdminResetRequestDto requestDto
    ) {
        return aiMatchService.resetAll(requestDto);
    }

    @PutMapping("/requests/{requestId}/arrival")
    public AiMatchAdminRequestDto markArrival(@PathVariable Long requestId, @RequestBody AiMatchAdminArrivalDto requestDto) {
        return aiMatchService.markArrival(requestId, requestDto);
    }

    @PutMapping("/requests/{requestId}/escort")
    public AiMatchAdminRequestDto setEscortStage(@PathVariable Long requestId, @RequestBody AiMatchAdminEscortDto requestDto) {
        return aiMatchService.setEscortStage(requestId, requestDto);
    }

    /** 두 사람이 자리에 앉은 뒤 스태프가 블라인드 채팅(타이머)을 시작한다. */
    @PostMapping("/requests/{requestId}/chat/start")
    public AiMatchAdminRequestDto startBlindChat(@PathVariable Long requestId) {
        return aiMatchService.startBlindChat(requestId);
    }

    /** 신고 확인용 채팅 기록. */
    @GetMapping("/requests/{requestId}/chat")
    public java.util.List<com.festflow.backend.dto.AiMatchAdminChatLineDto> getChatLog(@PathVariable Long requestId) {
        return aiMatchChatService.adminLog(requestId);
    }

    @PostMapping("/requests/{requestId}/met")
    public AiMatchAdminRequestDto markMet(@PathVariable Long requestId) {
        return aiMatchService.markMet(requestId);
    }

    @PostMapping("/requests/{requestId}/no-show")
    public AiMatchAdminRequestDto markNoShow(@PathVariable Long requestId, @RequestBody(required = false) AiMatchAdminNoShowDto requestDto) {
        return aiMatchService.markNoShow(requestId, requestDto);
    }

    @PutMapping("/profiles/{profileId}/hidden")
    public AiMatchAdminProfileDto setHidden(@PathVariable Long profileId, @RequestBody AiMatchAdminHiddenDto requestDto) {
        return aiMatchService.setProfileHidden(profileId, requestDto);
    }

    @PutMapping("/profiles/{profileId}/photo-review")
    public AiMatchAdminProfileDto reviewPhoto(@PathVariable Long profileId, @RequestBody AiMatchAdminPhotoReviewDto requestDto) {
        return aiMatchService.reviewPhoto(profileId, requestDto);
    }

    @PutMapping("/reports/{reportId}/resolve")
    public AiMatchReportDto resolveReport(@PathVariable Long reportId, @RequestBody(required = false) AiMatchReportResolveDto requestDto) {
        return aiMatchService.resolveReport(reportId, requestDto);
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public org.springframework.http.ResponseEntity<String> exportCsv(@RequestParam(defaultValue = "false") boolean statsOnly) {
        String csv = aiMatchService.exportAdminCsv(statsOnly);
        return org.springframework.http.ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"ai-match-report.csv\"")
                .contentType(new org.springframework.http.MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .body(csv);
    }

    @GetMapping("/summary")
    public com.festflow.backend.dto.AiMatchMasterSummaryDto getSummary() {
        return aiMatchService.getMasterSummary();
    }

    @GetMapping("/meetup-schedule")
    public AiMatchMeetupScheduleDto getMeetupSchedule(
            @org.springframework.web.bind.annotation.RequestParam(required = false) String date
    ) {
        return aiMatchService.getAdminMeetupSchedule(date);
    }
}
