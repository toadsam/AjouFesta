import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createCongestionStream,
  fetchAiCongestionPredictions,
  fetchAiDecisionLogs,
  fetchAiVisitorGuide,
  fetchAnalyticsDashboard,
} from "../api";
import { IconChart, IconMapPin, IconRefresh, IconSparkles } from "../components/UxIcons";

const ZONE_LABELS = {
  "ajou-square": "아주광장",
  "lawn-square": "잔디 광장",
  "gym-front": "체육관 앞",
  "student-hall": "학생회관",
  "seongho-hall": "성호관 주변",
  "rear-gate": "후문 거리",
};
const FALLBACK_GUIDE_ZONES = [
  { zoneKey: "main-stage", zoneName: "중앙무대", percent: 85, level: "PACKED", deltaPercent: 10 },
  { zoneKey: "food-truck", zoneName: "푸드트럭 존", percent: 72, level: "BUSY", deltaPercent: 8 },
  { zoneKey: "field-booth", zoneName: "운동장 부스", percent: 30, level: "LOW", deltaPercent: -4 },
  { zoneKey: "lawn-square", zoneName: "잔디광장", percent: 38, level: "NORMAL", deltaPercent: -3 },
  { zoneKey: "student-hall", zoneName: "학생회관", percent: 58, level: "NORMAL", deltaPercent: 2 },
  { zoneKey: "guide-desk", zoneName: "종합 안내 데스크", percent: 24, level: "LOW", deltaPercent: -1 },
];

const EMPTY_DASHBOARD = {
  updatedAt: null,
  minutesWindow: 15,
  sampleCount: 0,
  overview: {
    percent: 0,
    level: "LOW",
    deltaPercent: 0,
    currentCount: 0,
    previousCount: 0,
  },
  zones: [],
  trend: [],
  recommendation: {
    startTime: null,
    endTime: null,
    expectedPercent: 0,
    reason: "NO_DATA",
  },
};

function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}

function percentMeta(percent) {
  const value = clampPercent(percent);
  if (value <= 30) return { label: "한산", tone: "calm" };
  if (value <= 60) return { label: "보통", tone: "normal" };
  if (value <= 80) return { label: "혼잡", tone: "busy" };
  return { label: "매우 혼잡", tone: "packed" };
}

function zoneDisplayName(zone) {
  return ZONE_LABELS[zone.zoneKey] || zone.zoneName || zone.name || "축제 구역";
}

function zoneAction(percent) {
  const value = clampPercent(percent);
  if (value <= 30) return "지금 가기 좋음";
  if (value <= 60) return "여유 확인 후 방문";
  if (value <= 80) return "대기 예상";
  return "잠시 후 방문 추천";
}

function predictionAction(level, score = 0) {
  const text = `${level || ""}`.toUpperCase();
  const value = Number(score) || 0;
  if (text.includes("PACKED") || text.includes("매우") || value >= 80) return "가능하면 피하기";
  if (text.includes("BUSY") || text.includes("혼잡") || value >= 60) return "잠시 후 방문 추천";
  if (text.includes("NORMAL") || text.includes("보통") || value >= 35) return "지금 방문 추천";
  return "바로 방문하기 좋음";
}

function driftStatusLabel(status) {
  const value = `${status || ""}`.toUpperCase();
  if (value === "WARNING") return "AI 데이터 신뢰도 낮음";
  if (value === "CAUTION") return "AI 데이터 신뢰도 주의";
  return "AI 데이터 신뢰도 안정";
}

function driftWarningSummary(warnings = []) {
  const messages = [];
  const raw = warnings.map((warning) => `${warning || ""}`);
  const has = (pattern) => raw.some((warning) => warning.includes(pattern));

  if (has("gps_delta")) {
    messages.push("최근 위치 변화량이 평소 학습 범위보다 커서 혼잡이 빠르게 변할 수 있습니다.");
  }
  if (has("gps_count_nearby")) {
    messages.push("현재 주변 위치 신호가 학습 데이터보다 많아 예측을 참고용으로 표시합니다.");
  }
  if (has("reservation_delta") || has("reservation_count")) {
    messages.push("예약 증가 흐름이 평소 패턴과 달라 예측 신뢰도가 낮아질 수 있습니다.");
  }
  if (has("checked_in")) {
    messages.push("체크인 증가 흐름이 학습 범위와 달라 현장 확인이 필요합니다.");
  }
  if (has("wait")) {
    messages.push("대기시간 변화가 평소 패턴과 달라 혼잡도가 빠르게 바뀔 수 있습니다.");
  }
  if (has("stage") || has("event")) {
    messages.push("공연 일정 또는 예상 인파 조건이 학습 범위와 달라 예측을 보수적으로 봐야 합니다.");
  }

  return [...new Set(messages)].slice(0, 2);
}

