import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  askChat,
  createBoothStream,
  createEventStream,
  fetchAiFestivalGuide,
  fetchBooths,
  fetchEvents,
  fetchTrafficHourly,
} from "../api";
import {
  IconAlert,
  IconMapPin,
  IconMusic,
  IconSearch,
} from "../components/UxIcons";
import { resolveBoothImageUrl } from "../config/boothImages";
import {
  FESTIVAL_IMAGE,
  fallbackBooths,
} from "../data/festivalUiData";
import { normalizeEvents } from "../data/eventExperience";

const EVENT_RECOMMEND_IMAGE = "/images/og-festflow.png";
const DEFAULT_AI_GUIDE = {
  headline: "지금은 대기 짧은 부스부터 둘러보는 코스를 추천합니다.",
  summary: "혼잡도, 공연 시간, 부스 대기 정보를 기준으로 지금 움직이기 좋은 동선을 골라드릴게요.",
};
const AI_HOME_PROMPTS = [
  "지금 어디 가면 좋아?",
  "안 붐비는 음식 부스 추천해줘",
  "공연 전에 들를 부스 추천해줘",
];

function reservationLabel(booth) {
  if (booth?.reservationEnabled === false) return "현장 이용";
  const seats = Number(booth?.reservationAvailableSeats);
  if (Number.isFinite(seats) && seats > 0) return `예약 ${seats}석`;
  if (booth?.reservation) return booth.reservation;
  return "예약 확인";
}

function compactWaitLabel(booth) {
  const value = booth?.estimatedWaitMinutes ?? booth?.wait;
  if (value == null || value === "") return "대기 확인 중";
  return `대기 ${String(value).replace("분", "")}분`;
}

function crowdLevel(percent) {
  if (percent >= 75) return "혼잡";
  if (percent >= 45) return "보통";
  return "여유";
}

function cardTone(index) {
  return ["mint", "violet", "amber"][index] || "mint";
}

function cleanBrokenText(value, fallback = "추천 부스") {
  if (typeof value !== "string") return value;
  return value.replace(/\?{2,}/g, fallback);
}

