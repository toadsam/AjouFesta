package com.festflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.SajuCompatibilityDto;
import com.festflow.backend.dto.SajuDto;
import com.festflow.backend.service.saju.SajuCalculator;
import com.festflow.backend.service.saju.SajuCompatibility;
import com.festflow.backend.service.saju.SajuPillars;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * 사주 풀이.
 *
 * 여덟 글자는 {@link SajuCalculator} 가 자바로 정확히 계산하고, AI 는 그 결과를 읽기 좋은 글로
 * 옮기기만 한다. 키가 없거나 호출이 실패하면 규칙으로 쓴 풀이를 그대로 내보낸다 — 축제 당일에
 * OpenAI 가 흔들려도 사주 자체는 나와야 한다.
 */
@Service
public class SajuService {

    private static final Logger log = LoggerFactory.getLogger(SajuService.class);
    private static final String OPENAI_RESPONSES_PATH = "/v1/responses";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String textModel;

    public SajuService(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${app.openai.api-key:}") String apiKey,
            @Value("${app.openai.model:gpt-5-mini}") String textModel
    ) {
        // 이 코드베이스의 다른 OpenAI 호출과 같이 타임아웃을 직접 잡아 준다.
        // 기본 빌더를 그대로 쓰면 읽기 타임아웃이 너무 짧아 사주 풀이가 매번 폴백으로 떨어진다.
        this.restClient = restClientBuilder
                .baseUrl("https://api.openai.com")
                .requestFactory(requestFactory())
                .build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.textModel = textModel;
    }

