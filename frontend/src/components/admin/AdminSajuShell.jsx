// 소개팅 전용 관리자(/ai-match/admin)의 사주풍 틀. 데스크톱은 왼쪽 밤하늘 사이드바 + 오른쪽 한지 바탕 본문,
// 폰은 위쪽 머리글 + 가로 탭. 치토 도사가 지금 챙길 일을 알려 주고, 누르면 운영진 덕담을 한 장 뽑아 준다.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FESTIVAL } from "../../config/festival";
import { CountUp } from "../v2/V2Kit";
import {
  IconArrowLeft,
  IconChart,
  IconClipboard,
  IconHeart,
  IconRefresh,
  IconShield,
  IconUsers,
} from "../UxIcons";

const TAB_ICONS = {
  matches: IconHeart,
  requests: IconClipboard,
  profiles: IconUsers,
  reports: IconShield,
  tools: IconChart,
};

// 치토를 누르면 한 장씩 나오는 운영진 덕담. 사주풀이 말투.
const FORTUNES = [
  ["大吉", "오늘 맺어 준 인연은 오래 간대요. 자부심 가져도 좋아요."],
  ["吉", "노쇼 없는 하루가 될 괘예요. 혹시 몰라 문자만 한 번 더!"],
  ["和", "옆자리 운영진과 합이 좋은 날. 간식은 나눠 먹어요."],
  ["福", "물 한 잔 마시면 복이 들어와요. 지금이에요."],
  ["緣", "붉은 실은 이미 묶였어요. 우리는 길만 안내하면 돼요."],
  ["安", "급할수록 천천히. 전화번호는 두 번 확인해요."],
  ["喜", "오늘 웃으며 돌아가는 사람이 많을 거예요. 덕분이에요."],
  ["休", "십 분 쉬어 가도 괘는 바뀌지 않아요. 어깨 한 번 펴요."],
];

function greeting(now) {
  const h = now.getHours();
  if (h < 6) return "늦은 밤까지 고생이 많아요";
  if (h < 11) return "좋은 아침이에요";
  if (h < 14) return "점심은 챙기셨나요";
  if (h < 18) return "좋은 오후예요";
  if (h < 22) return "저녁까지 수고가 많아요";
  return "오늘도 고생 많았어요";
}

