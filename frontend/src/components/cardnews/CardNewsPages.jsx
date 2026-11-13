// 카드뉴스 한 장 한 장. 원본 카드의 배치(유리 카드 · 제목 상자 · 총학 로고)를 지키고, 그림마다 눌러 볼 거리를 붙였다.
import { useEffect, useMemo, useRef, useState } from "react";
import { CARD_NEWS_IMG, CONTACTS, GOODS, MAIN_BOOTH } from "../../data/cardNews";
import { AusumLogo, BOOTH_GROUPS, BoothMap, CnIcon, OutlineText, Roulette, StarDust } from "./CardNewsArt";

const img = (name) => `${CARD_NEWS_IMG}/${name}.webp`;

export function vibrate(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 진동이 없는 기기는 조용히 넘어간다.
  }
}

/* ---------- 유리 카드 틀 ----------
 * 짧은 화면에서 내용이 넘치면 카드 안에서 스크롤되고, 끝에 닿기 전까지 아래쪽이 살짝 흐려진다.
 */
function useOverflowFade() {
  const ref = useRef(null);
  const [state, setState] = useState({ scrollable: false, end: true });
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const check = () => {
      const scrollable = node.scrollHeight > node.clientHeight + 4;
      const end = node.scrollTop + node.clientHeight >= node.scrollHeight - 4;
      setState((prev) => (prev.scrollable === scrollable && prev.end === end ? prev : { scrollable, end }));
    };
    // 눌러서 내용이 늘어나는 장(확인 완료 문구 등)이 있어 누른 뒤에도 한 번 더 잰다.
    const later = () => window.setTimeout(check, 450);
    check();
    node.addEventListener("scroll", check, { passive: true });
    node.addEventListener("click", later);
    node.addEventListener("load", check, true);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(check) : null;
    observer?.observe(node);
    return () => {
      node.removeEventListener("scroll", check);
      node.removeEventListener("click", later);
      node.removeEventListener("load", check, true);
      observer?.disconnect();
    };
  }, []);
  const className = `${state.scrollable ? " is-scrollable" : ""}${state.end ? " is-end" : ""}`;
  return [ref, className];
}

export function GlassCard({ eyebrow, title, children, seed = 3, className = "" }) {
  const [bodyRef, bodyClass] = useOverflowFade();
  return (
    <article className={`cn-card ${className}`}>
      <div className="cn-card__paper" aria-hidden="true" />
      <StarDust seed={seed} dust={60} glow={5} className="cn-card__stars" />
      <header className="cn-card__brand">
        <span>2026 아주대학교 가을축제</span>
        <b>바람</b>
      </header>
      {title ? (
        <div className="cn-card__title cn-in" style={{ "--d": 0 }}>
          {eyebrow ? <small>{eyebrow}</small> : null}
          <h2>{title}</h2>
        </div>
      ) : null}
      <div className={`cn-card__body${bodyClass}`} ref={bodyRef}>
        {children}
      </div>
      <footer className="cn-card__foot">
        <AusumLogo />
      </footer>
    </article>
  );
}

