// 눌러 보는 매뉴얼 · 자리와 대기 안내 흐름. 화면 셋(손님 주점 화면 · 주문 콘솔 · 자리 현황판)과 순서, 방금 일어난 일을 글로 바꾸는 규칙.
// 이번 축제는 자리 예약을 받지 않는다(config/festival.js). 그래서 예약이 아니라, 당일에 실제로 쓰는 '앉히기 · 비우기 · 대기 시간 · 안내 한 줄 · 품절'을 다룬다.
import { DEMO_BOOTH_ID, DEMO_OPS_KEY } from "./pubDomain";

const BOOTH = DEMO_BOOTH_ID;
const TABLE = "7번";
const DISH = "어묵탕";
const OPS_KEY_STORAGE = "festflow_ops_booth_key";
const GUEST = "seatGuest";
const CONSOLE = "seatConsole";
const BOARD = "seatBoard";

const frames = [
  {
    id: GUEST,
    who: "손님",
    label: "손님 주점 화면",
    sub: "주점 탭 · 빈 자리와 대기 안내",
    home: `/booths/${BOOTH}`,
    allow: [/^\/$/, new RegExp(`^/booths(/${BOOTH})?$`)],
  },
  {
    id: CONSOLE,
    who: "스태프",
    label: "주문 콘솔",
    sub: "대기 시간 · 안내 한 줄 · 품절",
    home: `/ops/booth/${BOOTH}`,
    allow: [new RegExp(`^/ops/booth/${BOOTH}(/|$)`)],
    staff: true,
    session: [[OPS_KEY_STORAGE, DEMO_OPS_KEY]],
  },
  {
    id: BOARD,
    who: "스태프",
    label: "자리 현황판",
    sub: "입구 스태프가 보는 화면",
    home: `/ops/booth/${BOOTH}/tables`,
    allow: [new RegExp(`^/ops/booth/${BOOTH}(/|$)`)],
    staff: true,
    session: [[OPS_KEY_STORAGE, DEMO_OPS_KEY]],
  },
];

const steps = [
  {
    key: "seat",
    frame: BOARD,
    title: `주문 없이 앉은 손님 — ${TABLE}을 눌러 ‘이용 중’으로`,
    body: "QR로 주문하면 자리는 저절로 ‘이용 중’이 돼요. 주문 없이 앉은 손님은 입구 스태프가 직접 눌러요. (이번 축제는 자리 예약이 없어서, 손님은 ‘지금 빈 자리’를 보고 와요.)",
  },
  {
    key: "wait",
    frame: CONSOLE,
    title: "줄이 생겼어요 — 대기 시간과 안내 한 줄 적고 저장",
    body: "‘손님에게 보이는 한 줄’에서 대기 시간(분)과 운영 메모를 적으면 아래에 저장 줄이 떠요. ‘저장’을 눌러야 손님에게 보여요.",
  },
  {
    key: "soldout",
    frame: CONSOLE,
    title: `재료가 떨어졌어요 — ‘품절 바로 바꾸기’에서 ${DISH} 누르기`,
    body: "누르는 즉시 저장돼요. 손님 메뉴판과 테이블 QR 주문 화면에서 바로 품절이 돼요.",
  },
  {
    key: "release",
    frame: BOARD,
    title: "손님이 나갔어요 — 그 자리를 눌러 비우기",
    body: "자리는 저절로 비지 않아요. 손님이 일어난 걸 보고 그 자리를 누른 뒤, 확인 창에서 ‘빈 자리로 바꾸기’를 눌러요.",
  },
  {
    key: "clear",
    frame: CONSOLE,
    title: "줄이 빠졌어요 — 대기 시간을 0으로, 안내를 지우고 저장",
    body: "대기 시간을 0으로 바꾸고 운영 메모를 지운 뒤 ‘저장’. 지우지 않으면 손님 화면에 계속 남아 있어요.",
  },
];

function progress(snapshot) {
  const { flow, tables } = snapshot.pub;
  return {
    done: {
      seat: flow.walkInTableId != null,
      wait: flow.waitSet,
      soldout: flow.soldOutSet,
      release: flow.walkInReleased,
      clear: flow.waitCleared,
    },
    context: { table: tables.find((table) => table.id === flow.walkInTableId) || null },
  };
}

