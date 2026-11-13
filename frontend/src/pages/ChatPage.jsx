import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { askChat } from "../api";
import { IconBox, IconChart, IconChat, IconMapPin, IconMusic, IconSend, IconUsers } from "../components/UxIcons";

const quickPrompts = [
  { label: "지금 공연 뭐 있어?", icon: IconMusic },
  { label: "사람 적은 부스 추천해줘", icon: IconUsers },
  { label: "푸드트럭 어디 있어?", icon: IconBox },
  { label: "화장실 어디야?", icon: IconMapPin },
];

const assistantPanels = [
  { title: "공연", description: "시간, 무대, 라인업", icon: IconMusic, accent: "blue", prompt: "지금 공연 뭐 있어?" },
  { title: "부스", description: "위치, 추천, 후기", icon: IconBox, accent: "mint", prompt: "사람 적은 부스 추천해줘" },
  { title: "혼잡도", description: "시간대별, 구역별", icon: IconUsers, accent: "violet", prompt: "지금 가장 덜 붐비는 곳은 어디야?" },
  {
    title: "편의시설",
    description: "화장실, 분실물, 안내",
    icon: IconMapPin,
    accent: "amber",
    prompt: "화장실이랑 분실물 보관소 위치 알려줘",
  },
];

const botFallback =
  "지금은 응답을 불러오지 못했어요. 공연 시간이나 부스 위치처럼 궁금한 내용을 다시 질문해보세요.";
const DEFAULT_VISIBLE_EVIDENCE = 2;

const confidenceLabels = {
  HIGH: "근거 높음",
  MEDIUM: "근거 보통",
  LOW: "근거 낮음",
};

const evidenceTypeMeta = {
  ai_recommendation: { label: "AI 추천", icon: IconChart },
  ai_warning: { label: "AI 주의", icon: IconUsers },
  booth: { label: "부스", icon: IconBox },
  event: { label: "공연", icon: IconMusic },
  lost_item: { label: "분실물", icon: IconMapPin },
  notice: { label: "공지", icon: IconChat },
  knowledge: { label: "안내", icon: IconChart },
};

function formatMessageTime(date = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatEvidenceUpdatedAt(updatedAt) {
  if (!updatedAt) return "";

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(updatedAt));
  } catch {
    return "";
  }
}

function createMessage(role, text, meta = {}) {
  return {
    role,
    text,
    time: formatMessageTime(),
    confidence: meta.confidence || null,
    evidence: Array.isArray(meta.evidence) ? meta.evidence : [],
    warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
  };
}

function summarizeWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) return [];

  const staleWarnings = warnings.filter((warning) => warning.includes("운영 상태는 15분 이상 지난 정보일 수 있습니다."));
  const otherWarnings = warnings.filter((warning) => !warning.includes("운영 상태는 15분 이상 지난 정보일 수 있습니다."));
  const summary = [];

  if (staleWarnings.length > 0) {
    summary.push(`실시간 운영 상태 갱신이 늦은 부스가 ${staleWarnings.length}곳 있어요.`);
  }

  if (otherWarnings.length > 0) {
    summary.push(otherWarnings[0]);
  }

  if (otherWarnings.length > 1) {
    summary.push(`추가 안내 ${otherWarnings.length - 1}건이 더 있어요.`);
  }

  return summary;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const [messages, setMessages] = useState([
    createMessage("bot", "안녕하세요! 바람 AI 챗봇이에요. 축제에 대해 궁금한 점을 편하게 물어보세요."),
  ]);
  const threadRef = useRef(null);

  useEffect(() => {
    const container = threadRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function submit(text) {
    const question = text.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, createMessage("user", question)]);
    setInput("");
    setLoading(true);

    try {
      const result = await askChat(question);
      setMessages((prev) => [
        ...prev,
        createMessage("bot", result.answer || botFallback, {
          confidence: result.confidence,
          evidence: result.evidence,
          warnings: result.warnings,
        }),
      ]);
    } catch {
      setMessages((prev) => [...prev, createMessage("bot", botFallback)]);
    } finally {
      setLoading(false);
    }
  }

  function getEvidenceAction(item) {
    if (!item?.id) return null;

    switch (item.type) {
      case "booth":
      case "ai_recommendation":
      case "ai_warning":
        return { label: "부스 보기", onClick: () => navigate(`/booths/${item.id}`) };
      case "event":
        return { label: "공연 보기", onClick: () => navigate("/events") };
      case "lost_item":
        return { label: "분실물 보기", onClick: () => navigate("/lost-found") };
      default:
        return null;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submit(input);
  }

  return (
    <section className="uni-page festival-chat-page chat-reference-page">
      <header className="chat-hero">
        <div className="chat-hero__title">
          <strong>AI 챗봇</strong>
          <p>바람 AI가 축제 정보를 도와드려요</p>
        </div>

        <div className="chat-intro-card">
          <span className="chat-intro-card__avatar" aria-hidden="true">
            <IconChat className="h-6 w-6" />
          </span>
          <div className="chat-intro-card__bubble">
            <h1>안녕하세요! 바람 AI 챗봇이에요.</h1>
            <p>축제에 대한 궁금한 점을 물어보세요.</p>
          </div>
        </div>
      </header>

      <section className="chat-prompt-card" aria-label="빠른 질문">
        <div className="chat-prompt-row">
          {quickPrompts.map(({ label, icon: Icon }) => (
            <button key={label} type="button" onClick={() => submit(label)} disabled={loading}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="chat-prompt-card__bar" aria-hidden="true" />
      </section>

      <article className="chat-thread-card">
        <div className="chat-thread" ref={threadRef}>
          {messages.map((message, index) => {
            const messageKey = `${message.role}-${index}`;
            const warningSummary = summarizeWarnings(message.warnings);
            const hasExtraEvidence = message.evidence.length > DEFAULT_VISIBLE_EVIDENCE;
            const showAllEvidence = Boolean(expandedEvidence[messageKey]);
            const visibleEvidence = showAllEvidence ? message.evidence : message.evidence.slice(0, DEFAULT_VISIBLE_EVIDENCE);

            return (
              <div
                key={messageKey}
                className={message.role === "user" ? "chat-message chat-message--user" : "chat-message"}
              >
              {message.role === "bot" && (
                <span className="chat-avatar" aria-hidden="true">
                  <IconChat className="h-4 w-4" />
                </span>
              )}

              <div className="chat-message__content">
                <p>{message.text}</p>
                <span>{message.time}</span>

                {message.role === "bot" && (
                  <div className="chat-message__insights">
                    {message.confidence && (
                      <span className={`chat-confidence chat-confidence--${message.confidence.toLowerCase()}`}>
                        {confidenceLabels[message.confidence] || message.confidence}
                      </span>
                    )}

                    {warningSummary.length > 0 && (
                      <ul className="chat-warning-list" aria-label="답변 주의사항">
                        {warningSummary.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}

                    {visibleEvidence.length > 0 && (
                      <div className="chat-evidence-list" aria-label="답변 근거">
                        {visibleEvidence.map((item, evidenceIndex) => {
                          const meta = evidenceTypeMeta[item.type] || evidenceTypeMeta.knowledge;
                          const Icon = meta.icon;
                          const action = getEvidenceAction(item);
                          const updatedAt = formatEvidenceUpdatedAt(item.updatedAt);
                          const cardContent = (
                            <>
                              <div className="chat-evidence-card__head">
                                <span className="chat-evidence-card__type">
                                  <Icon className="h-3.5 w-3.5" />
                                  <strong>{meta.label}</strong>
                                </span>
                                {updatedAt ? <small>{updatedAt}</small> : null}
                              </div>
                              <b>{item.label}</b>
                              <p>{item.reason}</p>
                              {action ? <em>{action.label}</em> : null}
                            </>
                          );

                          if (action) {
                            return (
                              <button
                                key={`${item.type}-${item.id || evidenceIndex}`}
                                type="button"
                                className="chat-evidence-card chat-evidence-card--interactive"
                                onClick={action.onClick}
                              >
                                {cardContent}
                              </button>
                            );
                          }

                          return (
                            <div key={`${item.type}-${item.id || evidenceIndex}`} className="chat-evidence-card">
                              {cardContent}
                            </div>
                          );
                        })}

                        {hasExtraEvidence && (
                          <button
                            type="button"
                            className="chat-evidence-toggle"
                            onClick={() =>
                              setExpandedEvidence((prev) => ({
                                ...prev,
                                [messageKey]: !prev[messageKey],
                              }))
                            }
                          >
                            {showAllEvidence
                              ? "근거 접기"
                              : `근거 ${message.evidence.length - DEFAULT_VISIBLE_EVIDENCE}개 더 보기`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
            );
          })}

          {loading && (
            <div className="chat-message">
              <span className="chat-avatar" aria-hidden="true">
                <IconChat className="h-4 w-4" />
              </span>
              <div className="chat-message__content chat-message__content--loading">
                <p>축제 정보를 확인하고 있어요...</p>
                <span>{formatMessageTime()}</span>
              </div>
            </div>
          )}
        </div>
      </article>

      <section className="chat-assistant-panel" aria-label="도움말 카테고리">
        <header>
          <h2>바람 AI가 도와드릴 수 있어요</h2>
          <button type="button" onClick={() => submit("지금 가장 많이 묻는 질문 알려줘")} disabled={loading}>
            <IconChart className="h-4 w-4" />
            <span>추천 질문</span>
          </button>
        </header>

        <div className="chat-assistant-grid">
          {assistantPanels.map(({ title, description, icon: Icon, accent, prompt }) => (
            <button
              key={title}
              type="button"
              className={`chat-assistant-tile chat-assistant-tile--${accent}`}
              onClick={() => submit(prompt)}
              disabled={loading}
            >
              <span className="chat-assistant-tile__icon" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <strong>{title}</strong>
              <small>{description}</small>
            </button>
          ))}
        </div>
      </section>

      <form className="chat-input-shell" onSubmit={handleSubmit}>
        <div className="chat-input-bar">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="메시지를 입력하세요..."
            aria-label="챗봇 질문 입력"
          />
          <button type="submit" disabled={loading || !input.trim()} aria-label="전송">
            <IconSend className="h-5 w-5" />
          </button>
        </div>
      </form>
    </section>
  );
}
