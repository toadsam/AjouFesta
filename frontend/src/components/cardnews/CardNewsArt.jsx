// 카드뉴스 공용 그림: 별가루, 부스 배치도, 돌림판, 아이콘. 원본 카드뉴스의 모양을 코드로 다시 그린 것.
import { useMemo, useState } from "react";
import { CARD_NEWS_IMG } from "../../data/cardNews";

/* ---------- 별가루 ----------
 * 원본처럼 오른쪽 위로 몰린 작은 점 + 빛나는 별 몇 개. 시드가 같으면 매번 같은 자리.
 */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function StarDust({ seed = 7, dust = 70, glow = 7, corner = "tr", className = "" }) {
  const stars = useMemo(() => {
    const rand = seeded(seed);
    const list = [];
    for (let i = 0; i < dust; i += 1) {
      // 모서리 쪽으로 몰리게: 제곱해서 치우친다.
      const u = rand() ** 1.8;
      const v = rand() ** 1.4;
      const x = corner === "tr" ? 100 - u * 62 : u * 100;
      const y = corner === "tr" ? v * 58 : v * 100;
      list.push({ x, y, r: 0.12 + rand() * 0.3, o: 0.35 + rand() * 0.6, glow: false, d: rand() * 4 });
    }
    for (let i = 0; i < glow; i += 1) {
      list.push({ x: 30 + rand() * 68, y: 2 + rand() * 60, r: 0.5 + rand() * 0.55, o: 0.9, glow: true, d: rand() * 5 });
    }
    return list;
  }, [seed, dust, glow, corner]);

  // SVG 로 늘이면 별이 세로로 찌그러져서, 자리만 %로 두고 크기는 px 로 그린다.
  return (
    <span className={`cn-stars ${className}`} aria-hidden="true">
      {stars.map((star, index) =>
        star.glow ? (
          <i
            key={index}
            className="cn-stars__glow"
            style={{ left: `${star.x}%`, top: `${star.y}%`, width: `${star.r * 22}px`, height: `${star.r * 22}px`, animationDelay: `${star.d}s` }}
          />
        ) : (
          <i
            key={index}
            className="cn-stars__dot"
            style={{ left: `${star.x}%`, top: `${star.y}%`, width: `${1 + star.r * 6}px`, height: `${1 + star.r * 6}px`, opacity: star.o }}
          />
        ),
      )}
    </span>
  );
}

/* ---------- 흰 글자 + 바깥 테두리(표지 제목) ---------- */
export function OutlineText({ as: Tag = "span", className = "", children, ...rest }) {
  return (
    <Tag className={`cn-outline ${className}`} data-text={typeof children === "string" ? children : undefined} {...rest}>
      {children}
    </Tag>
  );
}

export function AusumLogo({ className = "" }) {
  return <img className={`cn-logo ${className}`} src={`${CARD_NEWS_IMG}/logo.webp`} alt="아주대학교 제45대 총학생회 AU:SUM" />;
}

/* ---------- 성호관 잔디밭 부스 배치도 ----------
 * 바탕 길은 원본 지도 그림, 부스 16칸은 그 위에 같은 자리로 다시 그려 누를 수 있게 했다.
 * 좌표는 map.webp(900×774) 기준: [번호, 가운데 x, 가운데 y, 폭, 높이, 각도]
 */
const BOOTHS = [
  [1, 460, 725, 104, 51, 0],
  [2, 335, 725, 104, 51, 0],
  [3, 153, 582, 106, 52, 40.6],
  [4, 58, 500, 106, 52, 39.7],
  [5, 89, 398, 104, 54, -55],
  [6, 156, 303, 104, 54, -54.5],
  [7, 225, 204, 104, 54, -54.5],
  [8, 292, 110, 104, 54, -54.5],
  [9, 390, 66, 101, 49, 33.7],
  [10, 499, 136, 104, 51, 34],
  [11, 600, 262, 53, 104, 7],
  [12, 715, 211, 105, 49, 14.3],
  [13, 706, 313, 106, 52, 0],
  [14, 528, 434, 106, 54, 1],
  [15, 663, 436, 106, 54, 1.5],
  [16, 751, 539, 106, 52, -60.7],
];

export const BOOTH_GROUPS = {
  main: { ids: [1, 2], label: "총학생회 메인부스", short: "메인부스 1·2" },
  saju: { ids: [3, 4], label: "SUM주팔자 소개팅", short: "SUM주팔자 3·4" },
};

function groupOf(id) {
  return Object.keys(BOOTH_GROUPS).find((key) => BOOTH_GROUPS[key].ids.includes(id)) || null;
}

