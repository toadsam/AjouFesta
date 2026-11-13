// 총학생회 주점 부스 + 테이블 8개 + 메뉴 5개를 서버에 만든다. 이미 "총학" 부스가 있으면 테이블·메뉴만 맞춘다.
//
//   운영:  $env:OPS_KEY="<운영 마스터 키>"; $env:API_BASE="https://festflow-production-1669.up.railway.app/api"; node scripts/seed-main-booth.mjs
//   로컬:  $env:OPS_KEY="0000"; node scripts/seed-main-booth.mjs
//
// 판매가는 아직 못 받아 비워 둔다. 운영 콘솔(/ops/booth/{id}) 메뉴판에서 채우면 된다.
const B = (process.env.API_BASE || "http://127.0.0.1:8080/api").replace(/\/+$/, "");
const KEY = process.env.OPS_KEY;
if (!KEY) {
  console.error("OPS_KEY 환경 변수에 운영 마스터 키를 넣어 주세요.");
  process.exit(1);
}
const H = { "Content-Type": "application/json", "X-OPS-KEY": KEY };

const menu = [
  { name: "삼겹살 볶음김치 쌈장", description: "삼겹살 400g · 볶음김치 100g · 쌈장 50g", price: "", soldOut: false },
  { name: "두부김치", description: "두부 300g · 김치 400g", price: "", soldOut: false },
  { name: "묵 김치 육수 김", description: "묵 300g · 김치 50g · 육수 340g · 김 10g", price: "", soldOut: false },
  { name: "짜파게티 2개 볶음김치", description: "짜파게티 2개 · 볶음김치 100g", price: "", soldOut: false },
  { name: "오뎅탕", description: "오뎅 336g · 물 500ml", price: "", soldOut: false },
];

const body = {
  name: "총학생회 주점",
  latitude: 37.2828,
  longitude: 127.0444,
  description: "노천극장 옆, 총학생회가 직접 여는 주점",
  displayOrder: 0,
  imageUrl: "/images/booths/주점사진.jpg",
  category: "주점",
  dayPart: "야간",
  openTime: "17:00:00",
  closeTime: "23:00:00",
  boothIntro: "바람 축제 공식 주점. 테이블 QR로 자리에서 바로 주문할 수 있어요.",
  menuBoardJson: JSON.stringify(menu),
  tags: "주점, 총학, 노천극장",
  estimatedWaitMinutes: 0,
  reservationEnabled: true,
};

const booths = await fetch(`${B}/booths`).then((r) => r.json());
let booth = booths.find((b) => (b.name || "").includes("총학"));
if (!booth) {
  const res = await fetch(`${B}/ops/master/booths`, { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`부스 생성 실패 ${res.status}: ${await res.text()}`);
  booth = await res.json();
  console.log("부스 생성:", booth.id, booth.name);
} else {
  console.log("이미 있음:", booth.id, booth.name, "→ 운영 시간·메뉴판·소개만 다시 맞춘다");
  const res = await fetch(`${B}/ops/master/booths/${booth.id}`, { method: "PUT", headers: H, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`부스 수정 실패 ${res.status}: ${await res.text()}`);
}

const tables = [
  ...[1, 2, 3, 4].map((n) => ({ tableName: `4인 ${n}`, totalSeats: 4, availableSeats: 4 })),
  ...[1, 2, 3].map((n) => ({ tableName: `6인 ${n}`, totalSeats: 6, availableSeats: 6 })),
  { tableName: "단체 8인", totalSeats: 8, availableSeats: 8 },
];
const cfg = await fetch(`${B}/ops/booth/${booth.id}/reservations/config`, {
  method: "PUT",
  headers: H,
  body: JSON.stringify({ maxReservationMinutes: 10, tables }),
});
if (!cfg.ok) throw new Error(`테이블 설정 실패 ${cfg.status}: ${await cfg.text()}`);
const state = await cfg.json();
console.log("테이블:", state.tables.map((t) => `${t.tableName}(${t.totalSeats})`).join(", "));

const after = await fetch(`${B}/booths/${booth.id}`).then((r) => r.json());
console.log("확인:", after.name, "| 시간", after.openTime, "~", after.closeTime, "| 테이블", after.reservationTableCount, "| 메뉴", after.menuBoardJson ? JSON.parse(after.menuBoardJson).length + "개" : "없음");
console.log(`주점 탭: ${B.replace(/\/api$/, "").includes("railway") ? "https://fest-flow-smoky.vercel.app" : "http://localhost:5173"}/booths`);
