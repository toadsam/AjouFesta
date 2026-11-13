// 테이블 자리 현황을 그림으로. 손님 주점 화면, 첫 화면 카드, 운영 콘솔이 같이 쓴다.
// 테이블마다 작은 테이블 그림(의자 개수 = 좌석 수)을 그리고 상태별로 색을 바꾼다. 스타일은 styles/v2-tables.css.
// collapsible 이면 띠와 범례만 남기고 그림을 접을 수 있다. 기본은 접힘(사용자 요청), 펼친 상태는 storageKey 로 기억한다.
import { useState } from "react";

function statusOf(table) {
  if (table?.occupancyStatus) return table.occupancyStatus;
  const seats = Number(table?.reservableSeats ?? table?.availableSeats);
  return seats > 0 ? "AVAILABLE" : "FULL";
}

const LABEL = { AVAILABLE: "빈 자리", IN_USE: "이용 중", RESERVED: "예약", FULL: "마감" };

/** 작은 테이블 그림. 의자를 위·아래로 나눠 앉힌다(최대 8개, 그 이상은 8개로 그린다). */
function TableIcon({ seats }) {
  const count = Math.max(1, Math.min(8, Number(seats) || 1));
  const top = Math.ceil(count / 2);
  const bottom = count - top;
  const w = 64;
  const chair = (n, y) =>
    Array.from({ length: n }, (_, i) => {
      const gap = w / (n + 1);
      return <rect key={`${y}-${i}`} x={gap * (i + 1) - 5} y={y} width="10" height="5" rx="2.5" className="v2-tmap__chair" />;
    });
  return (
    <svg viewBox="0 0 64 40" className="v2-tmap__icon" aria-hidden="true">
      {chair(top, 2)}
      <rect x="8" y="10" width="48" height="20" rx="7" className="v2-tmap__top" />
      {bottom > 0 && chair(bottom, 33)}
    </svg>
  );
}

function readOpen(storageKey, fallback) {
  if (!storageKey) return fallback;
  try {
    const saved = window.localStorage.getItem(`festflow_tmap_${storageKey}`);
    return saved == null ? fallback : saved === "1";
  } catch {
    return fallback;
  }
}

export function TableMap({ tables = [], compact = false, collapsible = false, defaultOpen = true, storageKey = "", toggleClass = "" }) {
  const [open, setOpen] = useState(() => readOpen(storageKey, defaultOpen));
  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      if (storageKey) window.localStorage.setItem(`festflow_tmap_${storageKey}`, next ? "1" : "0");
    } catch {
      // 저장 못 해도 동작에는 지장 없다
    }
  }

  const list = tables.map((table, index) => ({
    id: table.id ?? index,
    name: table.tableName || `테이블 ${index + 1}`,
    seats: Number(table.totalSeats) || Number(table.availableSeats) || 0,
    status: statusOf(table),
  }));
  const free = list.filter((t) => t.status === "AVAILABLE").length;
  const inUse = list.filter((t) => t.status === "IN_USE" || t.status === "FULL").length;
  const reserved = list.filter((t) => t.status === "RESERVED").length;

  if (!list.length) return null;

  return (
    <div className={`v2-tmap${compact ? " v2-tmap--compact" : ""}`}>
      <div className="v2-tmap__bar" aria-hidden="true">
        {list.map((t) => (
          <i key={t.id} className={`is-${t.status.toLowerCase()}`} />
        ))}
      </div>
      <div className={`v2-tmap__body${!collapsible || open ? " v2-tmap__body--open" : ""}`}>
        <div>
          <div className="v2-tmap__grid">
            {list.map((t) => (
              <div key={t.id} className={`v2-tmap__tile is-${t.status.toLowerCase()}`} title={`${t.name} · ${LABEL[t.status] || t.status}`}>
                <TableIcon seats={t.seats} />
                <strong>{t.name}</strong>
                <small>{t.status === "AVAILABLE" ? `${t.seats}인석` : LABEL[t.status] || t.status}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="v2-tmap__foot">
        <div className="v2-tmap__legend">
          <span className="is-available">빈 자리 {free}</span>
          <span className="is-in_use">이용 중 {inUse}</span>
          {reserved > 0 && <span className="is-reserved">예약 {reserved}</span>}
        </div>
        {collapsible && (
          <button type="button" className={`v2-tmap__toggle ${toggleClass}`.trim()} onClick={toggle} aria-expanded={open}>
            {open ? "접기" : `테이블 ${list.length}개 보기`}
            <svg viewBox="0 0 24 24" className={`v2-tmap__chev${open ? " is-open" : ""}`} aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/** 첫 화면 카드처럼 좁은 곳에 쓰는 점 띠. 앞에서부터 빈 자리 수만큼 초록. */
export function TableDots({ free = 0, total = 0 }) {
  const all = Math.max(0, Number(total) || 0);
  if (!all) return null;
  // 테이블이 많으면(총학 주점 60개) 점 하나가 테이블 하나일 수 없다. 열 칸짜리 비율 표시로 바꾼다.
  const scaled = all > 12;
  const count = scaled ? 10 : all;
  const freeCount = Math.max(0, Math.min(all, Number(free) || 0));
  const lit = scaled ? (freeCount === 0 ? 0 : Math.max(1, Math.round((freeCount / all) * count))) : freeCount;
  return (
    <span className="v2-tdots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i < lit ? "is-free" : ""} />
      ))}
    </span>
  );
}
