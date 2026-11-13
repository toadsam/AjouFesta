// 치토 도사의 산통 뽑기 — 오늘의 연애운.
// 산통을 흔들면(버튼 또는 폰 흔들기) 산가지 하나가 올라오고, 그 가지에 적힌 오늘의 운이 펼쳐진다.
// 같은 날 같은 사람은 몇 번을 뽑아도 같은 가지가 나온다(날짜 + 닉네임으로 정한다). 서버를 부르지 않는다.
// 치토는 아주대 공식 포즈를 그대로 쓴다(캐릭터 이용 조건: 형태 변경 금지). 산통·산가지는 따로 그린 SVG.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/saju-fortune.css";

const ELEMENT_INFO = {
  목: { hanja: "木", word: "나무", color: "#2f9e6b" },
  화: { hanja: "火", word: "불", color: "#e5533d" },
  토: { hanja: "土", word: "흙", color: "#c8962a" },
  금: { hanja: "金", word: "쇠", color: "#8a94a6" },
  수: { hanja: "水", word: "물", color: "#2b6de0" },
};
const ELEMENT_ORDER = ["목", "화", "토", "금", "수"];

// 가지 열여섯 개. 장소는 전부 아주대 안, 시간은 축제가 열리는 시간대.
const STICKS = [
  { title: "동풍이 분다", line: "먼저 말 거는 쪽이 이겨요. 오늘은 망설이는 시간이 제일 아까운 날.", place: "성호관 앞", time: "해 질 무렵", element: "목" },
  { title: "불씨가 붙는다", line: "웃음 코드가 맞는 사람을 만나요. 첫마디는 가볍게, 농담 하나면 충분해요.", place: "노천극장", time: "공연 시작 직전", element: "화" },
  { title: "단단한 땅", line: "화려한 말보다 끝까지 들어 주는 태도가 통해요. 질문을 하나 더 해 보세요.", place: "중앙도서관 계단", time: "오후 네 시", element: "토" },
  { title: "맑은 쇳소리", line: "애매하게 굴지 말고 분명하게. 마음에 들면 든다고 말하는 날이에요.", place: "다산관 로비", time: "점심 직후", element: "금" },
  { title: "물길이 열린다", line: "계획한 곳이 아니라 우연히 들른 곳에서 인연이 와요. 발길 닿는 대로 걸어 보세요.", place: "텔레토비 동산", time: "노을 질 때", element: "수" },
  { title: "새순이 돋는다", line: "처음 보는 사람에게 유난히 마음이 가요. 낯가림은 오늘만 접어 두세요.", place: "율곡관 앞", time: "오전 열한 시", element: "목" },
  { title: "등불을 든 사람", line: "당신이 먼저 밝게 굴면 주변이 모여요. 사진 한 장 같이 찍자고 해 보세요.", place: "총학생회 부스", time: "저녁 일곱 시", element: "화" },
  { title: "쌓아 올린 돌담", line: "서두르면 어긋나요. 오늘은 연락처보다 다음 약속을 먼저 잡는 편이 나아요.", place: "팔달관 앞", time: "오후 두 시", element: "토" },
  { title: "잘 벼린 칼", line: "취향이 분명한 사람이 끌려요. 좋아하는 걸 숨기지 말고 먼저 꺼내세요.", place: "원천관 앞", time: "오후 세 시", element: "금" },
  { title: "달이 비친 연못", line: "조용한 자리에서 진짜 얘기가 나와요. 시끄러운 곳을 잠깐 벗어나 보세요.", place: "선구자상 앞", time: "밤 아홉 시", element: "수" },
  { title: "바람을 탄 씨앗", line: "친구의 친구가 인연이에요. 같이 온 사람을 소개받아 보세요.", place: "주점 입구", time: "저녁 여덟 시", element: "목" },
  { title: "한낮의 해", line: "눈에 띄는 날이에요. 평소보다 한 톤 밝은 옷이 도와줘요.", place: "정문 앞", time: "정오", element: "화" },
  { title: "가을 들판", line: "같이 먹는 음식이 마음을 열어요. 한 입 나눠 주는 게 오늘의 고백이에요.", place: "푸드트럭 줄", time: "저녁 여섯 시", element: "토" },
  { title: "은가락지", line: "약속을 지키는 사람이 점수를 따요. 시간 맞춰 가는 것만으로 반은 먹고 들어가요.", place: "소개팅 부스 대기 장소", time: "약속 5분 전", element: "금" },
  { title: "새벽 이슬", line: "기대 없이 나간 자리에서 뜻밖의 사람이 와요. 오늘은 거절보다 수락을.", place: "중앙도서관 앞", time: "이른 저녁", element: "수" },
  { title: "붉은 실", line: "이미 스친 사람 중에 있어요. 아까 눈 마주친 그 사람, 한 번 더 찾아보세요.", place: "성호관과 도서관 사이 길", time: "지금부터 한 시간", element: "화" },
];

const ORDINAL = ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째", "일곱째", "여덟째", "아홉째", "열째", "열한째", "열두째", "열셋째", "열넷째", "열다섯째", "열여섯째"];

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
}

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

