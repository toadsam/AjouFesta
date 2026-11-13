// 소개팅 부스 블라인드 채팅방. 두 사람이 부스에 앉고 스태프가 '채팅 시작'을 누르면 열리고, 10분 뒤 닫히면 각자 얼굴 보기를 고른다.
// 서버 상태를 1초마다 받아 온다(채팅 중). 시계는 서버 시각 기준으로 맞춘다.
// 전역 버튼 스타일(.app-shell button)에 안 눌리도록 body 에 포털로 띄우고 mchat-* 클래스만 쓴다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  chooseAiMatchChatReveal,
  enterAiMatchChat,
  fetchAiMatchChatState,
  reportAiMatchProfile,
  sendAiMatchChatMessage,
} from "../api";
import "../styles/saju-chat.css";

const MAX_LENGTH = 300;
const TOPICS_PER_PAGE = 4;
const POLL_MS = { WAITING: 2000, OPEN: 1000, CHOOSING: 1500, MATCH: 6000, NO_MATCH: 6000 };

function toMs(value) {
  if (!value) return 0;
  // LocalDateTime 은 소수 자리가 6자리까지 온다. 브라우저마다 다르게 읽지 않도록 밀리초까지만 쓴다.
  const time = new Date(`${value}`.slice(0, 23)).getTime();
  return Number.isFinite(time) ? time : 0;
}

