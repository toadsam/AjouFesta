// 눌러 보는 매뉴얼 · 주점 주문 흐름. 화면 셋(손님 폰 · 주문 콘솔 · 요리사 창)과 순서, 방금 일어난 일을 글로 바꾸는 규칙.
// 주문 → 입금 확인(콘솔) → 메뉴별 완료(요리사 창 · 주방마다 맡은 메뉴만) → 모든 메뉴가 끝나면 서빙 완료(콘솔) → 자리 비우기(콘솔에서 여는 현황판).
import { DEMO_BOOTH_ID, DEMO_OPS_KEY } from "./pubDomain";

const TABLE = "3번";
const BOOTH = DEMO_BOOTH_ID;
const OPS_KEY_STORAGE = "festflow_ops_booth_key";
const STATUS_INDEX = { PENDING_PAYMENT: 0, PAID: 1, PREPARING: 2, READY: 3, COMPLETED: 4 };

const won = (value) => `${Number(value || 0).toLocaleString("ko-KR")}원`;

const frames = [
  {
    id: "guest",
    who: "손님",
    label: "손님 폰",
    sub: `${TABLE} 테이블 QR을 찍은 화면`,
    home: `/order/${BOOTH}/${encodeURIComponent(TABLE)}`,
    allow: [new RegExp(`^/order/${BOOTH}(/|$)`), /^\/orders\/\d+$/],
  },
  {
    id: "console",
    who: "스태프",
    label: "주문 콘솔",
    sub: "입금을 확인하고 음식을 나르는 스태프 화면",
    home: `/ops/booth/${BOOTH}`,
    // 콘솔과, 콘솔에서 여는 자리 현황판 · QR 인쇄. 요리사 창은 옆 화면에 따로 떠 있다.
    allow: [new RegExp(`^/ops/booth/${BOOTH}(/tables|/table-qr)?$`)],
    staff: true,
    session: [[OPS_KEY_STORAGE, DEMO_OPS_KEY]],
  },
  {
    id: "kitchen",
    who: "요리사",
    label: "요리사 창",
    sub: "주방에서 보는 화면 · 맡은 메뉴만 · 입금 확인된 순서",
    home: `/ops/booth/${BOOTH}/kitchen`,
    allow: [new RegExp(`^/ops/booth/${BOOTH}/kitchen$`)],
    staff: true,
    session: [[OPS_KEY_STORAGE, DEMO_OPS_KEY]],
  },
];

const steps = [
  {
    key: "order",
    frame: "guest",
    title: "메뉴를 담아 주문하기",
    body: "메뉴를 누르고 담은 뒤 ‘주문하기’. 입금자명과 휴대폰 번호를 넣고 한 번 더 ‘주문하기’를 눌러요.",
  },
  {
    key: "paid",
    frame: "console",
    title: "‘입금 확인’ 누르기",
    body: "통장에 입금자명으로 돈이 들어왔는지 보고, 새로 뜬 주문 카드의 ‘입금 확인’을 눌러요. 누르는 순간 요리사 창에 떠요.",
  },
  {
    key: "ready",
    frame: "kitchen",
    title: "맡은 메뉴를 고르고, 다 만들면 ‘완료’ 누르기",
    body: "주방마다 요리사 창 하나씩, 맡은 메뉴만 봐요. 먼저 메뉴를 고르면 그 메뉴가 든 주문이 입금 확인된 순서로 떠요. 다 만들면 ‘완료’(5초 안에 되돌리기). 주문에 메뉴가 둘 이상이면 위쪽 메뉴 이름을 눌러 다른 메뉴 주방으로 바꿔 마저 완료해요. 모든 메뉴가 끝나야 콘솔 ‘서빙할 것’으로 넘어가요.",
  },
  {
    key: "complete",
    frame: "console",
    title: "가져다주고 ‘서빙 완료’ 누르기",
    body: "‘서빙할 것’에 올라온 테이블로 음식을 가져다준 뒤 눌러요. 주문은 처리 중 목록에서 빠져요.",
  },
  {
    key: "release",
    frame: "console",
    title: `손님이 나가면 현황판에서 ${TABLE}을 눌러 비우기`,
    body: "주문이 끝나도 자리는 저절로 비지 않아요. 콘솔 위의 ‘현황판’을 열어 손님이 일어난 테이블을 누르고, 확인 창에서 ‘빈 자리로 바꾸기’를 눌러요.",
  },
];