function festivalChip(now) {
  const start = new Date(`${FESTIVAL.startDate}T00:00:00`);
  const end = new Date(`${FESTIVAL.endDate}T23:59:59`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((start - today) / 86400000);
  if (days > 0) return `축제까지 D-${days}`;
  if (now <= end) return days === 0 ? "축제 1일차" : "축제 2일차";
  return "축제 종료";
}

// 손님용 사주 소개팅 메인과 같은 밤 풍경: 화면에 고정된 그림 + 천천히 떨어지는 꽃잎 몇 장.
const PETALS = [
  { x: "12%", d: "17s", delay: "-3s", kind: "pink", s: 1 },
  { x: "27%", d: "21s", delay: "-11s", kind: "gold", s: 0.8 },
  { x: "44%", d: "18s", delay: "-6s", kind: "pink", s: 0.7 },
  { x: "61%", d: "23s", delay: "-15s", kind: "gold", s: 1 },
  { x: "76%", d: "19s", delay: "-1s", kind: "pink", s: 0.9 },
  { x: "90%", d: "22s", delay: "-8s", kind: "gold", s: 0.7 },
];

export function AdminNightSky() {
  return (
    <div className="aas-sky" aria-hidden="true">
      <div className="aas-sky__img" />
      {PETALS.map((petal, index) => (
        <i
          key={index}
          className={`aas-petal aas-petal--${petal.kind}`}
          style={{ "--x": petal.x, "--d": petal.d, "--delay": petal.delay, "--s": petal.s }}
        />
      ))}
    </div>
  );
}

/** 지금 가장 먼저 챙길 일 한 가지. 없으면 쉬어 가라는 말. */
export function pickBriefing({ waiting, photos, reports, pending, matched }) {
  if (reports > 0) return { tone: "alert", tab: "reports", text: `신고 ${reports}건이 기다려요. 빨리 볼수록 좋아요.`, cta: "신고 보기" };
  if (waiting > 0) return { tone: "todo", tab: "matches", text: `연결을 기다리는 인연이 ${waiting}쌍 있어요. 먼저 챙겨 볼까요?`, cta: "매치 보기" };
  if (photos > 0) return { tone: "todo", tab: "reports", text: `검수할 사진이 ${photos}장 쌓였어요.`, cta: "사진 검수" };
  if (pending > 0) return { tone: "calm", tab: "requests", text: `답을 기다리는 신청이 ${pending}건 있어요. 지켜보기만 하면 돼요.`, cta: "신청 기록" };
  if (matched > 0) return { tone: "done", tab: "matches", text: "지금 챙길 일은 없어요. 차 한 잔 하고 오세요.", cta: "" };
  return { tone: "done", tab: "matches", text: "아직 조용해요. 첫 인연이 맺어지면 바로 알려 드릴게요.", cta: "" };
}

export function AdminSajuSide({ tabs, activeTab, onTab, adminName, loading, onRefresh, onLogout, briefing }) {
  const [fortune, setFortune] = useState(null);
  const [hop, setHop] = useState(0);
  const [chitoOk, setChitoOk] = useState(true);
  const lastRef = useRef(-1);
  const timerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function drawFortune() {
    let next = Math.floor(Math.random() * FORTUNES.length);
    if (next === lastRef.current) next = (next + 1) % FORTUNES.length;
    lastRef.current = next;
    setFortune(FORTUNES[next]);
    setHop(Date.now());
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setFortune(null), 6000);
  }

  return (
    <aside className="aas-side">
      <div className="aas-side__sky" aria-hidden="true" />
      <div className="aas-brand">
        <span className="aas-brand__eyebrow">AI Match Control</span>
        <h1>
          소개팅 <em>전용 관리자</em>
        </h1>
      </div>

      <div className={`aas-chito aas-chito--${fortune ? "fortune" : briefing.tone}`}>
        <button type="button" className="aas-chito__face" onClick={drawFortune} aria-label="치토 도사에게 덕담 한 장 받기">
          <span className="aas-chito__halo" aria-hidden="true" />
          {chitoOk ? (
            <img key={hop} className={hop ? "is-hop" : ""} src="/images/saju/chito-dosa.png" alt="" onError={() => setChitoOk(false)} />
          ) : (
            <img key={hop} className={hop ? "is-hop" : ""} src="/images/chito-wave.png" alt="" />
          )}
        </button>
        <div className="aas-chito__bubble" key={fortune ? fortune[0] : briefing.text} role="status">
          {fortune ? (
            <>
              <b className="aas-chito__seal">{fortune[0]}</b>
              <p>{fortune[1]}</p>
            </>
          ) : (
            <>
              <p>{briefing.text}</p>
              {briefing.cta && briefing.tab !== activeTab ? (
                <button type="button" className="aas-chito__go" onClick={() => onTab(briefing.tab)}>
                  {briefing.cta} →
                </button>
              ) : (
                <span className="aas-chito__here">{briefing.cta ? "지금 보고 있어요" : "치토를 눌러 덕담 한 장"}</span>
              )}
            </>
          )}
        </div>
      </div>

      <nav className="aa-nav aas-nav" aria-label="관리 화면">
        {tabs.map(([key, label, count], index) => {
          const Icon = TAB_ICONS[key] || IconClipboard;
          const active = activeTab === key;
          return (
            <button key={key} type="button" className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => onTab(key)}>
              <span className="aas-nav__icon">
                <Icon className="h-5 w-5" />
              </span>
              <span className="aas-nav__label">{label}</span>
              {count !== null && count > 0 ? <em>{count}</em> : null}
              <kbd aria-hidden="true">{index + 1}</kbd>
            </button>
          );
        })}
      </nav>

      <div className="aas-side__foot">
        <p className="aas-side__who">
          <i aria-hidden="true">{`${adminName || "관"}`.slice(0, 1)}</i>
          <span>
            <b>{adminName || "관리자"}</b>
            <small>로그인됨</small>
          </span>
        </p>
        <div className="aas-side__actions">
          <Link to="/ai-match" title="사용자 화면으로">
            <IconArrowLeft className="h-4 w-4" />
            <span>사용자 화면</span>
          </Link>
          <button type="button" onClick={onRefresh} disabled={loading} className={loading ? "is-spinning" : ""} title="새로고침 (R)">
            <IconRefresh className="h-4 w-4" />
            <span>새로고침</span>
          </button>
          <button type="button" onClick={onLogout} className="aas-side__logout">
            로그아웃
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AdminSajuHero({ adminName, message, loading, kpis, onTab }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const chip = useMemo(() => festivalChip(now), [now]);
  const clock = `${now.getMonth() + 1}월 ${now.getDate()}일 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <header className="aas-hero">
      <div className="aas-hero__top">
        <div>
          <p className="aas-hero__hello">
            {greeting(now)}, <b>{adminName || "관리자"}</b>님
          </p>
          <p className={`aas-hero__status${loading ? " is-loading" : ""}`} role="status" aria-live="polite">
            <i aria-hidden="true" />
            {message || "소개팅 운영 현황을 보고 있어요."}
          </p>
        </div>
        <div className="aas-hero__chips">
          <span className="aas-hero__chip aas-hero__chip--gold">{chip}</span>
          <span className="aas-hero__chip">{clock}</span>
        </div>
      </div>
      <div className="aas-kpis">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <button key={kpi.key} type="button" className={`aas-kpi aas-kpi--${kpi.key}`} style={{ "--i": index }} onClick={() => onTab(kpi.tab)}>
              <span className="aas-kpi__icon">
                <Icon className="h-5 w-5" />
              </span>
              <span className="aas-kpi__label">{kpi.label}</span>
              <strong>
                <CountUp value={kpi.value} />
              </strong>
              <small>{kpi.note}</small>
              {kpi.hanja ? (
                <b className="aas-kpi__hanja" aria-hidden="true">
                  {kpi.hanja}
                </b>
              ) : null}
            </button>
          );
        })}
      </div>
    </header>
  );
}

/** 새 매치가 성사됐을 때 잠깐 뜨는 낙관 도장 알림. */
export function AdminSajuCelebrate({ count, onDone }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 3600);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <div className="aas-celebrate" role="status" onClick={onDone}>
      <img src="/images/chito-party.png" alt="" />
      <div>
        <strong>새 인연이 맺어졌어요</strong>
        <p>방금 {count}쌍이 성사됐어요. 성사·연락 탭에서 챙겨 주세요.</p>
      </div>
      <b className="aas-celebrate__seal" aria-hidden="true">
        成
      </b>
    </div>
  );
}