    private SimpleClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(30));
        return factory;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public SajuPillars calculate(LocalDate birthDate, LocalTime birthTime) {
        return SajuCalculator.calculate(birthDate, birthTime);
    }

    /**
     * 사주 풀이 글을 만든다. 실패해도 예외를 던지지 않는다 — 가입이 사주 때문에 막히면 안 된다.
     */
    public String writeReading(SajuPillars pillars, String nickname, String gender) {
        String fallback = ruleBasedReading(pillars, nickname);
        if (!isConfigured()) {
            log.info("OpenAI key is absent; using the rule-based saju reading.");
            return fallback;
        }
        try {
            String prompt = buildPrompt(pillars, nickname, gender);
            // gpt-5 계열은 추론 토큰을 먼저 쓴다. 예산이 빠듯하면 본문이 빈 채로 돌아오므로 넉넉히 준다.
            Map<String, Object> body = Map.of(
                    "model", textModel,
                    "store", false,
                    "max_output_tokens", 1500,
                    "input", List.of(Map.of(
                            "role", "user",
                            "content", List.of(Map.of("type", "input_text", "text", prompt))
                    ))
            );
            String response = restClient.post()
                    .uri(OPENAI_RESPONSES_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> headers.setBearerAuth(apiKey))
                    .body(body)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(response);
            String text = extractOutputText(root).trim();
            if (text.isBlank()) {
                // 조용히 넘어가면 왜 규칙 기반 글이 나오는지 알 수 없다. 상태와 이유를 남긴다.
                log.warn(
                        "OpenAI returned no saju text (status={}, incomplete={}); using the rule-based reading.",
                        root.path("status").asText("?"),
                        root.path("incomplete_details").path("reason").asText("-")
                );
                return fallback;
            }
            return text;
        } catch (Exception exception) {
            log.warn("Saju reading generation failed; using the rule-based reading.", exception);
            return fallback;
        }
    }

    /** 가입 화면 미리보기용. OpenAI 를 부르지 않고 규칙 기반 짧은 풀이만 돌려준다. */
    public String previewReading(SajuPillars pillars, String nickname) {
        return ruleBasedReading(pillars, nickname);
    }

    public SajuDto toDto(SajuPillars pillars, String reading) {
        int dayElement = SajuCalculator.stemElement(pillars.dayStem());
        return new SajuDto(
                pillars.yearPillar(),
                pillars.monthPillar(),
                pillars.dayPillar(),
                pillars.hourPillar(),
                pillars.hourKnown(),
                SajuCalculator.stemName(pillars.dayStem()),
                SajuCalculator.elementName(dayElement),
                SajuCalculator.zodiacOf(pillars.yearBranch()),
                SajuCalculator.elementCounts(pillars),
                SajuCalculator.elementName(SajuCalculator.strongestElement(pillars)),
                SajuCalculator.elementName(SajuCalculator.weakestElement(pillars)),
                reading
        );
    }

    public SajuCompatibilityDto compatibility(SajuPillars mine, SajuPillars theirs) {
        SajuCompatibility.Result result = SajuCompatibility.evaluate(mine, theirs);
        return new SajuCompatibilityDto(result.score(), result.grade(), result.headline(), result.reasons());
    }

    private String buildPrompt(SajuPillars pillars, String nickname, String gender) {
        Map<String, Integer> counts = SajuCalculator.elementCounts(pillars);
        String elementLine = counts.entrySet().stream()
                .map(entry -> entry.getKey() + " " + entry.getValue())
                .reduce((a, b) -> a + ", " + b)
                .orElse("");

        return """
                아래는 이미 정확히 계산된 사주팔자다. 네가 다시 계산하지 말고 주어진 글자를 그대로 근거로 삼아라.

                닉네임: %s
                성별: %s
                년주: %s
                월주: %s
                일주: %s
                시주: %s
                일간: %s (%s)
                오행 개수: %s

                이 사람의 사주 풀이를 한국어로 써라. 조건:
                - 3~4문장, 존댓말, 대학 축제 부스에서 읽는 가벼운 톤
                - 일간과 오행 분포를 근거로 성격과 연애 스타일을 말할 것
                - 주어진 여덟 글자 외의 정보를 지어내지 말 것
                - 건강, 수명, 재물, 합격 여부처럼 단정하면 곤란한 예언은 하지 말 것
                - 부정적으로 끝내지 말고 마지막 문장은 축제에서 어떻게 사람을 만나면 좋을지로 마무리할 것
                - 제목이나 머리말 없이 본문만 출력할 것
                """
                .formatted(
                        nickname == null ? "익명" : nickname,
                        gender == null ? "미상" : gender,
                        pillars.yearPillar(),
                        pillars.monthPillar(),
                        pillars.dayPillar(),
                        pillars.hourKnown() ? pillars.hourPillar() : "태어난 시간을 몰라 세우지 않음",
                        SajuCalculator.stemName(pillars.dayStem()),
                        SajuCalculator.elementName(SajuCalculator.stemElement(pillars.dayStem())),
                        elementLine
                );
    }

    /** OpenAI 를 못 쓸 때 쓰는 풀이. 계산된 사주에서 그대로 끌어내므로 내용이 비어 있지 않다. */
    private String ruleBasedReading(SajuPillars pillars, String nickname) {
        int dayElement = SajuCalculator.stemElement(pillars.dayStem());
        String dayElementName = SajuCalculator.elementName(dayElement);
        String strongest = SajuCalculator.elementName(SajuCalculator.strongestElement(pillars));
        String weakest = SajuCalculator.elementName(SajuCalculator.weakestElement(pillars));
        String zodiac = SajuCalculator.zodiacOf(pillars.yearBranch());
        String who = nickname == null || nickname.isBlank() ? "이 분" : nickname + " 님";

        return who + "은 " + zodiac + "띠에 일간이 " + SajuCalculator.stemName(pillars.dayStem())
                + "(" + dayElementName + ")인 사주예요. " + elementCharacter(dayElement)
                + " 사주 전체로는 " + strongest + " 기운이 가장 많고 " + weakest + " 기운이 가장 적어서, "
                + complementAdvice(weakest) + " 축제에서는 " + meetingAdvice(dayElement);
    }

    private String elementCharacter(int element) {
        return switch (element) {
            case 0 -> "곧게 자라는 나무처럼 한번 정한 방향으로 꾸준히 가는 성격이에요.";
            case 1 -> "불처럼 감정이 솔직하고 표현이 빠른 편이에요.";
            case 2 -> "흙처럼 듬직해서 주변 사람이 기대기 좋은 성격이에요.";
            case 3 -> "쇠처럼 기준이 분명하고 맺고 끊는 게 확실한 편이에요.";
            default -> "물처럼 상황에 맞춰 유연하게 흘러가는 성격이에요.";
        };
    }

    private String complementAdvice(String weakest) {
        return switch (weakest) {
            case "목" -> "새로 시작하는 일을 곁에 두면 균형이 맞아요.";
            case "화" -> "사람들 앞에 나서는 자리를 조금 늘리면 좋아요.";
            case "토" -> "믿고 기댈 사람을 곁에 두면 좋아요.";
            case "금" -> "기준을 분명히 정해두면 흔들림이 줄어요.";
            default -> "천천히 쉬어가는 시간을 챙기면 좋아요.";
        };
    }

    private String meetingAdvice(int element) {
        return switch (element) {
            case 0 -> "먼저 말을 거는 사람보다 오래 이야기할 사람을 찾아보세요.";
            case 1 -> "분위기에 휩쓸리지 말고 한 사람과 길게 이야기해 보세요.";
            case 2 -> "편하게 들어주다 보면 먼저 다가오는 사람이 있을 거예요.";
            case 3 -> "첫인상만 보지 말고 두 번째 대화까지 가 보세요.";
            default -> "여러 사람을 두루 만나보면 잘 맞는 결을 금방 찾을 거예요.";
        };
    }

    private String extractOutputText(JsonNode root) {
        String direct = root.path("output_text").asText("");
        if (!direct.isBlank()) {
            return direct;
        }
        for (JsonNode outputItem : root.path("output")) {
            for (JsonNode contentItem : outputItem.path("content")) {
                if ("output_text".equals(contentItem.path("type").asText(""))) {
                    String text = contentItem.path("text").asText("");
                    if (!text.isBlank()) {
                        return text;
                    }
                }
            }
        }
        return "";
    }
}
