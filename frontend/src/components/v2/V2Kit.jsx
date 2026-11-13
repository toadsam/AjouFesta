// ver2 공용 조각. 바텀시트, 토스트, 숫자 카운트업, 브랜드 마크, 아이콘 몇 개.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Reeds } from "../order/SkyReeds";

/* ---------- 아이콘 ---------- */
function svgProps(props) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function IconFlag(props) {
  return (
    <svg {...svgProps(props)}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

export function IconBeer(props) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 8h9v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z" />
      <path d="M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      <path d="M6 8a3 3 0 0 1 3-4 3 3 0 0 1 5 0 2.5 2.5 0 0 1 1 4" />
      <path d="M9 12v5M12 12v5" />
    </svg>
  );
}

export function IconHeartSaju(props) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      <path d="M12 7.4v5M9.8 9.9h4.4" strokeWidth="1.5" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconPhone(props) {
  return (
    <svg {...svgProps(props)}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function IconPlane(props) {
  return (
    <svg {...svgProps(props)}>
      <path d="M21 3 3 10.5l7.5 2.5L13 21l8-18z" />
      <path d="M10.5 13 21 3" />
    </svg>
  );
}

/** 포스터의 종이비행기. 히어로에 띄운다. */
export function PaperPlane({ className = "" }) {
  return (
    <svg viewBox="0 0 140 90" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 46 132 6 92 84 66 58z" fill="#f7f9fc" />
      <path d="M6 46 66 58 132 6z" fill="#e3e9f1" />
      <path d="M66 58 92 84 132 6z" fill="#ffffff" />
      <path d="M66 58 62 82 78 70z" fill="#cfd8e3" />
      <path d="M6 46 132 6M66 58 132 6M66 58 92 84" stroke="#b8c4d3" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

export function IconWind(props) {
  return (
    <svg {...svgProps(props)}>
      <path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 12h15a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 16h8a2 2 0 1 1-2 2" />
    </svg>
  );
}

/* ---------- 브랜드 ----------
 * 로고와 캐릭터는 여기서만 그린다. 아주대 마스코트 치토로 바꿀 때 이 컴포넌트만 바꾸면 된다.
 */
export function Brand({ caption = "아주대학교 축제" }) {
  return (
    <div className="v2-brand">
      <span className="v2-brand__mark">
        <IconPlane />
      </span>
      <span className="v2-brand__name">
        바람
        <small>{caption}</small>
      </span>
    </div>
  );
}

/** index.css 가 section 마다 z-index 스택을 만들어서, 시트와 토스트는 앱 껍데기 바로 아래에 그린다. */
function portalTarget() {
  if (typeof document === "undefined") return null;
  return document.querySelector(".app-shell") || document.body;
}

/**
 * 아주대 공식 마스코트 치토. 파일은 public/images/chito.png, chito-flame.png (출처: ajou.ac.kr 캐릭터 페이지).
 * 교내·비영리 용도로만 쓸 수 있다. 파일이 없으면 아무것도 그리지 않는다.
 */
export function Mascot({ kind = "chito", className = "", style }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  const src = kind === "flame" ? "/images/chito-flame.png" : "/images/chito.png";
  return <img className={`v2-mascot v2-mascot--${kind} ${className}`} src={src} alt="" style={style} onError={() => setOk(false)} />;
}

export function HeroReeds({ height = 120 }) {
  return (
    <div className="v2-hero__reeds">
      <Reeds height={height} />
    </div>
  );
}

/* ---------- 숫자 카운트업 ---------- */
export function CountUp({ value, duration = 700, suffix = "" }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return (
    <>
      {shown.toLocaleString("ko-KR")}
      {suffix}
    </>
  );
}

/* ---------- 토스트 ---------- */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(0);

  function show(text, tone = "default") {
    if (!text) return;
    window.clearTimeout(timerRef.current);
    setToast({ text, tone, key: Date.now() });
    timerRef.current = window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const target = portalTarget();
  const node = toast && target ? createPortal(
    <div key={toast.key} className="v2-toast" role="status" aria-live="polite">
      {toast.text}
    </div>,
    target,
  ) : null;

  return [show, node];
}

/* ---------- 바텀시트 ----------
 * 닫을 때도 내려가는 동작이 보이도록 closing 상태를 한 박자 둔다.
 */
export function BottomSheet({ open, onClose, title, description, children }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return undefined;
    }
    if (!mounted) return undefined;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [mounted, onClose]);

  const target = portalTarget();
  if (!mounted || !target) return null;

  return createPortal(
    <>
      <div
        className={`v2-sheet-backdrop${closing ? " v2-sheet-backdrop--closing" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        className={`v2-sheet${closing ? " v2-sheet--closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title ? <h2>{title}</h2> : null}
        {description ? <p>{description}</p> : null}
        {children}
      </section>
    </>,
    target,
  );
}
