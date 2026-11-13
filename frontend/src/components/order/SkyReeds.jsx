// "바람" 컨셉 배경: 파란 하늘(살짝 노을) + 갈대. 포스터가 나오면 이 자리에 사진을 깐다.
const BACK = [
  [14, 120, 26], [48, 90, 30], [84, 140, 22], [118, 70, 34], [150, 125, 28],
  [186, 95, 32], [222, 150, 24], [258, 80, 36], [296, 118, 30], [334, 100, 32], [368, 145, 26],
];
const FRONT = [
  [34, 160, 22], [96, 130, 30], [172, 170, 26], [240, 120, 34], [310, 160, 28], [356, 130, 30],
];

function Stalk({ x, top, lean, color, width, height }) {
  const d = `M${x} ${height} C ${x + lean * 0.2} ${height - (height - top) * 0.45}, ${x + lean * 0.6} ${height - (height - top) * 0.8}, ${x + lean} ${top}`;
  return (
    <>
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />
      <ellipse
        cx={x + lean}
        cy={top - 12}
        rx="4"
        ry="18"
        transform={`rotate(${16 + lean * 0.3} ${x + lean} ${top - 12})`}
        fill={color}
        opacity="0.9"
      />
    </>
  );
}

export function Reeds({ height = 220, className = "" }) {
  // 갈대 좌표는 260px 기준으로 잡혀 있어서 높이에 맞춰 세로만 늘린다.
  const scale = height / 260;
  return (
    <svg
      viewBox={`0 0 390 ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ display: "block" }}
    >
      {BACK.map(([x, t, l]) => (
        <Stalk key={`b${x}`} x={x} top={t * scale} lean={l} color="#e6d3a5" width={1.8} height={height} />
      ))}
      {FRONT.map(([x, t, l]) => (
        <Stalk key={`f${x}`} x={x} top={t * scale} lean={l} color="#d4b97f" width={2.4} height={height} />
      ))}
    </svg>
  );
}

export default function SkyReeds({ height = 300, children, className = "" }) {
  return (
    <div className={`od-sky ${className}`} style={{ height }}>
      <div className="od-sky__clouds" />
      <div className="od-sky__reeds">
        <Reeds height={Math.round(height * 0.7)} />
      </div>
      {children}
    </div>
  );
}
