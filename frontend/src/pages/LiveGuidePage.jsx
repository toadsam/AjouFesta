// 눌러 보는 운영 매뉴얼 (/guide/live).
// 손님 · 참가자 화면과 스태프 화면을 진짜 그대로 나란히 띄우고, 한쪽에서 누르면 다른 쪽이 어떻게 바뀌는지 바로 보여 준다.
// 화면은 iframe 속의 실제 페이지이고, 서버만 연습용(demo/demoServer.js)으로 바꿔 끼웠다. 실제 주문 · 실제 서버와는 이어져 있지 않다.
// 흐름(주점 주문 · 포장 주문 · 자리와 대기 안내 · 사주 소개팅 · 총괄 공지와 공연 시간 · 분실물)마다 화면 구성과 순서는 demo/*Scenario.js 에 있다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDemoServer } from "../demo/demoServer";
import { aimatchContactScenario } from "../demo/aimatchContactScenario";
import { aimatchScenario } from "../demo/aimatchScenario";
import { festScenario } from "../demo/festScenario";
import { lostScenario } from "../demo/lostScenario";
import { pubScenario } from "../demo/pubScenario";
import { seatScenario } from "../demo/seatScenario";
import { takeoutScenario } from "../demo/takeoutScenario";
import "../styles/live-guide.css";

const SCENARIOS = [pubScenario, takeoutScenario, seatScenario, aimatchScenario, aimatchContactScenario, festScenario, lostScenario];
const ALL_FRAMES = SCENARIOS.flatMap((scenario) => scenario.frames);
const FRAME_BY_ID = Object.fromEntries(ALL_FRAMES.map((frame) => [frame.id, frame]));

function scenarioFromUrl() {
  const wanted = new URLSearchParams(window.location.search).get("flow");
  return SCENARIOS.find((scenario) => scenario.id === wanted) || SCENARIOS[0];
}

/* ---------- 연습용 서버(페이지에 하나) ---------- */
let hostSingleton = null;
function getHost() {
  if (hostSingleton) return hostSingleton;
  const storages = new Map();
  hostSingleton = {
    server: createDemoServer(),
    rules: Object.fromEntries(ALL_FRAMES.map((frame) => [frame.id, { home: frame.home, allow: frame.allow }])),
    // 화면마다 따로 쓰는 임시 저장소. 운영 키 · 로그인 같은 처음 값은 흐름 파일이 정한다.
    storageFor(role) {
      if (!storages.has(role)) {
        const frame = FRAME_BY_ID[role] || {};
        storages.set(role, { local: new Map(frame.local || []), session: new Map(frame.session || []) });
      }
      return storages.get(role);
    },
    onBlocked: null,
    // 흐름을 (다시) 시작한다. 흐름이 정한 시각이 있으면 연습용 시계를 거기에 맞춘다.
    reset(scenario) {
      storages.clear();
      this.server.reset({ clockStart: scenario?.clockStart });
    },
  };
  // iframe 속 화면(demo/demoFrame.js)이 이 값을 보고 연습 화면으로 켜진다.
  window.__ffDemoHost = hostSingleton;
  return hostSingleton;
}

/* ---------- iframe 속에서 '지금 누를 곳' 표시 ---------- */
const RING_ID = "ffdemo-ring";
const FLASH_ID = "ffdemo-flash";
// 진짜 화면의 버튼은 건드리지 않는다. 버튼 자리에 맞춰 테두리만 따로 얹는다.
const RING_STYLE = `
#${RING_ID} {
  position: fixed;
  z-index: 2147483000;
  display: none;
  pointer-events: none;
  border: 3px solid #ff6a3d;
  box-shadow: 0 0 0 0 rgba(255, 106, 61, 0.55);
  animation: ffdemo-ring 1.2s ease-in-out infinite;
}
@keyframes ffdemo-ring {
  50% { box-shadow: 0 0 0 11px rgba(255, 106, 61, 0); }
}
#${FLASH_ID} {
  position: fixed;
  z-index: 2147482999;
  display: none;
  pointer-events: none;
  border-radius: 14px;
  background: rgba(255, 196, 61, 0.2);
  box-shadow: 0 0 0 3px rgba(255, 170, 30, 0.9);
  transition: opacity 0.5s ease;
}`;