function deviceSeed() {
  try {
    let seed = window.localStorage.getItem("festflow_saju_seed");
    if (!seed) {
      seed = `${Math.random()}`.slice(2);
      window.localStorage.setItem("festflow_saju_seed", seed);
    }
    return seed;
  } catch {
    return "guest";
  }
}

/** 오늘 가지의 기운이 내 일간과 어떤 사이인지 한 줄. */
function relationLine(mine, stick) {
  const a = ELEMENT_ORDER.indexOf(mine);
  const b = ELEMENT_ORDER.indexOf(stick);
  if (a < 0 || b < 0) return "";
  const me = `내 일간 ${ELEMENT_INFO[mine].hanja}`;
  const it = `오늘 가지의 ${ELEMENT_INFO[stick].hanja}`;
  if (a === b) return `${it}는 ${me}와 같은 기운이에요. 평소의 나답게 굴면 돼요.`;
  if ((b + 1) % 5 === a) return `${it}가 ${me}를 키워 줘요. 밀어주는 날이니 한 걸음 더 나가 보세요.`;
  if ((a + 1) % 5 === b) return `${me}가 ${it}를 키워요. 내가 베푸는 만큼 돌아오는 날이에요.`;
  if ((b + 2) % 5 === a) return `${it}가 ${me}를 누르는 날이에요. 무리하지 말고 한 템포 쉬어 가요.`;
  return `${me}가 ${it}를 다스려요. 주도권은 나에게 있어요.`;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * 산통. 옻칠한 통에 금박 띠, 한지 꼬리표(緣). 가지 일곱 개가 부채꼴로 꽂혀 있고 가운데 가지가 뽑혀 올라온다.
 * 그리는 순서: 통 안쪽(어두운 입구) → 가지 → 통 몸체(가지 아랫부분을 가린다) → 앞쪽 테두리.
 */
function Santong({ phase }) {
  const sticks = [-20, -13, -6, 7, 14, 21];
  return (
    <svg className={`sf-santong sf-santong--${phase}`} viewBox="0 0 160 210" aria-hidden="true">
      <defs>
        <linearGradient id="sf-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a1f66" />
          <stop offset="0.35" stopColor="#5a43b8" />
          <stop offset="0.7" stopColor="#3b2a8a" />
          <stop offset="1" stopColor="#221a55" />
        </linearGradient>
        <linearGradient id="sf-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a87c2a" />
          <stop offset="0.4" stopColor="#f4dc98" />
          <stop offset="1" stopColor="#b88a34" />
        </linearGradient>
        <linearGradient id="sf-stick" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9cf8e" />
          <stop offset="0.5" stopColor="#fff2cf" />
          <stop offset="1" stopColor="#d9b96c" />
        </linearGradient>
      </defs>

      <ellipse cx="80" cy="198" rx="50" ry="7" fill="rgba(0,0,0,0.35)" />
      <ellipse cx="80" cy="92" rx="38" ry="10" fill="#140f33" />

      <g className="sf-santong__sticks">
        {sticks.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 80 150)`}>
            <rect x="77" y="26" width="6" height="110" rx="3" fill="url(#sf-stick)" />
            <rect x="77" y="26" width="6" height="13" rx="3" fill="#c8362d" />
          </g>
        ))}
      </g>
      <g className="sf-santong__drawn">
        <rect x="76.5" y="14" width="7" height="120" rx="3.5" fill="#fff8e2" stroke="#c8362d" strokeWidth="1" />
        <rect x="76.5" y="14" width="7" height="16" rx="3.5" fill="#c8362d" />
        <circle cx="80" cy="42" r="1.6" fill="#c8362d" />
      </g>

      <path d="M42 92 L52 190 Q80 200 108 190 L118 92 Q80 106 42 92 Z" fill="url(#sf-body)" />
      <path d="M42 92 Q80 106 118 92" fill="none" stroke="url(#sf-gold)" strokeWidth="5" strokeLinecap="round" />
      <path d="M44.5 114 Q80 127 115.5 114" fill="none" stroke="url(#sf-gold)" strokeWidth="2.2" />
      <path d="M50.5 174 Q80 185 109.5 174" fill="none" stroke="url(#sf-gold)" strokeWidth="2.2" />
      <path d="M52 190 Q80 200 108 190" fill="none" stroke="url(#sf-gold)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M56 98 L62 186" stroke="rgba(255,255,255,0.18)" strokeWidth="5" strokeLinecap="round" />

      <g transform="rotate(-3 80 146)">
        <rect x="64" y="126" width="32" height="40" rx="3" fill="#fbf3dc" stroke="#d9b45a" strokeWidth="1" />
        <text x="80" y="155" textAnchor="middle" fontSize="24" fontWeight="700" fontFamily="'Gowun Batang', 'Noto Serif KR', serif" fill="#c8362d">緣</text>
      </g>
    </svg>
  );
}

export default function SajuFortune({ nickname, myElement, compact = false, ctaLabel, onCta }) {
  const date = todayKey();
  const seedKey = nickname ? `nick:${nickname}` : `dev:${deviceSeed()}`;
  const index = useMemo(() => hash(`${date}|${seedKey}`) % STICKS.length, [date, seedKey]);
  const stick = STICKS[index];
  const element = ELEMENT_INFO[stick.element];
  const storageKey = `festflow_saju_fortune_${date}_${hash(seedKey)}`;

  const [phase, setPhase] = useState(() => {
    try {
      return window.localStorage.getItem(storageKey) ? "done" : "idle";
    } catch {
      return "idle";
    }
  });
  const [open, setOpen] = useState(!compact);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const draw = useCallback(() => {
    if (phase !== "idle") return;
    const quick = prefersReducedMotion();
    setOpen(true);
    setPhase("shake");
    try {
      window.navigator.vibrate?.([30, 40, 30, 40, 60]);
    } catch {
      /* 진동을 못 쓰는 기기 */
    }
    timers.current.push(window.setTimeout(() => setPhase("rise"), quick ? 0 : 1100));
    timers.current.push(
      window.setTimeout(() => {
        setPhase("done");
        try {
          window.localStorage.setItem(storageKey, "1");
        } catch {
          /* 저장 못 해도 결과는 보여 준다 */
        }
      }, quick ? 0 : 1900),
    );
  }, [phase, storageKey]);

  // 폰을 흔들어도 뽑힌다. 권한을 따로 물어야 하는 기기(iOS)는 버튼만 쓴다.
  useEffect(() => {
    if (phase !== "idle" || !open) return undefined;
    if (typeof window.DeviceMotionEvent === "undefined" || typeof window.DeviceMotionEvent.requestPermission === "function") {
      return undefined;
    }
    let last = 0;
    const onMotion = (event) => {
      const a = event.accelerationIncludingGravity;
      if (!a) return;
      const force = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
      const now = Date.now();
      if (force > 32 && now - last > 600) {
        last = now;
        draw();
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [phase, open, draw]);

  const done = phase === "done";

  if (compact && !open) {
    return (
      <button type="button" className={`sf-bar${done ? " sf-bar--done" : ""}`} onClick={() => setOpen(true)}>
        <img src="/images/saju/chito-dosa.png" alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/chito-wave.png"; }} />
        <span className="sf-bar__text">
          <small>치토 도사의 산통</small>
          <strong>{done ? `오늘의 가지 · ${stick.title}` : "오늘의 연애운 뽑기"}</strong>
        </span>
        <span className="sf-bar__go" aria-hidden="true">{done ? "다시 보기 ›" : "흔들기 ›"}</span>
      </button>
    );
  }

  return (
    <section className={`sf sf--${phase}`} aria-label="오늘의 연애운">
      <header className="sf-head">
        <div>
          <small>치토 도사의 산통 · {date.slice(5).replace("-", ".")}</small>
          <strong>{done ? "오늘 뽑은 가지" : "오늘의 연애운, 한 가지 뽑아 볼까요"}</strong>
        </div>
        {compact ? (
          <button type="button" className="sf-close" onClick={() => setOpen(false)}>
            접기
          </button>
        ) : null}
      </header>

      {!done ? (
        <div className="sf-stage">
          <div className="sf-scene">
            <span className="sf-scene__glow" aria-hidden="true" />
            <button type="button" className="sf-santong-btn" onClick={draw} disabled={phase !== "idle"} aria-label="산통 흔들어 가지 뽑기">
              <Santong phase={phase} />
            </button>
            <img
              className="sf-chito"
              src="/images/saju/chito-dosa.png"
              alt=""
              onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/chito-wave.png"; }}
            />
            <span className="sf-bubble">{phase === "idle" ? "한 가지 뽑아 보게!" : "차르르…"}</span>
          </div>
          <p className="sf-say">산통을 누르거나 폰을 흔들어 보세요. 가지는 하루에 하나예요.</p>
          <button type="button" className="sf-primary" onClick={draw} disabled={phase !== "idle"}>
            {phase === "idle" ? "산통 흔들기" : "뽑는 중…"}
          </button>
        </div>
      ) : (
        <div className="sf-result">
          <div className="sf-stick" style={{ "--sf-el": element.color }}>
            <span className="sf-stick__no">{ORDINAL[index]} 가지</span>
            <b className="sf-stick__hanja">{element.hanja}</b>
            <span className="sf-stick__el">{stick.element} · {element.word}</span>
          </div>
          <div className="sf-result__body">
            <strong className="sf-result__title">{stick.title}</strong>
            <p className="sf-result__line">{stick.line}</p>
            <dl className="sf-luck">
              <div>
                <dt>인연이 오는 곳</dt>
                <dd>{stick.place}</dd>
              </div>
              <div>
                <dt>좋은 때</dt>
                <dd>{stick.time}</dd>
              </div>
            </dl>
            {myElement ? <p className="sf-result__mine">{relationLine(myElement, stick.element)}</p> : null}
            {onCta ? (
              <button type="button" className="sf-primary" onClick={onCta}>
                {ctaLabel}
              </button>
            ) : null}
            <small className="sf-result__foot">가지는 하루에 하나. 내일 새 가지가 나와요. 재미로 보는 운세예요.</small>
          </div>
        </div>
      )}
    </section>
  );
}