function progress(snapshot) {
  const { orders, tables } = snapshot.pub;
  const order = orders.filter((item) => !item.seed).sort((a, b) => b.id - a.id)[0] || null;
  const table = tables.find((item) => item.tableName === TABLE) || null;
  const index = order ? STATUS_INDEX[order.status] ?? -1 : -1;
  const canceled = order?.status === "CANCELED";
  return {
    done: {
      order: Boolean(order),
      paid: canceled || index >= 1,
      ready: canceled || index >= 3,
      complete: canceled || index >= 4,
      release: Boolean(order) && (canceled || index >= 4) && table?.occupancyStatus === "AVAILABLE",
    },
    context: { order },
    titles: canceled ? { release: `취소된 주문이에요. ${steps[4].title}` } : {},
  };
}

// 요리사 창 · 콘솔에서 그 주문의 카드를 찾는다(바뀐 자리 표시용).
const kitchenCard = (orderNo) => (doc) =>
  [...doc.querySelectorAll(".kt-order")].find((node) => node.querySelector(".kt-order__meta")?.textContent.includes(`#${orderNo}`)) || null;
const consoleCard = (orderNo) => (doc) =>
  [...doc.querySelectorAll(".ops-order")].find((node) => node.querySelector(".ops-order__meta")?.textContent.includes(`#${orderNo}`)) || null;

