package com.festflow.backend.controller;

import com.festflow.backend.dto.ChatRequestDto;
import com.festflow.backend.dto.ChatResponseDto;
import com.festflow.backend.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping
    public ChatResponseDto chat(@Valid @RequestBody ChatRequestDto requestDto) {
        return chatService.answer(requestDto.question());
    }
}

