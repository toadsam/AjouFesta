// 카드뉴스 두 번째 묶음: 공연무대 입장·안전, 배리어 프리존, 포토부스, 주류. (체육대회는 2026-10-06 에 안 하기로 해 뺌)
// 원본 카드의 글을 그대로 옮기고, 확인 체크 · 가방 검사 · 단계 넘기기 · 팀 고르기처럼 손으로 해 볼 거리를 붙였다.
import { useEffect, useMemo, useState } from "react";
import { BAR, BARRIER, CARD_NEWS_IMG, PHOTO_BOOTH, STAGE } from "../../data/cardNews";
import { CnIcon, PinMap } from "./CardNewsArt";
import { GlassCard, InfoRows, vibrate } from "./CardNewsPages";

const img = (name) => `${CARD_NEWS_IMG}/${name}.webp`;

/* "[굵게]" 표시가 든 문장을 굵은 글씨로 */
export function Rich({ text }) {
  const parts = text.split(/(\[[^\]]+\])/g).filter(Boolean);
  return parts.map((part, index) =>
    part.startsWith("[") ? <b key={index}>{part.slice(1, -1)}</b> : <span key={index}>{part}</span>,
  );
}

/* 지금이 언제인지: 시작 전(D-n / n시간 n분) · 진행 중 · 끝 */
export function useWhen(startIso, endIso) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return useMemo(() => {
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : null;
    if (now < start) {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const startDay = new Date(start);
      startDay.setHours(0, 0, 0, 0);
      const days = Math.round((startDay - today) / 86400000);
      if (days > 0) return { tone: "soon", days, text: `D-${days}` };
      const minutes = Math.ceil((start - now) / 60000);
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return { tone: "soon", days: 0, text: h ? `${h}시간 ${m}분 남음` : `${m}분 남음` };
    }
    if (!end || now <= end) return { tone: "live", days: 0, text: "진행 중" };
    return { tone: "done", days: 0, text: "종료" };
  }, [now, startIso, endIso]);
}

