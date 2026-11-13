package com.festflow.backend.controller;

import com.festflow.backend.dto.AiBoothRecommendationDto;
import com.festflow.backend.dto.AiDecisionLogDto;
import com.festflow.backend.dto.AiFestivalGuideDto;
import com.festflow.backend.dto.AiVisitorGuideDto;
import com.festflow.backend.service.AiCongestionService;
import com.festflow.backend.service.AiDecisionLogService;
import com.festflow.backend.service.PublicAiGuideService;
import com.festflow.backend.service.TtlCache;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ai")
public class AiGuideController {

    private final AiCongestionService aiCongestionService;
    private final AiDecisionLogService decisionLogService;
    private final PublicAiGuideService publicAiGuideService;

    public AiGuideController(
            AiCongestionService aiCongestionService,
            AiDecisionLogService decisionLogService,
            PublicAiGuideService publicAiGuideService
    ) {
        this.aiCongestionService = aiCongestionService;
        this.decisionLogService = decisionLogService;
        this.publicAiGuideService = publicAiGuideService;
    }

    // 셋 다 로그인 없이 열리고, 만드는 데 몇 초가 걸린다(혼잡 모델 · OpenAI). 잠깐 같은 결과를 돌려 쓴다.
    private final TtlCache<String, AiFestivalGuideDto> guideCache = new TtlCache<>(30_000);
    private final TtlCache<String, List<AiBoothRecommendationDto>> predictionCache = new TtlCache<>(30_000);
    private final TtlCache<String, AiVisitorGuideDto> visitorGuideCache = new TtlCache<>(60_000);

    @GetMapping("/guide")
    public AiFestivalGuideDto guide() {
        return guideCache.get("guide", aiCongestionService::guide);
    }

    @GetMapping("/congestion/predictions")
    public List<AiBoothRecommendationDto> congestionPredictions() {
        return predictionCache.get("predictions", aiCongestionService::analyzeCurrent);
    }

    @GetMapping("/decisions")
    public List<AiDecisionLogDto> decisions() {
        return decisionLogService.recent();
    }

    @GetMapping("/visitor-guide/{scope}")
    public AiVisitorGuideDto visitorGuide(@PathVariable String scope) {
        // 서비스가 아는 범위는 셋뿐이다(그 밖은 analytics 로 처리된다). 캐시 키도 셋으로 묶는다.
        String key = "events".equals(scope) || "stage-map".equals(scope) ? scope : "analytics";
        return visitorGuideCache.get(key, () -> publicAiGuideService.guide(key));
    }
}
