package com.festflow.backend.service;

import com.festflow.backend.dto.AiDecisionLogDto;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

@Service
public class AiDecisionLogService {

    private static final int MAX_LOGS = 30;

    private final Deque<AiDecisionLogDto> logs = new ConcurrentLinkedDeque<>();

    public void record(
            String type,
            String title,
            String summary,
            List<String> reasons,
            List<String> actions
    ) {
        logs.addFirst(new AiDecisionLogDto(
                LocalDateTime.now(),
                type,
                title,
                summary,
                safeList(reasons),
                safeList(actions)
        ));
        trim();
    }

    public List<AiDecisionLogDto> recent() {
        return logs.stream().limit(MAX_LOGS).toList();
    }

    private List<String> safeList(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private void trim() {
        while (logs.size() > MAX_LOGS) {
            logs.pollLast();
        }
    }
}
