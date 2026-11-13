// 스태프 화면 공용 조각: 아이콘 · 아바타 · 바텀시트.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deptColor, givenName, statusOf } from "./crewUtils";

function Svg({ children, size = 20, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const Icon = {
  phone: (p) => <Svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></Svg>,
  message: (p) => <Svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></Svg>,
  search: (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>,
  close: (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>,
  plus: (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  edit: (p) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></Svg>,
  pin: (p) => <Svg {...p}><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></Svg>,
  clock: (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>,
  users: (p) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></Svg>,
  me: (p) => <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="3" /><circle cx="12" cy="10" r="3" /><path d="M8 17a4 4 0 0 1 8 0" /></Svg>,
  book: (p) => <Svg {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></Svg>,
  grid: (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 10h18M9 4v16" /></Svg>,
  copy: (p) => <Svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Svg>,
  trash: (p) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>,
  swap: (p) => <Svg {...p}><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></Svg>,
  history: (p) => <Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></Svg>,
  chevron: (p) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>,
  megaphone: (p) => <Svg {...p}><path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1Z" /><path d="M17 8a5 5 0 0 1 0 8" /></Svg>,
  logout: (p) => <Svg {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" /></Svg>,
};

// 상태 아이콘: 깃발(일) · 그릇(밥) · 책(수업) · 컵(쉼) · 집(퇴근)
export function StatusIcon({ status, size = 20 }) {
  switch (status) {
    case "WORKING":
      return <Svg size={size}><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></Svg>;
    case "EATING":
      return <Svg size={size}><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3" /></Svg>;
    case "CLASS":
      return <Svg size={size}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></Svg>;
    case "RESTING":
      return <Svg size={size}><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" /><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M9 3v3M12 3v3" /></Svg>;
    case "OFF":
      return <Svg size={size}><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></Svg>;
    default:
      return <Svg size={size}><circle cx="12" cy="12" r="8" strokeDasharray="3 3" /></Svg>;
  }
}

/** 국 색 동그라미에 이름 두 글자. 상태가 있으면 오른쪽 아래에 상태 점. */
export function Avatar({ member, name, size = 40, showStatus = true }) {
  const label = member?.name || name || "?";
  const status = member ? statusOf(member.status) : null;
  return (
    <span className="crew-avatar" style={{ "--size": `${size}px`, "--dept": deptColor(member?.dept) }} aria-hidden="true">
      <span className="crew-avatar__text">{givenName(label)}</span>
      {showStatus && status?.key ? <span className="crew-avatar__dot" style={{ background: status.color }} /> : null}
    </span>
  );
}

/** 이름 칩. 누르면 그 사람 카드가 열린다. 내 이름이면 강조. */
export function NameChip({ name, member, me, onOpen, clash, tag }) {
  const status = member ? statusOf(member.status) : null;
  return (
    <button
      type="button"
      className={`crew-chip${me ? " is-me" : ""}${member ? "" : " is-unknown"}${clash ? " is-clash" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.(name);
      }}
    >
      <span className="crew-chip__dot" style={{ background: status?.key ? status.color : "transparent" }} />
      {name}
      {tag ? <em className="crew-chip__tag">{tag}</em> : null}
    </button>
  );
}

/** 얼굴 칩: 국 색 동그라미(+상태 점) 와 이름. 시간표 줄처럼 사람이 주인공인 곳에 쓴다. */
export function PersonChip({ name, member, me, onOpen }) {
  return (
    <button
      type="button"
      className={`crew-pchip${me ? " is-me" : ""}${member ? "" : " is-unknown"}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.(name);
      }}
    >
      <Avatar member={member} name={name} size={24} />
      <span>{name}</span>
    </button>
  );
}

/** 이름 칩 여러 개. limit 를 넘으면 '+N명' 을 눌러 펼친다. */
export function NameChips({ names, byName, meName, onOpen, limit = 9, empty = null }) {
  const [open, setOpen] = useState(false);
  if (names.length === 0) return empty;
  const shown = open || names.length <= limit ? names : names.slice(0, limit - 1);
  return (
    <div className="crew-chips">
      {shown.map((name) => (
        <NameChip key={name} name={name} member={byName.get(name)} me={name === meName} onOpen={onOpen} />
      ))}
      {shown.length < names.length ? (
        <button type="button" className="crew-chip crew-chip--more" onClick={(event) => { event.stopPropagation(); setOpen(true); }}>
          +{names.length - shown.length}명
        </button>
      ) : null}
    </div>
  );
}

/** 아래에서 올라오는 시트. 닫힐 때도 내려가는 모습이 보이게 한 박자 둔다. */
export function Sheet({ open, onClose, title, children, tall = false }) {
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
    }, 220);
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

  if (!mounted) return null;
  return createPortal(
    <div className={`crew-sheet-layer${closing ? " is-closing" : ""}`}>
      <div className="crew-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section className={`crew-sheet${tall ? " crew-sheet--tall" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="crew-sheet__head">
          <h2>{title}</h2>
          <button type="button" className="crew-icon-btn" onClick={onClose} aria-label="닫기">
            <Icon.close size={18} />
          </button>
        </header>
        <div className="crew-sheet__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export function Chito({ src, className = "", alt = "" }) {
  const [current, setCurrent] = useState(src);
  useEffect(() => setCurrent(src), [src]);
  return (
    <img
      className={`crew-chito ${className}`}
      src={current}
      alt={alt}
      draggable="false"
      onError={() => {
        if (current !== "/images/chito.png") setCurrent("/images/chito.png");
      }}
    />
  );
}

/**
 * 더하기 · 지우기 · 바꾸기 전에 "이게 맞나요?"를 한 번 더 묻는 창.
 * const [ask, askNode] = useAsk(); if (!(await ask({ title, lines, note, confirmLabel, danger }))) return;
 * lines 는 [이름, 값] 묶음 — 무엇이 어떻게 되는지 그대로 보여 준다.
 */
export function useAsk() {
  const [request, setRequest] = useState(null);
  const ask = useCallback((options) => new Promise((resolve) => setRequest({ ...options, resolve })), []);
  const answer = useCallback((value) => {
    setRequest((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);
  const node = request ? createPortal(<AskDialog {...request} onAnswer={answer} />, document.body) : null;
  return [ask, node];
}

function AskDialog({ title, lines = [], note, confirmLabel = "확인", danger = false, onAnswer }) {
  const confirmRef = useRef(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onAnswer(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onAnswer]);

  return (
    <div className="crew-ask-layer" role="alertdialog" aria-modal="true" aria-labelledby="crew-ask-title">
      <div className="crew-ask-backdrop" onClick={() => onAnswer(false)} aria-hidden="true" />
      <div className={`crew-ask${danger ? " is-danger" : ""}`}>
        <span className="crew-ask__icon" aria-hidden="true">{danger ? <Icon.trash size={22} /> : <Icon.edit size={22} />}</span>
        <h2 id="crew-ask-title">{title}</h2>
        {lines.length ? (
          <dl className="crew-ask__lines">
            {lines.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {note ? <p className="crew-ask__note">{note}</p> : null}
        <div className="crew-ask__actions">
          <button type="button" className="crew-btn crew-btn--soft" onClick={() => onAnswer(false)}>취소</button>
          <button
            ref={confirmRef}
            type="button"
            className={`crew-btn ${danger ? "crew-btn--danger-solid" : "crew-btn--primary"}`}
            onClick={() => onAnswer(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
