package com.festflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.AiBoothRecommendationDto;
import com.festflow.backend.dto.AiFestivalGuideDto;
import com.festflow.backend.dto.AiVisitorActionDto;
import com.festflow.backend.dto.AiVisitorGuideDto;
import com.festflow.backend.dto.AnalyticsDashboardDto;
import com.festflow.backend.dto.AnalyticsZoneCrowdDto;
import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.service.analytics.AnalyticsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class PublicAiGuideService {

    private static final String OPENAI_RESPONSES_PATH = "/v1/responses";

    private final AnalyticsService analyticsService;
    private final AiCongestionService aiCongestionService;
    private final EventService eventService;
    private final BoothService boothService;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String apiKey;
    private final String model;

    public PublicAiGuideService(
            AnalyticsService analyticsService,
            AiCongestionService aiCongestionService,
            EventService eventService,
            BoothService boothService,
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            @Value("${app.openai.api-key:}") String apiKey,
            @Value("${app.openai.model:gpt-5-mini}") String model
    ) {
        this.analyticsService = analyticsService;
        this.aiCongestionService = aiCongestionService;
        this.eventService = eventService;
        this.boothService = boothService;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder
                .baseUrl("https://api.openai.com")
                .requestFactory(requestFactory())
                .build();
        this.apiKey = apiKey;
        this.model = model;
    }

    public AiVisitorGuideDto guide(String scope) {
        String normalizedScope = normalizeScope(scope);
        AiVisitorGuideDto fallback = switch (normalizedScope) {
            case "events" -> fallbackEvents();
            case "stage-map" -> fallbackStageMap();
            default -> fallbackAnalytics();
        };

        if (apiKey == null || apiKey.isBlank()) {
            return fallback;
        }

        String context = switch (normalizedScope) {
            case "events" -> eventsContext();
            case "stage-map" -> stageMapContext();
            default -> analyticsContext();
        };

        try {
            String response = generateText(normalizedScope, fallback.title(), context);
            return parseGuide(normalizedScope, fallback.title(), response, fallback);
        } catch (Exception ex) {
            return fallback;
        }
    }

    private AiVisitorGuideDto fallbackAnalytics() {
        AiFestivalGuideDto guide = safeCongestionGuide();
        List<AiBoothRecommendationDto> predictions = safePredictions();
        AiBoothRecommendationDto avoid = firstOrNull(guide.avoidNow());
        AiBoothRecommendationDto good = firstOrNull(guide.recommendedNow());
        AiBoothRecommendationDto later = firstOrNull(predictions);

        List<String> bullets = new ArrayList<>();
        bullets.add(guide.headline());
        bullets.add(guide.summary());
        if (later != null) {
            bullets.add(later.boothName() + "은 30분 뒤 " + later.predictedLevel() + " 상태가 예상돼요.");
        }

        return new AiVisitorGuideDto(
                "analytics",
                "AI 혼잡도 가이드",
                "현재 혼잡도 데이터를 바탕으로 움직이기 좋은 동선을 정리했어요.",
                bullets,
                List.of(
                        action("지금 피할 곳", avoid == null ? "혼잡 구역 없음" : avoid.boothName(), avoid == null ? "즉시 피해야 할 구역은 아직 없어요." : "혼잡 위험이 높아 잠시 후 방문을 추천해요.", "danger"),
                        action("지금 가기 좋은 곳", good == null ? "가까운 여유 부스" : good.boothName(), good == null ? "대기 시간이 짧은 부스를 우선 확인해보세요." : "지금 방문 부담이 낮은 곳이에요.", "good"),
                        action("30분 뒤 주의", later == null ? "공연 주변" : later.boothName(), later == null ? "공연 시작 전후에는 무대 주변 이동을 여유 있게 잡아주세요." : "조금 뒤 더 붐빌 수 있어요.", "wait")
                ),
                guide.userActions().stream().limit(3).toList(),
                false
        );
    }

    private AiVisitorGuideDto fallbackEvents() {
        List<EventResponseDto> events = sortedEvents();
        LocalDateTime now = LocalDateTime.now();
        List<EventResponseDto> upcoming = events.stream()
                .filter(event -> event.startTime() != null && !event.startTime().isBefore(now.minusMinutes(10)))
                .limit(3)
                .toList();
        EventResponseDto recommended = firstOrNull(upcoming);

        return new AiVisitorGuideDto(
                "events",
                "AI 공연 가이드",
                recommended == null
                        ? "오늘 공연 데이터를 확인해서 보기 좋은 순서로 정리했어요."
                        : recommended.title() + " 공연은 지금 확인하기 좋은 일정이에요.",
                List.of(
                        upcoming.isEmpty() ? "곧 시작하는 공연이 아직 없습니다." : "곧 시작하는 공연이 " + upcoming.size() + "개 있어요.",
                        "인기 공연은 시작 20분 전 이동을 추천해요.",
                        "여유롭게 보고 싶다면 보조무대와 버스킹 일정도 확인해보세요."
                ),
                List.of(
                        action("AI 추천 공연", recommended == null ? "전체 라인업" : recommended.title(), recommended == null ? "시간표 전체에서 원하는 공연을 골라보세요." : timeText(recommended) + " 시작 전에 이동하기 좋아요.", "good"),
                        action("곧 시작", upcoming.size() > 1 ? upcoming.get(1).title() : "다음 공연", upcoming.size() > 1 ? timeText(upcoming.get(1)) + " 일정이에요." : "다음 공연 시간을 확인해보세요.", "wait"),
                        action("혼잡 예상", "메인 스테이지", "인기 공연 시간대에는 미리 이동하는 편이 좋아요.", "danger")
                ),
                List.of("공연 시간", "현재 시각", "무대 이동 부담을 함께 봤어요."),
                false
        );
    }

    private AiVisitorGuideDto fallbackStageMap() {
        List<BoothResponseDto> booths = boothService.getAllBooths();
        List<BoothResponseDto> sorted = booths.stream()
                .sorted(Comparator.comparingInt((BoothResponseDto booth) -> value(booth.estimatedWaitMinutes())))
                .toList();
        BoothResponseDto good = firstOrNull(sorted);
        BoothResponseDto busy = booths.stream()
                .max(Comparator.comparingInt(booth -> value(booth.estimatedWaitMinutes())))
                .orElse(null);

        return new AiVisitorGuideDto(
                "stage-map",
                "AI 주변 부스 추천",
                "가까운 부스 중 대기 시간이 짧은 곳을 먼저 추천해드려요.",
                List.of(
                        good == null ? "지금 추천할 부스 데이터를 기다리고 있어요." : good.name() + "은 지금 비교적 가기 좋아요.",
                        busy == null ? "혼잡한 부스 정보가 아직 없어요." : busy.name() + "은 대기가 길어질 수 있어요.",
                        "대기 시간이 긴 곳은 나중에 다시 확인해보세요."
                ),
                List.of(
                        action("지금 가기 좋은 부스", good == null ? "여유 부스" : good.name(), good == null ? "대기 시간이 짧은 부스를 먼저 확인해보세요." : "대기 " + value(good.estimatedWaitMinutes()) + "분 기준이에요.", "good"),
                        action("잠시 피할 부스", busy == null ? "혼잡 부스 없음" : busy.name(), busy == null ? "현재 강한 혼잡 신호는 없어요." : "대기 " + value(busy.estimatedWaitMinutes()) + "분이라 나중에 가는 편이 좋아요.", "danger")
                ),
                List.of("대기 시간", "부스 운영 상태", "사용자 이동 흐름을 함께 참고했어요."),
                false
        );
    }

    private String analyticsContext() {
        AnalyticsDashboardDto dashboard = analyticsService.dashboard(15);
        List<AiBoothRecommendationDto> predictions = safePredictions().stream().limit(8).toList();
        return "페이지: AI 혼잡도 예측\n"
                + "전체 혼잡도: " + dashboard.overview().percent() + "% / " + dashboard.overview().level()
                + " / 변화 " + dashboard.overview().deltaPercent() + "%\n"
                + "구역별 혼잡도: " + dashboard.zones().stream()
                .sorted(Comparator.comparingInt(AnalyticsZoneCrowdDto::percent).reversed())
                .limit(8)
                .map(zone -> zone.zoneName() + "=" + zone.percent() + "%/" + zone.level() + "/변화" + zone.deltaPercent())
                .toList()
                + "\n30분 예측 후보: " + predictions.stream()
                .map(item -> item.boothName() + "=현재" + item.currentLevel() + ",예측" + item.predictedLevel() + ",위험" + item.riskScore() + ",대기" + item.waitMinutes())
                .toList();
    }

    private String eventsContext() {
        LocalDateTime now = LocalDateTime.now();
        return "페이지: AI 공연 가이드\n현재시각: " + now + "\n공연 목록: "
                + sortedEvents().stream()
                .limit(12)
                .map(event -> event.title() + "/" + timeText(event) + "/" + value(event.status()) + "/" + value(event.liveMessage()))
                .toList();
    }

    private String stageMapContext() {
        return "페이지: AI 주변 부스 추천\n부스 목록: " + boothService.getAllBooths().stream()
                .sorted(Comparator.comparingInt((BoothResponseDto booth) -> value(booth.estimatedWaitMinutes())).reversed())
                .limit(12)
                .map(booth -> booth.name() + "/카테고리 " + value(booth.category()) + "/대기 " + value(booth.estimatedWaitMinutes()) + "분/재고 " + value(booth.remainingStock()) + "/좌석 " + value(booth.reservationAvailableSeats()))
                .toList();
    }

    private String generateText(String scope, String title, String context) throws Exception {
        Map<String, Object> request = Map.of(
                "model", model,
                "instructions",
                "You are Fest-A AI for festival visitors. Write in friendly Korean. "
                        + "Use only the supplied data. Return only valid JSON with this shape: "
                        + "{\"summary\":\"short sentence\",\"bullets\":[\"2-3 visitor-facing lines\"],"
                        + "\"actions\":[{\"title\":\"short label\",\"target\":\"place or event\",\"description\":\"actionable reason\",\"tone\":\"good|wait|danger|info\"}],"
                        + "\"reasons\":[\"why the AI recommends this\"]}. "
                        + "Focus on what the visitor should do in the next 30 minutes.",
                "input", "scope=" + scope + "\ntitle=" + title + "\n" + context,
                "max_output_tokens", 520
        );
        String response = restClient.post()
                .uri(OPENAI_RESPONSES_PATH)
                .contentType(MediaType.APPLICATION_JSON)
                .headers(headers -> headers.setBearerAuth(apiKey))
                .body(request)
                .retrieve()
                .body(String.class);
        return extractAnswer(response);
    }

    private AiVisitorGuideDto parseGuide(String scope, String title, String generatedText, AiVisitorGuideDto fallback) throws Exception {
        if (generatedText == null || generatedText.isBlank()) {
            return fallback;
        }

        String text = cleanJson(generatedText);
        try {
            JsonNode root = objectMapper.readTree(text);
            List<AiVisitorActionDto> actions = new ArrayList<>();
            JsonNode actionNodes = root.path("actions");
            if (actionNodes.isArray()) {
                for (JsonNode node : actionNodes) {
                    actions.add(action(
                            node.path("title").asText("AI 추천"),
                            node.path("target").asText("추천 장소"),
                            node.path("description").asText("지금 확인해보세요."),
                            node.path("tone").asText("info")
                    ));
                }
            }
            return new AiVisitorGuideDto(
                    scope,
                    title,
                    root.path("summary").asText(fallback.summary()),
                    readStringList(root.path("bullets"), fallback.bullets()),
                    actions.isEmpty() ? fallback.actions() : actions.stream().limit(4).toList(),
                    readStringList(root.path("reasons"), fallback.reasons()),
                    true
            );
        } catch (Exception ex) {
            return new AiVisitorGuideDto(
                    scope,
                    title,
                    generatedText.trim(),
                    List.of(generatedText.trim()),
                    fallback.actions(),
                    fallback.reasons(),
                    true
            );
        }
    }

    private String extractAnswer(String response) throws Exception {
        JsonNode root = objectMapper.readTree(response);
        JsonNode outputText = root.path("output_text");
        if (outputText.isTextual()) {
            return outputText.asText();
        }
        JsonNode output = root.path("output");
        if (output.isArray()) {
            for (JsonNode item : output) {
                JsonNode content = item.path("content");
                if (!content.isArray()) continue;
                for (JsonNode contentItem : content) {
                    if ("output_text".equals(contentItem.path("type").asText()) && contentItem.path("text").isTextual()) {
                        return contentItem.path("text").asText();
                    }
                }
            }
        }
        return null;
    }

    private SimpleClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(4));
        factory.setReadTimeout(Duration.ofSeconds(12));
        return factory;
    }

    private List<EventResponseDto> sortedEvents() {
        return eventService.getAllEvents().stream()
                .sorted(Comparator.comparing(
                        EventResponseDto::startTime,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ))
                .toList();
    }

    private AiFestivalGuideDto safeCongestionGuide() {
        try {
            return aiCongestionService.guide();
        } catch (Exception ex) {
            return new AiFestivalGuideDto(
                    LocalDateTime.now(),
                    "AI가 축제 데이터를 확인하고 있어요.",
                    "데이터가 쌓이면 더 정확한 추천을 보여드릴게요.",
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of("가까운 부스의 대기 시간을 먼저 확인해보세요."),
                    List.of()
            );
        }
    }

    private List<AiBoothRecommendationDto> safePredictions() {
        try {
            return aiCongestionService.analyzeCurrent();
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<String> readStringList(JsonNode node, List<String> fallback) {
        if (!node.isArray()) {
            return fallback;
        }
        List<String> result = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual() && !item.asText().isBlank()) {
                result.add(item.asText());
            }
        }
        return result.isEmpty() ? fallback : result.stream().limit(4).toList();
    }

    private String cleanJson(String value) {
        String text = value.trim();
        if (text.startsWith("```")) {
            text = text.replaceFirst("^```(?:json)?", "").replaceFirst("```$", "").trim();
        }
        return text;
    }

    private String normalizeScope(String scope) {
        String value = scope == null ? "analytics" : scope.trim().toLowerCase(Locale.ROOT);
        if (value.equals("stage") || value.equals("map")) return "stage-map";
        if (value.equals("event")) return "events";
        if (value.equals("analytics") || value.equals("events") || value.equals("stage-map")) return value;
        return "analytics";
    }

    private AiVisitorActionDto action(String title, String target, String description, String tone) {
        String safeTone = switch (tone == null ? "" : tone) {
            case "good", "wait", "danger", "info" -> tone;
            default -> "info";
        };
        return new AiVisitorActionDto(title, target, description, safeTone);
    }

    private String timeText(EventResponseDto event) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:mm");
        String start = event.startTime() == null ? "시간 미정" : event.startTime().format(formatter);
        String end = event.endTime() == null ? "" : " - " + event.endTime().format(formatter);
        return start + end;
    }

    private int value(Integer value) {
        return value == null ? 0 : Math.max(0, value);
    }

    private String value(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private <T> T firstOrNull(List<T> values) {
        return values == null || values.isEmpty() ? null : values.get(0);
    }
}