/* 배리어 프리존 카드의 '큰 글씨' 켜기. 네 장이 같은 값을 쓴다. */
const BIG_KEY = "festflow.cardnews.bigtext";
function useBigText() {
  const [big, setBig] = useState(() => {
    try {
      return window.localStorage.getItem(BIG_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const sync = (event) => setBig(Boolean(event.detail));
    window.addEventListener("cn-bigtext", sync);
    return () => window.removeEventListener("cn-bigtext", sync);
  }, []);
  function toggle() {
    const next = !big;
    try {
      window.localStorage.setItem(BIG_KEY, next ? "1" : "0");
    } catch {
      // 저장이 막혀도 이번 화면에서는 바뀐다.
    }
    window.dispatchEvent(new CustomEvent("cn-bigtext", { detail: next }));
    vibrate();
  }
  return [big, toggle];
}

function BigTextButton({ big, onToggle }) {
  return (
    <button type="button" className={`cn-bigbtn${big ? " is-on" : ""}`} onClick={onToggle} aria-pressed={big}>
      <span aria-hidden="true">가</span>
      {big ? "기본 글씨" : "큰 글씨"}
    </button>
  );
}

/* ================= 공연무대 입장 안내 ================= */
export function StageEntryPage() {
  const when = useWhen(STAGE.entryAt);
  const [checked, setChecked] = useState([]);
  const done = checked.length === STAGE.rules.length;

  function toggle(index) {
    setChecked((list) => (list.includes(index) ? list.filter((i) => i !== index) : [...list, index]));
    vibrate(checked.length + 1 === STAGE.rules.length ? [10, 40, 10] : 8);
  }

  return (
    <GlassCard title="공연무대 입장 안내" seed={43}>
      <InfoRows rows={[["공연 장소", STAGE.place], ["입장 시간", STAGE.entry]]} />
      <p className="cn-note cn-in" style={{ "--d": 3 }}>
        ({STAGE.entryNote})
      </p>
      <p className={`cn-status cn-status--${when.tone} cn-in`} style={{ "--d": 3 }}>
        <i aria-hidden="true" />
        {when.tone === "soon" ? `10월 8일 입장까지 ${when.text}` : when.tone === "live" ? "입장이 시작됐어요" : "공연이 끝났어요"}
      </p>
      <div className="cn-checkhead cn-in" style={{ "--d": 4 }}>
        <span>하나씩 눌러서 확인해요</span>
        <b>
          {checked.length} / {STAGE.rules.length}
        </b>
      </div>
      <ol className="cn-checks">
        {STAGE.rules.map((rule, index) => (
          <li key={index} className="cn-in" style={{ "--d": index + 5 }}>
            <button type="button" className={`cn-check${checked.includes(index) ? " is-on" : ""}`} onClick={() => toggle(index)} aria-pressed={checked.includes(index)}>
              <span className="cn-check__box" aria-hidden="true">
                {checked.includes(index) ? "✓" : index + 1}
              </span>
              <span className="cn-check__text">
                <Rich text={rule.text} />
                {rule.sub ? <small>({rule.sub})</small> : null}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {done ? (
        <p className="cn-done" role="status">
          준비 끝! 학생증 챙겨서 만나요
        </p>
      ) : null}
    </GlassCard>
  );
}

/* ================= 대기줄 · 입구 ================= */
export function StageQueuePage() {
  return (
    <GlassCard title="공연무대 대기줄 및 입구 안내" seed={47} className="cn-card--wide-title">
      <div className="cn-gate cn-in" style={{ "--d": 1 }}>
        <span className="cn-gate__tag">공연 무대 입구</span>
        <strong>{STAGE.gate}</strong>
      </div>
      <div className="cn-in" style={{ "--d": 2 }}>
        <PinMap src={img("stage-map")} ratio={700 / 670} alt="노천극장 입구와 대기줄 지도" pins={[{ x: 31.3, y: 45, label: "입구", tone: "gold" }]} />
      </div>
      <ul className="cn-bullets">
        {STAGE.queue.map((line, index) => (
          <li key={index} className="cn-in" style={{ "--d": index + 3 }}>
            <Rich text={line} />
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

/* ================= 학생참여공연팀 ================= */
export function StageTeamsPage({ onSchedule }) {
  const [cheers, setCheers] = useState({});
  function cheer(name) {
    setCheers((map) => ({ ...map, [name]: (map[name] || 0) + 1 }));
    vibrate(6);
  }
  return (
    <GlassCard title="학생참여공연팀" seed={53}>
      <p className="cn-note cn-in" style={{ "--d": 1 }}>
        팀 이름을 눌러 응원을 보내 보세요
      </p>
      <ol className="cn-teams">
        {STAGE.teams.map((name, index) => {
          const count = cheers[name] || 0;
          return (
            <li key={name} className="cn-in" style={{ "--d": Math.min(index + 2, 10) }}>
              <button type="button" className={`cn-team${count ? " is-on" : ""}`} onClick={() => cheer(name)}>
                <span className="cn-team__no">{index + 1}.</span>
                <span className="cn-team__name">{name}</span>
                {count ? (
                  <span key={count} className="cn-team__cheer" aria-label={`응원 ${count}번`}>
                    <CnIcon.heart filled />
                    {count > 1 ? count : null}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="cn-cta cn-in" style={{ "--d": 11 }} onClick={onSchedule}>
        앱에서 공연 시간표 보기 <CnIcon.arrow />
      </button>
    </GlassCard>
  );
}

/* ================= 반입금지 물품: 가방 검사 ================= */
const itemStroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
const ITEM_ICONS = {
  bottle: (
    <svg viewBox="0 0 32 32">
      <path d="M13 3h6v5l2 3v17a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V11l2-3z" {...itemStroke} />
      <path d="M11 16h10" {...itemStroke} />
      <path d="M24 20l3-3M25 25h3" {...itemStroke} />
    </svg>
  ),
  knife: (
    <svg viewBox="0 0 32 32">
      <path d="M6 26l13-13c3-3 6-4 8-4-0 3-2 6-5 9l-4 4-3-3" {...itemStroke} />
      <path d="M6 26l3 1 3-3-3-3z" {...itemStroke} />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 32 32">
      <rect x="4" y="10" width="16" height="13" rx="2" {...itemStroke} />
      <path d="M20 13h4l4-2v12l-4-2h-4" {...itemStroke} />
      <circle cx="12" cy="16.5" r="3.5" {...itemStroke} />
      <path d="M8 10l1.5-3h5L16 10" {...itemStroke} />
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 32 32">
      <path d="M16 4c1 5 7 7 7 14a7 7 0 0 1-14 0c0-4 2-6 3-8 1 2 2 3 3 3 0-3 0-6 1-9z" {...itemStroke} />
      <path d="M16 20c1 1 3 2 3 4a3 3 0 0 1-6 0c0-1 1-2 3-4z" {...itemStroke} />
    </svg>
  ),
  food: (
    <svg viewBox="0 0 32 32">
      <path d="M7 8h11l-1.5 19a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1z" {...itemStroke} />
      <path d="M7.5 13h10M12 8V4h3" {...itemStroke} />
      <path d="M21 16h6c0 4-1 7-3 7s-3-3-3-7zM24 23v5M22 28h4" {...itemStroke} />
    </svg>
  ),
  warn: (
    <svg viewBox="0 0 32 32">
      <path d="M16 4l13 23H3z" {...itemStroke} />
      <path d="M16 12v7" {...itemStroke} />
      <circle cx="16" cy="23" r="1.2" fill="currentColor" />
    </svg>
  ),
};

export function StageBannedPage() {
  const [stamped, setStamped] = useState([]);
  const all = stamped.length === STAGE.banned.length;
  function stamp(index) {
    if (stamped.includes(index)) return;
    setStamped((list) => [...list, index]);
    vibrate(stamped.length + 1 === STAGE.banned.length ? [12, 50, 12] : 12);
  }
  return (
    <GlassCard title="반입금지 물품 안내" seed={59}>
      <p className="cn-copy cn-in" style={{ "--d": 1 }}>
        안전하고 즐거운 관람을 위해 <b>반입 물품 검사</b>를 실시합니다.
      </p>
      <p className="cn-copy cn-copy--sm cn-in" style={{ "--d": 2 }}>
        공연 관람 방해 및 타인의 불편을 야기하는 물품은 반입이 금지되며 쾌적한 공연 관람을 위한 조치이니 학우분들의 양해 부탁드립니다.
      </p>
      <div className="cn-checkhead cn-in" style={{ "--d": 3 }}>
        <span className="cn-tag cn-tag--inline">반입금지 물품</span>
        <b>{all ? "가방 검사 끝!" : `눌러서 검사 ${stamped.length} / ${STAGE.banned.length}`}</b>
      </div>
      <div className="cn-banned">
        {STAGE.banned.map((item, index) => {
          const on = stamped.includes(index);
          return (
            <button
              key={index}
              type="button"
              className={`cn-ban cn-in${on ? " is-on" : ""}`}
              style={{ "--d": index + 4 }}
              onClick={() => stamp(index)}
              aria-pressed={on}
            >
              <span className="cn-ban__icon" aria-hidden="true">
                {ITEM_ICONS[item.icon]}
              </span>
              <span className="cn-ban__text">
                {item.strong ? <b>{item.strong}</b> : null}
                {item.label ? <small>{item.strong ? `(${item.label})` : item.label}</small> : null}
              </span>
              {on ? (
                <span className="cn-ban__stamp" aria-hidden="true">
                  반입금지
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

/* ================= 기타 유의사항 ================= */
export function StageEtcPage() {
  return (
    <GlassCard title="기타 유의사항" seed={61}>
      <ul className="cn-bullets cn-bullets--center">
        {STAGE.etc.map((line, index) => (
          <li key={index} className="cn-in" style={{ "--d": index + 1 }}>
            <Rich text={line} />
          </li>
        ))}
      </ul>
      <p className="cn-closing cn-in" style={{ "--d": 7 }}>
        즐겁고 안전한 공연을 위해 관객 여러분의 협조를 부탁드립니다.
      </p>
    </GlassCard>
  );
}

/* ================= 배리어 프리존 ================= */
export function BarrierAboutPage() {
  const [big, toggle] = useBigText();
  return (
    <GlassCard
      title={
        <>
          공연 무대 배리어
          <br />
          프리존 입장 안내
        </>
      }
      seed={67}
      className={big ? "cn-card--big" : ""}
    >
      <BigTextButton big={big} onToggle={toggle} />
      <InfoRows rows={[["공연 장소", BARRIER.place], ["공연 시간", BARRIER.hours]]} />
      <h3 className="cn-subhead cn-in" style={{ "--d": 3 }}>
        배리어 프리존이란?
      </h3>
      <p className="cn-copy cn-copy--left cn-in" style={{ "--d": 4 }}>
        {BARRIER.about}
      </p>
      <p className="cn-copy cn-in" style={{ "--d": 5 }}>
        안전하고 즐거운 가을축제 <span className="cn-nowrap">&lt;바람&gt; 을</span> 위해
        <br />
        배리어 프리존을 운영하고자 합니다.
      </p>
    </GlassCard>
  );
}

function PlaneArrow({ className = "" }) {
  return (
    <svg className={`cn-plane ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 11.5L22 3l-6.5 18-3.5-7.5z" fill="#fff" />
      <path d="M12 13.5L22 3" stroke="rgba(120,150,190,0.6)" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function BarrierStepsPage() {
  const [big, toggle] = useBigText();
  const [step, setStep] = useState(0);
  const last = BARRIER.steps.length - 1;
  function go(next) {
    setStep(next);
    vibrate();
  }
  return (
    <GlassCard title="배리어 프리존 입장 절차" seed={71} className={big ? "cn-card--big" : ""}>
      <BigTextButton big={big} onToggle={toggle} />
      <p className="cn-lead cn-in" style={{ "--d": 1 }}>
        별도의 사전 신청 없이 아주대학교 <mark>노천극장(The Art)</mark>에 오신 후 <mark>스태프에게 요청하시면 배리어 프리존으로 안전하고 빠르게 이동</mark>하실 수
        있습니다.
      </p>
      <div className={`cn-steps cn-steps--at${step} cn-in`} style={{ "--d": 2 }}>
        {BARRIER.steps.map((text, index) => (
          <button
            key={index}
            type="button"
            className={`cn-step cn-step--${index}${index === step ? " is-on" : ""}${index < step ? " is-done" : ""}`}
            onClick={() => go(index)}
            aria-current={index === step ? "step" : undefined}
          >
            <span className="cn-step__no">{index + 1}</span>
            {text}
          </button>
        ))}
        <PlaneArrow className="cn-plane--a" />
        <PlaneArrow className="cn-plane--b" />
        <PlaneArrow className="cn-plane--c" />
        <span key={step} className="cn-steps__flyer" aria-hidden="true">
          <PlaneArrow />
        </span>
      </div>
      <div className="cn-stepnav cn-in" style={{ "--d": 3 }}>
        <button type="button" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0}>
          이전
        </button>
        <span>
          {step + 1} / {BARRIER.steps.length}
        </span>
        <button type="button" className="is-primary" onClick={() => go(step === last ? 0 : step + 1)}>
          {step === last ? "처음부터" : "다음 단계"}
        </button>
      </div>
    </GlassCard>
  );
}

export function BarrierMapPage() {
  const [big, toggle] = useBigText();
  return (
    <GlassCard seed={73} className={`cn-card--map${big ? " cn-card--big" : ""}`}>
      <BigTextButton big={big} onToggle={toggle} />
      <div className="cn-in" style={{ "--d": 1 }}>
        <PinMap src={img("barrier-map")} ratio={1000 / 771} alt="노천극장 주변 지도, 배리어 프리존 입구 표시" pins={[{ x: 34, y: 71, label: "배리어 프리존 입구", tone: "pink" }]} zoomable />
      </div>
      <p className="cn-caption cn-in" style={{ "--d": 2 }}>
        &lt;배리어 프리존 입구&gt;
      </p>
      <p className="cn-note cn-in" style={{ "--d": 3 }}>
        지도를 누르면 크게 볼 수 있어요
      </p>
    </GlassCard>
  );
}

export function BarrierNotesPage() {
  const [big, toggle] = useBigText();
  return (
    <GlassCard
      title={
        <>
          배리어 프리존 입장 관련
          <br />
          유의사항
        </>
      }
      seed={79}
      className={big ? "cn-card--big" : ""}
    >
      <BigTextButton big={big} onToggle={toggle} />
      <ul className="cn-bullets cn-bullets--dot">
        {BARRIER.notes.map((line, index) => (
          <li key={index} className="cn-in" style={{ "--d": index + 1 }}>
            {line}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

/* ================= 포토부스 ================= */
export function PhotoPlacePage() {
  return (
    <GlassCard title="포토부스 위치 안내" seed={97}>
      <InfoRows rows={[["운영 장소", PHOTO_BOOTH.place], ["운영 일자", PHOTO_BOOTH.dates]]} />
      <div className="cn-mapwrap cn-in" style={{ "--d": 3 }}>
        <PinMap src={img("photo-map")} ratio={900 / 581} alt="중앙도서관 옆 야시장과 포토부스 위치" pins={[{ x: 86, y: 41, label: "포토부스", tone: "teal" }]} />
      </div>
      <p className="cn-copy cn-in" style={{ "--d": 4 }}>
        2026 아주대학교 가을축제 <span className="cn-nowrap">&lt;바람&gt;은</span> 포토부스와 함께합니다!
        <br />
        바람 프레임과 함께 축제를 즐겨봐요!
      </p>
    </GlassCard>
  );
}

export function PhotoFramePage() {
  const [count, setCount] = useState(0);
  const [shot, setShot] = useState(0);

  useEffect(() => {
    if (!count) return undefined;
    const timer = window.setTimeout(() => {
      if (count === 1) {
        setCount(0);
        setShot(Date.now());
        vibrate([6, 30, 20]);
      } else {
        setCount(count - 1);
        vibrate(5);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [count]);

  return (
    <GlassCard title="포토 프레임" seed={101}>
      <div className="cn-frames cn-in" style={{ "--d": 1 }}>
        <img key={shot || "still"} className={shot ? "is-shot" : ""} src={img("photo-frames")} alt="바람 포토 프레임 2종(세로 네 컷, 네 칸 엽서형)" draggable="false" />
        {count ? (
          <span key={count} className="cn-frames__count" aria-live="polite">
            {count}
          </span>
        ) : null}
        {shot ? <span key={shot} className="cn-frames__flash" aria-hidden="true" /> : null}
      </div>
      <button type="button" className="cn-shutter cn-in" style={{ "--d": 2 }} onClick={() => !count && setCount(3)} aria-label="찰칵 찍어 보기">
        <span />
      </button>
      <p className="cn-note cn-in" style={{ "--d": 3 }}>
        {shot && !count ? "찰칵! 진짜 사진은 도서관 주차장 포토부스에서" : "셔터를 눌러 보세요"}
      </p>
    </GlassCard>
  );
}

/* ================= 주류 ================= */
export function BarRulesPage() {
  const [answer, setAnswer] = useState(null);
  return (
    <GlassCard title="주류 관련 유의 사항" seed={103}>
      <div className="cn-in" style={{ "--d": 1 }}>
        <PinMap src={img("bar-map")} ratio={900 / 615} alt="성호관 앞 주간부스와 푸드트럭·플리마켓 지도" zoomable />
      </div>
      <dl className="cn-blocks cn-blocks--tight">
        <div className="cn-in" style={{ "--d": 2 }}>
          <dt>운영장소</dt>
          <dd>{BAR.place}</dd>
        </div>
        <div className="cn-in" style={{ "--d": 3 }}>
          <dt>주류 판매 시간</dt>
          <dd>{BAR.hours}</dd>
        </div>
        <div className="cn-in" style={{ "--d": 4 }}>
          <dt>주류 관련 안내</dt>
          <dd className="cn-dd--small">
            {BAR.rule}
            <br />
            {BAR.rule2}
          </dd>
        </div>
      </dl>
      <div className="cn-quiz cn-in" style={{ "--d": 5 }}>
        <span className="cn-quiz__q">외부에서 가져온 술, 이 병은 괜찮을까요?</span>
        <div className="cn-quiz__row">
          {[
            ["pet", "페트병"],
            ["glass", "유리병"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`cn-bottle cn-bottle--${key}${answer === key ? " is-on" : ""}`}
              onClick={() => {
                setAnswer(key);
                vibrate(key === "glass" ? [12, 40, 12] : 8);
              }}
            >
              <svg viewBox="0 0 32 48" aria-hidden="true">
                {key === "pet" ? (
                  <path d="M12 3h8v5c4 3 6 6 6 11v24a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V19c0-5 2-8 6-11zM6 24h20M6 34h20" {...itemStroke} strokeWidth="2" />
                ) : (
                  <path d="M13 3h6v10l4 6v24a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V19l4-6zM9 27h14" {...itemStroke} strokeWidth="2" />
                )}
              </svg>
              {label}
              {answer === key ? (
                <em className={`cn-bottle__verdict cn-bottle__verdict--${key}`}>{key === "pet" ? "OK" : "회수"}</em>
              ) : null}
            </button>
          ))}
        </div>
        {answer ? (
          <p className="cn-quiz__a" role="status">
            {answer === "pet" ? "페트병은 괜찮아요." : "유리병은 안전상 반입 금지, 적발 시 회수돼요."}
          </p>
        ) : null}
      </div>
    </GlassCard>
  );
}