function mmss(ms) {
  const left = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(left / 60)}:${`${left % 60}`.padStart(2, "0")}`;
}

function clock(value) {
  const date = new Date(toMs(value));
  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

export default function MeetupChat({ requestId, nickname, pin, onClose }) {
  const [meta, setMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [topics, setTopics] = useState([]);
  const [pending, setPending] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(true);
  const [topicPage, setTopicPage] = useState(0);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [reportState, setReportState] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const tokenRef = useRef("");
  const lastIdRef = useRef(0);
  const offsetRef = useRef(0);
  const phaseRef = useRef("");
  const listRef = useRef(null);
  const localIdRef = useRef(0);
  const collapsedOnceRef = useRef(false);

  const apply = useCallback((state) => {
    if (!state) return;
    offsetRef.current = toMs(state.serverNow) - Date.now();
    phaseRef.current = state.phase;
    setMeta(state);
    if (state.topics?.length) setTopics(state.topics);
    if (state.messages?.length) {
      lastIdRef.current = Math.max(lastIdRef.current, ...state.messages.map((message) => message.id));
      setMessages((prev) => {
        const seen = new Set(prev.map((message) => message.id));
        const fresh = state.messages.filter((message) => !seen.has(message.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    }
  }, []);

  const enter = useCallback(async () => {
    const result = await enterAiMatchChat(requestId, nickname, pin);
    tokenRef.current = result.token;
    lastIdRef.current = 0;
    setMessages([]);
    apply(result.state);
  }, [requestId, nickname, pin, apply]);

  // 입장 + 폴링. 토큰이 사라졌으면(서버 재시작) 다시 입장하고, 끊기면 2초 뒤 다시 시도한다.
  useEffect(() => {
    let stopped = false;
    let timer = null;
    async function tick() {
      let delay = 2000;
      try {
        if (!tokenRef.current) {
          await enter();
        } else {
          apply(await fetchAiMatchChatState(tokenRef.current, lastIdRef.current));
        }
        setOffline(false);
        setError("");
        // 끝난 방(CLOSED)은 더 받아 올 게 없으니 멈춘다.
        delay = phaseRef.current === "CLOSED" ? 0 : POLL_MS[phaseRef.current] ?? 2000;
      } catch (loadError) {
        if (loadError?.status === 401 && tokenRef.current) {
          tokenRef.current = "";
          delay = 300;
        } else if (loadError?.status && loadError.status < 500 && loadError.status !== 429) {
          setError(loadError.message || "채팅방에 들어가지 못했어요.");
          delay = 5000;
        } else {
          setOffline(true);
        }
      }
      if (stopped) return;
      if (delay > 0) timer = window.setTimeout(tick, delay);
    }
    tick();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [enter, apply]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  // 뒤 화면이 같이 스크롤되지 않게 잠근다.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const phase = meta?.phase || "";
  const serverNow = now + offsetRef.current;
  const chatLeft = meta?.endsAt ? toMs(meta.endsAt) - serverNow : 0;
  const chooseLeft = meta?.chooseUntil ? toMs(meta.chooseUntil) - serverNow : 0;
  // 서버가 단계를 넘겨 주기 전이라도 시계가 0이 되면 입력을 막는다.
  const canSend = phase === "OPEN" && chatLeft > 0;
  const textCount = messages.filter((message) => message.type === "TEXT").length;

  useEffect(() => {
    if (textCount >= 1 && !collapsedOnceRef.current) {
      collapsedOnceRef.current = true;
      setTopicsOpen(false);
    }
  }, [textCount]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length, phase]);

  const unusedTopics = useMemo(() => {
    const used = new Set(messages.filter((message) => message.type === "TOPIC").map((message) => message.content));
    return topics.filter((topic) => !used.has(topic.text));
  }, [topics, messages]);
  const pageCount = Math.max(1, Math.ceil(unusedTopics.length / TOPICS_PER_PAGE));
  const shownTopics = unusedTopics.slice((topicPage % pageCount) * TOPICS_PER_PAGE, (topicPage % pageCount) * TOPICS_PER_PAGE + TOPICS_PER_PAGE);

  async function deliver(item) {
    setPending((prev) => prev.map((entry) => (entry.localId === item.localId ? { ...entry, failed: false } : entry)));
    try {
      const saved = await sendAiMatchChatMessage(tokenRef.current, item.topicId ? { topicId: item.topicId } : { content: item.content });
      lastIdRef.current = Math.max(lastIdRef.current, saved.id);
      setMessages((prev) => (prev.some((message) => message.id === saved.id) ? prev : [...prev, saved]));
      setPending((prev) => prev.filter((entry) => entry.localId !== item.localId));
    } catch (sendError) {
      if (sendError?.status === 409 || sendError?.status === 400) {
        // 시간이 끝났거나 이미 나온 주제: 다시 보낼 수 없으니 지우고 이유만 알린다.
        setPending((prev) => prev.filter((entry) => entry.localId !== item.localId));
        setError(sendError.message || "보내지 못했어요.");
      } else {
        setPending((prev) => prev.map((entry) => (entry.localId === item.localId ? { ...entry, failed: true } : entry)));
      }
    }
  }

  function submit(event) {
    event?.preventDefault();
    const content = text.trim();
    if (!content || !canSend) return;
    const item = { localId: ++localIdRef.current, content, failed: false };
    setPending((prev) => [...prev, item]);
    setText("");
    deliver(item);
  }

  function sendTopic(topic) {
    if (!canSend) return;
    const item = { localId: ++localIdRef.current, content: topic.text, topicId: topic.id, failed: false };
    setPending((prev) => [...prev, item]);
    setTopicsOpen(false);
    deliver(item);
  }

  async function choose(reveal) {
    const question = reveal
      ? "얼굴 보기를 고를까요? 상대도 원할 때만 서로 얼굴을 봐요."
      : "여기까지 할까요? 한 번 고르면 바꿀 수 없어요.";
    if (!window.confirm(question)) return;
    setChoiceBusy(true);
    try {
      apply(await chooseAiMatchChatReveal(tokenRef.current, reveal));
      setError("");
    } catch (choiceError) {
      setError(choiceError.message || "선택을 보내지 못했어요.");
    } finally {
      setChoiceBusy(false);
    }
  }

  async function report() {
    if (!meta?.partnerProfileId || reportState === "sending") return;
    const detail = window.prompt("어떤 점이 불편했는지 적어 주세요. 운영진만 보고, 상대에게는 알려지지 않아요.");
    if (detail === null) return;
    setReportState("sending");
    try {
      await reportAiMatchProfile(meta.partnerProfileId, nickname, pin, "OFFENSIVE_MESSAGE", `[블라인드 채팅 · 신청 ${requestId}] ${detail}`.slice(0, 480));
      setReportState("done");
    } catch (reportError) {
      setReportState("");
      setError(reportError.message || "신고를 보내지 못했어요. 부스 스태프에게 바로 알려 주세요.");
    }
  }

  const timerLabel = phase === "OPEN" ? mmss(chatLeft) : phase === "CHOOSING" ? mmss(chooseLeft) : "";
  const showList = phase === "OPEN" || phase === "CHOOSING" || ((phase === "MATCH" || phase === "NO_MATCH" || phase === "CLOSED") && messages.length > 0);

  const node = (
    <div className="mchat" role="dialog" aria-modal="true" aria-label="블라인드 채팅">
      <div className="mchat__frame">
        <header className="mchat__head">
          <button type="button" className="mchat__close" onClick={onClose} aria-label="채팅방 닫기">
            ←
          </button>
          <div className="mchat__title">
            <strong>블라인드 채팅</strong>
            <small>{meta?.partnerNickname ? `${meta.partnerNickname} 님과` : "불러오는 중…"}</small>
          </div>
          {timerLabel ? (
            <span className={`mchat__timer${phase === "OPEN" && chatLeft <= 60_000 ? " is-soon" : ""}`} aria-label="남은 시간">
              {phase === "CHOOSING" ? "선택 " : ""}
              {timerLabel}
            </span>
          ) : null}
          {meta?.partnerProfileId ? (
            <button type="button" className="mchat__report" onClick={report} disabled={reportState !== ""}>
              {reportState === "done" ? "신고 접수됨" : "신고"}
            </button>
          ) : null}
        </header>

        {offline ? <p className="mchat__banner mchat__banner--warn">연결이 끊겼어요. 다시 연결하는 중…</p> : null}
        {error ? <p className="mchat__banner mchat__banner--error">{error}</p> : null}
        {phase === "OPEN" && chatLeft <= 60_000 && chatLeft > 0 ? (
          <p className="mchat__banner mchat__banner--soon">1분 남았어요. 하고 싶은 말을 마무리해 주세요.</p>
        ) : null}

        {!meta && !error ? <div className="mchat__center"><p>채팅방에 들어가는 중…</p></div> : null}

        {phase === "WAITING" ? (
          <div className="mchat__center">
            <span className="mchat__moon" aria-hidden="true">🌙</span>
            <strong>곧 채팅이 시작돼요</strong>
            <p>두 사람이 자리에 앉으면 스태프가 채팅을 시작해요. 이 화면을 켜 둔 채 잠시만 기다려 주세요.</p>
            <ul>
              <li>얼굴을 보기 전에 <b>10분</b> 동안 글로 이야기해요.</li>
              <li>끝나면 각자 <b>얼굴 보기</b>를 골라요. 둘 다 원할 때만 얼굴을 봐요.</li>
              <li>불편한 일이 생기면 위의 <b>신고</b>를 누르거나 스태프를 불러 주세요.</li>
            </ul>
          </div>
        ) : null}

        {showList ? (
          <div className="mchat__list" ref={listRef} aria-live="polite">
            <p className="mchat__notice">
              얼굴을 보기 전 10분 대화예요. 연락처나 SNS는 얼굴을 본 뒤에 나눠 주세요. 신고가 들어오면 운영진이 대화를 확인할 수 있고, 대화는 축제가 끝나면 지워져요.
            </p>
            {messages.map((message) =>
              message.type === "TOPIC" ? (
                <div key={message.id} className="mchat__topic-card">
                  <small>💬 {message.mine ? "내가 고른 주제" : "상대가 고른 주제"}</small>
                  <b>{message.content}</b>
                </div>
              ) : (
                <div key={message.id} className={`mchat__row${message.mine ? " is-mine" : ""}`}>
                  <p className="mchat__bubble">{message.content}</p>
                  <time>{clock(message.createdAt)}</time>
                </div>
              ),
            )}
            {pending.map((item) => (
              <div key={`p${item.localId}`} className="mchat__row is-mine is-pending">
                <p className="mchat__bubble">{item.content}</p>
                {item.failed ? (
                  <button type="button" className="mchat__retry" onClick={() => deliver(item)}>
                    다시 보내기
                  </button>
                ) : (
                  <time>보내는 중</time>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {phase === "OPEN" ? (
          <div className="mchat__bottom">
            {unusedTopics.length ? (
              <div className={`mchat__topics${topicsOpen ? " is-open" : ""}`}>
                <div className="mchat__topics-head">
                  <button type="button" className="mchat__topics-toggle" onClick={() => setTopicsOpen((open) => !open)} aria-expanded={topicsOpen}>
                    💡 대화 주제 {topicsOpen ? "접기" : "보기"}
                  </button>
                  {topicsOpen && pageCount > 1 ? (
                    <button type="button" className="mchat__topics-more" onClick={() => setTopicPage((page) => page + 1)}>
                      다른 주제
                    </button>
                  ) : null}
                </div>
                {topicsOpen ? (
                  <div className="mchat__chips">
                    {shownTopics.map((topic) => (
                      <button key={topic.id} type="button" className="mchat__chip" disabled={!canSend} onClick={() => sendTopic(topic)}>
                        {topic.text}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <form className="mchat__composer" onSubmit={submit}>
              <input
                type="text"
                value={text}
                maxLength={MAX_LENGTH}
                onChange={(event) => setText(event.target.value)}
                placeholder={canSend ? "메시지를 입력하세요" : "채팅 시간이 끝났어요"}
                disabled={!canSend}
                aria-label="메시지"
                autoComplete="off"
                enterKeyHint="send"
              />
              <button type="submit" disabled={!canSend || !text.trim()}>
                보내기
              </button>
            </form>
          </div>
        ) : null}

        {phase === "CHOOSING" ? (
          <div className="mchat__panel">
            {meta.myChoice == null ? (
              <>
                <strong>채팅이 끝났어요. 얼굴을 보고 싶나요?</strong>
                <p>둘 다 ‘얼굴 보기’를 골라야만 서로 얼굴을 봐요. 누가 무엇을 골랐는지는 알려 주지 않아요.</p>
                <div className="mchat__choices">
                  <button type="button" className="mchat__yes" disabled={choiceBusy} onClick={() => choose(true)}>
                    얼굴 보기
                  </button>
                  <button type="button" className="mchat__no" disabled={choiceBusy} onClick={() => choose(false)}>
                    여기까지 할게요
                  </button>
                </div>
                <small>{mmss(chooseLeft)} 안에 고르지 않으면 ‘여기까지’로 처리돼요.</small>
              </>
            ) : (
              <>
                <strong>선택을 보냈어요</strong>
                <p>상대의 선택을 기다리고 있어요. 잠시만요.</p>
              </>
            )}
          </div>
        ) : null}

        {phase === "MATCH" ? (
          <div className="mchat__panel mchat__panel--match">
            <span aria-hidden="true">🎉</span>
            <strong>서로 얼굴을 보기로 했어요</strong>
            <p>스태프가 가림막을 걷어 드릴 거예요. 즐거운 시간 보내세요!</p>
            <button type="button" className="mchat__done" onClick={onClose}>닫기</button>
          </div>
        ) : null}

        {phase === "NO_MATCH" ? (
          <div className="mchat__panel">
            <strong>이번 만남은 여기까지예요</strong>
            <p>이야기 나눠 주셔서 고마워요. 스태프 안내에 따라 한 분씩 나가 주세요.</p>
            <button type="button" className="mchat__done" onClick={onClose}>닫기</button>
          </div>
        ) : null}

        {phase === "CLOSED" ? (
          <div className="mchat__panel">
            <strong>채팅이 끝났어요</strong>
            <p>스태프 안내를 따라 주세요.</p>
            <button type="button" className="mchat__done" onClick={onClose}>닫기</button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