function ensureOverlay(doc, id) {
  let box = doc.getElementById(id);
  if (box) return box;
  if (!doc.getElementById(`${RING_ID}-style`)) {
    const style = doc.createElement("style");
    style.id = `${RING_ID}-style`;
    style.textContent = RING_STYLE;
    doc.head.appendChild(style);
  }
  box = doc.createElement("div");
  box.id = id;
  box.setAttribute("aria-hidden", "true");
  doc.body.appendChild(box);
  return box;
}

const ensureRing = (doc) => ensureOverlay(doc, RING_ID);

// 다른 화면에서 누른 결과로 바뀐 자리: 그 자리로 내려가서 잠깐 노랗게 표시한다(진짜 화면의 요소는 건드리지 않는다).
// scroll=false: 그 화면에 지금 누를 곳이 있을 때. 화면을 끌고 가지 않고 보이는 자리에서만 표시한다.
function flashChange(doc, element, scroll = true) {
  if (!doc.defaultView) return;
  if (scroll) scrollToTarget(doc, element, null);
  const box = ensureOverlay(doc, FLASH_ID);
  const until = `${performance.now() + 3400}`;
  box.dataset.until = until; // 새 표시가 오면 앞의 것은 그만둔다.
  const tick = () => {
    if (box.dataset.until !== until) return;
    const left = Number(until) - performance.now();
    const rect = element.isConnected ? element.getBoundingClientRect() : null;
    if (left <= 0 || !rect || !rect.height) {
      box.style.display = "none";
      return;
    }
    box.style.display = "block";
    box.style.opacity = left < 600 ? "0" : "1";
    box.style.left = `${rect.left - 4}px`;
    box.style.top = `${rect.top - 4}px`;
    box.style.width = `${rect.width + 8}px`;
    box.style.height = `${rect.height + 8}px`;
    window.requestAnimationFrame(tick);
  };
  tick();
}

