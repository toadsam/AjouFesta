// 목록·상세 화면 뒤에 깔리는 아주대 밤 풍경(고정 배경)과 천천히 떨어지는 꽃잎 몇 장.
// 화면에 고정(fixed)이라 스크롤해도 풍경은 그대로다. 스타일은 styles/saju-night.css 의 nt-*.

const PETALS = [
  { x: "8%", d: "15s", delay: "-2s", kind: "pink", s: 1 },
  { x: "22%", d: "19s", delay: "-9s", kind: "gold", s: 0.8 },
  { x: "37%", d: "17s", delay: "-5s", kind: "pink", s: 0.7 },
  { x: "55%", d: "21s", delay: "-13s", kind: "gold", s: 1 },
  { x: "68%", d: "16s", delay: "-1s", kind: "pink", s: 0.9 },
  { x: "81%", d: "20s", delay: "-7s", kind: "gold", s: 0.7 },
  { x: "91%", d: "18s", delay: "-11s", kind: "pink", s: 0.8 },
];

export default function NightSky() {
  return (
    <div className="nt-sky" aria-hidden="true">
      <div className="nt-sky__img" />
      <div className="nt-sky__petals">
        {PETALS.map((petal, index) => (
          <i
            key={index}
            className={`nt-petal nt-petal--${petal.kind}`}
            style={{ "--x": petal.x, "--d": petal.d, "--delay": petal.delay, "--s": petal.s }}
          />
        ))}
      </div>
    </div>
  );
}