function describe(event) {
  const from = frames.some((frame) => frame.id === event.role) ? event.role : "console";
  switch (event.type) {
    case "order.created":
      return {
        from,
        cause:
          event.order.tableLabel === "포장"
            ? `손님이 포장으로 주문했어요 (${won(event.order.totalAmount)}) — 포장은 ‘포장 주문’ 흐름에서 따로 눌러 볼 수 있어요`
            : `손님이 ${event.order.tableLabel} 테이블에서 주문했어요 (${won(event.order.totalAmount)})`,
        effects: [
          { frame: "guest", text: "‘주문이 완료되었어요’ 화면으로 넘어가고 입금 계좌가 보여요." },
          {
            frame: "console",
            text: `‘새 주문 · ${event.order.tableLabel} 테이블’ 띠와 소리가 나고, 주문 카드가 ‘입금 대기’로 생겨요.${
              event.seated ? ` 자리 현황판의 ${event.order.tableLabel}도 저절로 ‘이용 중’이 돼요.` : ""
            }`,
          },
          { frame: "kitchen", quiet: true, text: "아직 아무것도 안 떠요. 입금이 확인된 주문만 떠요." },
        ],
      };
    case "order.status": {
      const table = event.order.tableLabel;
      const no = event.order.orderNo;
      const byKitchen = from === "kitchen";
      const wasInKitchen = event.from === "PAID" || event.from === "PREPARING";
      const map = {
        PAID: {
          cause: `스태프가 ${table} 주문의 ‘입금 확인’을 눌렀어요`,
          effects: [
            { frame: "guest", text: "‘입금이 확인됐어요’로 바뀌고 입금 계좌 안내가 사라져요." },
            { frame: "console", text: "주문 카드가 ‘입금 확인’으로 바뀌고 ‘요리사 창에 떠 있어요’가 보여요." },
            { frame: "kitchen", show: kitchenCard(no), text: "그 메뉴를 맡은 주방에 소리와 함께 카드가 떠요(메뉴를 안 골랐으면 고르는 화면). 입금이 확인된 순서대로 아래에 쌓여요." },
          ],
        },
        PREPARING: {
          cause: byKitchen ? `요리사가 ${table} 주문의 ‘조리 시작’을 눌렀어요` : `스태프가 콘솔에서 ${table} 주문의 ‘조리 시작’을 대신 눌렀어요`,
          effects: [
            { frame: "guest", text: "‘조리 중이에요’로 바뀌어요." },
            { frame: "console", show: byKitchen ? consoleCard(no) : undefined, text: "주문 카드가 ‘조리 중’으로 바뀌어요." },
            { frame: "kitchen", show: byKitchen ? undefined : kitchenCard(no), text: "카드 테두리가 보라색 ‘조리 중’으로 바뀌고 버튼이 ‘완료’가 돼요." },
          ],
        },
        READY: {
          cause: byKitchen ? `요리사가 ${table} 주문을 ‘완료’했어요` : `스태프가 콘솔에서 ${table} 주문의 ‘준비 완료’를 대신 눌렀어요(남은 메뉴를 모두 완료로)`,
          effects: [
            { frame: "guest", text: "‘준비가 끝났어요!’로 바뀌어요." },
            {
              frame: "console",
              show: (doc) => doc.querySelector(".ops-serve"),
              text: byKitchen
                ? `‘음식 나왔어요 · ${table} 테이블’ 띠와 소리가 나고, 맨 위 ‘서빙할 것’에 올라와요.`
                : "맨 위 ‘서빙할 것’에 올라와요.",
            },
            {
              frame: "kitchen",
              show: byKitchen ? undefined : (doc) => doc.querySelector(".kt-served"),
              text: `카드가 목록에서 빠지고, 맨 아래 ‘다 만든 주문 · 서빙 기다리는 중’에 ${table}이 남아요.`,
            },
          ],
        },
        COMPLETED: {
          cause: `스태프가 ${table} 주문의 ‘서빙 완료’를 눌렀어요`,
          effects: [
            { frame: "guest", text: "‘맛있게 드세요!’로 바뀌어요." },
            { frame: "console", text: "‘서빙할 것’에서 빠져요. ‘오늘 전체’를 누르면 다시 볼 수 있어요. 자리는 그대로 ‘이용 중’이에요." },
            { frame: "kitchen", quiet: !event.from || event.from !== "READY", text: `‘다 만든 주문’에서 ${table}이 빠져요.` },
          ],
        },
        CANCELED: {
          cause: `스태프가 ${table} 주문을 취소했어요`,
          effects: [
            { frame: "guest", text: "‘주문이 취소되었어요’로 바뀌어요." },
            { frame: "console", text: "‘처리 중’ 목록에서 빠져요. 자리는 그대로 ‘이용 중’이라, 손님이 나갔으면 현황판에서 직접 비워요." },
            wasInKitchen
              ? { frame: "kitchen", text: "주방에 떠 있던 카드가 사라져요. 만들던 음식은 멈춰요." }
              : { frame: "kitchen", quiet: true, text: "입금 전이라 요리사 창에는 뜬 적이 없어요." },
          ],
        },
      };
      return map[event.order.status] ? { from, ...map[event.order.status] } : null;
    }
    case "order.item": {
      const table = event.order.tableLabel;
      const no = event.order.orderNo;
      const menu = event.item.name;
      const items = event.order.items || [];
      const done = items.filter((item) => item.doneAt).length;
      if (event.order.status === "READY") {
        return {
          from,
          cause: `${menu} 주방이 ${table} 주문의 ‘${menu}’ 완료를 눌렀어요 — 이 주문의 메뉴가 모두 끝났어요`,
          effects: [
            { frame: "guest", text: "‘준비가 끝났어요!’로 바뀌어요." },
            {
              frame: "console",
              show: (doc) => doc.querySelector(".ops-serve"),
              text: `‘음식 나왔어요 · ${table} 테이블’ 띠와 소리가 나고, 맨 위 ‘서빙할 것’에 올라와요.`,
            },
            { frame: "kitchen", text: `카드가 빠지고, 맨 아래 ‘다 만든 주문 · 서빙 기다리는 중’에 ${table}이 남아요.` },
          ],
        };
      }
      return {
        from,
        cause: `${menu} 주방이 ${table} 주문의 ‘${menu}’ 완료를 눌렀어요 (메뉴 ${done}/${items.length})`,
        effects: [
          { frame: "guest", quiet: event.from !== "PAID", text: "‘조리 중이에요’로 바뀌어요." },
          { frame: "console", show: consoleCard(no), text: `카드의 ‘${menu}’에 ✓가 붙고 ‘메뉴 ${done}/${items.length} 완료’가 보여요. 아직 ‘서빙할 것’엔 안 올라가요.` },
          { frame: "kitchen", text: "이 주방에서는 카드가 빠져요(‘내 몫은 끝난 주문’에 남아요). 남은 메뉴를 맡은 주방이 완료해야 서빙할 것으로 넘어가요 — 위 메뉴 이름을 눌러 그 주방으로 바꿔 보세요." },
        ],
      };
    }
    case "table.occupied":
      return {
        from,
        cause: `스태프가 ${event.table.tableName}을 ‘이용 중’으로 바꿨어요`,
        effects: [
          { frame: "console", text: `현황판의 ${event.table.tableName}이 빨간 ‘이용 중 · 방금 앉음’이 돼요.` },
          { frame: "guest", quiet: true, text: "손님이 보는 주점 화면의 ‘남은 자리’가 하나 줄어요." },
        ],
      };
    case "table.released":
      return {
        from,
        cause: `스태프가 ${event.table.tableName}을 비웠어요`,
        effects: [
          { frame: "console", text: `현황판의 ${event.table.tableName}이 초록 ‘빈 자리’로 돌아와요.` },
          { frame: "guest", quiet: true, text: "손님이 보는 주점 화면의 ‘남은 자리’가 하나 늘어요." },
        ],
      };
    case "booth.updated": {
      if (!event.soldOut?.length) return null;
      const item = event.soldOut[0];
      return {
        from,
        cause: `스태프가 ‘${item.name}’을 ${item.soldOut ? "품절" : "다시 판매"}로 바꿨어요`,
        effects: [
          {
            frame: "guest",
            quiet: true,
            text: item.soldOut
              ? `메뉴 화면을 다시 열면 ‘${item.name}’이 품절로 보이고 담을 수 없어요.`
              : `메뉴 화면을 다시 열면 ‘${item.name}’을 다시 담을 수 있어요.`,
          },
        ],
      };
    }
    case "order.config":
      if (!event.toggled) return null;
      return {
        from,
        cause: `스태프가 ‘QR 주문 받기’를 ${event.orderEnabled ? "켰어요" : "껐어요"}`,
        effects: [
          {
            frame: "guest",
            quiet: true,
            text: event.orderEnabled
              ? "메뉴 화면을 다시 열면 주문할 수 있어요."
              : "메뉴 화면을 다시 열면 ‘지금은 주문을 받지 않아요’가 뜨고 담을 수 없어요.",
          },
        ],
      };
    default:
      return null;
  }
}

