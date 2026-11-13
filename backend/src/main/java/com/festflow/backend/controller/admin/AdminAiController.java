package com.festflow.backend.controller.admin;

import com.festflow.backend.dto.AiAssistRequestDto;
import com.festflow.backend.dto.AiAssistResponseDto;
import com.festflow.backend.service.OpsAiService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/ai")
public class AdminAiController {

    private final OpsAiService opsAiService;

    public AdminAiController(OpsAiService opsAiService) {
        this.opsAiService = opsAiService;
    }

    @PostMapping("/briefing")
    public AiAssistResponseDto briefing() {
        return opsAiService.masterBriefing();
    }

    @PostMapping("/notice-draft")
    public AiAssistResponseDto noticeDraft(@RequestBody AiAssistRequestDto requestDto) {
        return opsAiService.masterNoticeDraft(requestDto);
    }
}