export function BoothMap({ highlight = ["main", "saju"], focus, selected, onSelect, tone = "blue", label }) {
  const bubble = useMemo(() => {
    if (!selected) return null;
    const group = groupOf(selected);
    const ids = group ? BOOTH_GROUPS[group].ids : [selected];
    const members = BOOTHS.filter((booth) => ids.includes(booth[0]));
    const x = members.reduce((sum, booth) => sum + booth[1], 0) / members.length;
    const y = Math.min(...members.map((booth) => booth[2])) - 70;
    const text = group ? `${ids.join("·")}번 · ${BOOTH_GROUPS[group].label}` : `${selected}번 · 주간부스`;
    const width = text.length * 30 + 56;
    const clampedX = Math.min(Math.max(x, width / 2 + 8), 900 - width / 2 - 8);
    return { x: clampedX, y: Math.max(y, 48), text, width, tipX: x - clampedX };
  }, [selected]);

  return (
    <svg className={`cn-map cn-map--${tone}`} viewBox="0 0 900 774" role="img" aria-label="성호관 잔디밭 부스 배치도">
      <image href={`${CARD_NEWS_IMG}/map.webp`} x="0" y="0" width="900" height="774" />
      {BOOTHS.map(([id, cx, cy, w, h, angle]) => {
        const group = groupOf(id);
        const lit = group && highlight.includes(group);
        const dim = focus && group !== focus;
        const classes = ["cn-map__booth", lit ? `cn-map__booth--${group}` : "", lit && !dim ? "is-lit" : "", dim ? "is-dim" : "", selected === id ? "is-picked" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <g key={id} className={classes} onClick={() => onSelect?.(id)} role="button" tabIndex={0} aria-label={`${id}번 부스`}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect?.(id);
            }}
          >
            <g transform={`translate(${cx} ${cy}) rotate(${angle})`}>
              {lit && !dim ? <rect className="cn-map__halo" x={-w / 2 - 7} y={-h / 2 - 7} width={w + 14} height={h + 14} rx="6" /> : null}
              <rect className="cn-map__rect" x={-w / 2} y={-h / 2} width={w} height={h} rx="2" />
            </g>
            <text className="cn-map__num" x={cx} y={cy + 9} textAnchor="middle">
              {id}
            </text>
          </g>
        );
      })}
      {label ? (
        <text className="cn-map__label" x="397" y="672" textAnchor="middle">
          {label}
        </text>
      ) : null}
      {bubble ? (
        <g className="cn-map__bubble" transform={`translate(${bubble.x} ${bubble.y})`} key={selected}>
          <rect x={-bubble.width / 2} y="-38" width={bubble.width} height="68" rx="34" />
          <path d={`M ${bubble.tipX - 13} 29 L ${bubble.tipX} 48 L ${bubble.tipX + 13} 29 Z`} />
          <text x="0" y="8" textAnchor="middle">
            {bubble.text}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

/* ---------- 핀이 꽂힌 지도 ----------
 * 원본 카드의 지도 그림 위에 깜빡이는 핀과 이름표를 얹는다. zoomable 이면 누를 때 크게 보기.
 * children 은 그림 위에 같이 얹는 것(구역 표시 · 코스 선).  크게 볼 때도 함께 보인다.
 */
export function PinMap({ src, ratio, alt, pins = [], zoomable = false, children }) {
  const [zoomed, setZoomed] = useState(false);
  const body = (
    <span className="cn-pinmap__inner" style={{ aspectRatio: ratio }}>
      <img src={src} alt={alt} draggable="false" />
      {pins.map((pin) => (
        <span key={pin.label} className={`cn-pin cn-pin--${pin.tone || "blue"}`} style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
          <i aria-hidden="true" />
          <b>{pin.label}</b>
        </span>
      ))}
      {children}
    </span>
  );
  if (!zoomable) return <div className="cn-pinmap">{body}</div>;
  return (
    <>
      <button type="button" className="cn-pinmap cn-pinmap--zoom" onClick={() => setZoomed(true)} aria-label={`${alt} 크게 보기`}>
        {body}
      </button>
      {zoomed ? (
        <div className="cn-zoom" role="dialog" aria-label={alt} onClick={() => setZoomed(false)}>
          <div className="cn-zoom__scroll" onClick={(event) => event.stopPropagation()}>
            <div className="cn-zoom__map">{body}</div>
          </div>
          <button type="button" className="cn-zoom__close" aria-label="닫기" onClick={() => setZoomed(false)}>
            <CnIcon.close />
          </button>
          <p className="cn-zoom__hint">밀어서 둘러보세요</p>
        </div>
      ) : null}
    </>
  );
}

/* ---------- 돌림판(스탬프 미션) ---------- */
export function Roulette({ angle = 0, spinning = false }) {
  const slices = 12;
  const paths = [];
  for (let i = 0; i < slices; i += 1) {
    const a0 = (i / slices) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / slices) * Math.PI * 2 - Math.PI / 2;
    const r = 78;
    paths.push(
      <path
        key={i}
        d={`M 0 0 L ${Math.cos(a0) * r} ${Math.sin(a0) * r} A ${r} ${r} 0 0 1 ${Math.cos(a1) * r} ${Math.sin(a1) * r} Z`}
        fill={i % 2 ? "#cfe3f7" : "#a9cbef"}
      />,
    );
  }
  const pins = [];
  for (let i = 0; i < slices; i += 1) {
    const a = (i / slices) * Math.PI * 2;
    pins.push(<circle key={i} cx={Math.cos(a) * 88} cy={Math.sin(a) * 88} r="3.2" fill="#f4f9ff" />);
  }
  return (
    <svg className="cn-roulette" viewBox="-110 -125 220 270" aria-hidden="true">
      <defs>
        <linearGradient id="cn-rl-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fbdf0" />
          <stop offset="1" stopColor="#6fa6e3" />
        </linearGradient>
        <linearGradient id="cn-rl-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9d0f6" />
          <stop offset="1" stopColor="#7fb2e8" />
        </linearGradient>
      </defs>
      <path d="M -30 60 L 30 60 L 62 136 L -62 136 Z" fill="url(#cn-rl-base)" />
      <rect x="-66" y="130" width="132" height="10" rx="5" fill="#86b6ea" />
      <g
        className={`cn-roulette__wheel${spinning ? " is-spinning" : ""}`}
        style={{ transform: `rotate(${angle}deg)` }}
      >
        <circle r="98" fill="url(#cn-rl-rim)" />
        <circle r="80" fill="#e6f1fc" />
        {paths}
        {pins}
        <circle r="22" fill="#8fbdf0" />
        <circle r="15" fill="#b8d6f5" />
      </g>
      <path d="M -16 -118 L 16 -118 L 0 -88 Z" fill="#8fbdf0" stroke="#b9d8f7" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- 아이콘 ---------- */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

export const CnIcon = {
  back: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M15 5l-7 7 7 7" {...stroke} strokeWidth="2.2" /></svg>
  ),
  more: (p) => (
    <svg viewBox="0 0 24 24" {...p}><circle cx="5" cy="12" r="1.9" fill="currentColor" /><circle cx="12" cy="12" r="1.9" fill="currentColor" /><circle cx="19" cy="12" r="1.9" fill="currentColor" /></svg>
  ),
  share: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" {...stroke} /></svg>
  ),
  heart: ({ filled, ...p }) => (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" {...stroke} fill={filled ? "currentColor" : "none"} />
    </svg>
  ),
  info: (p) => (
    <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" {...stroke} /><path d="M12 11v6M10.5 17h3" {...stroke} /><circle cx="12" cy="7.6" r="1.1" fill="currentColor" /></svg>
  ),
  sliders: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M4 7h16M4 12h16M4 17h16" {...stroke} /><circle cx="15" cy="7" r="2" fill="#fff" {...stroke} /><circle cx="9" cy="12" r="2" fill="#fff" {...stroke} /><circle cx="14" cy="17" r="2" fill="#fff" {...stroke} /></svg>
  ),
  trash: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10v6.5M14 10v6.5" {...stroke} /></svg>
  ),
  flash: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M9 3L5 11h5l-2 7" {...stroke} /><circle cx="16.5" cy="15.5" r="3" {...stroke} /><path d="M14.4 17.6l4.2-4.2" {...stroke} /></svg>
  ),
  flashOn: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M13 3L6 13h5l-1 8 7-10h-5l1-8z" {...stroke} fill="currentColor" /></svg>
  ),
  hdr: ({ off, ...p }) => (
    <svg viewBox="0 0 40 24" {...p}>
      <text x="20" y="17" textAnchor="middle" fontSize="13" fontFamily="inherit" fill="currentColor" fontWeight="500">HDR</text>
      {off ? <path d="M13 3l14 18" {...stroke} strokeWidth="1.5" /> : null}
    </svg>
  ),
  filters: (p) => (
    <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="8.5" r="4.2" {...stroke} /><circle cx="8.3" cy="14.8" r="4.2" {...stroke} /><circle cx="15.7" cy="14.8" r="4.2" {...stroke} /></svg>
  ),
  menu: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M4 7h16M4 12h16M4 17h16" {...stroke} /></svg>
  ),
  sun: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path key={a} d="M12 2.2v3" transform={`rotate(${a} 12 12)`} {...stroke} strokeWidth="1.6" />
      ))}
    </svg>
  ),
  phone: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M6.6 3.8l2.6-.4 1.6 4-1.9 1.3a11 11 0 0 0 4.8 4.8l1.3-1.9 4 1.6-.4 2.6a2 2 0 0 1-2.2 1.7C10.3 16.8 7.2 13.7 5 7.5a2 2 0 0 1 1.6-3.7z" {...stroke} /></svg>
  ),
  arrow: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M5 12h14M13 6l6 6-6 6" {...stroke} strokeWidth="2" /></svg>
  ),
  close: (p) => (
    <svg viewBox="0 0 24 24" {...p}><path d="M6 6l12 12M18 6L6 18" {...stroke} strokeWidth="2" /></svg>
  ),
};