function findTarget(stepKey, doc, { order }) {
  const pick = (selector) => doc.querySelector(selector);
  const path = decodeURIComponent(doc.location?.pathname || "");
  if (stepKey === "order") {
    if (path.startsWith("/orders/")) return pick(".od-fixed .od-ghost");
    if (path.endsWith("/checkout")) {
      const name = pick("#od-depositor");
      if (name && !name.value.trim()) return name;
      const phone = pick("#od-phone");
      if (phone && !/^0\d{9,10}$/.test(phone.value.replace(/\D/g, ""))) return phone;
      return pick(".od-fixed .od-cta:not(:disabled)");
    }
    if (pick(".od-sheet")) return pick(".od-sheet .od-cta");
    const cartbar = pick(".od-cartbar");
    if (cartbar && !cartbar.disabled) return cartbar;
    // 담은 게 최소 주문 금액(14,000원)에 못 미치면 띠가 회색이라 못 누른다 — 아직 안 담은 메뉴를 하나 더 가리킨다.
    return [...doc.querySelectorAll(".od-menu-item:not(:disabled)")].find((item) => !item.querySelector(".od-plus strong")) || cartbar;
  }
  if (stepKey === "release") {
    // 콘솔에 있으면 위쪽 ‘현황판’ 버튼, 현황판에 와 있으면 그 테이블.
    if (!path.endsWith("/tables")) return pick('.ops__top-row a[href$="/tables"]');
    // 테이블을 누르면 확인 창이 뜬다 → 그 안의 '빈 자리로 바꾸기'.
    return (
      pick(".tb-confirm__yes") ||
      [...doc.querySelectorAll(".tb-table")].find((button) => button.querySelector("strong")?.textContent.trim() === TABLE) ||
      null
    );
  }
  if (!order) return null;
  if (stepKey === "ready") {
    // 아직 안 끝난 메뉴를 맡은 주방으로 가서 그 줄의 '완료'.
    const left = (order.items || []).filter((item) => !item.doneAt).map((item) => item.name);
    if (!left.length) return null;
    const menu = new URLSearchParams(doc.location?.search || "").get("menu") || "";
    if (!menu) {
      return (
        [...doc.querySelectorAll(".kt-pick__item")].find((button) => left.includes(button.querySelector("strong")?.textContent.trim())) ||
        pick(".kt-pick__all")
      );
    }
    if (menu !== "all" && !left.includes(menu)) return pick(".kt__title--menu");
    const card = kitchenCard(order.orderNo)(doc);
    // 완료를 누르고 되돌리기를 기다리는 5초 동안은 누를 곳이 없다.
    return card?.querySelector(".kt-btn--done") || null;
  }
  // 콘솔 단계인데 현황판 · QR 인쇄 화면에 가 있으면 콘솔로 돌아가는 버튼.
  if (path !== `/ops/booth/${BOOTH}`) return pick('.v2-topbar a, a[href$="/ops/booth/' + BOOTH + '"]');
  return consoleCard(order.orderNo)(doc)?.querySelector(".ops-btn--primary") || null;
}

export const pubScenario = {
  id: "pub",
  label: "주점 주문",
  shortLabel: "주문",
  subtitle: "주점 · 테이블 QR 주문 → 주방 → 서빙",
  frames,
  steps,
  progress,
  describe,
  findTarget,
  /** 누를 곳이 이 요소 안에 있으면 요소가 통째로 보이게 맞춘다. */
  scrollAnchor: ".ops-order, .kt-order",
  ideas: [
    "요리사 창에서 ‘완료’를 누르고 5초 안에 ‘되돌리기’를 누르면?",
    "메뉴 두 개를 담아 주문하고 한 메뉴만 ‘완료’하면 콘솔 카드는? 손님 폰은?",
    "주문을 두 건 넣고 나중 주문부터 ‘입금 확인’하면 요리사 창 순서는?",
    "주문 콘솔에서 조리 중인 주문을 ‘취소’하면 요리사 창은?",
    "주문 콘솔 ‘메뉴판’에서 품절로 바꾸면 손님 메뉴는?",
  ],
};
