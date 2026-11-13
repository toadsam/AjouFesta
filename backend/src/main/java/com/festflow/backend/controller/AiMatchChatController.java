package com.festflow.backend.controller;

import com.festflow.backend.dto.AiMatchChatChoiceDto;
import com.festflow.backend.dto.AiMatchChatEnterDto;
import com.festflow.backend.dto.AiMatchChatMessageDto;
import com.festflow.backend.dto.AiMatchChatSendDto;
import com.festflow.backend.dto.AiMatchChatStateDto;
import com.festflow.backend.dto.AiMatchProfileAccessRequestDto;
import com.festflow.backend.service.AiMatchChatService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 소개팅 부스 블라인드 채팅. 입장은 닉네임·비밀번호로, 그 뒤는 X-Chat-Token 헤더로 확인한다. */
@RestController
@RequestMapping("/api/ai-match")
public class AiMatchChatController {

    private static final String TOKEN_HEADER = "X-Chat-Token";

    private final AiMatchChatService chatService;

    public AiMatchChatController(AiMatchChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/requests/{requestId}/chat/enter")
    public AiMatchChatEnterDto enter(@PathVariable Long requestId, @RequestBody AiMatchProfileAccessRequestDto requestDto) {
        return chatService.enter(requestId, requestDto);
    }

    @GetMapping("/chat/state")
    public AiMatchChatStateDto state(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestParam(required = false) Long afterId
    ) {
        return chatService.state(token, afterId);
    }

    @PostMapping("/chat/messages")
    public AiMatchChatMessageDto send(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestBody AiMatchChatSendDto requestDto
    ) {
        return chatService.send(token, requestDto);
    }

    @PostMapping("/chat/choice")
    public AiMatchChatStateDto choose(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestBody AiMatchChatChoiceDto requestDto
    ) {
        return chatService.choose(token, requestDto);
    }
}
