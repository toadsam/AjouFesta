package com.festflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.AiBoothRecommendationDto;
import com.festflow.backend.dto.AiFestivalGuideDto;
import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.ChatEvidenceDto;
import com.festflow.backend.dto.ChatResponseDto;
import com.festflow.backend.dto.CongestionResponseDto;
import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.dto.LostItemResponseDto;
import com.festflow.backend.dto.NoticeResponseDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ChatService {

    private static final String OPENAI_RESPONSES_PATH = "/v1/responses";
    private static final int MAX_EVIDENCE = 5;
    private static final List<KnowledgeChunk> STATIC_KNOWLEDGE = List.of(
            new KnowledgeChunk(1L, "예약 안내", "예약 가능한 부스는 부스 상세 화면에서 예약 상태와 테이블 현황을 먼저 확인한 뒤 예약해야 합니다. 예약이 꺼진 부스는 현장 이용 방식입니다.", "faq", null),
            new KnowledgeChunk(2L, "혼잡도 안내", "혼잡도는 주변 GPS 및 운영 데이터 기반 참고값입니다. 안전 이동이 필요하면 여유 또는 보통 단계의 부스를 우선 추천합니다.", "faq", null),
            new KnowledgeChunk(3L, "분실물 안내", "분실물을 찾을 때는 물품 종류, 색상, 특징, 잃어버린 위치와 시간을 함께 알려주면 등록된 분실물과 더 잘 대조할 수 있습니다.", "faq", null),
            new KnowledgeChunk(4L, "공연 안내", "공연 추천은 현재 시간, 공연 시작/종료 시간, 진행 상태를 기준으로 안내합니다. 지연 또는 취소 공지가 있으면 공지를 우선 확인해야 합니다.", "faq", null),
            new KnowledgeChunk(5L, "응급 안내", "응급 상황이나 몸이 좋지 않은 경우 응급 부스 또는 종합 안내 데스크로 이동하고, 심각한 상황은 현장 스태프에게 즉시 알려야 합니다.", "safety", null)
    );

    private final BoothService boothService;
    private final EventService eventService;
    private final LostItemService lostItemService;
    private final NoticeService noticeService;
    private final AiCongestionService aiCongestionService;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String apiKey;
    private final String model;

    public ChatService(
            BoothService boothService,
            EventService eventService,
            LostItemService lostItemService,
            NoticeService noticeService,
            AiCongestionService aiCongestionService,
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            @Value("${app.openai.api-key:}") String apiKey,
            @Value("${app.openai.model:gpt-5-mini}") String model
    ) {
        this.boothService = boothService;
        this.eventService = eventService;
        this.lostItemService = lostItemService;
        this.noticeService = noticeService;
        this.aiCongestionService = aiCongestionService;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder
                .baseUrl("https://api.openai.com")
                .requestFactory(requestFactory())
                .build();
        this.apiKey = apiKey;
        this.model = model;
    }

    public ChatResponseDto answer(String question) {
        RetrievalResult retrieval = retrieveEvidence(question);
        String confidence = resolveConfidence(retrieval);

        if (apiKey == null || apiKey.isBlank()) {
            List<String> warnings = new ArrayList<>(retrieval.warnings());
            warnings.add("AI API 키가 설정되지 않아 기본 안내로 응답했습니다.");
            return new ChatResponseDto(buildFallbackAnswer(question, retrieval), confidence, retrieval.evidence(), warnings);
        }

        try {
            Map<String, Object> request = Map.of(
                    "model", model,
                    "instructions", buildInstructions(),
                    "input", buildInput(question, retrieval),
                    "max_output_tokens", 220
            );

            String response = restClient.post()
                    .uri(OPENAI_RESPONSES_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> headers.setBearerAuth(apiKey))
                    .body(request)
                    .retrieve()
                    .body(String.class);

            String answer = extractAnswer(response);
            if (answer == null || answer.isBlank()) {
                List<String> warnings = new ArrayList<>(retrieval.warnings());
                warnings.add("AI 응답을 해석하지 못해 기본 안내를 표시했습니다.");
                return new ChatResponseDto(buildFallbackAnswer(question, retrieval), confidence, retrieval.evidence(), warnings);
            }
            return new ChatResponseDto(answer.trim(), confidence, retrieval.evidence(), retrieval.warnings());
        } catch (RestClientException ex) {
            List<String> warnings = new ArrayList<>(retrieval.warnings());
            warnings.add("AI 연결에 실패해 근거 기반 기본 안내를 표시했습니다.");
            return new ChatResponseDto(buildFallbackAnswer(question, retrieval), confidence, retrieval.evidence(), warnings);
        } catch (Exception ex) {
            List<String> warnings = new ArrayList<>(retrieval.warnings());
            warnings.add("AI 답변 생성 중 오류가 발생해 기본 안내를 표시했습니다.");
            return new ChatResponseDto(buildFallbackAnswer(question, retrieval), confidence, retrieval.evidence(), warnings);
        }
    }

    private SimpleClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(8));
        return factory;
    }

    private RetrievalResult retrieveEvidence(String question) {
        List<EvidenceCandidate> candidates = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        String normalizedQuestion = normalize(question);
        Set<String> terms = terms(normalizedQuestion);
        LocalDateTime now = LocalDateTime.now();
        boolean wantsLostItems = wantsLostItems(normalizedQuestion);
        boolean wantsEvents = wantsEvents(normalizedQuestion);
        boolean wantsBooths = wantsBooths(normalizedQuestion) || (!wantsLostItems && !wantsEvents);
        boolean wantsCongestion = wantsCongestion(normalizedQuestion);
        boolean wantsKnowledge = wantsKnowledge(normalizedQuestion);

        if (wantsBooths) {
            List<BoothResponseDto> booths = boothService.getAllBooths();
            Map<Long, CongestionResponseDto> congestionByBoothId = wantsCongestion ? safeCongestionByBoothId() : Map.of();
            for (BoothResponseDto booth : booths) {
                CongestionResponseDto congestion = congestionByBoothId.get(booth.id());
                int score = scoreBooth(booth, congestion, normalizedQuestion, terms);
                if (score <= 0) {
                    continue;
                }

                if (booth.liveStatusUpdatedAt() != null && Duration.between(booth.liveStatusUpdatedAt(), now).toMinutes() > 15) {
                    warnings.add(booth.name() + " 운영 상태는 15분 이상 지난 정보일 수 있습니다.");
                }

                candidates.add(new EvidenceCandidate(
                        score,
                        new ChatEvidenceDto(
                                "booth",
                                booth.id(),
                                booth.name(),
                                boothReason(booth, congestion),
                                stringify(booth.liveStatusUpdatedAt())
                        )
                ));
            }
        }

        if (wantsEvents) {
            List<EventResponseDto> events = eventService.getAllEvents();
            for (EventResponseDto event : events) {
                int score = scoreEvent(event, normalizedQuestion, terms, now);
                if (score <= 0) {
                    continue;
                }
                candidates.add(new EvidenceCandidate(
                        score,
                        new ChatEvidenceDto(
                                "event",
                                event.id(),
                                event.title(),
                                eventReason(event, now),
                                stringify(event.statusUpdatedAt())
                        )
                ));
            }
        }

        if (wantsLostItems) {
            List<LostItemResponseDto> lostItems = lostItemService.getAll(true);
            for (LostItemResponseDto item : lostItems) {
                int score = scoreLostItem(item, normalizedQuestion, terms);
                if (score <= 0) {
                    continue;
                }
                candidates.add(new EvidenceCandidate(
                        score,
                        new ChatEvidenceDto(
                                "lost_item",
                                item.id(),
                                item.title(),
                                lostItemReason(item),
                                stringify(item.updatedAt() != null ? item.updatedAt() : item.createdAt())
                        )
                ));
            }
        }

        if (wantsCongestion || wantsBooths) {
            addAiRecommendationEvidence(candidates);
        }

        if (wantsKnowledge || candidates.isEmpty()) {
            addNoticeEvidence(candidates, normalizedQuestion, terms);
            addStaticKnowledgeEvidence(candidates, normalizedQuestion, terms);
        }

        List<ChatEvidenceDto> evidence = candidates.stream()
                .sorted(Comparator.comparingInt(EvidenceCandidate::score).reversed())
                .map(EvidenceCandidate::evidence)
                .filter(distinctEvidence())
                .limit(MAX_EVIDENCE)
                .toList();

        if (evidence.isEmpty()) {
            warnings.add("질문과 직접 연결되는 축제 데이터 근거를 찾지 못했습니다.");
        }

        return new RetrievalResult(evidence, warnings);
    }

    private void addAiRecommendationEvidence(List<EvidenceCandidate> candidates) {
        try {
            AiFestivalGuideDto guide = aiCongestionService.guide();
            guide.recommendedNow().stream()
                    .limit(3)
                    .forEach(item -> candidates.add(new EvidenceCandidate(
                            8,
                            new ChatEvidenceDto(
                                    "ai_recommendation",
                                    item.boothId(),
                                    item.boothName(),
                                    aiRecommendationReason(item, false),
                                    null
                            )
                    )));
            guide.avoidNow().stream()
                    .limit(2)
                    .forEach(item -> candidates.add(new EvidenceCandidate(
                            6,
                            new ChatEvidenceDto(
                                    "ai_warning",
                                    item.boothId(),
                                    item.boothName(),
                                    aiRecommendationReason(item, true),
                                    null
                            )
                    )));
        } catch (Exception ex) {
            // AI guide evidence is optional; the chatbot can still answer from raw festival data.
        }
    }

    private String aiRecommendationReason(AiBoothRecommendationDto item, boolean avoid) {
        List<String> parts = new ArrayList<>();
        if (avoid) {
            parts.add("지금은 잠시 피하는 편이 좋습니다");
        } else {
            parts.add("지금 방문하기 좋은 후보입니다");
        }
        parts.add("주변 감지 인원 " + Math.max(0, item.currentCrowdCount()) + "명");
        if (item.waitMinutes() != null) {
            parts.add("예상 대기 " + Math.max(0, item.waitMinutes()) + "분");
        }
        if (item.availableSeats() != null) {
            parts.add(item.availableSeats() > 0
                    ? "예약 가능 좌석 " + item.availableSeats() + "석"
                    : "예약 가능 좌석 없음");
        }
        if (item.remainingStock() != null) {
            parts.add(item.remainingStock() > 10
                    ? "재고 여유"
                    : "재고가 적어질 수 있음");
        }
        return String.join(", ", parts);
    }

    private boolean wantsBooths(String question) {
        return containsAny(question, "부스", "booth", "먹", "음식", "메뉴", "추천", "대기", "재고", "예약", "주점", "포토", "체험", "굿즈", "상품", "식사");
    }

    private boolean wantsEvents(String question) {
        return containsAny(question, "공연", "이벤트", "일정", "무대", "시작", "라인업", "event");
    }

    private boolean wantsLostItems(String question) {
        return containsAny(question, "분실", "잃어", "잃어버", "찾", "지갑", "가방", "핸드폰", "휴대폰", "lost", "물건");
    }

    private boolean wantsCongestion(String question) {
        return containsAny(question, "혼잡", "붐비", "사람", "여유", "한산", "지금 추천", "지금 기준");
    }

    private boolean wantsKnowledge(String question) {
        return containsAny(
                question,
                "공지", "안내", "방법", "어떻게", "규칙", "주의", "안전", "응급", "우천", "비", "예약", "분실", "도움", "faq"
        );
    }

    private void addNoticeEvidence(List<EvidenceCandidate> candidates, String question, Set<String> terms) {
        try {
            for (NoticeResponseDto notice : noticeService.getActiveNotices()) {
                int score = scoreText(terms, notice.title(), notice.content(), notice.category());
                if (containsAny(question, "공지", "안내", "우천", "비", "긴급", "분실")) {
                    score += 2;
                }
                if (score <= 0) {
                    continue;
                }

                candidates.add(new EvidenceCandidate(
                        score,
                        new ChatEvidenceDto(
                                "notice",
                                notice.id(),
                                notice.title(),
                                noticeReason(notice),
                                stringify(notice.updatedAt() != null ? notice.updatedAt() : notice.createdAt())
                        )
                ));
            }
        } catch (Exception ex) {
            // 공지 검색 실패는 다른 근거 검색에 영향을 주지 않는다.
        }
    }

    private void addStaticKnowledgeEvidence(List<EvidenceCandidate> candidates, String question, Set<String> terms) {
        for (KnowledgeChunk chunk : STATIC_KNOWLEDGE) {
            int score = scoreText(terms, chunk.title(), chunk.content(), chunk.category());
            if (chunkMatchesIntent(question, chunk)) {
                score += 3;
            }
            if (score <= 0) {
                continue;
            }

            candidates.add(new EvidenceCandidate(
                    score,
                    new ChatEvidenceDto(
                            "knowledge",
                            chunk.id(),
                            chunk.title(),
                            chunk.content(),
                            stringify(chunk.updatedAt())
                    )
            ));
        }
    }

    private boolean chunkMatchesIntent(String question, KnowledgeChunk chunk) {
        return switch (chunk.title()) {
            case "예약 안내" -> containsAny(question, "예약", "테이블", "자리");
            case "혼잡도 안내" -> containsAny(question, "혼잡", "붐비", "사람", "여유", "한산");
            case "분실물 안내" -> containsAny(question, "분실", "잃어", "찾", "지갑", "가방", "핸드폰", "휴대폰");
            case "공연 안내" -> containsAny(question, "공연", "무대", "라인업", "시작", "일정");
            case "응급 안내" -> containsAny(question, "응급", "아파", "다쳤", "안전", "도움");
            default -> false;
        };
    }

    private Map<Long, CongestionResponseDto> safeCongestionByBoothId() {
        try {
            return boothService.getAllCongestions().stream()
                    .collect(Collectors.toMap(CongestionResponseDto::boothId, Function.identity(), (a, b) -> a));
        } catch (Exception ex) {
            return new HashMap<>();
        }
    }

    private int scoreBooth(BoothResponseDto booth, CongestionResponseDto congestion, String question, Set<String> terms) {
        int score = scoreText(terms, booth.name(), booth.description(), booth.category(), booth.tags(), booth.contentJson(), booth.liveStatusMessage());
        if (containsAny(question, "부스", "booth", "먹", "음식", "메뉴", "추천", "대기", "재고", "예약")) {
            score += 2;
        }
        if (containsAny(question, "혼잡", "붐비", "사람", "여유", "한산") && congestion != null) {
            score += 2;
        }
        if (containsAny(question, "빨리", "대기", "줄") && booth.estimatedWaitMinutes() != null && booth.estimatedWaitMinutes() <= 10) {
            score += 3;
        }
        if (containsAny(question, "예약") && Boolean.TRUE.equals(booth.reservationEnabled())) {
            score += 3;
        }
        return score;
    }

    private int scoreEvent(EventResponseDto event, String question, Set<String> terms, LocalDateTime now) {
        int score = scoreText(terms, event.title(), event.status(), event.liveMessage());
        if (containsAny(question, "공연", "이벤트", "일정", "무대", "시작", "event")) {
            score += 4;
        }
        if (event.startTime() != null && event.endTime() != null && !event.endTime().isBefore(now)) {
            score += 2;
        }
        if (containsAny(question, "곧", "다음", "지금") && event.startTime() != null && !event.startTime().isBefore(now.minusMinutes(5))) {
            score += 3;
        }
        return score;
    }

    private int scoreLostItem(LostItemResponseDto item, String question, Set<String> terms) {
        int score = scoreText(terms, item.title(), item.description(), item.category(), item.foundLocation(), item.statusLabel());
        if (containsAny(question, "분실", "잃어", "잃어버", "찾", "지갑", "가방", "핸드폰", "휴대폰", "lost")) {
            score += 4;
        }
        return score;
    }

    private int scoreText(Set<String> terms, String... values) {
        String target = normalize(String.join(" ", valuesOrEmpty(values)));
        int score = 0;
        for (String term : terms) {
            if (term.length() >= 2 && target.contains(term)) {
                score += 2;
            }
        }
        return score;
    }

    private String boothReason(BoothResponseDto booth, CongestionResponseDto congestion) {
        List<String> parts = new ArrayList<>();
        parts.add("카테고리 " + valueOrUnknown(booth.category()));
        if (booth.estimatedWaitMinutes() != null) {
            parts.add("대기 " + booth.estimatedWaitMinutes() + "분");
        }
        if (booth.remainingStock() != null) {
            parts.add("재고 " + booth.remainingStock());
        }
        if (congestion != null) {
            parts.add("혼잡도 " + congestion.level() + " (" + congestion.nearbyUserCount() + "명)");
        }
        if (booth.liveStatusMessage() != null && !booth.liveStatusMessage().isBlank()) {
            parts.add("상태: " + booth.liveStatusMessage());
        }
        return String.join(", ", parts);
    }

    private String eventReason(EventResponseDto event, LocalDateTime now) {
        List<String> parts = new ArrayList<>();
        parts.add(event.startTime() + " - " + event.endTime());
        parts.add("상태 " + valueOrUnknown(event.status()));
        if (event.startTime() != null && event.startTime().isAfter(now)) {
            parts.add("시작까지 약 " + Duration.between(now, event.startTime()).toMinutes() + "분");
        }
        if (event.liveMessage() != null && !event.liveMessage().isBlank()) {
            parts.add("안내: " + event.liveMessage());
        }
        return String.join(", ", parts);
    }

    private String lostItemReason(LostItemResponseDto item) {
        List<String> parts = new ArrayList<>();
        parts.add("카테고리 " + valueOrUnknown(item.category()));
        parts.add("발견 위치 " + valueOrUnknown(item.foundLocation()));
        parts.add("상태 " + valueOrUnknown(item.statusLabel()));
        if (item.description() != null && !item.description().isBlank()) {
            parts.add("설명: " + item.description());
        }
        return String.join(", ", parts);
    }

    private String noticeReason(NoticeResponseDto notice) {
        List<String> parts = new ArrayList<>();
        parts.add("공지 분류 " + valueOrUnknown(notice.category()));
        if (notice.content() != null && !notice.content().isBlank()) {
            parts.add(notice.content());
        }
        return String.join(", ", parts);
    }

    private String resolveConfidence(RetrievalResult retrieval) {
        if (retrieval.evidence().size() >= 3 && retrieval.warnings().isEmpty()) {
            return "HIGH";
        }
        if (!retrieval.evidence().isEmpty()) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private String buildFallbackAnswer(String question, RetrievalResult retrieval) {
        if (retrieval.evidence().isEmpty()) {
            return "지금 질문과 바로 연결되는 축제 데이터를 찾지 못했어요. 부스, 공연, 대기 시간, 예약 가능 여부처럼 구체적으로 다시 물어봐 주세요.";
        }
        ChatEvidenceDto top = retrieval.evidence().get(0);
        return switch (top.type()) {
            case "booth" -> top.label() + "부터 확인해 보세요. " + top.reason() + "라서 지금 움직이기 좋습니다.";
            case "event" -> top.label() + " 일정을 먼저 확인해 보세요. " + top.reason();
            case "lost_item" -> top.label() + " 항목이 질문과 가장 가까워 보여요. " + top.reason();
            default -> top.label() + " 정보가 가장 관련 있어요. " + top.reason();
        };
    }
    private String buildInstructions() {
        return """
                You are Fest-A's production festival AI assistant.
                Answer in Korean unless the user asks in another language.
                You must ground concrete claims only in the Evidence list.
                Do not invent booth names, event times, stock, wait times, congestion levels, reservations, locations, or lost items.
                If evidence is weak or missing, say what is unknown and suggest a safe next step.
                Do not expose private contact details.
                Use short action-first answers.
                Prefer this structure: 추천/답변, 이유, 다음 행동.
                Keep the answer under 5 Korean lines when possible.
                Do not mention internal scores or labels such as riskScore, LOW, MEDIUM, HIGH, RISK, or BUSY.
                Explain with visitor-facing facts: nearby people, wait time, available seats, stock, event timing, and whether it is easy to visit now.
                Answer in this order: recommendation, reason, next action.
                """;
    }

    private String buildInput(String question, RetrievalResult retrieval) throws Exception {
        return """
                Current server time: %s
                Confidence from server retrieval: %s
                Warnings: %s
                Evidence JSON:
                %s

                User question:
                %s
                """.formatted(
                LocalDateTime.now(),
                resolveConfidence(retrieval),
                objectMapper.writeValueAsString(retrieval.warnings()),
                objectMapper.writeValueAsString(retrieval.evidence()),
                question
        );
    }

    private String extractAnswer(String response) throws Exception {
        if (response == null || response.isBlank()) {
            return null;
        }

        JsonNode root = objectMapper.readTree(response);
        return firstNonBlank(
                extractResponseText(root.path("output_text")),
                extractResponseText(root.path("output")),
                extractResponseText(root.path("content")),
                extractResponseText(root.path("message"))
        );
    }

    private String extractResponseText(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }

        if (node.isTextual()) {
            return node.asText();
        }

        if (node.isArray()) {
            for (JsonNode item : node) {
                String text = extractResponseText(item);
                if (text != null && !text.isBlank()) {
                    return text;
                }
            }
            return null;
        }

        if (!node.isObject()) {
            return null;
        }

        String type = node.path("type").asText("");
        if (("output_text".equals(type) || "text".equals(type) || "message".equals(type))
                && node.path("text").isTextual()) {
            return node.path("text").asText();
        }

        JsonNode text = node.path("text");
        if (text.isObject() && text.path("value").isTextual()) {
            return text.path("value").asText();
        }

        return firstNonBlank(
                extractResponseText(node.path("output_text")),
                extractResponseText(node.path("content")),
                extractResponseText(node.path("message")),
                extractResponseText(node.path("output")),
                extractResponseText(text)
        );
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private Set<String> terms(String normalizedQuestion) {
        String[] rawTerms = normalizedQuestion.split("[^\\p{IsAlphabetic}\\p{IsDigit}가-힣]+");
        Set<String> result = new LinkedHashSet<>();
        for (String term : rawTerms) {
            if (term != null && term.length() >= 2) {
                result.add(term);
            }
        }
        return result;
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase().trim();
    }

    private List<String> valuesOrEmpty(String... values) {
        List<String> result = new ArrayList<>();
        for (String value : values) {
            if (value != null) {
                result.add(value);
            }
        }
        return result;
    }

    private java.util.function.Predicate<ChatEvidenceDto> distinctEvidence() {
        Set<String> seen = new LinkedHashSet<>();
        return evidence -> seen.add(evidence.type() + ":" + evidence.id());
    }

    private String valueOrUnknown(Object value) {
        if (value == null) {
            return "미등록";
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? "미등록" : text;
    }

    private String stringify(LocalDateTime value) {
        return value == null ? null : value.toString();
    }

    private record EvidenceCandidate(int score, ChatEvidenceDto evidence) {
    }

    private record RetrievalResult(List<ChatEvidenceDto> evidence, List<String> warnings) {
    }

    private record KnowledgeChunk(Long id, String title, String content, String category, LocalDateTime updatedAt) {
    }
}