/* ---------- 방금 일어난 일 ---------- */
// 손님 화면에서 바뀐 자리(주점 화면이면 그 칸, 첫 화면이면 주점 카드).
const guestSeats = (doc) => doc.querySelector(".v2-seats") || doc.querySelector(".v2-main-booth");
const guestTitle = (doc) => doc.querySelector(".v2-detail-title") || doc.querySelector(".v2-main-booth");
const guestDish = (name) => (doc) =>
  [...doc.querySelectorAll(".v2-dish")].find((node) => node.querySelector("strong")?.textContent.trim() === name) || null;
const consoleKpis = (doc) => doc.querySelector(".ops-kpis");
const boardSummary = (doc) => doc.querySelector(".tb-summary");
const boardTable = (name) => (doc) =>
  [...doc.querySelectorAll(".tb-table")].find((button) => button.querySelector("strong")?.textContent.trim() === name) || null;

function describe(event) {
  const from = frames.some((frame) => frame.id === event.role) ? event.role : CONSOLE;
  switch (event.type) {
    case "table.occupied":
    case "table.released": {
      const seated = event.type === "table.occupied";
      const name = event.table.tableName;
      const count = `${event.free}/${event.total}`;
      return {
        from,
        cause: seated ? `스태프가 ${name}을 ‘이용 중’으로 바꿨어요` : `스태프가 ${name}을 비웠어요`,
        effects: [
          {
            frame: GUEST,
            text:
              event.free === 0
                ? "‘지금 빈 자리’가 ‘지금은 만석이에요’로 바로 바뀌어요."
                : `‘지금 빈 자리’가 테이블 ${event.free}개 남음(${count})으로 ${seated ? "줄어요" : "늘어요"}. 새로고침하지 않아도 몇 초 안에 바뀌어요.`,
            show: guestSeats,
            showDelay: 1300,
          },
          {
            frame: BOARD,
            text: seated ? `${name}이 빨간 ‘이용 중 · 방금 앉음’이 되고, 앉은 지 얼마나 됐는지 계속 보여요.` : `${name}이 ‘빈 자리’로 돌아와요.`,
            show: boardTable(name),
          },
          { frame: CONSOLE, text: `‘지금 현황’의 빈 테이블이 ${count}로 바뀌어요.`, show: consoleKpis },
        ],
      };
    }
    case "booth.updated": {
      if (event.soldOut?.length) {
        const item = event.soldOut[0];
        return {
          from,
          cause: `스태프가 ‘${item.name}’을 ${item.soldOut ? "품절" : "다시 판매"}로 바꿨어요`,
          effects: [
            {
              frame: GUEST,
              text: item.soldOut
                ? `메뉴의 ‘${item.name}’에 바로 ‘품절’이 붙어요. 테이블 QR 주문 화면에서도 담을 수 없어요.`
                : `메뉴의 ‘${item.name}’에서 ‘품절’이 바로 사라져요.`,
              show: guestDish(item.name),
            },
            { frame: CONSOLE, text: `‘${item.name}’ 칸이 ${item.soldOut ? "‘품절’" : "‘판매 중’"}로 바뀌어요. 저장 버튼은 따로 누르지 않아요.` },
          ],
        };
      }
      const { wait, message } = event;
      const waitChanged = wait && wait.before !== wait.after;
      const messageChanged = message && message.before !== message.after;
      if (!waitChanged && !messageChanged) return null;
      const badge = (minutes) => (minutes > 0 ? `‘대기 ${minutes}분’` : "‘바로 입장’");
      const parts = [];
      if (waitChanged) parts.push(`주점 이름 위 배지가 ${badge(wait.before)}에서 ${badge(wait.after)}으로 바로 바뀌어요.${wait.after >= 30 ? " 30분부터는 빨간색이에요." : ""}`);
      if (messageChanged) {
        parts.push(
          message.after
            ? `이름 아래에 “${message.after}”가 떠요. 첫 화면의 주점 카드에도 같은 한 줄이 보여요.`
            : "이름 아래의 안내 한 줄이 사라져요.",
        );
      }
      return {
        from,
        cause: waitChanged
          ? wait.after > 0
            ? `스태프가 대기 시간을 ${wait.after}분으로 저장했어요`
            : "스태프가 대기 시간을 0으로 저장했어요"
          : message.after
            ? "스태프가 안내 한 줄을 저장했어요"
            : "스태프가 안내 한 줄을 지웠어요",
        effects: [
          { frame: GUEST, text: parts.join(" "), show: guestTitle },
          { frame: CONSOLE, quiet: true, text: "아래 저장 줄이 사라지고 ‘저장했어요’가 떠요." },
        ],
      };
    }
    case "tables.updated":
      return {
        from,
        cause: "스태프가 테이블 설정을 저장했어요",
        effects: [
          { frame: GUEST, text: `전체 테이블이 ${event.total}개로 보여요(빈 테이블 ${event.free}개).`, show: guestSeats, showDelay: 1300 },
          { frame: BOARD, text: "현황판의 테이블 버튼도 같이 바뀌어요.", show: boardSummary },
        ],
      };
    default:
      return null;
  }
}