function scrollToTarget(doc, element, anchorSelector) {
  const view = doc.defaultView;
  if (!view) return;
  // 옆으로 넘기는 줄(폰 폭 관리자 화면의 메뉴 줄) 안에 있으면 그 줄을 옆으로 민다.
  for (let node = element.parentElement; node && node !== doc.body; node = node.parentElement) {
    if (node.scrollWidth <= node.clientWidth + 4 || !["auto", "scroll"].includes(view.getComputedStyle(node).overflowX)) continue;
    const rail = node.getBoundingClientRect();
    const item = element.getBoundingClientRect();
    if (item.left < rail.left + 8 || item.right > rail.right - 8) {
      node.scrollTo({ left: node.scrollLeft + item.left - rail.left - (rail.width - item.width) / 2, behavior: "smooth" });
    }
    break;
  }
  // 세로로 구르는 칸들(안쪽 → 바깥). 보통은 페이지 전체가 구르지만, 안쪽 칸이 따로 구르는 화면(노트북 폭의 총괄 화면)도 있다.
  // 옆으로만 넘기는 줄은 세로로 몇 px 남는 것뿐이라 뺀다.
  const scrollers = [];
  for (let node = element.parentElement; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
    if (node.scrollHeight - node.clientHeight > 40 && ["auto", "scroll"].includes(view.getComputedStyle(node).overflowY)) scrollers.push(node);
  }
  const pageScrolls = doc.documentElement.scrollHeight - view.innerHeight > 4;
  if (pageScrolls || !scrollers.length) scrollers.push(null); // null = 페이지 전체
  const anchor = anchorSelector ? element.closest(anchorSelector) : null;
  let shift = 0; // 안쪽 칸을 굴린 만큼 요소는 위로 올라간다.
  scrollers.forEach((scroller, index) => {
    const top = scroller ? scroller.getBoundingClientRect().top : 0;
    const height = scroller ? scroller.clientHeight : view.innerHeight;
    const position = scroller ? scroller.scrollTop : view.scrollY;
    const limit = (scroller ? scroller.scrollHeight : doc.documentElement.scrollHeight) - height;
    // iframe 안에서만 움직인다(scrollIntoView 는 바깥 페이지까지 끌고 간다).
    const move = (delta) => {
      const next = Math.min(Math.max(0, limit), Math.max(0, position + delta));
      (scroller || view).scrollTo({ top: next, behavior: "smooth" });
      shift += next - position;
    };
    const own = element.getBoundingClientRect();
    const ownTop = own.top - shift;
    const ownBottom = own.bottom - shift;
    if (index < scrollers.length - 1) {
      if (ownTop < top + 8 || ownBottom > top + height - 8) move(ownTop - top - height * 0.38);
      return;
    }
    const bottomLimit = top + height - 72;
    // 카드 안의 버튼이면 카드가 통째로 보이게 맞춘다(위쪽 붙박이 머리글에 가리지 않게). 카드가 화면보다 길면 버튼만 맞춘다.
    const box = anchor?.getBoundingClientRect();
    if (box && box.height <= bottomLimit - top - 132) {
      if (box.top - shift >= top + 132 && box.bottom - shift <= bottomLimit) return;
      move(box.top - shift - top - 144);
      return;
    }
    if (ownTop >= top + 96 && ownBottom <= bottomLimit) return;
    move(ownTop - top - height * 0.38);
  });
}

function useWide() {
  const query = "(min-width: 1080px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return wide;
}

const toneOf = (frame) => (frame?.staff ? "staff" : "guest");
// "손님 첫 화면" 처럼 이름이 '화면'으로 끝나면 '화면 화면 보기'가 되지 않게 한다.
const viewLabel = (frame) => `${frame.label.replace(/\s*화면$/, "")} 화면 보기 →`;

/* ---------- 화면 한 개 ---------- */
function Phone({ frame, generation, wide, hidden, changed, isNext, frameRef }) {
  const screenRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: 700 });
  // 그리는 폭: 보통은 폰(390). 노트북으로 쓰는 화면은 흐름 파일이 폭을 정한다.
  const drawWidth = frame.width || 390;

  // 넓은 화면에서는 그 폭으로 그린 화면을 칸에 맞게 줄여 보여 준다.
  useEffect(() => {
    if (!wide || !screenRef.current || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const scale = Math.min(1, entry.contentRect.width / drawWidth);
      setFit({ scale, height: Math.round(entry.contentRect.height / scale) });
    });
    observer.observe(screenRef.current);
    return () => observer.disconnect();
  }, [wide, drawWidth]);

  return (
    <section
      className={`lg-phone${frame.width ? " lg-phone--desk" : ""}${hidden ? " lg-phone--hidden" : ""}${changed ? " lg-phone--changed" : ""}${isNext ? " lg-phone--next" : ""}`}
      aria-hidden={hidden ? "true" : undefined}
    >
      <header className="lg-phone__head">
        <span className={`lg-who lg-who--${toneOf(frame)}`}>{frame.who}</span>
        <div>
          <strong>{frame.label}</strong>
          <small>{frame.sub}</small>
        </div>
        {changed ? <em className="lg-phone__flag">방금 바뀜</em> : isNext ? <em className="lg-phone__flag lg-phone__flag--next">여기를 눌러요</em> : null}
      </header>
      <div className="lg-phone__screen" ref={screenRef}>
        <iframe
          key={generation}
          ref={frameRef}
          name={`ffdemo:${frame.id}`}
          title={`${frame.who} · ${frame.label}`}
          src={frame.home}
          style={wide ? { width: drawWidth, transform: `scale(${fit.scale})`, height: fit.height } : undefined}
        />
      </div>
    </section>
  );
}