function compactText(value, maxLength = 90) {
  const text = cleanBrokenText(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [booths, setBooths] = useState([]);
  const [events, setEvents] = useState([]);
  const [traffic, setTraffic] = useState([]);
  const [aiGuide, setAiGuide] = useState(null);
  const [aiGuideLoading, setAiGuideLoading] = useState(true);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiAskLoading, setAiAskLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      fetchBooths(),
      fetchEvents(),
      fetchTrafficHourly(),
    ]).then(([boothResult, eventResult, trafficResult]) => {
      if (!mounted) return;
      if (boothResult.status === "fulfilled") setBooths(boothResult.value || []);
      if (eventResult.status === "fulfilled") setEvents(eventResult.value || []);
      if (trafficResult.status === "fulfilled") setTraffic(trafficResult.value || []);
      const failed = [boothResult, eventResult].some((item) => item.status === "rejected");
      setMessage(failed ? "일부 실시간 정보는 기본 안내로 표시 중입니다." : "");
    });

    fetchAiFestivalGuide()
      .then((data) => {
        if (mounted) setAiGuide(data || null);
      })
      .catch(() => {
        if (mounted) setAiGuide(null);
      })
      .finally(() => {
        if (mounted) setAiGuideLoading(false);
      });

    const streams = [];
    try {
      const boothStream = createBoothStream();
      boothStream.addEventListener("booths", (event) => {
        try {
          const next = JSON.parse(event.data);
          if (Array.isArray(next)) setBooths(next);
        } catch {
          // Ignore malformed stream payloads.
        }
      });
      streams.push(boothStream);
    } catch {
      // Streaming is optional for the public home.
    }

    try {
      const eventStream = createEventStream();
      eventStream.addEventListener("events", (event) => {
        try {
          const next = JSON.parse(event.data);
          if (Array.isArray(next)) setEvents(next);
        } catch {
          // Ignore malformed stream payloads.
        }
      });
      streams.push(eventStream);
    } catch {
      // Streaming is optional for the public home.
    }

    return () => {
      mounted = false;
      streams.forEach((stream) => stream.close());
    };
  }, []);

  const boothSource = booths.length ? booths : fallbackBooths;
  const eventSource = normalizeEvents(events);

  const homeCards = useMemo(() => {
    const sortedBooths = [...boothSource].sort(
      (a, b) => (Number(a.estimatedWaitMinutes) || 0) - (Number(b.estimatedWaitMinutes) || 0),
    );
    const nextEvent = [...eventSource]
      .filter((event) => event.startTime)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];
    const firstBooth = sortedBooths[0];
    const reservable =
      boothSource.find(
        (booth) =>
          booth.id !== firstBooth?.id &&
          booth.reservationEnabled !== false &&
          Number(booth.reservationAvailableSeats) > 0,
      ) ||
      sortedBooths.find((booth) => booth.id !== firstBooth?.id) ||
      boothSource[0];

    return [
      {
        id: firstBooth?.id,
        type: "booth",
        tag: crowdLevel(Math.min(95, Number(firstBooth?.estimatedWaitMinutes || 0) * 5)),
        title: firstBooth?.name || "응급 케어 스팟",
        caption: firstBooth ? compactWaitLabel(firstBooth) : "대기 0분",
        image: firstBooth ? resolveBoothImageUrl(firstBooth) : FESTIVAL_IMAGE,
        imageFocus: "center",
      },
      {
        id: nextEvent?.id,
        type: "event",
        tag: "곧 시작",
        title: nextEvent?.title || "중앙무대 공연",
        caption: nextEvent?.startTime
          ? `${new Date(nextEvent.startTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 시작`
          : "18:30 시작",
        image: nextEvent?.imageUrl || EVENT_RECOMMEND_IMAGE,
        imageFocus: nextEvent?.imageFocus || "center",
      },
      {
        id: reservable?.id,
        type: "booth",
        tag: "예약 가능",
        title: reservable?.name || "푸드 박스 부스",
        caption: reservable ? reservationLabel(reservable) : "예약 가능 12명",
        image: reservable ? resolveBoothImageUrl(reservable) : "/images/booths/%EC%A3%BC%EC%A0%90%EC%82%AC%EC%A7%84.jpg",
        imageFocus: "center",
      },
    ];
  }, [boothSource, eventSource]);

  const crowdPercent = useMemo(() => {
    if (!traffic.length) return 55;
    const latest = Number(traffic[traffic.length - 1]?.count) || 0;
    const max = Math.max(1, ...traffic.map((item) => Number(item.count) || 0));
    return Math.min(99, Math.max(1, Math.round((latest / max) * 100)));
  }, [traffic]);
  const visibleAiGuide = aiGuide || DEFAULT_AI_GUIDE;

  async function handleAiAsk(question = aiQuestion) {
    const nextQuestion = question.trim();
    if (!nextQuestion || aiAskLoading) return;

    setAiAskLoading(true);
    setAiQuestion("");
    setAiAnswer({
      question: nextQuestion,
      answer: "AI가 축제 데이터를 확인하면서 답변을 만드는 중입니다.",
      evidence: [],
      pending: true,
    });
    try {
      const result = await askChat(nextQuestion);
      setAiAnswer({
        question: nextQuestion,
        answer: result.answer,
        evidence: Array.isArray(result.evidence) ? result.evidence : [],
        pending: false,
      });
    } catch (error) {
      setAiAnswer({
        question: nextQuestion,
        answer: error.message || "AI 답변을 불러오지 못했습니다.",
        evidence: [],
        pending: false,
      });
    } finally {
      setAiAskLoading(false);
    }
  }

  function evidencePath(item) {
    if (!item?.id) return null;
    if (item.type === "booth" || item.type === "ai_recommendation" || item.type === "ai_warning") {
      return `/booths/${item.id}`;
    }
    if (item.type === "event") return "/events";
    if (item.type === "lost_item") return "/lost-found";
    return null;
  }

  return (
    <section className="uni-page uni-home-page reference-home-page">
      <header
        className="home-hero-card"
        style={{
          backgroundImage:
            "radial-gradient(circle at 78% 42%, rgba(139, 92, 246, 0.25), transparent 5.8rem), radial-gradient(circle at 50% 62%, rgba(37, 87, 255, 0.14), transparent 6.2rem), linear-gradient(145deg, #ffffff 0%, #f4f0ff 58%, #eef8ff 100%)",
        }}
      >
        <div className="home-hero-top">
          <strong>바람</strong>
          <button type="button" aria-label="공지사항" onClick={() => navigate("/more")}>
            <IconAlert className="h-4 w-4" />
          </button>
        </div>
        <div className="home-hero-copy">
          <h1>오늘의 아주대 축제</h1>
          <span>지금 뭐 할지 바로 고르세요!</span>
          <small>공연, 부스, 지도, 혼잡도까지 한 번에 확인하세요.</small>
        </div>
        <div className="hero-action-grid">
          <button type="button" onClick={() => navigate("/events")}>
            <IconMusic className="h-5 w-5" />
            <span>공연 보기</span>
          </button>
          <button type="button" onClick={() => navigate("/stage-map")}>
            <IconSearch className="h-5 w-5" />
            <span>부스 찾기</span>
          </button>
          <button type="button" onClick={() => navigate("/stage-map")}>
            <IconMapPin className="h-5 w-5" />
            <span>지도 열기</span>
          </button>
        </div>
      </header>

      {message && <p className="app-inline-note">{message}</p>}

      <section className="uni-card ai-guide-card">
        <div className="uni-section-head">
          <h2>AI 축제 가이드</h2>
          <button type="button" onClick={() => navigate("/analytics")}>예측 보기</button>
        </div>
        <div className="ai-guide-card__hero">
          <strong>{compactText(visibleAiGuide.headline, 42)}</strong>
          <p>{compactText(visibleAiGuide.summary, 82)}</p>
          {aiGuideLoading && <span className="ai-guide-card__thinking">AI 가이드 생성 중</span>}
        </div>
        <div className="ai-guide-card__prompt-row">
          {AI_HOME_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="ai-guide-card__prompt"
              onClick={() => handleAiAsk(prompt)}
              disabled={aiAskLoading}
            >
              {prompt}
            </button>
          ))}
        </div>
        <form
          className="ai-guide-card__ask"
          onSubmit={(event) => {
            event.preventDefault();
            handleAiAsk();
          }}
        >
          <input
            value={aiQuestion}
            onChange={(event) => setAiQuestion(event.target.value)}
            placeholder="AI에게 축제 동선을 물어보세요"
            disabled={aiAskLoading}
          />
          <button type="submit" disabled={aiAskLoading || !aiQuestion.trim()}>
            {aiAskLoading ? "AI 생성 중" : "질문"}
          </button>
        </form>
        {aiAnswer && (
          <div className={`ai-guide-card__answer${aiAnswer.pending ? " ai-guide-card__answer--pending" : ""}`}>
            <small>{cleanBrokenText(aiAnswer.question, "질문")}</small>
            {aiAnswer.pending && <span className="ai-guide-card__thinking">AI 답변 생성 중</span>}
            <p>{compactText(aiAnswer.answer, 118)}</p>
            {aiAnswer.evidence.length > 0 && (
              <div className="ai-guide-card__evidence">
                {aiAnswer.evidence.slice(0, 2).map((item, index) => {
                  const path = evidencePath(item);
                  const label = cleanBrokenText(item.label || item.reason || "AI 근거");
                  if (!path) {
                    return <span key={`${item.type}-${item.id || index}`}>{label}</span>;
                  }
                  return (
                    <button
                      key={`${item.type}-${item.id || index}`}
                      type="button"
                      onClick={() => navigate(path)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="uni-section">
        <div className="uni-section-head">
          <h2>지금 추천</h2>
          <button type="button" onClick={() => navigate("/stage-map")}>더보기</button>
        </div>
        <div className="recommend-strip">
          {homeCards.slice(0, 3).map((item, index) => (
            <button
              key={`${item.type}-${item.id || item.title}`}
              type="button"
              className={`recommend-card recommend-card--${cardTone(index)}`}
              style={{
                "--recommend-image": `url("${item.image}")`,
                "--recommend-focus": item.imageFocus || "center",
              }}
              onClick={() => {
                if (item.type === "event") navigate("/events");
                else navigate(item.id ? `/booths/${item.id}` : "/stage-map");
              }}
            >
              <span>{item.tag}</span>
              <strong>{item.title}</strong>
              <small>{item.caption}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="uni-card crowd-summary-card" onClick={() => navigate("/analytics")}>
        <div className="uni-section-head">
          <h2>실시간 혼잡도</h2>
          <button type="button">더보기</button>
        </div>
        <div className="crowd-score-row">
          <div>
            <p>축제장 전체 혼잡도</p>
            <span>{crowdLevel(crowdPercent)}</span>
          </div>
          <strong>{crowdPercent}%</strong>
        </div>
        <div className="crowd-meter" aria-hidden="true">
          <span className="meter-green" />
          <span className="meter-yellow" />
          <span className="meter-red" />
        </div>
        <div className="crowd-scale">
          <span>0%</span>
          <span>100%</span>
        </div>
      </section>
    </section>
  );
}
