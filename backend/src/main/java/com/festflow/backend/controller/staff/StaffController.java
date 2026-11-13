package com.festflow.backend.controller.staff;

import com.festflow.backend.dto.AiAssistRequestDto;
import com.festflow.backend.dto.AiAssistResponseDto;
import com.festflow.backend.dto.StaffBootstrapDto;
import com.festflow.backend.dto.StaffLoginRequestDto;
import com.festflow.backend.dto.StaffLoginResponseDto;
import com.festflow.backend.dto.StaffMemberResponseDto;
import com.festflow.backend.dto.StaffStatusUpdateRequestDto;
import com.festflow.backend.service.StaffService;
import com.festflow.backend.service.OpsAiService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/staff")
public class StaffController {

    private final StaffService staffService;
    private final OpsAiService opsAiService;

    public StaffController(StaffService staffService, OpsAiService opsAiService) {
        this.staffService = staffService;
        this.opsAiService = opsAiService;
    }

    @PostMapping("/auth/login")
    public StaffLoginResponseDto login(@Valid @RequestBody StaffLoginRequestDto requestDto) {
        return staffService.login(requestDto);
    }

    @PostMapping("/auth/logout")
    public void logout(@RequestHeader(value = "X-Staff-Token", required = false) String staffToken) {
        staffService.logout(staffToken);
    }

    @GetMapping("/bootstrap")
    public StaffBootstrapDto bootstrap(
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken
    ) {
        return staffService.bootstrap(staffToken);
    }

    @PutMapping("/me/status")
    public StaffMemberResponseDto updateMyStatus(
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken,
            @RequestBody StaffStatusUpdateRequestDto requestDto
    ) {
        return staffService.updateMyStatus(staffToken, requestDto);
    }

    @PostMapping("/ai/zone-summary")
    public AiAssistResponseDto aiZoneSummary(
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken
    ) {
        return opsAiService.staffZoneSummary(staffToken);
    }

    @PostMapping("/ai/lost-item-assist")
    public AiAssistResponseDto aiLostItemAssist(
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken,
            @RequestBody AiAssistRequestDto requestDto
    ) {
        return opsAiService.staffLostItemAssist(staffToken, requestDto);
    }

    @PostMapping("/ai/field-checklist")
    public AiAssistResponseDto aiFieldChecklist(
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken
    ) {
        return opsAiService.staffFieldChecklist(staffToken);
    }

    @PostMapping("/ai/reply-draft")
    public AiAssistResponseDto aiReplyDraft(
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken,
            @RequestBody AiAssistRequestDto requestDto
    ) {
        return opsAiService.staffReplyDraft(staffToken, requestDto);
    }
}