export function InfoRows({ rows }) {
  return (
    <dl className="cn-rows">
      {rows.map(([label, value], index) => (
        <div key={label} className="cn-rows__row cn-in" style={{ "--d": index + 1 }}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* 지금 부스가 열려 있는지: 10.07·10.08 10:00~17:00 */
function useBoothStatus() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return useMemo(() => {
    const at = (day, time) => new Date(`${day}T${time}:00`);
    for (const day of MAIN_BOOTH.days) {
      const open = at(day, MAIN_BOOTH.open);
      const close = at(day, MAIN_BOOTH.close);
      if (now < open) {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const days = Math.round((new Date(`${day}T00:00:00`) - today) / 86400000);
        if (days > 0) return { tone: "soon", text: `D-${days} · ${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일 오전 10시에 열어요` };
        return { tone: "soon", text: "오늘 오전 10시에 열어요" };
      }
      if (now <= close) return { tone: "live", text: "지금 운영 중 · 오후 5시까지" };
    }
    return { tone: "done", text: "올해 부스 운영을 마쳤어요" };
  }, [now]);
}

function StatusPill() {
  const status = useBoothStatus();
  return (
    <p className={`cn-status cn-status--${status.tone} cn-in`} style={{ "--d": 4 }}>
      <i aria-hidden="true" />
      {status.text}
    </p>
  );
}

/* ================= 표지: 카메라 뷰파인더 ================= */
const MODES = ["Short video", "Video", "Photo", "Portrait", "1:1"];
const ZOOMS = [
  [".5", 0.82],
  ["1×", 1],
  ["2", 1.45],
];

export function CoverPage({ set, active, onMenu, onFilter }) {
  const [flash, setFlash] = useState(false);
  const [flashBurst, setFlashBurst] = useState(0);
  const [hdr, setHdr] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState("Photo");
  const [exposure, setExposure] = useState(0);
  const [focus, setFocus] = useState({ x: 30, y: 27, key: 0 });
  const [recSeconds, setRecSeconds] = useState(0);
  const dragRef = useRef(null);
  const recording = mode === "Video" || mode === "Short video";
  const cover = set.cover || { lines: [set.title], date: "" };
  // 작게 쓰는 줄(with 같은 것)은 글자 크기를 정할 때 세지 않는다.
  const longest = Math.max(...cover.lines.filter((line) => !cover.small?.includes(line)).map((line) => line.length));

  useEffect(() => {
    if (!recording || !active) return undefined;
    setRecSeconds(0);
    const timer = window.setInterval(() => setRecSeconds((s) => (mode === "Short video" && s >= 15 ? 0 : s + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [recording, active, mode]);

  function tapFocus(event) {
    if (event.target.closest("button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setFocus({ x: Math.min(Math.max(x, 16), 84), y: Math.min(Math.max(y, 14), 80), key: Date.now() });
    setExposure(0);
    if (flash) setFlashBurst(Date.now());
    vibrate(6);
  }

  function startExposure(event) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { y: event.clientY, start: exposure };
  }
  function moveExposure(event) {
    if (!dragRef.current) return;
    const next = dragRef.current.start - (event.clientY - dragRef.current.y) / 90;
    setExposure(Math.max(-1, Math.min(1, next)));
  }
  function endExposure() {
    dragRef.current = null;
  }

  const clock = `${String(Math.floor(recSeconds / 60)).padStart(2, "0")}:${String(recSeconds % 60).padStart(2, "0")}`;

  return (
    <div className={`cn-cover cn-cover--${mode.replace(/[^a-z0-9]/gi, "").toLowerCase()}${hdr ? " is-hdr" : ""}${cover.photo ? " cn-cover--poster" : ""}`}>
      <div className="cn-cover__bar">
        <button type="button" aria-label={flash ? "플래시 끄기" : "플래시 켜기"} onClick={() => setFlash((v) => !v)} className={flash ? "is-on" : ""}>
          {flash ? <CnIcon.flashOn /> : <CnIcon.flash />}
        </button>
        <button type="button" aria-label="HDR" onClick={() => setHdr((v) => !v)} className={hdr ? "is-on" : ""}>
          <CnIcon.hdr off={!hdr} className="cn-cover__hdr" />
        </button>
        <button type="button" aria-label="필터 바꾸기" onClick={onFilter}>
          <CnIcon.filters />
        </button>
        <button type="button" aria-label="목록" onClick={onMenu}>
          <CnIcon.menu />
        </button>
      </div>

      <div className="cn-vf" onClick={tapFocus}>
        <div
          className="cn-vf__scene"
          style={{ transform: `scale(${zoom})`, filter: `brightness(${1 + exposure * 0.28}) saturate(${hdr ? 1.25 : 1}) contrast(${hdr ? 1.08 : 1})` }}
        >
          {cover.photo ? (
            <>
              {/* 포스터가 잘리지 않게 통째로 넣고, 남는 위아래는 흐린 포스터로 채운다 */}
              <span className="cn-vf__photoblur" style={{ backgroundImage: `url(${img(cover.thumb || cover.photo)})` }} aria-hidden="true" />
              <img className="cn-vf__photo" src={img(cover.photo)} alt={`${set.title} 포스터`} draggable="false" />
            </>
          ) : (
            <>
              <div className="cn-vf__paper" aria-hidden="true" />
              <StarDust seed={11} dust={110} glow={9} className="cn-vf__stars" />
            </>
          )}
        </div>
        <div className="cn-vf__grid" aria-hidden="true">
          <i /><i /><i /><i />
        </div>

        {recording ? (
          <span className="cn-vf__rec">
            <i /> REC {clock}
          </span>
        ) : null}

        <div className="cn-vf__brand cn-in" style={{ "--d": 0 }}>
          <span>2026 아주대학교 가을축제</span>
          <b>바람</b>
        </div>

        <div className="cn-vf__subject" style={{ left: `${focus.x}%`, top: `${focus.y}%` }}>
          <img className="cn-vf__bird" src={img("bird")} alt="" draggable="false" style={{ transform: `scale(${zoom})` }} />
          <span key={focus.key} className="cn-vf__focus" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <span
            className="cn-vf__sun"
            role="slider"
            aria-label="밝기"
            aria-valuemin={-1}
            aria-valuemax={1}
            aria-valuenow={Math.round(exposure * 10) / 10}
            tabIndex={0}
            onPointerDown={startExposure}
            onPointerMove={moveExposure}
            onPointerUp={endExposure}
            onPointerCancel={endExposure}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") setExposure((v) => Math.min(1, v + 0.1));
              if (event.key === "ArrowDown") setExposure((v) => Math.max(-1, v - 0.1));
            }}
            style={{ "--ev": exposure }}
          >
            <b className="cn-vf__track" aria-hidden="true" />
            <CnIcon.sun />
          </span>
        </div>

        <div className={`cn-vf__title${cover.lines.length > 1 || Array.isArray(cover.sub) ? " cn-vf__title--two" : ""}${cover.lines.length > 3 ? " cn-vf__title--tall" : ""}`}>
          <h2 className="cn-vf__lines" style={{ "--len": longest }}>
            {cover.lines.map((line) => (
              <OutlineText key={line} className={`cn-vf__line${cover.small?.includes(line) ? " cn-vf__line--small" : ""}`}>
                {line}
              </OutlineText>
            ))}
          </h2>
          {Array.isArray(cover.sub) ? (
            <span className="cn-vf__subs">
              {cover.sub.map((line) => (
                <OutlineText key={line} className="cn-vf__sub cn-vf__sub--long">
                  {line}
                </OutlineText>
              ))}
            </span>
          ) : cover.sub ? (
            <OutlineText className="cn-vf__sub">{cover.sub}</OutlineText>
          ) : null}
          <OutlineText as="p" className="cn-vf__date">
            {cover.date}
          </OutlineText>
        </div>

        <div className="cn-vf__zoom" role="group" aria-label="확대">
          {ZOOMS.map(([label, value]) => (
            <button
              key={label}
              type="button"
              className={zoom === value ? "is-on" : ""}
              onClick={(event) => {
                event.stopPropagation();
                setZoom(value);
                vibrate(5);
              }}
            >
              {zoom === value ? label : label.replace("×", "")}
            </button>
          ))}
        </div>

        <div className="cn-vf__foot">
          <AusumLogo />
        </div>

        {flashBurst ? <span key={flashBurst} className="cn-vf__flash" aria-hidden="true" /> : null}
        <span className="cn-vf__hint" aria-hidden="true">
          넘겨 보기 <CnIcon.arrow />
        </span>
      </div>

      <div className="cn-cover__modes" role="tablist" aria-label="촬영 모드">
        {MODES.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={mode === name} className={mode === name ? "is-on" : ""} onClick={() => setMode(name)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================= 총학생회 부스 안내 ================= */
export function BoothMapPage() {
  const [focus, setFocus] = useState(null);
  const [picked, setPicked] = useState(null);

  function pickGroup(key) {
    setFocus((current) => (current === key ? null : key));
    setPicked(focus === key ? null : BOOTH_GROUPS[key].ids[0]);
    vibrate();
  }

  return (
    <GlassCard title="총학생회 부스 안내" seed={5}>
      <InfoRows rows={[["운영 장소", MAIN_BOOTH.place], ["운영 일자", MAIN_BOOTH.dates], ["운영 시간", MAIN_BOOTH.hours]]} />
      <div className="cn-mapbox cn-in" style={{ "--d": 5 }}>
        <StatusPill />
        <div className="cn-chips">
          {Object.entries(BOOTH_GROUPS).map(([key, group]) => (
            <button key={key} type="button" className={`cn-chip cn-chip--${key}${focus === key ? " is-on" : ""}`} onClick={() => pickGroup(key)}>
              <i aria-hidden="true" />
              {group.short}
            </button>
          ))}
        </div>
        <BoothMap focus={focus} selected={picked} onSelect={(id) => setPicked((current) => (current === id ? null : id))} />
      </div>
      <p className="cn-copy cn-copy--sm cn-in" style={{ "--d": 7 }}>
        <b>총학생회 메인부스</b>는 <b>주간부스 1, 2번 부스</b>에서 만나볼 수 있습니다.
        <br />
        <b>‘SUM주팔자’ 부스</b>는 <b>주간부스 3, 4번 부스</b>에서 만나볼 수 있습니다.
      </p>
    </GlassCard>
  );
}

/* ================= 가을축제 굿즈(한눈에) =================
 * 원본 배치 그대로: 네이비 티셔츠(왼쪽 위) · 화이트 티셔츠(오른쪽 아래로 겹침) · 키링(왼쪽 아래) · 가격표 두 개.
 * 티셔츠를 누르면 앞뒤 순서가 바뀌고, 키링을 누르면 흔들린다. 가격표는 굿즈 안내의 해당 장으로 넘어간다.
 */
export function GoodsPage({ onJump }) {
  const [front, setFront] = useState("white");
  const [swing, setSwing] = useState(0);
  const shuffle = (color) => {
    setFront(color === front ? (color === "navy" ? "white" : "navy") : color);
    vibrate();
  };
  return (
    <GlassCard eyebrow="총학생회 메인부스" title="가을축제 굿즈" seed={8}>
      <div className={`cn-goods cn-goods--front-${front}`}>
        <button type="button" className="cn-goods__tee cn-goods__tee--navy cn-in" style={{ "--d": 1 }} onClick={() => shuffle("navy")} aria-label="네이비 티셔츠 앞으로">
          <img src={img("tee-navy")} alt="네이비 치토 티셔츠 앞·뒤" draggable="false" />
        </button>
        <button type="button" className="cn-goods__tee cn-goods__tee--white cn-in" style={{ "--d": 2 }} onClick={() => shuffle("white")} aria-label="화이트 티셔츠 앞으로">
          <img src={img("tee-white")} alt="화이트 치토 티셔츠 앞·뒤" draggable="false" />
        </button>
        <button type="button" className="cn-callout cn-callout--tee cn-in" style={{ "--d": 3 }} onClick={() => onJump?.("goods", "tee")}>
          <span>굿즈 티셔츠 - 2color</span>
          <b>{GOODS.tee.price}</b>
        </button>
        <button
          type="button"
          className="cn-goods__ring cn-in"
          style={{ "--d": 4 }}
          onClick={() => {
            setSwing(Date.now());
            vibrate();
          }}
          aria-label="키링 흔들어 보기"
        >
          <img key={swing} className={swing ? "is-swing" : ""} src={img("keyring")} alt="치토 키캡 키링 4구" draggable="false" />
        </button>
        <button type="button" className="cn-callout cn-callout--ring cn-in" style={{ "--d": 5 }} onClick={() => onJump?.("goods", "keyring")}>
          <span>키캡 키링 4구</span>
          <b>{GOODS.keyring.price}</b>
        </button>
      </div>
      <p className="cn-copy cn-in" style={{ "--d": 6 }}>
        2026 아주대학교 가을축제 <span className="cn-nowrap">&lt;바람&gt;의</span> 굿즈 배부 및 판매가 총학생회 메인부스 (성호관 잔디밭 1, 2번 부스)에서 이루어집니다!
      </p>
      <p className="cn-copy cn-in" style={{ "--d": 7 }}>
        <span className="cn-nowrap">&lt;바람&gt;의</span> 굿즈와 함께 더욱 신나는 축제를 즐겨보세요!
      </p>
    </GlassCard>
  );
}

/* ================= 리플렛 ================= */
export function LeafletPage({ onSchedule }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [zoomed, setZoomed] = useState(false);
  function move(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -y * 14, y: x * 18 });
  }
  return (
    <GlassCard eyebrow="총학생회 메인부스" title="리플렛" seed={13}>
      <button
        type="button"
        className="cn-leaflet cn-in"
        style={{ "--d": 1 }}
        onPointerMove={move}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        onClick={() => setZoomed(true)}
        aria-label="리플렛 크게 보기"
      >
        <img src={img("leaflet")} alt="가을축제 바람 리플렛" draggable="false" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }} />
        <span className="cn-leaflet__zoom">눌러서 크게 보기</span>
      </button>
      <p className="cn-copy cn-in" style={{ "--d": 2 }}>
        총학생회 메인부스에서 2026 아주대학교 가을축제 <span className="cn-nowrap">&lt;바람&gt;의</span> 부스팀, 공연팀, 아티스트까지 확인 가능한 리플렛을 배부합니다.
      </p>
      <button type="button" className="cn-cta cn-in" style={{ "--d": 3 }} onClick={onSchedule}>
        앱에서 공연 시간표 보기 <CnIcon.arrow />
      </button>
      {zoomed ? (
        <div className="cn-zoom" role="dialog" aria-label="리플렛 크게 보기" onClick={() => setZoomed(false)}>
          <div className="cn-zoom__scroll" onClick={(event) => event.stopPropagation()}>
            <img src={img("leaflet")} alt="가을축제 바람 리플렛" />
          </div>
          <button type="button" className="cn-zoom__close" aria-label="닫기" onClick={() => setZoomed(false)}>
            <CnIcon.close />
          </button>
          <p className="cn-zoom__hint">옆으로 밀어서 보세요</p>
        </div>
      ) : null}
    </GlassCard>
  );
}

/* ================= 타투스티커 =================
 * 손가락(마우스)을 따라 스티커 위로 반짝이는 빛이 지나간다. 누르면 살짝 떠올랐다 내려앉는다.
 */
export function TattooPage() {
  const [shine, setShine] = useState({ x: 30, y: 20 });
  const [lift, setLift] = useState(0);
  function move(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    setShine({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
  }
  return (
    <GlassCard eyebrow="총학생회 메인부스" title="타투스티커" seed={17}>
      <button
        type="button"
        className="cn-tattoo cn-in"
        style={{ "--d": 1, "--sx": `${shine.x}%`, "--sy": `${shine.y}%` }}
        onPointerMove={move}
        onClick={() => {
          setLift(Date.now());
          vibrate();
        }}
        aria-label="타투스티커 2종"
      >
        <span key={lift} className={`cn-tattoo__stack${lift ? " is-lift" : ""}`}>
          <img src={img("tattoo")} alt="치토 타투스티커 2종" draggable="false" />
          <span className="cn-tattoo__shine" aria-hidden="true" />
        </span>
      </button>
      <span className="cn-tag cn-in" style={{ "--d": 2 }}>
        타투스티커 2종
      </span>
      <p className="cn-copy cn-in" style={{ "--d": 3 }}>
        아주대학교 공식 마스코트 ‘치토’를 담은 타투스티커와 함께 알찬 축제를 즐겨보세요! 타투스티커는 <b>학생증 확인 후 총학생회 메인부스에서 수령 가능</b>합니다
      </p>
    </GlassCard>
  );
}

/* ================= 바람을 묶다 & 스탬프 미션 ================= */
export function WishStampPage() {
  const [gust, setGust] = useState(0);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState("");

  function spin() {
    if (spinning) return;
    setResult("");
    setSpinning(true);
    vibrate(12);
    setAngle((current) => current + 1440 + Math.floor(Math.random() * 360));
    window.setTimeout(() => {
      setSpinning(false);
      setResult("꽝 없음! 진짜 선물은 메인부스에서");
      vibrate([10, 40, 10]);
    }, 3300);
  }

  return (
    <GlassCard eyebrow="총학생회 메인부스" title="바람을 묶다 & 스탬프 미션" seed={19} className="cn-card--wide-title">
      <div className="cn-duo">
        <button
          type="button"
          className="cn-panel cn-in"
          style={{ "--d": 1 }}
          onClick={() => {
            setGust(Date.now());
            vibrate();
          }}
        >
          <span className="cn-panel__art cn-panel__art--ribbon">
            <img key={gust} className={gust ? "is-gust" : ""} src={img("ribbon")} alt="바람을 묶다 리본" draggable="false" />
          </span>
          <strong>바람을 묶다</strong>
          <span>
            리본에 나만의 소원과 바람을 적어 걸어주세요.
          </span>
          <span>
            여러분의 바람이 이루어지길 바랍니다.
          </span>
        </button>
        <button type="button" className="cn-panel cn-in" style={{ "--d": 2 }} onClick={spin} aria-label="돌림판 돌려 보기">
          <span className="cn-panel__art">
            <Roulette angle={angle} spinning={spinning} />
            {result ? <em className="cn-panel__result">{result}</em> : null}
          </span>
          <strong>스탬프 미션</strong>
          <span>
            축제 곳곳의 프로그램에 참여하고 스탬프를 모아보세요!
          </span>
          <span>
            미션을 완성하면 꽝 없는 돌림판으로 특별한 선물을 드립니다.
          </span>
        </button>
      </div>
      <p className="cn-note cn-in" style={{ "--d": 3 }}>
        리본을 누르면 바람이 불고, 돌림판을 누르면 돌아가요
      </p>
    </GlassCard>
  );
}

/* ================= SUM주팔자 ================= */
const SCREENS = ["screen1", "screen2", "screen3"];

export function SumSajuPage({ onGo }) {
  const [center, setCenter] = useState(1);
  return (
    <GlassCard eyebrow="총학생회 소개팅 부스" title="SUM주팔자" seed={23}>
      <div className="cn-screens cn-in" style={{ "--d": 1 }}>
        {SCREENS.map((name, index) => {
          const pos = index - center;
          return (
            <button
              key={name}
              type="button"
              className={`cn-screens__item${pos === 0 ? " is-center" : ""}`}
              style={{ "--pos": pos }}
              onClick={() => {
                if (pos === 0) onGo?.();
                else setCenter(index);
              }}
              aria-label={pos === 0 ? "AI 사주 소개팅 열기" : "이 화면 보기"}
            >
              <img src={img(name)} alt="" draggable="false" />
            </button>
          );
        })}
      </div>
      <p className="cn-copy cn-copy--lg cn-in" style={{ "--d": 2 }}>
        익명 채팅으로 시작되는 두근두근 소개팅!
        <br />
        사주로 오늘의 인연과 궁합까지 확인해보세요.
      </p>
      <button type="button" className="cn-cta cn-cta--solid cn-in" style={{ "--d": 3 }} onClick={onGo}>
        AI 사주 소개팅 하러 가기 <CnIcon.arrow />
      </button>
    </GlassCard>
  );
}

/* ================= 문의 ================= */
export function ContactPage() {
  return (
    <GlassCard seed={29} className="cn-card--contact">
      <div className="cn-contact">
        <p className="cn-contact__msg cn-in" style={{ "--d": 0 }}>
          제45대 총학생회 &lt;AU:SUM&gt;은
          <br />
          성공적인 가을축제 <span className="cn-nowrap">&lt;바람&gt;을</span>
          <br />
          만들기 위해 노력하겠습니다.
        </p>
        <p className="cn-contact__head cn-in" style={{ "--d": 1 }}>
          &lt; 문의 사항 &gt;
        </p>
        <ul className="cn-contact__list">
          {CONTACTS.map((person, index) => (
            <li key={person.phone} className="cn-in" style={{ "--d": index + 2 }}>
              <a href={`tel:${person.phone.replace(/-/g, "")}`}>
                <span>
                  <small>{person.role}</small>
                  <b>{person.name}</b>
                </span>
                <em>{person.phone}</em>
                <i aria-hidden="true">
                  <CnIcon.phone />
                </i>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </GlassCard>
  );
}

/* ================= 판매 위치 안내(굿즈) ================= */
export function GoodsPlacePage() {
  const [picked, setPicked] = useState(null);
  return (
    <GlassCard title="판매 위치 안내" seed={31}>
      <InfoRows rows={[["판매 장소", MAIN_BOOTH.placeLong], ["운영 일자", MAIN_BOOTH.dates], ["운영 시간", MAIN_BOOTH.hours]]} />
      <StatusPill />
      <div className="cn-mapbox cn-in" style={{ "--d": 5 }}>
        <BoothMap highlight={["main"]} tone="teal" label="총학생회 부스" selected={picked} onSelect={(id) => setPicked((current) => (current === id ? null : id))} />
      </div>
      <p className="cn-note cn-in" style={{ "--d": 6 }}>
        부스를 누르면 이름이 떠요
      </p>
    </GlassCard>
  );
}

/* ================= 치토 티셔츠 =================
 * 원본처럼 왼쪽에 네이비·화이트, 오른쪽에 앞면·뒷면 프린팅. 색을 고르고 프린팅을 누르면 옷 위 자리가 빛난다.
 */
const PRINT_SPOT = { front: { x: 38, y: 35, r: 8 }, back: { x: 70, y: 55, r: 19 } };

export function TeePage() {
  const [color, setColor] = useState("navy");
  const [side, setSide] = useState("back");
  const spot = PRINT_SPOT[side];
  return (
    <GlassCard title="치토 티셔츠 - 2color" seed={37}>
      <div className="cn-frame cn-tee cn-in" style={{ "--d": 1 }}>
        <div className="cn-tee__shirts">
          {[
            ["navy", "네이비"],
            ["white", "화이트"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`cn-tee__pair${color === key ? " is-on" : ""}`}
              onClick={() => {
                setColor(key);
                vibrate();
              }}
              aria-pressed={color === key}
              aria-label={`${label} 티셔츠`}
            >
              <img src={img(`tee-${key}`)} alt={`${label} 티셔츠 앞·뒤`} draggable="false" />
              {color === key ? (
                <span key={side} className="cn-tee__spot" style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.r * 2}%` }} aria-hidden="true" />
              ) : null}
              <em className="cn-tee__name">{label}</em>
            </button>
          ))}
        </div>
        <div className="cn-tee__prints">
          {[
            ["front", "앞면 프린팅", "print-front"],
            ["back", "뒷면 프린팅", "print-back"],
          ].map(([key, label, file]) => (
            <button
              key={key}
              type="button"
              className={`cn-tee__print cn-tee__print--${key}${side === key ? " is-on" : ""}`}
              onClick={() => {
                setSide(key);
                vibrate();
              }}
              aria-pressed={side === key}
            >
              <span className="cn-tee__art">
                <img src={img(file)} alt={`${label} 그림`} draggable="false" />
              </span>
              <span className="cn-tee__label">▶ {label}</span>
            </button>
          ))}
        </div>
      </div>
      <span className="cn-tag cn-in" style={{ "--d": 2 }}>
        {GOODS.tee.name}
      </span>
      <p className="cn-price cn-in" style={{ "--d": 3 }}>
        {GOODS.tee.price}
      </p>
    </GlassCard>
  );
}

/* ================= 치토 키캡 키링 ================= */
const CAPS = [
  ["cap-squirrel", "첫 번째 키캡"],
  ["cap-flame", "두 번째 키캡"],
  ["cap-sprout", "세 번째 키캡"],
  ["cap-au", "AU 로고 키캡"],
];

export function KeyringPage() {
  const [pressed, setPressed] = useState(null);
  const [clicks, setClicks] = useState([]);
  const [swing, setSwing] = useState(0);

  function press(index) {
    setPressed(index);
    vibrate(10);
    const id = Date.now();
    setClicks((list) => [...list.slice(-3), { id, index }]);
    window.setTimeout(() => setClicks((list) => list.filter((c) => c.id !== id)), 900);
  }

  return (
    <GlassCard title="치토 키캡 키링 4구" seed={41}>
      <div className="cn-frame cn-ring cn-in" style={{ "--d": 1 }}>
        <button
          type="button"
          className="cn-ring__photo"
          onClick={() => {
            setSwing(Date.now());
            vibrate();
          }}
          aria-label="키링 흔들어 보기"
        >
          <img key={swing} className={swing ? "is-swing" : ""} src={img("keyring")} alt="치토 키캡 키링 4구" draggable="false" />
        </button>
        <div className="cn-ring__caps" aria-label="디자인 상세 — 키캡을 눌러 보세요">
          {CAPS.map(([file, name], index) => (
            <button
              key={file}
              type="button"
              className={`cn-cap${pressed === index ? " is-down" : ""}`}
              onPointerDown={() => press(index)}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed((p) => (p === index ? null : p))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") press(index);
              }}
              onKeyUp={() => setPressed(null)}
              aria-label={name}
            >
              <span className="cn-cap__top">
                <img src={img(file)} alt="" draggable="false" />
              </span>
              {clicks
                .filter((c) => c.index === index)
                .map((c) => (
                  <em key={c.id} className="cn-cap__pop">
                    딸깍
                  </em>
                ))}
            </button>
          ))}
        </div>
        <span className="cn-ring__label">
          ▶ 디자인 상세
          <small>키캡을 눌러 보세요</small>
        </span>
      </div>
      <span className="cn-tag cn-in" style={{ "--d": 2 }}>
        {GOODS.keyring.name}
      </span>
      <p className="cn-price cn-in" style={{ "--d": 3 }}>
        {GOODS.keyring.price}
      </p>
    </GlassCard>
  );
}