/* ---------- 페이지 ---------- */
export default function LiveGuidePage() {
  // 처음 여는 흐름에 맞춰 연습용 서버를 준비한다(화면들이 뜨기 전에 시계부터 맞춘다).
  const host = useMemo(() => {
    const next = getHost();
    next.reset(scenarioFromUrl());
    return next;
  }, []);
  const wide = useWide();
  const [scenario, setScenario] = useState(scenarioFromUrl);
  const [generation, setGeneration] = useState(0);
  const [snap, setSnap] = useState(() => host.server.snapshot());
  const [log, setLog] = useState([]);
  const [changed, setChanged] = useState({});
  const [tab, setTab] = useState(() => scenarioFromUrl().frames[0].id);
  const [notice, setNotice] = useState("");
  const [closedResult, setClosedResult] = useState(0);
  const frameRefs = useRef({});
  const logId = useRef(0);
  // 방금 일로 바뀐 자리를 찾는 함수(화면별). 폰에서는 그 화면을 열 때 한 번 더 표시한다.
  const pendingShow = useRef({});
  // 다음에 누를 곳이 있는 화면. 그 화면은 누를 곳으로 내려가야 하니 '바뀐 자리'로 끌고 가지 않는다.
  const nextFrameRef = useRef(null);
  const showChange = useCallback((frameId) => {
    const find = pendingShow.current[frameId];
    if (!find) return;
    try {
      const doc = frameRefs.current[frameId]?.contentDocument;
      const element = doc?.body ? find(doc) : null;
      if (element) flashChange(doc, element, nextFrameRef.current !== frameId);
    } catch {
      // 닫힌 화면
    }
  }, []);
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  // 흐름 버튼 줄이 화면보다 길면(폰) 고른 버튼이 보이게 그 줄만 옆으로 민다.
  const flowsRef = useRef(null);
  useEffect(() => {
    const rail = flowsRef.current;
    const on = rail?.querySelector(".lg-flow.is-on");
    if (!rail || !on || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollTo({ left: on.offsetLeft - (rail.clientWidth - on.offsetWidth) / 2, behavior: "smooth" });
  }, [scenario, wide]);

  useEffect(() => {
    document.title = "눌러 보는 운영 매뉴얼 · 바람";
    document.documentElement.classList.add("lg-root");
    return () => document.documentElement.classList.remove("lg-root");
  }, []);

  // 연습용 서버에서 일어난 일을 듣는다.
  useEffect(() => {
    const timers = new Set();
    const later = (fn, ms) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
    };
    const off = host.server.listen((event) => {
      setSnap(host.server.snapshot());
      // 실제 화면은 다시 볼 때(focus) 바로 새로 읽는다. 연습에서도 그 신호를 줘서 다른 화면이 곧바로 따라오게 한다.
      later(() => {
        Object.values(frameRefs.current).forEach((node) => {
          try {
            node?.contentWindow?.dispatchEvent(new Event("focus"));
          } catch {
            // 닫힌 화면
          }
        });
      }, 250);
      const entry = scenarioRef.current.describe(event);
      if (!entry) return;
      pendingShow.current = {};
      entry.effects.forEach((effect) => {
        if (!effect.show) return;
        pendingShow.current[effect.frame] = effect.show;
        later(() => showChange(effect.frame), effect.showDelay ?? 900);
      });
      logId.current += 1;
      const stampId = logId.current;
      setLog((current) => [{ id: stampId, ...entry }, ...current].slice(0, 6));
      // quiet: 그 화면에서 눈에 보이게 바뀌는 것이 없는 설명. '방금 바뀜' 표시는 붙이지 않는다.
      const touched = entry.effects.filter((effect) => !effect.quiet && effect.frame !== entry.from).map((effect) => effect.frame);
      setChanged(Object.fromEntries(touched.map((id) => [id, stampId])));
      later(() => setChanged((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value !== stampId))), 6000);
    });
    host.onBlocked = () => {
      setNotice("연습 화면에서는 이 흐름에 쓰는 화면만 열려요.");
      later(() => setNotice(""), 3000);
    };
    return () => {
      off();
      host.onBlocked = null;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [host, showChange]);

  // 시간이 흘러야 끝나는 단계(임시 잠금이 풀림 · 채팅 시간 끝)가 있어서, 조용히 한 번씩 상태를 다시 읽는다.
  useEffect(() => {
    const timer = window.setInterval(() => setSnap(host.server.snapshot()), 2000);
    return () => window.clearInterval(timer);
  }, [host]);

  const { done, context, titles = {} } = useMemo(() => scenario.progress(snap), [scenario, snap]);
  const steps = scenario.steps;
  const currentIndex = steps.findIndex((step) => !done[step.key]);
  const current = currentIndex >= 0 ? steps[currentIndex] : null;
  const currentKey = current?.key || "";
  const currentFrame = current?.frame ? FRAME_BY_ID[current.frame] : null;
  const contextRef = useRef(context);
  contextRef.current = context;
  nextFrameRef.current = current?.frame || null;

  // 지금 누를 곳: iframe 속 진짜 버튼을 찾아(0.35초마다) 그 위에 테두리를 맞춰 얹는다(매 프레임).
  useEffect(() => {
    const step = scenario.steps.find((item) => item.key === currentKey) || null;
    const targets = {};
    // 누를 곳마다 처음 본 때와 마지막으로 화면을 맞춘 때.
    const seen = new WeakMap();
    const docOf = (frame) => {
      try {
        const doc = frameRefs.current[frame.id]?.contentDocument;
        return doc?.body ? doc : null;
      } catch {
        return null;
      }
    };
    const find = () => {
      scenario.frames.forEach((frame) => {
        const doc = docOf(frame);
        let target = null;
        if (doc && step && step.frame === frame.id) {
          try {
            target = scenario.findTarget(step.key, doc, contextRef.current);
          } catch {
            target = null;
          }
        }
        targets[frame.id] = target;
        if (!target) return;
        const now = performance.now();
        const mark = seen.get(target);
        if (!mark) {
          seen.set(target, { first: now, last: now });
          scrollToTarget(doc, target, scenario.scrollAnchor);
          return;
        }
        // 맞춘 직후에 목록이 다시 그려져(새 줄이 끼어들어) 누를 곳이 화면 밖으로 밀리면 한 번 더 맞춘다.
        // 처음 2.5초 동안만 한다. 그 뒤에는 사용자가 다른 곳을 둘러봐도 끌고 오지 않는다.
        if (now - mark.first > 2500 || now - mark.last < 700) return;
        const rect = target.getBoundingClientRect();
        const height = doc.defaultView?.innerHeight || 0;
        if (rect.bottom < 8 || rect.top > height - 8) {
          mark.last = now;
          scrollToTarget(doc, target, scenario.scrollAnchor);
        }
      });
    };
    let raf = 0;
    const place = () => {
      scenario.frames.forEach((frame) => {
        const doc = docOf(frame);
        if (!doc) return;
        const ring = ensureRing(doc);
        const target = targets[frame.id];
        const rect = target?.isConnected ? target.getBoundingClientRect() : null;
        if (!rect || !rect.width || !rect.height) {
          ring.style.display = "none";
          return;
        }
        const radius = parseFloat(doc.defaultView.getComputedStyle(target).borderTopLeftRadius) || 10;
        ring.style.display = "block";
        ring.style.left = `${rect.left - 5}px`;
        ring.style.top = `${rect.top - 5}px`;
        ring.style.width = `${rect.width + 10}px`;
        ring.style.height = `${rect.height + 10}px`;
        ring.style.borderRadius = `${Math.min(radius + 5, (rect.height + 10) / 2)}px`;
      });
      raf = window.requestAnimationFrame(place);
    };
    find();
    place();
    const timer = window.setInterval(find, 350);
    return () => {
      window.clearInterval(timer);
      window.cancelAnimationFrame(raf);
    };
  }, [scenario, currentKey, generation]);

  const start = useCallback(
    (nextScenario) => {
      host.reset(nextScenario);
      pendingShow.current = {};
      setScenario(nextScenario);
      setSnap(host.server.snapshot());
      setLog([]);
      setChanged({});
      setTab(nextScenario.frames[0].id);
      setClosedResult(0);
      setGeneration((value) => value + 1);
      const url = new URL(window.location.href);
      if (nextScenario === SCENARIOS[0]) url.searchParams.delete("flow");
      else url.searchParams.set("flow", nextScenario.id);
      window.history.replaceState(null, "", url);
    },
    [host],
  );
  const restart = () => start(scenario);

  const openTab = (id) => {
    if (!scenario.frames.some((frame) => frame.id === id)) return;
    setTab(id);
    setClosedResult(logId.current);
    if (pendingShow.current[id]) {
      window.setTimeout(() => {
        showChange(id);
        delete pendingShow.current[id];
      }, 350);
    }
    setChanged((currentChanged) => Object.fromEntries(Object.entries(currentChanged).filter(([key]) => key !== id)));
  };

  const latest = log[0] || null;
  // 폰에서 '방금 일어난 일' 카드가 권하는 다음 화면: 다음에 누를 화면, 아니면 방금 바뀐 다른 화면.
  const peekFrame = latest
    ? [current?.frame, ...latest.effects.filter((effect) => !effect.quiet).map((effect) => effect.frame)].find((id) => id && id !== tab) || null
    : null;
  const sheetOpen = !wide && Boolean(latest) && closedResult !== latest.id;

  const resultBody = latest && (
    <>
      <span className="lg-result__label">방금 일어난 일</span>
      <strong>{latest.cause}</strong>
      <ul>
        {latest.effects.map((effect) => (
          <li key={`${latest.id}-${effect.frame}`}>
            <button type="button" className={`lg-chip lg-chip--${toneOf(FRAME_BY_ID[effect.frame])}`} onClick={() => openTab(effect.frame)}>
              {FRAME_BY_ID[effect.frame].label}
            </button>
            <span>{effect.text}</span>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div className={`lg-page${wide ? " lg-page--wide" : ""}`}>
      <header className="lg-top">
        <div className="lg-top__title">
          <a href="/guide/" className="lg-top__back" aria-label="운영 매뉴얼로">
            ←
          </a>
          <div>
            <strong>눌러 보는 운영 매뉴얼</strong>
            <small>{scenario.subtitle}</small>
          </div>
        </div>
        <nav className="lg-flows" aria-label="흐름 고르기" ref={flowsRef}>
          {SCENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`lg-flow${item === scenario ? " is-on" : ""}`}
              aria-pressed={item === scenario}
              onClick={() => (item === scenario ? undefined : start(item))}
            >
              {wide ? item.label : item.shortLabel || item.label}
            </button>
          ))}
        </nav>
        <div className="lg-top__side">
          <span className="lg-badge">연습 화면 · 실제 서버와 이어져 있지 않아요</span>
          <button type="button" className="lg-btn lg-btn--ghost" onClick={restart}>
            처음부터
          </button>
        </div>
      </header>

      <div className="lg-side">
        <section className="lg-coach" aria-live="polite">
          <ol className="lg-steps" aria-label={`${steps.length}단계 중 ${currentIndex < 0 ? steps.length : currentIndex}단계 끝남`}>
            {steps.map((step, index) => (
              <li key={step.key} className={done[step.key] ? "is-done" : index === currentIndex ? "is-current" : ""} />
            ))}
          </ol>

          <div className="lg-coach__body">
            {current ? (
              <div className="lg-now">
                <span className="lg-now__label">
                  지금 할 일 · {currentIndex + 1}/{steps.length}
                </span>
                <h1>
                  {currentFrame ? (
                    <span className={`lg-who lg-who--${toneOf(currentFrame)}`}>
                      {currentFrame.who} · {currentFrame.label}
                    </span>
                  ) : (
                    <span className="lg-who lg-who--coach">연습용 버튼</span>
                  )}
                  {titles[current.key] || current.title}
                </h1>
                <p>{current.body}</p>
                {current.action ? (
                  <button type="button" className="lg-btn lg-btn--point" onClick={() => scenario.runAction?.(host.server, current.action, context)}>
                    ⏩ {current.action.label}
                  </button>
                ) : null}
                {!wide && currentFrame && tab !== current.frame && !sheetOpen && (
                  <button type="button" className="lg-btn lg-btn--primary" onClick={() => openTab(current.frame)}>
                    {viewLabel(currentFrame)}
                  </button>
                )}
              </div>
            ) : (
              <div className="lg-now">
                <span className="lg-now__label">한 바퀴 끝</span>
                <h1>이제 마음대로 눌러 보세요</h1>
                <p>아래처럼 눌러 보면, 그때마다 다른 화면이 어떻게 바뀌는지 알려 줘요.</p>
                <ul className="lg-ideas">
                  {scenario.ideas.map((idea) => (
                    <li key={idea}>{idea}</li>
                  ))}
                </ul>
                <button type="button" className="lg-btn lg-btn--primary" onClick={restart}>
                  처음부터 다시 해 보기
                </button>
              </div>
            )}

            {wide && latest && <div className="lg-result">{resultBody}</div>}
          </div>
        </section>

        {log.length > 1 && (
          <section className="lg-log">
            <h2>지금까지 눌러 본 것</h2>
            <ol>
              {log.slice(1).map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.cause}</strong>
                  <span>
                    {entry.effects
                      .filter((effect) => effect.frame !== entry.from)
                      .map((effect) => `${FRAME_BY_ID[effect.frame].label}: ${effect.text}`)
                      .join(" ")}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {!wide && (
        <nav className="lg-tabs" aria-label="화면 고르기">
          {scenario.frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              className={`lg-tab${tab === frame.id ? " is-on" : ""}`}
              aria-pressed={tab === frame.id}
              onClick={() => openTab(frame.id)}
            >
              <small>{frame.who}</small>
              {frame.label}
              {changed[frame.id] && tab !== frame.id ? <i aria-label="방금 바뀜" /> : null}
            </button>
          ))}
        </nav>
      )}

      <div
        className="lg-stage"
        style={wide ? { gridTemplateColumns: scenario.frames.map((frame) => `minmax(0, ${frame.width ? 2.6 : 1}fr)`).join(" ") } : undefined}
      >
        {scenario.frames.map((frame) => (
          <Phone
            key={frame.id}
            frame={frame}
            generation={generation}
            wide={wide}
            hidden={!wide && tab !== frame.id}
            changed={Boolean(changed[frame.id])}
            isNext={Boolean(current) && current.frame === frame.id && !changed[frame.id]}
            frameRef={(node) => {
              frameRefs.current[frame.id] = node;
            }}
          />
        ))}
        {sheetOpen && (
          <div className="lg-sheet" key={latest.id}>
            {resultBody}
            <div className="lg-sheet__actions">
              {peekFrame && (
                <button type="button" className="lg-btn lg-btn--primary" onClick={() => openTab(peekFrame)}>
                  {viewLabel(FRAME_BY_ID[peekFrame])}
                </button>
              )}
              <button type="button" className="lg-btn lg-btn--ghost" onClick={() => setClosedResult(latest.id)}>
                닫기
              </button>
            </div>
          </div>
        )}
      </div>

      {notice && (
        <div className="lg-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