function formatUpdatedAt(value) {
  if (!value) return "업데이트 대기";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "업데이트 대기";
  return `업데이트 ${date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}

function formatDelta(delta) {
  const value = Math.round(Number(delta) || 0);
  if (value === 0) return "이전보다 비슷함";
  return value > 0 ? "이전보다 증가" : "이전보다 감소";
}

function deltaTone(delta) {
  const value = Number(delta) || 0;
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "same";
}

function Gauge({ percent }) {
  const value = clampPercent(percent);
  const radius = 50;
  const length = Math.PI * radius;
  const offset = length - (length * value) / 100;
  const angle = Math.PI - (value / 100) * Math.PI;
  const needleX = 70 + 42 * Math.cos(angle);
  const needleY = 70 - 42 * Math.sin(angle);

  return (
    <svg className="analytics-gauge" viewBox="0 0 140 84" role="img" aria-label={`전체 혼잡도 ${value}%`}>
      <defs>
        <linearGradient id="analyticsGaugeGradient" x1="20" y1="0" x2="120" y2="0">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="32%" stopColor="#22c55e" />
          <stop offset="60%" stopColor="#facc15" />
          <stop offset="80%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <path className="analytics-gauge__track" d="M20 70 A50 50 0 0 1 120 70" pathLength={length} />
      <path
        className="analytics-gauge__value"
        d="M20 70 A50 50 0 0 1 120 70"
        pathLength={length}
        style={{ strokeDasharray: length, strokeDashoffset: offset }}
      />
      <line className="analytics-gauge__needle" x1="70" y1="70" x2={needleX} y2={needleY} />
      <circle className="analytics-gauge__pin" cx="70" cy="70" r="4" />
    </svg>
  );
}

function TrendChart({ points }) {
  const trend = points.length
    ? points
    : Array.from({ length: 8 }, (_, index) => ({
        label: `${String(index * 3).padStart(2, "0")}시`,
        percent: 0,
        count: 0,
        current: index === 5,
      }));
  const width = 320;
  const height = 150;
  const left = 24;
  const right = 14;
  const top = 14;
  const bottom = 28;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const chartPoints = trend.map((item, index) => {
    const x = left + (trend.length === 1 ? chartWidth / 2 : (chartWidth * index) / (trend.length - 1));
    const y = top + chartHeight - (chartHeight * clampPercent(item.percent)) / 100;
    return { ...item, x, y };
  });
  const path = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const active = chartPoints.find((point) => point.current) || chartPoints[chartPoints.length - 1];

  return (
    <div className="analytics-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="시간대별 혼잡 추이">
        <line className="analytics-chart__axis" x1={left} y1={top} x2={left} y2={top + chartHeight} />
        <line className="analytics-chart__axis" x1={left} y1={top + chartHeight} x2={width - right} y2={top + chartHeight} />
        {[0, 50, 100].map((tick) => {
          const y = top + chartHeight - (chartHeight * tick) / 100;
          return (
            <g key={tick}>
              <line className="analytics-chart__grid" x1={left} y1={y} x2={width - right} y2={y} />
              <text className="analytics-chart__tick" x="0" y={y + 4}>{tick}%</text>
            </g>
          );
        })}
        <path className="analytics-chart__line" d={path} />
        {active && (
          <g>
            <line className="analytics-chart__marker-line" x1={active.x} y1={top} x2={active.x} y2={top + chartHeight} />
            <circle className="analytics-chart__marker" cx={active.x} cy={active.y} r="4.5" />
            <foreignObject x={Math.min(width - 78, Math.max(28, active.x - 30))} y={Math.max(2, active.y - 42)} width="60" height="36">
              <div className="analytics-chart__bubble">
                <strong>{active.label}</strong>
                <span>{clampPercent(active.percent)}%</span>
              </div>
            </foreignObject>
          </g>
        )}
        {chartPoints.map((point, index) => (
          index % 2 === 0 || index === chartPoints.length - 1 ? (
            <text key={point.label} className="analytics-chart__label" x={point.x} y={height - 6}>
              {point.label}
            </text>
          ) : null
        ))}
      </svg>
    </div>
  );
}

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [aiPredictions, setAiPredictions] = useState([]);
  const [aiDecisionLogs, setAiDecisionLogs] = useState([]);
  const [aiVisitorGuide, setAiVisitorGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async ({ includeVisitorGuide = false } = {}) => {
    try {
      const [nextDashboard, nextPredictions, nextDecisionLogs, nextVisitorGuide] = await Promise.all([
        fetchAnalyticsDashboard(15),
        fetchAiCongestionPredictions().catch(() => []),
        fetchAiDecisionLogs().catch(() => []),
        includeVisitorGuide ? fetchAiVisitorGuide("analytics").catch(() => null) : Promise.resolve(null),
      ]);
      setDashboard({
        ...EMPTY_DASHBOARD,
        ...nextDashboard,
        overview: { ...EMPTY_DASHBOARD.overview, ...(nextDashboard?.overview || {}) },
        recommendation: {
          ...EMPTY_DASHBOARD.recommendation,
          ...(nextDashboard?.recommendation || {}),
        },
        zones: Array.isArray(nextDashboard?.zones) ? nextDashboard.zones : [],
        trend: Array.isArray(nextDashboard?.trend) ? nextDashboard.trend : [],
      });
      setAiPredictions(Array.isArray(nextPredictions) ? nextPredictions : []);
      setAiDecisionLogs(Array.isArray(nextDecisionLogs) ? nextDecisionLogs : []);
      if (nextVisitorGuide) setAiVisitorGuide(nextVisitorGuide);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "실시간 혼잡도 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ includeVisitorGuide: true });

    let stream = null;
    try {
      stream = createCongestionStream();
      stream.addEventListener("congestion", () => {
        load();
      });
    } catch {
      // Streaming is optional; manual refresh still works.
    }

    return () => stream?.close();
  }, [load]);

  const overviewPercentMeta = percentMeta(dashboard.overview.percent);
  const zones = useMemo(() => {
    const source = dashboard.zones.length ? dashboard.zones : FALLBACK_GUIDE_ZONES;
    return [...source]
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 6);
  }, [dashboard.zones]);
  const guideZones = useMemo(() => {
    const source = dashboard.zones.length ? dashboard.zones : FALLBACK_GUIDE_ZONES;
    return [...source].sort((a, b) => clampPercent(b.percent) - clampPercent(a.percent));
  }, [dashboard.zones]);
  const busiestZone = guideZones[0] || FALLBACK_GUIDE_ZONES[0];
  const secondBusyZone = guideZones[1] || FALLBACK_GUIDE_ZONES[1];
  const calmZone = [...guideZones].sort((a, b) => clampPercent(a.percent) - clampPercent(b.percent))[0] || FALLBACK_GUIDE_ZONES[2];
  const laterZone = aiPredictions[0]
    ? {
        name: aiPredictions[0].boothName,
        copy: `30분 뒤 ${aiPredictions[0].predictedLevel || "혼잡"} 예상`,
      }
    : {
        name: zoneDisplayName(secondBusyZone),
        copy: `${Math.max(10, Math.min(30, Math.round(clampPercent(secondBusyZone.percent) / 4)))}분 뒤 완화 여부 확인`,
      };
  const aiGuideActions = Array.isArray(aiVisitorGuide?.actions) ? aiVisitorGuide.actions : [];
  const actionCards = aiGuideActions.length >= 3 ? aiGuideActions.slice(0, 3).map((action) => ({
    title: action.title || "AI 추천",
    name: action.target || "추천 장소",
    value: action.description || "지금 확인해보세요.",
    copy: aiVisitorGuide?.generated ? "OpenAI 실시간 해석" : "데이터 기반 추천",
    tone: ["danger", "good", "wait"].includes(action.tone) ? action.tone : "wait",
  })) : [
    {
      title: "지금 피할 곳",
      name: zoneDisplayName(busiestZone),
      value: `혼잡도 ${clampPercent(busiestZone.percent)}%`,
      copy: "잠시 후 방문 추천",
      tone: "danger",
    },
    {
      title: "지금 가기 좋은 곳",
      name: zoneDisplayName(calmZone),
      value: `혼잡도 ${clampPercent(calmZone.percent)}%`,
      copy: "바로 방문하기 좋음",
      tone: "good",
    },
    {
      title: "기다리면 좋은 곳",
      name: laterZone.name,
      value: laterZone.copy,
      copy: "조금 뒤 다시 확인하기",
      tone: "wait",
    },
  ];
  const aiGuideBullets = Array.isArray(aiVisitorGuide?.bullets)
    ? aiVisitorGuide.bullets.filter(Boolean).slice(0, 3)
    : [];
  const summaryLines = aiGuideBullets.length ? aiGuideBullets : [
    `지금은 ${zoneDisplayName(busiestZone)}${secondBusyZone ? `와 ${zoneDisplayName(secondBusyZone)}` : ""}이 붐비고 있어요.`,
    `${zoneDisplayName(calmZone)}은 비교적 여유로워요.`,
    aiPredictions[0]
      ? `${aiPredictions[0].boothName}은 30분 뒤 ${aiPredictions[0].predictedLevel || "혼잡"} 단계가 될 수 있어요.`
      : `${zoneDisplayName(secondBusyZone)}은 잠시 뒤 더 붐빌 수 있어요.`,
  ];
  const hasMeasurements = Number(dashboard.sampleCount) > 0
    || dashboard.trend.some((point) => Number(point.count) > 0);

  return (
    <section className="uni-page analytics-live-page">
      <header className="analytics-ai-hero">
        <div className="analytics-ai-hero__copy">
          <div className="analytics-ai-hero__badges">
            <span>실시간 분석 중</span>
            <span>최근 {dashboard.minutesWindow}분 기준</span>
          </div>
          <h1>AI 혼잡도 예측</h1>
          <p>지금 어디가 붐비는지, 어디로 가면 좋은지 AI가 알려드려요.</p>
          <Link to="/analytics/stage" className="analytics-stage-link">
            <IconMapPin className="h-4 w-4" />
            노천극장 인원 보기
          </Link>
        </div>
        <img
          src="/images/ai/ai-congestion-chart.png"
          alt="AI 혼잡도 예측"
          onError={(event) => {
            event.currentTarget.hidden = true;
            event.currentTarget.closest(".analytics-ai-hero")?.classList.add("analytics-ai-hero--no-image");
          }}
        />
        <button type="button" aria-label="혼잡도 새로고침" onClick={() => load({ includeVisitorGuide: true })} disabled={loading}>
          <IconRefresh className="h-5 w-5" />
        </button>
      </header>

      {message && <p className="app-inline-note app-inline-note--danger">{message}</p>}

      <section className="analytics-ai-summary-card" aria-label="AI 현재 요약">
        <span>
          <IconSparkles className="h-4 w-4" />
          AI 현재 요약
        </span>
        <strong>{summaryLines[0]}</strong>
        <ul>
          {summaryLines.slice(1).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="analytics-action-section" aria-label="지금 행동 추천">
        <div className="analytics-section-head">
          <h2>지금 행동 추천</h2>
          <span>3초 안에 판단하기</span>
        </div>
        <div className="analytics-action-grid">
          {actionCards.map((card) => (
            <article key={card.title} className={`analytics-action-card analytics-action-card--${card.tone}`}>
              <small>{card.title}</small>
              <strong>{card.name}</strong>
              <span>{card.value}</span>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`analytics-overview-card analytics-overview-card--${overviewPercentMeta.tone}`} aria-label="전체 축제장 혼잡도">
        <div className="analytics-overview-copy">
          <span>전체 축제장 혼잡도</span>
          <strong className={`analytics-level analytics-level--${overviewPercentMeta.tone}`}>
            현재 {overviewPercentMeta.label}
            <b>{clampPercent(dashboard.overview.percent)}%</b>
          </strong>
          <small className={`analytics-delta analytics-delta--${deltaTone(dashboard.overview.deltaPercent)}`}>
            {formatDelta(dashboard.overview.deltaPercent)}
          </small>
          <em>
            최근 {dashboard.minutesWindow}분 기준 · 실측 {Number(dashboard.sampleCount) || 0}건
          </em>
        </div>
        <Gauge percent={dashboard.overview.percent} />
      </section>

      {!hasMeasurements && (
        <p className="analytics-data-note">
          아직 실시간 위치 로그가 부족해서 기본 안내를 함께 보여드려요. 위치 데이터가 쌓이면 실제 흐름으로 갱신됩니다.
        </p>
      )}

      <section className="analytics-section">
        <div className="analytics-section-head">
          <h2>구역별 혼잡도</h2>
          <span>{formatUpdatedAt(dashboard.updatedAt)}</span>
        </div>
        <div className="analytics-zone-grid">
          {zones.map((zone) => {
            const meta = percentMeta(zone.percent);
            return (
              <article key={zone.zoneKey} className={`analytics-zone-card analytics-zone-card--${meta.tone}`}>
                <span>{zoneDisplayName(zone)}</span>
                <strong>{meta.label} {clampPercent(zone.percent)}%</strong>
                <small className={`analytics-delta analytics-delta--${deltaTone(zone.deltaPercent)}`}>
                  {zoneAction(zone.percent)}
                </small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="analytics-prediction-section">
        <div className="analytics-section-head">
          <h2>30분 뒤 혼잡 예측</h2>
          <span>공연·부스·위치 흐름 반영</span>
        </div>
        <div className="analytics-prediction-list">
          {aiPredictions.slice(0, 4).map((item) => {
            const driftNotes = driftWarningSummary(item.aiModel?.driftWarnings);

            return (
              <article key={item.boothId || item.boothName} className="analytics-prediction-card">
                <div>
                  <strong>{item.boothName}</strong>
                  <p>현재 {item.currentLevel || "보통"} → 30분 뒤 {item.predictedLevel || "혼잡"}</p>
                  <span>{predictionAction(item.predictedLevel, item.riskScore)}</span>
                  {item.aiModel && (
                    <div className="analytics-prediction-card__model">
                      <b>{item.aiModel.modelBased ? item.aiModel.modelType || "RandomForest" : "Fallback"}</b>
                      <em>
                        신뢰도 {Number.isFinite(Number(item.aiModel.confidence))
                          ? `${Math.round(Number(item.aiModel.confidence) * 100)}%`
                          : "확인 중"}
                      </em>
                      {item.aiModel.driftStatus && (
                        <em className={`analytics-prediction-card__drift analytics-prediction-card__drift--${String(item.aiModel.driftStatus).toLowerCase()}`}>
                          {driftStatusLabel(item.aiModel.driftStatus)}
                          {Number.isFinite(Number(item.aiModel.driftScore))
                            ? ` ${Math.round(Number(item.aiModel.driftScore) * 100)}%`
                            : ""}
                        </em>
                      )}
                      {Array.isArray(item.aiModel.factors) && item.aiModel.factors.length > 0 && (
                        <small>{item.aiModel.factors.slice(0, 3).join(" · ")}</small>
                      )}
                      {driftNotes.length > 0 && (
                        <small className="analytics-prediction-card__drift-reason">
                          {driftNotes.join(" ")}
                        </small>
                      )}
                    </div>
                  )}
                </div>
                <small>AI 위험 점수 {Number(item.riskScore) || 0}점</small>
              </article>
            );
          })}
          {!aiPredictions.length && (
            FALLBACK_GUIDE_ZONES.slice(1, 3).map((zone) => (
              <article key={`fallback-${zone.zoneKey}`} className="analytics-prediction-card">
                <div>
                  <strong>{zoneDisplayName(zone)}</strong>
                  <p>현재 {percentMeta(zone.percent).label} → 30분 뒤 {clampPercent(zone.percent) > 65 ? "혼잡" : "보통"}</p>
                  <span>{predictionAction(percentMeta(zone.percent).label, zone.percent)}</span>
                </div>
                <small>기본 안내</small>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="analytics-section analytics-trend-section">
        <div className="analytics-section-head">
          <h2>시간대별 혼잡 추이</h2>
          <button type="button" aria-label="오늘 추이 보기">
            오늘
          </button>
        </div>
        <TrendChart points={dashboard.trend} />
      </section>

      <section className="analytics-evidence-section">
        <div className="analytics-section-head">
          <h2>AI 추천 근거</h2>
          <span>왜 이 장소를 추천하거나 피하라고 했는지 알려드려요.</span>
        </div>
        <div className="analytics-evidence-list">
          {aiDecisionLogs.slice(0, 3).map((log, index) => (
            <article key={`${log.createdAt}-${index}`} className="analytics-evidence-card">
              <span>
                <IconMapPin className="h-4 w-4" />
                {log.type || "AI 분석"}
              </span>
              <strong>{log.title}</strong>
              <p>{log.summary}</p>
              {(log.reasons || []).length > 0 && (
                <small>{(log.reasons || []).slice(0, 2).join(" · ")}</small>
              )}
            </article>
          ))}
          {!aiDecisionLogs.length && (
            <article className="analytics-evidence-card">
              <span>
                <IconChart className="h-4 w-4" />
                AI 분석
              </span>
              <strong>{zoneDisplayName(busiestZone)} 혼잡 상승 예상</strong>
              <p>주변 위치 흐름과 공연 전 이동량이 함께 늘어날 수 있어요.</p>
              <small>위치 데이터가 쌓이면 실제 판단 근거로 바뀝니다.</small>
            </article>
          )}
        </div>
      </section>
    </section>
  );
}