/* ---------- 지금 누를 곳 ---------- */
const cardOf = (doc, title) => [...doc.querySelectorAll(".ops-card")].find((card) => card.querySelector(".ops-card__head h2")?.textContent.trim() === title) || null;
const fieldInput = (card, label) =>
  card ? [...card.querySelectorAll(".ops-field")].find((field) => field.querySelector("span")?.textContent.trim() === label)?.querySelector("input") || null : null;
// 저장 줄의 '저장'(테이블도 같이 바꿨으면 '정보 저장').
const saveButton = (doc) => [...doc.querySelectorAll(".ops-savebar .ops-btn--primary")].find((button) => /^(정보 )?저장$/.test(button.textContent.trim())) || null;

function findTarget(stepKey, doc, { table }) {
  if (stepKey === "seat") {
    const button = boardTable(TABLE)(doc);
    // 이미 누가 앉은 자리면 다른 빈 자리를 가리킨다.
    return button?.classList.contains("tb-table--available") ? button : doc.querySelector(".tb-table--available");
  }
  // 테이블을 누르면 확인 창이 뜬다 → 그 안의 '빈 자리로 바꾸기'.
  if (stepKey === "release") return doc.querySelector(".tb-confirm__yes") || (table ? boardTable(table.tableName)(doc) : null);
  if (stepKey === "soldout") {
    return [...doc.querySelectorAll(".ops-soldout__chip:not(.is-out)")].find((chip) => chip.querySelector("span")?.textContent.trim() === DISH) || doc.querySelector(".ops-soldout__chip:not(.is-out)");
  }
  const card = cardOf(doc, "손님에게 보이는 한 줄");
  const wait = fieldInput(card, "대기 시간(분)");
  const memo = fieldInput(card, "운영 메모");
  if (!wait || !memo) return null;
  const minutes = Number(wait.value) || 0;
  if (stepKey === "wait") {
    if (minutes <= 0) return wait;
    if (!memo.value.trim()) return memo;
    return saveButton(doc);
  }
  if (stepKey === "clear") {
    if (minutes > 0) return wait;
    if (memo.value.trim()) return memo;
    return saveButton(doc);
  }
  return null;
}

export const seatScenario = {
  id: "seat",
  label: "자리 · 대기 안내",
  shortLabel: "자리",
  subtitle: "주점 · 빈 자리와 대기 안내 (이번 축제는 자리 예약 없음)",
  frames,
  steps,
  progress,
  describe,
  findTarget,
  scrollAnchor: ".ops-card",
  ideas: [
    "빈 자리를 전부 ‘이용 중’으로 바꾸면 손님 화면은? (만석)",
    "대기 시간을 30분 넘게 적으면 손님 화면 배지 색은?",
    "주문 콘솔 ‘자리’에서 +4인으로 테이블을 늘리고 ‘테이블 저장’을 누르면?",
    "손님 화면 왼쪽 위 ←를 눌러 첫 화면으로 가면 주점 카드에는 어떻게 보일까?",
  ],
};
