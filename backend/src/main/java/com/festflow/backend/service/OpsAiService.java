package com.festflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.AiFestivalGuideDto;
import com.festflow.backend.dto.AiAssistRequestDto;
import com.festflow.backend.dto.AiAssistResponseDto;
import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.CongestionResponseDto;
import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.dto.LostItemResponseDto;
import com.festflow.backend.dto.NoticeResponseDto;
import com.festflow.backend.dto.StaffMemberResponseDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class OpsAiService {

    private static final String OPENAI_RESPONSES_PATH = "/v1/responses";

    private final BoothService boothService;
    private final EventService eventService;
    private final NoticeService noticeService;
    private final LostItemService lostItemService;
    private final StaffService staffService;
    private final AiCongestionService aiCongestionService;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String apiKey;
    private final String model;

    public OpsAiService(
            BoothService boothService,
            EventService eventService,
            NoticeService noticeService,
            LostItemService lostItemService,
            StaffService staffService,
            AiCongestionService aiCongestionService,
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            @Value("${app.openai.api-key:}") String apiKey,
            @Value("${app.openai.model:gpt-5-mini}") String model
    ) {
        this.boothService = boothService;
        this.eventService = eventService;
        this.noticeService = noticeService;
        this.lostItemService = lostItemService;
        this.staffService = staffService;
        this.aiCongestionService = aiCongestionService;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder
                .baseUrl("https://api.openai.com")
                .requestFactory(requestFactory())
                .build();
        this.apiKey = apiKey;
        this.model = model;
    }

    public AiAssistResponseDto masterBriefing() {
        OpsSnapshot snapshot = snapshot();
        List<String> highlights = masterHighlights(snapshot);
        List<String> actions = masterActions(snapshot);
        AiFestivalGuideDto aiGuide = safeGuide();
        highlights.addAll(aiGuide.operatorAlerts().stream().limit(3).toList());
        actions.addAll(aiGuide.userActions().stream().limit(2).map(action -> "AI 추천 기반 현장 조치: " + action).toList());
        String fallback = String.join("\n", highlights);
        String summary = generateText(
                "운영 총괄용 현재 상황 브리핑을 한국어로 5줄 이하로 작성하세요. 위험도와 즉시 할 일을 먼저 말하세요.",
                snapshot.context("master briefing"),
                fallback
        );
        return new AiAssistResponseDto(
                "AI 운영 브리핑",
                summary,
                highlights,
                actions,
                null,
                null,
                null,
                confidence(highlights)
        );
    }

    public AiAssistResponseDto masterNoticeDraft(AiAssistRequestDto requestDto) {
        OpsSnapshot snapshot = snapshot();
        String type = safe(requestDto.type(), "안내");
        String prompt = safe(requestDto.prompt(), "");
        String fallbackTitle = noticeTitle(type, snapshot);
        String fallbackContent = noticeContent(type, snapshot);
        String generated = generateText(
                "축제 운영 공지 초안을 작성하세요. 반드시 '제목:'과 '내용:' 형식으로만 답하세요. 내용은 2문장 이하로 짧고 공손하게 작성하세요.",
                snapshot.context("notice draft") + "\n공지 유형: " + type + "\n추가 요청: " + prompt,
                "제목: " + fallbackTitle + "\n내용: " + fallbackContent
        );
        Draft draft = parseDraft(generated, fallbackTitle, fallbackContent);
        return new AiAssistResponseDto(
                "AI 공지 초안",
                "초안을 확인한 뒤 필요한 부분을 수정하고 등록하세요.",
                List.of("AI는 공지를 직접 발행하지 않습니다.", "관리자가 확인 후 등록해야 합니다."),
                List.of("문구 확인", "공지 입력칸에 반영", "활성 여부 확인 후 등록"),
                draft.title(),
                draft.content(),
                noticeCategory(type),
                "MEDIUM"
        );
    }

    public AiAssistResponseDto staffZoneSummary(String staffToken) {
        StaffMemberResponseDto me = staffService.authenticateByToken(staffToken);
        List<StaffMemberResponseDto> staff = staffService.bootstrap(staffToken).staff();
        List<StaffMemberResponseDto> nearbyStaff = nearbyStaff(me, staff);
        String context = nearbyStaffContext(me, nearbyStaff);
        String summary = generateText(
                "스태프 본인에게 보여줄 AI 협업 판단을 한국어로 4줄 이하로 작성하세요. 누가 지원 요청에 가장 적절한지, 누구는 호출을 보류해야 하는지, 내가 지금 해야 할 행동, 바로 쓸 짧은 무전 문구를 포함하세요. 부스, 재고, 대기시간, 공연, 분실물은 언급하지 마세요.",
                context,
                nearbyStaffFallback(me, nearbyStaff)
        );
        return new AiAssistResponseDto(
                "AI 협업 판단",
                summary,
                nearbyStaffHighlights(me, nearbyStaff),
                nearbyStaffActions(me, nearbyStaff),
                null,
                null,
                null,
                "HIGH"
        );
    }

    public AiAssistResponseDto staffFieldChecklist(String staffToken) {
        StaffMemberResponseDto me = staffService.authenticateByToken(staffToken);
        List<StaffMemberResponseDto> staff = staffService.bootstrap(staffToken).staff();
        List<EventResponseDto> events = upcomingEvents().stream().limit(5).toList();
        List<NoticeResponseDto> notices = noticeService.getActiveNotices().stream().limit(5).toList();
        List<LostItemResponseDto> lostItems = activeLostItems().stream().limit(8).toList();
        List<String> actions = staffOpsActions(me, staff, events, notices, lostItems);
        String summary = generateText(
                "스태프용 현장 체크리스트를 한국어로 작성하세요. 부스 운영 업무는 제외하고 줄관리, 무대관리, 통로 확보, 안전 확인, 공지 전달, 분실물 확인을 우선순위로 정리하세요. 결과는 짧은 한 문단으로 작성하세요.",
                staffOpsContext(me, staff, events, notices, lostItems),
                "현재 업무와 공지, 공연 일정, 분실물 상태를 확인해 우선순위대로 처리하세요."
        );
        return new AiAssistResponseDto(
                "AI 현장 체크리스트",
                summary,
                staffOpsHighlights(me, staff, events, notices, lostItems),
                actions,
                null,
                null,
                null,
                "HIGH"
        );
    }

    public AiAssistResponseDto staffLostItemAssist(String staffToken, AiAssistRequestDto requestDto) {
        staffService.authenticateByToken(staffToken);
        String prompt = safe(requestDto.prompt(), "");
        if (prompt.isBlank()) {
            return new AiAssistResponseDto(
                    "AI 분실물 매칭",
                    "방문객이 말한 분실물 설명을 입력하면, 등록된 분실물 후보와 비교해 가능성이 높은 항목과 확인 질문을 정리합니다.",
                    List.of(),
                    List.of("예: 검은색 반지갑을 학생회관 근처에서 잃어버렸어요", "예: 에어팟 케이스에 파란 스티커가 붙어 있어요"),
                    null,
                    null,
                    null,
                    "LOW"
            );
        }
        List<LostItemResponseDto> matches = lostItemMatches(prompt).stream().limit(3).toList();
        List<String> highlights = lostItemMatchHighlights(prompt, matches);
        String context = lostItemMatchContext(prompt, matches);
        String summary = generateText(
                "스태프용 AI 분실물 매칭 결과를 한국어로 짧게 작성하세요. 방문객 설명과 후보를 비교해 가장 가능성 높은 후보, 일치한 근거, 애매한 부분을 설명하세요. 연락처는 말하지 말고, 바로 인계하지 말라는 확인 절차를 포함하세요.",
                context,
                lostItemMatchFallback(prompt, matches)
        );
        return new AiAssistResponseDto(
                "AI 분실물 매칭",
                summary,
                highlights,
                lostItemMatchActions(matches),
                null,
                null,
                null,
                matches.isEmpty() ? "LOW" : "HIGH"
        );
    }

    public AiAssistResponseDto staffReplyDraft(String staffToken, AiAssistRequestDto requestDto) {
        StaffMemberResponseDto me = staffService.authenticateByToken(staffToken);
        BoothResponseDto booth = assignedBooth(me);
        String prompt = safe(requestDto.prompt(), "");
        String summary = generateText(
                "스태프가 방문객에게 바로 말할 수 있는 짧고 친절한 한국어 응대 문구를 작성하세요. 모르는 내용은 확인 후 안내하겠다고 말하세요.",
                staffContext(me, booth, booth != null ? safeCongestion(booth.id()) : null, noticeService.getActiveNotices().stream().limit(3).toList())
                        + "\n방문객 질문/상황: " + prompt,
                "확인 후 바로 안내드리겠습니다. 가까운 스태프 또는 본부에서도 도움을 받으실 수 있습니다."
        );
        return new AiAssistResponseDto(
                "응대 문구 초안",
                summary,
                List.of("방문객에게 바로 읽어줄 수 있는 문구입니다."),
                List.of("상황 확인", "필요 시 본부 연결"),
                null,
                null,
                null,
                "MEDIUM"
        );
    }

    private AiFestivalGuideDto safeGuide() {
        try {
            return aiCongestionService.guide();
        } catch (Exception ex) {
            return new AiFestivalGuideDto(
                    LocalDateTime.now(),
                    "AI 혼잡 판단을 불러오지 못했습니다.",
                    "기본 운영 데이터만 사용합니다.",
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of()
            );
        }
    }

    private SimpleClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(4));
        factory.setReadTimeout(Duration.ofSeconds(14));
        return factory;
    }

    private String generateText(String instructions, String input, String fallback) {
        if (apiKey == null || apiKey.isBlank()) {
            return fallback;
        }
        try {
            Map<String, Object> request = Map.of(
                    "model", model,
                    "instructions", instructions,
                    "input", input,
                    "max_output_tokens", 380
            );
            String response = restClient.post()
                    .uri(OPENAI_RESPONSES_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> headers.setBearerAuth(apiKey))
                    .body(request)
                    .retrieve()
                    .body(String.class);
            String text = extractAnswer(response);
            return text == null || text.isBlank() ? fallback : text.trim();
        } catch (Exception ex) {
            return fallback;
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

    private OpsSnapshot snapshot() {
        List<BoothResponseDto> booths = boothService.getAllBooths();
        List<EventResponseDto> events = eventService.getAllEvents();
        List<NoticeResponseDto> notices = noticeService.getActiveNotices();
        List<LostItemResponseDto> lostItems = lostItemService.getAll(true);
        List<StaffMemberResponseDto> staff = staffService.getAllStaffMembers();
        List<CongestionResponseDto> congestions;
        try {
            congestions = boothService.getAllCongestions();
        } catch (Exception ex) {
            congestions = List.of();
        }
        return new OpsSnapshot(booths, events, notices, lostItems, staff, congestions);
    }

    private List<String> masterHighlights(OpsSnapshot snapshot) {
        List<String> result = new ArrayList<>();
        snapshot.congestions().stream()
                .max(Comparator.comparingInt(CongestionResponseDto::nearbyUserCount))
                .ifPresent(item -> result.add("최고 혼잡: " + item.boothName() + " · " + item.level() + " · " + item.nearbyUserCount() + "명"));
        snapshot.booths().stream()
                .filter(booth -> booth.estimatedWaitMinutes() != null)
                .max(Comparator.comparingInt(BoothResponseDto::estimatedWaitMinutes))
                .ifPresent(booth -> result.add("최장 대기: " + booth.name() + " · " + booth.estimatedWaitMinutes() + "분"));
        long lowStock = snapshot.booths().stream()
                .filter(booth -> booth.remainingStock() != null && booth.remainingStock() <= 10)
                .count();
        result.add("재고 10개 이하 부스: " + lowStock + "곳");
        long urgentStaff = snapshot.staff().stream().filter(staff -> "URGENT".equals(staff.status())).count();
        result.add("긴급 상태 스태프: " + urgentStaff + "명");
        long activeLost = snapshot.lostItems().stream().filter(item -> !"RETURNED".equals(item.status())).count();
        result.add("미반환 분실물: " + activeLost + "건");
        snapshot.events().stream()
                .filter(event -> event.startTime() != null && event.startTime().isAfter(LocalDateTime.now()))
                .min(Comparator.comparing(EventResponseDto::startTime))
                .ifPresent(event -> result.add("다음 공연: " + event.title() + " · " + event.startTime().toLocalTime()));
        return result;
    }

    private List<String> masterActions(OpsSnapshot snapshot) {
        List<String> actions = new ArrayList<>();
        if (snapshot.congestions().stream().anyMatch(item -> item.nearbyUserCount() >= 12)) {
            actions.add("혼잡 완화 공지 초안을 만들고 우회 동선을 안내하세요.");
        }
        if (snapshot.booths().stream().anyMatch(booth -> booth.remainingStock() != null && booth.remainingStock() <= 10)) {
            actions.add("재고 부족 부스에 품절/공급 상태 확인을 요청하세요.");
        }
        if (snapshot.staff().stream().anyMatch(staff -> "URGENT".equals(staff.status()))) {
            actions.add("긴급 상태 스태프 위치와 메모를 먼저 확인하세요.");
        }
        if (actions.isEmpty()) {
            actions.add("현재는 큰 위험 신호가 적습니다. 부스 대기시간과 공지 상태를 주기적으로 확인하세요.");
        }
        return actions;
    }

    private String noticeTitle(String type, OpsSnapshot snapshot) {
        if ("congestion".equals(type)) return "혼잡 구역 우회 안내";
        if ("lost".equals(type)) return "분실물 센터 이용 안내";
        if ("booth".equals(type)) return "부스 운영 상태 안내";
        if ("event".equals(type)) return "공연 일정 안내";
        return "축제 운영 안내";
    }

    private String noticeContent(String type, OpsSnapshot snapshot) {
        if ("congestion".equals(type)) {
            return snapshot.congestions().stream()
                    .max(Comparator.comparingInt(CongestionResponseDto::nearbyUserCount))
                    .map(item -> item.boothName() + " 주변이 혼잡합니다. 안전을 위해 여유 있는 통로를 이용해 주세요.")
                    .orElse("일부 구역이 혼잡할 수 있습니다. 현장 스태프 안내에 따라 이동해 주세요.");
        }
        if ("lost".equals(type)) return "분실물은 분실물 센터에서 확인할 수 있습니다. 물품 특징과 발견 위치를 스태프에게 알려 주세요.";
        if ("booth".equals(type)) return "일부 부스의 대기시간과 재고가 변동될 수 있습니다. 방문 전 부스 상세 정보를 확인해 주세요.";
        if ("event".equals(type)) return "공연 일정은 현장 상황에 따라 변동될 수 있습니다. 최신 안내를 확인해 주세요.";
        return "안전하고 원활한 축제 이용을 위해 현장 안내를 확인해 주세요.";
    }

    private String noticeCategory(String type) {
        if ("lost".equals(type)) return "분실물";
        if ("congestion".equals(type)) return "긴급";
        return "안내";
    }

    private Draft parseDraft(String generated, String fallbackTitle, String fallbackContent) {
        String title = fallbackTitle;
        String content = fallbackContent;
        if (generated != null) {
            for (String line : generated.split("\\R")) {
                String trimmed = line.trim();
                if (trimmed.startsWith("제목:")) title = trimmed.substring(3).trim();
                if (trimmed.startsWith("내용:")) content = trimmed.substring(3).trim();
            }
        }
        return new Draft(title.isBlank() ? fallbackTitle : title, content.isBlank() ? fallbackContent : content);
    }

    private BoothResponseDto assignedBooth(StaffMemberResponseDto me) {
        if (me.assignedBoothId() == null) return null;
        try {
            return boothService.getBoothById(me.assignedBoothId());
        } catch (Exception ex) {
            return null;
        }
    }

    private CongestionResponseDto safeCongestion(Long boothId) {
        try {
            return boothService.getCongestionByBoothId(boothId);
        } catch (Exception ex) {
            return null;
        }
    }

    private List<EventResponseDto> upcomingEvents() {
        LocalDateTime now = LocalDateTime.now();
        return eventService.getAllEvents().stream()
                .filter(event -> event.startTime() != null)
                .filter(event -> event.endTime() == null || !event.endTime().isBefore(now.minusMinutes(10)))
                .sorted(Comparator.comparing(EventResponseDto::startTime))
                .toList();
    }

    private List<LostItemResponseDto> activeLostItems() {
        return lostItemService.getAll(true).stream()
                .filter(item -> !"RETURNED".equalsIgnoreCase(safe(item.status(), "")))
                .sorted(Comparator.comparing(
                        LostItemResponseDto::updatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .toList();
    }

    private List<StaffMemberResponseDto> nearbyStaff(StaffMemberResponseDto me, List<StaffMemberResponseDto> staff) {
        boolean hasMyLocation = hasStaffLocation(me);
        return staff.stream()
                .filter(member -> !String.valueOf(member.staffNo()).equals(String.valueOf(me.staffNo())))
                .sorted((left, right) -> {
                    if (hasMyLocation) {
                        double leftDistance = hasStaffLocation(left) ? distanceMeters(me.latitude(), me.longitude(), left.latitude(), left.longitude()) : Double.MAX_VALUE;
                        double rightDistance = hasStaffLocation(right) ? distanceMeters(me.latitude(), me.longitude(), right.latitude(), right.longitude()) : Double.MAX_VALUE;
                        int compared = Double.compare(leftDistance, rightDistance);
                        if (compared != 0) return compared;
                    }
                    boolean leftSameTeam = safe(left.team(), "").equals(safe(me.team(), ""));
                    boolean rightSameTeam = safe(right.team(), "").equals(safe(me.team(), ""));
                    if (leftSameTeam != rightSameTeam) return leftSameTeam ? -1 : 1;
                    return Comparator.comparing(
                            StaffMemberResponseDto::lastUpdatedAt,
                            Comparator.nullsLast(Comparator.reverseOrder())
                    ).compare(left, right);
                })
                .limit(5)
                .toList();
    }

    private String nearbyStaffContext(StaffMemberResponseDto me, List<StaffMemberResponseDto> nearbyStaff) {
        StaffMemberResponseDto support = bestSupportCandidate(nearbyStaff);
        StaffMemberResponseDto hold = callHoldCandidate(nearbyStaff);
        return "나: " + me.name() + " / " + me.team() + " / " + me.statusLabel() + " / 업무 " + safe(me.currentTask(), "미입력")
                + "\n내 위치 공유: " + (hasStaffLocation(me) ? "켜짐" : "꺼짐 또는 미확인")
                + "\n협업 판단 기준: 대기중과 가까운 스태프를 우선 추천하고, 긴급/이동중/이미 맡은 일이 뚜렷한 스태프는 호출 보류로 판단"
                + "\n추천 지원 후보: " + (support == null ? "없음" : support.name() + " / " + support.statusLabel() + " / " + safe(support.currentTask(), "업무 미입력") + " / " + staffDistanceLabel(me, support))
                + "\n호출 보류 후보: " + (hold == null ? "없음" : hold.name() + " / " + hold.statusLabel() + " / " + safe(hold.currentTask(), "업무 미입력") + " / " + staffDistanceLabel(me, hold))
                + "\n주변 스태프: " + nearbyStaff.stream().map(member ->
                        member.name()
                                + " / " + member.team()
                                + " / 상태 " + member.statusLabel()
                                + " / 업무 " + safe(member.currentTask(), "미입력")
                                + " / 거리 " + staffDistanceLabel(me, member)
                                + " / 업데이트 " + value(member.lastUpdatedAt())
                ).toList();
    }

    private String nearbyStaffFallback(StaffMemberResponseDto me, List<StaffMemberResponseDto> nearbyStaff) {
        if (nearbyStaff.isEmpty()) return "주변에서 확인되는 스태프가 없습니다. 위치 공유 상태와 팀 연락망을 먼저 확인하세요.";
        StaffMemberResponseDto support = bestSupportCandidate(nearbyStaff);
        StaffMemberResponseDto hold = callHoldCandidate(nearbyStaff);
        if (support == null) {
            return "지금 바로 호출하기 좋은 대기 인원이 보이지 않습니다. 현재 위치를 유지하고 팀장에게 지원 가능 인원을 확인하세요.";
        }
        return support.name() + "님이 " + support.statusLabel() + " 상태라 지원 요청 후보입니다."
                + (hold == null ? "" : " " + hold.name() + "님은 " + hold.statusLabel() + " 상태라 호출을 보류하세요.")
                + " 무전 문구: " + radioMessage(me, support);
    }

    private List<String> nearbyStaffHighlights(StaffMemberResponseDto me, List<StaffMemberResponseDto> nearbyStaff) {
        List<String> result = new ArrayList<>();
        result.add("내 상태: " + me.statusLabel() + " · " + safe(me.currentTask(), "업무 미입력"));
        if (nearbyStaff.isEmpty()) {
            result.add("주변 스태프: 확인 없음");
            return result;
        }
        StaffMemberResponseDto support = bestSupportCandidate(nearbyStaff);
        StaffMemberResponseDto hold = callHoldCandidate(nearbyStaff);
        if (support != null) result.add("지원 요청 추천: " + support.name() + " · " + support.statusLabel() + " · " + staffDistanceLabel(me, support));
        if (hold != null) result.add("호출 보류: " + hold.name() + " · " + hold.statusLabel() + " · " + safe(hold.currentTask(), "업무 미입력"));
        long sameTaskCount = nearbyStaff.stream()
                .filter(member -> !safe(me.currentTask(), "").isBlank())
                .filter(member -> safe(member.currentTask(), "").equalsIgnoreCase(safe(me.currentTask(), "")))
                .count();
        if (sameTaskCount > 0) result.add("역할 겹침 가능: 내 업무와 같은 주변 스태프 " + sameTaskCount + "명");
        nearbyStaff.stream().limit(3).forEach(member -> result.add(member.name()
                + " · " + member.statusLabel()
                + " · " + safe(member.currentTask(), "업무 미입력")
                + " · " + staffDistanceLabel(me, member)));
        return result;
    }

    private List<String> nearbyStaffActions(StaffMemberResponseDto me, List<StaffMemberResponseDto> nearbyStaff) {
        List<String> actions = new ArrayList<>();
        StaffMemberResponseDto support = bestSupportCandidate(nearbyStaff);
        StaffMemberResponseDto hold = callHoldCandidate(nearbyStaff);
        if (support != null) {
            actions.add("지원 요청 추천: " + support.name() + "님에게 " + safe(me.currentTask(), "현재 업무") + " 지원을 요청하세요.");
        }
        if (hold != null) {
            actions.add("호출 보류: " + hold.name() + "님은 " + hold.statusLabel() + " 상태라 지금은 부르지 않는 편이 좋습니다.");
        }
        nearbyStaff.stream()
                .filter(member -> "URGENT".equals(member.status()))
                .findFirst()
                .ifPresent(member -> actions.add(member.name() + "님이 긴급 상태입니다. 위치와 메모를 먼저 확인하세요."));
        nearbyStaff.stream()
                .filter(member -> "MOVING".equals(member.status()))
                .findFirst()
                .ifPresent(member -> actions.add(member.name() + "님은 이동중입니다. 도착 전까지 현재 위치를 유지하세요."));
        if (support != null) actions.add("무전 문구: " + radioMessage(me, support));
        if (actions.isEmpty()) actions.add("주변에 바로 호출할 인원이 없습니다. 현재 업무를 유지하고 위치 공유를 확인하세요.");
        return actions.stream().limit(4).toList();
    }

    private StaffMemberResponseDto bestSupportCandidate(List<StaffMemberResponseDto> nearbyStaff) {
        return nearbyStaff.stream()
                .filter(member -> !"URGENT".equals(member.status()))
                .filter(member -> !"MOVING".equals(member.status()))
                .min(Comparator.comparingInt(this::supportPriority))
                .orElse(null);
    }

    private int supportPriority(StaffMemberResponseDto member) {
        if ("STANDBY".equals(member.status())) return 0;
        if ("ON_DUTY".equals(member.status())) return 1;
        return 2;
    }

    private StaffMemberResponseDto callHoldCandidate(List<StaffMemberResponseDto> nearbyStaff) {
        return nearbyStaff.stream()
                .filter(member -> "URGENT".equals(member.status()) || "MOVING".equals(member.status()))
                .findFirst()
                .orElse(null);
    }

    private String radioMessage(StaffMemberResponseDto me, StaffMemberResponseDto support) {
        return support.name() + "님, " + safe(me.currentTask(), "현재 위치") + " 지원 가능하시면 합류 부탁드립니다.";
    }

    private boolean hasStaffLocation(StaffMemberResponseDto member) {
        if (member == null || !Boolean.TRUE.equals(member.locationSharingEnabled())) return false;
        return member.latitude() != null
                && member.longitude() != null
                && Math.abs(member.latitude()) <= 90
                && Math.abs(member.longitude()) <= 180
                && !(member.latitude() == 0 && member.longitude() == 0);
    }

    private String staffDistanceLabel(StaffMemberResponseDto me, StaffMemberResponseDto member) {
        if (!hasStaffLocation(me) || !hasStaffLocation(member)) return "위치 미공유";
        double meters = distanceMeters(me.latitude(), me.longitude(), member.latitude(), member.longitude());
        if (meters < 1000) return Math.round(meters) + "m";
        return String.format("%.1fkm", meters / 1000.0);
    }

    private double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusMeters = 6371000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private String staffOpsContext(
            StaffMemberResponseDto me,
            List<StaffMemberResponseDto> staff,
            List<EventResponseDto> events,
            List<NoticeResponseDto> notices,
            List<LostItemResponseDto> lostItems
    ) {
        long urgentStaff = staff.stream().filter(member -> "URGENT".equals(member.status())).count();
        return "스태프: " + me.name() + " / " + me.team() + " / 상태 " + me.statusLabel()
                + "\n현재 업무: " + safe(me.currentTask(), "미입력")
                + "\n메모: " + safe(me.currentNote(), "미입력")
                + "\n위치 공유: " + (Boolean.TRUE.equals(me.locationSharingEnabled()) ? "켜짐" : "꺼짐")
                + "\n긴급 상태 스태프 수: " + urgentStaff
                + "\n다가오는 공연: " + events.stream().limit(5).map(event -> event.title() + " / " + event.startTime() + " / " + safe(event.status(), "-")).toList()
                + "\n활성 공지: " + notices.stream().limit(5).map(NoticeResponseDto::title).toList()
                + "\n미처리 분실물: " + lostItems.stream().limit(8).map(item -> item.title() + " / " + item.statusLabel() + " / " + item.foundLocation()).toList();
    }

    private String staffOpsFallback(
            StaffMemberResponseDto me,
            List<StaffMemberResponseDto> staff,
            List<EventResponseDto> events,
            List<NoticeResponseDto> notices,
            List<LostItemResponseDto> lostItems
    ) {
        List<String> actions = staffOpsActions(me, staff, events, notices, lostItems);
        return safe(me.currentTask(), "현재 맡은 구역") + " 기준으로 " + String.join(" ", actions.stream().limit(2).toList());
    }

    private List<String> staffOpsHighlights(
            StaffMemberResponseDto me,
            List<StaffMemberResponseDto> staff,
            List<EventResponseDto> events,
            List<NoticeResponseDto> notices,
            List<LostItemResponseDto> lostItems
    ) {
        List<String> result = new ArrayList<>();
        result.add("상태: " + me.statusLabel());
        result.add("현재 업무: " + safe(me.currentTask(), "미입력"));
        events.stream().findFirst().ifPresent(event -> result.add("다가오는 공연: " + event.title()));
        if (!notices.isEmpty()) result.add("중요 공지: " + notices.get(0).title());
        long urgentStaff = staff.stream().filter(member -> "URGENT".equals(member.status())).count();
        if (urgentStaff > 0) result.add("긴급 상태 스태프 " + urgentStaff + "명");
        if (!lostItems.isEmpty()) result.add("확인할 분실물 " + lostItems.size() + "건");
        return result;
    }

    private List<String> staffOpsActions(
            StaffMemberResponseDto me,
            List<StaffMemberResponseDto> staff,
            List<EventResponseDto> events,
            List<NoticeResponseDto> notices,
            List<LostItemResponseDto> lostItems
    ) {
        List<String> actions = new ArrayList<>();
        String task = safe(me.currentTask(), "").toLowerCase();
        if (task.contains("줄") || task.contains("대기")) {
            actions.add("줄 끝 지점과 통로 막힘 여부를 먼저 확인하세요.");
        }
        if (task.contains("무대") || task.contains("공연")) {
            actions.add("무대 앞 통로와 입장 동선을 확보하세요.");
        }
        if (task.contains("입구") || task.contains("동선") || task.contains("안내")) {
            actions.add("방문객 이동 방향과 우회 동선을 짧게 안내하세요.");
        }
        events.stream()
                .filter(event -> event.startTime() != null)
                .filter(event -> {
                    long minutes = Duration.between(LocalDateTime.now(), event.startTime()).toMinutes();
                    return minutes >= -5 && minutes <= 30;
                })
                .findFirst()
                .ifPresent(event -> actions.add(event.title() + " 전후로 무대 주변 혼잡과 통로 확보를 확인하세요."));
        if (!notices.isEmpty()) {
            actions.add("활성 공지 내용을 방문객 안내에 반영하세요.");
        }
        long ownerClaimed = lostItems.stream().filter(item -> "OWNER_CLAIMED".equals(item.status())).count();
        if (ownerClaimed > 0) {
            actions.add("소유자 확인 요청 분실물 " + ownerClaimed + "건을 우선 확인하세요.");
        }
        long urgentStaff = staff.stream().filter(member -> "URGENT".equals(member.status())).count();
        if (urgentStaff > 0) {
            actions.add("긴급 상태 스태프 위치를 확인하고 필요하면 지원을 요청하세요.");
        }
        if (actions.isEmpty()) {
            actions.add("현재 업무 위치를 유지하고, 공지와 분실물 문의를 수시로 확인하세요.");
        }
        return actions.stream().limit(5).toList();
    }

    private String staffContext(StaffMemberResponseDto me, BoothResponseDto booth, CongestionResponseDto congestion, List<NoticeResponseDto> notices) {
        return "스태프: " + me.name() + " / " + me.team() + " / 상태 " + me.statusLabel()
                + "\n현재 업무: " + safe(me.currentTask(), "미입력")
                + "\n메모: " + safe(me.currentNote(), "미입력")
                + "\n담당 부스: " + (booth == null ? "미배정" : booth.name() + " / 대기 " + booth.estimatedWaitMinutes() + "분 / 재고 " + booth.remainingStock())
                + "\n혼잡도: " + (congestion == null ? "미확인" : congestion.level() + " / " + congestion.nearbyUserCount() + "명")
                + "\n활성 공지: " + notices.stream().map(NoticeResponseDto::title).toList();
    }

    private String staffFallback(StaffMemberResponseDto me, BoothResponseDto booth, CongestionResponseDto congestion) {
        if (booth == null) {
            return "현재 담당 부스가 없습니다. 팀 지시와 중요 공지를 먼저 확인해 주세요.";
        }
        return booth.name() + " 담당입니다. 대기 " + value(booth.estimatedWaitMinutes()) + "분, 재고 " + value(booth.remainingStock())
                + ", 혼잡도 " + (congestion == null ? "미확인" : congestion.level()) + "입니다.";
    }

    private List<String> staffHighlights(StaffMemberResponseDto me, BoothResponseDto booth, CongestionResponseDto congestion, List<NoticeResponseDto> notices) {
        List<String> result = new ArrayList<>();
        result.add("상태: " + me.statusLabel());
        result.add("담당: " + (booth == null ? "미배정" : booth.name()));
        if (congestion != null) result.add("혼잡도: " + congestion.level() + " · " + congestion.nearbyUserCount() + "명");
        if (!notices.isEmpty()) result.add("중요 공지: " + notices.get(0).title());
        return result;
    }

    private List<String> staffActions(StaffMemberResponseDto me, BoothResponseDto booth, CongestionResponseDto congestion) {
        List<String> actions = new ArrayList<>();
        if (booth != null && booth.remainingStock() != null && booth.remainingStock() <= 10) actions.add("재고 부족 가능성을 운영자에게 보고하세요.");
        if (booth != null && booth.estimatedWaitMinutes() != null && booth.estimatedWaitMinutes() >= 20) actions.add("대기열 정리와 예상 대기시간 안내를 강화하세요.");
        if (congestion != null && congestion.nearbyUserCount() >= 12) actions.add("혼잡 완화를 위해 주변 동선을 정리하세요.");
        if (actions.isEmpty()) actions.add("현재 상태를 유지하고 문의 응대와 위치 공유를 계속하세요.");
        return actions;
    }

    private List<LostItemResponseDto> lostItemMatches(String prompt) {
        Set<String> terms = lostItemSearchTerms(prompt);
        return lostItemService.getAll(true).stream()
                .filter(item -> scoreLostItem(item, terms) > 0)
                .sorted(Comparator.comparingInt((LostItemResponseDto item) -> scoreLostItem(item, terms)).reversed())
                .toList();
    }

    private Set<String> lostItemSearchTerms(String prompt) {
        Set<String> terms = new LinkedHashSet<>(List.of(safe(prompt, "").toLowerCase().split("[^\\p{IsAlphabetic}\\p{IsDigit}가-힣]+")));
        if (terms.stream().anyMatch(term -> term.contains("검정") || term.contains("검은") || term.contains("블랙"))) {
            terms.addAll(List.of("검정", "검은", "검은색", "블랙", "black"));
        }
        if (terms.stream().anyMatch(term -> term.contains("흰") || term.contains("하양") || term.contains("화이트"))) {
            terms.addAll(List.of("흰색", "하얀", "하양", "화이트", "white"));
        }
        if (terms.stream().anyMatch(term -> term.contains("지갑"))) {
            terms.addAll(List.of("지갑", "반지갑", "카드지갑"));
        }
        if (terms.stream().anyMatch(term -> term.contains("에어팟") || term.contains("airpod"))) {
            terms.addAll(List.of("에어팟", "airpod", "airpods", "이어폰"));
        }
        return terms;
    }

    private String lostItemMatchContext(String prompt, List<LostItemResponseDto> matches) {
        StringBuilder builder = new StringBuilder();
        builder.append("방문객 설명: ").append(prompt).append("\n등록된 후보:\n");
        if (matches.isEmpty()) {
            builder.append("매칭된 후보 없음");
            return builder.toString();
        }
        for (int i = 0; i < matches.size(); i++) {
            LostItemResponseDto item = matches.get(i);
            builder.append(i + 1)
                    .append(". ")
                    .append(item.title())
                    .append(" / 종류: ").append(value(item.category()))
                    .append(" / 발견 위치: ").append(value(item.foundLocation()))
                    .append(" / 상태: ").append(value(item.statusLabel()))
                    .append(" / 설명: ").append(value(item.description()))
                    .append("\n");
        }
        return builder.toString();
    }

    private List<String> lostItemMatchHighlights(String prompt, List<LostItemResponseDto> matches) {
        if (matches.isEmpty()) return List.of("가능성 높은 후보 없음 · 현재 등록된 분실물과 설명이 충분히 겹치지 않습니다.");
        List<String> highlights = new ArrayList<>();
        for (int i = 0; i < matches.size(); i++) {
            LostItemResponseDto item = matches.get(i);
            highlights.add("lost-item:" + item.id() + "|" + (i + 1) + "순위 후보: " + value(item.title())
                    + " · 일치한 근거: " + lostItemMatchedEvidence(prompt, item)
                    + " · 애매한 부분: " + lostItemUnclearPoint(prompt, item)
                    + " · 추가 확인 질문: " + lostItemFollowUpQuestion(item));
        }
        return highlights;
    }

    private String lostItemMatchedEvidence(String prompt, LostItemResponseDto item) {
        Set<String> terms = lostItemSearchTerms(prompt);
        List<String> matched = new ArrayList<>();
        String title = safe(item.title(), "").toLowerCase();
        String description = safe(item.description(), "").toLowerCase();
        String category = safe(item.category(), "").toLowerCase();
        String location = safe(item.foundLocation(), "").toLowerCase();
        for (String term : terms) {
            if (term == null || term.length() < 2) continue;
            if (title.contains(term) || category.contains(term)) matched.add("물품/종류");
            else if (location.contains(term)) matched.add("위치");
            else if (description.contains(term)) matched.add("상세 설명");
        }
        if (matched.isEmpty()) return "방문객 설명과 일부 표현이 유사합니다.";
        return String.join(", ", matched.stream().distinct().limit(3).toList()) + " 정보가 겹칩니다.";
    }

    private String lostItemUnclearPoint(String prompt, LostItemResponseDto item) {
        String target = (safe(item.title(), "") + " " + safe(item.description(), "") + " " + safe(item.category(), "") + " " + safe(item.foundLocation(), "")).toLowerCase();
        Set<String> terms = lostItemSearchTerms(prompt);
        List<String> missing = terms.stream()
                .filter(term -> term != null && term.length() >= 2 && !target.contains(term))
                .limit(3)
                .toList();
        if (missing.isEmpty()) return "현재 설명만으로는 고유 특징 확인이 필요합니다.";
        return "등록 정보에서 " + String.join(", ", missing) + " 단서는 바로 확인되지 않습니다.";
    }

    private String lostItemFollowUpQuestion(LostItemResponseDto item) {
        String category = safe(item.category(), "").toLowerCase();
        String title = safe(item.title(), "").toLowerCase();
        if (category.contains("지갑") || title.contains("지갑")) return "지갑 안에 있던 카드, 학생증, 브랜드 같은 고유 특징을 말해줄 수 있나요?";
        if (category.contains("전자") || title.contains("에어팟") || title.contains("이어폰")) return "케이스 색상, 스티커, 기기 이름처럼 본인만 알 수 있는 특징이 있나요?";
        if (category.contains("카드") || title.contains("카드")) return "카드 색상이나 카드사, 이름 일부를 확인할 수 있나요?";
        return "색상, 훼손 흔적, 부착물처럼 본인만 알 수 있는 특징이 있나요?";
    }

    private String lostItemMatchFallback(String prompt, List<LostItemResponseDto> matches) {
        if (matches.isEmpty()) {
            return "등록된 분실물 중 방문객 설명과 강하게 겹치는 후보가 없습니다. 색상, 물품 종류, 마지막으로 본 위치를 더 물어보고 신규 분실 접수로 남겨 주세요.";
        }
        LostItemResponseDto top = matches.get(0);
        return "가장 먼저 확인할 후보는 '" + top.title() + "'입니다. 방문객 설명과 겹치는 정보가 있지만 바로 인계하지 말고 사진, 상세 설명, 고유 특징을 추가로 확인하세요.";
    }

    private List<String> lostItemMatchActions(List<LostItemResponseDto> matches) {
        if (matches.isEmpty()) {
            return List.of("색상/종류/마지막 위치를 더 물어보기", "다른 표현으로 다시 매칭하기", "후보가 계속 없으면 신규 분실 접수 등록");
        }
        return List.of("1순위 후보 사진과 상세 설명 대조", "고유 특징이 2개 이상 맞는지 확인", "확인이 부족하면 소유자 확인 중으로 보류", "분실물 상세 탭에서 상태 확인");
    }

    private int scoreLostItem(LostItemResponseDto item, Set<String> terms) {
        String target = (safe(item.title(), "") + " " + safe(item.description(), "") + " " + safe(item.category(), "") + " " + safe(item.foundLocation(), "")).toLowerCase();
        int score = 0;
        for (String term : terms) {
            if (term != null && term.length() >= 2 && target.contains(term)) score++;
        }
        return score;
    }

    private String confidence(List<String> highlights) {
        return highlights.size() >= 4 ? "HIGH" : "MEDIUM";
    }

    private String safe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String value(Object value) {
        return value == null ? "-" : String.valueOf(value);
    }

    private record OpsSnapshot(
            List<BoothResponseDto> booths,
            List<EventResponseDto> events,
            List<NoticeResponseDto> notices,
            List<LostItemResponseDto> lostItems,
            List<StaffMemberResponseDto> staff,
            List<CongestionResponseDto> congestions
    ) {
        String context(String purpose) {
            return "목적: " + purpose
                    + "\n부스: " + booths.stream().limit(12).map(booth -> booth.name() + "/대기 " + booth.estimatedWaitMinutes() + "/재고 " + booth.remainingStock()).toList()
                    + "\n혼잡: " + congestions.stream().limit(8).map(item -> item.boothName() + "/" + item.level() + "/" + item.nearbyUserCount()).toList()
                    + "\n공연: " + events.stream().limit(8).map(event -> event.title() + "/" + event.status() + "/" + event.startTime()).toList()
                    + "\n공지: " + notices.stream().limit(5).map(NoticeResponseDto::title).toList()
                    + "\n분실물: " + lostItems.stream().limit(8).map(item -> item.title() + "/" + item.statusLabel()).toList()
                    + "\n스태프: " + staff.stream().limit(12).map(member -> member.name() + "/" + member.statusLabel() + "/" + member.currentTask()).toList();
        }
    }

    private record Draft(String title, String content) {
    }
}
