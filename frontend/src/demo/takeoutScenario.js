// 눌러 보는 매뉴얼 · 포장 주문 흐름. 화면 셋(손님 폰 · 주문 콘솔 · 요리사 창)은 주점 주문 흐름과 같고 규칙도 pubDomain.js 를 같이 쓴다.
// 포장 고르기 → 주문 → 입금 확인(콘솔) → 메뉴별 완료(요리사 창) → 모든 메뉴가 끝나면 손님이 번호를 보여 주면 건네줌(콘솔). 자리를 안 쓰니 비우기 단계가 없다.
import { DEMO_BOOTH_ID, DEMO_OPS_KEY } from "./pubDomain";
import { TAKEOUT_PICKUP, isTakeout } from "../utils/orderCart";

const BOOTH = DEMO_BOOTH_ID;
const OPS_KEY_STORAGE = "festflow_ops_booth_key";
const STATUS_INDEX = { PENDING_PAYMENT: 0, PAID: 1, PREPARING: 2, READY: 3, COMPLETED: 4 };
const GUEST = "takeGuest";
const CONSOLE = "takeConsole";
const KITCHEN = "takeKitchen";

const won = (value) => `${Number(value || 0).toLocaleString("ko-KR")}원`;
// 이 흐름에서 손님이 포장 대신 테이블을 골라 주문해도 글이 어색하지 않게.
const where = (order) => (isTakeout(order.tableLabel) ? `포장 #${order.orderNo}` : `${order.tableLabel} 테이블`);

const frames = [
  {
    id: GUEST,
    who: "손님",
    label: "손님 폰",
    sub: "공용 QR을 찍은 화면 · 포장 QR이면 바로 메뉴가 열려요",
    home: `/order/${BOOTH}`,
    allow: [new RegExp(`^/order/${BOOTH}(/|$)`), /^\/orders\/\d+$/],
  },
  {
    id: CONSOLE,
    who: "스태프",
    label: "주문 콘솔",
    sub: "입금을 확인하고 포장을 건네주는 스태프 화면",
    home: `/ops/booth/${BOOTH}`,
    allow: [new RegExp(`^/ops/booth/${BOOTH}(/tables|/table-qr)?$`)],
    staff: true,
    session: [[OPS_KEY_STORAGE, DEMO_OPS_KEY]],
  },
  {
    id: KITCHEN,
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
    frame: GUEST,
    title: "‘포장해 갈게요’를 누르고 주문하기",
    body: `테이블 번호 대신 맨 위 ‘포장해 갈게요’를 눌러요(포장 QR을 찍으면 이 화면 없이 바로 메뉴가 열려요). 메뉴를 담고 입금자명 · 휴대폰 번호를 넣어 ‘주문하기’. 음식은 ${TAKEOUT_PICKUP}에서 받아요.`,
  },
  {
    key: "paid",
    frame: CONSOLE,
    title: "‘입금 확인’ 누르기",
    body: "포장 주문은 카드에 주황색 ‘포장’과 주문번호 · 전화 끝번호가 보여요. 입금을 확인하고 ‘입금 확인’을 눌러요. 테이블 주문과 같은 줄에 서요.",
  },
  {
    key: "ready",
    frame: KITCHEN,
    title: "맡은 메뉴를 고르고, 다 담으면 ‘완료’ 누르기",
    body: "요리사 창은 주방마다 맡은 메뉴만 봐요. 포장도 입금 확인된 순서 그대로이고, ‘포장 · 용기에 담아요’가 붙은 카드는 그릇 대신 포장 용기에 담아요. 메뉴가 둘 이상이면 위쪽 메뉴 이름을 눌러 다른 주방으로 바꿔 마저 완료해요. 모든 메뉴가 끝나면 5초 뒤 콘솔 ‘서빙할 것’으로 넘어가고, 손님 폰이 ‘포장이 나왔어요! 지금 받으러 오세요’로 바뀌며 진동해요.",
  },
  {
    key: "complete",
    frame: CONSOLE,
    title: "번호를 확인하고 ‘건네줌’ 누르기",
    body: "손님이 폰의 주문번호를 보여 주면 카드의 번호와 맞춰 보고 건네준 뒤 ‘건네줌’. 안 오면 카드의 전화번호를 눌러 바로 전화해요. 포장은 자리를 안 쓰니 현황판에서 비울 것이 없어요.",
  },
];

function progress(snapshot) {
  const order = snapshot.pub.orders.filter((item) => !item.seed).sort((a, b) => b.id - a.id)[0] || null;
  const index = order ? STATUS_INDEX[order.status] ?? -1 : -1;
  const canceled = order?.status === "CANCELED";
  return {
    done: {
      order: Boolean(order),
      paid: canceled || index >= 1,
      ready: canceled || index >= 3,
      complete: canceled || index >= 4,
    },
    context: { order },
    titles: {},
  };
}

const kitchenCard = (orderNo) => (doc) =>
  [...doc.querySelectorAll(".kt-order")].find((node) => node.querySelector(".kt-order__meta")?.textContent.includes(`#${orderNo}`)) || null;
const consoleCard = (orderNo) => (doc) =>
  [...doc.querySelectorAll(".ops-order")].find((node) => node.querySelector(".ops-order__meta")?.textContent.includes(`#${orderNo}`)) || null;

function describe(event) {
  const from = frames.some((frame) => frame.id === event.role) ? event.role : CONSOLE;
  if (event.type === "order.created") {
    const takeout = isTakeout(event.order.tableLabel);
    return {
      from,
      cause: takeout
        ? `손님이 포장으로 주문했어요 (${won(event.order.totalAmount)})`
        : `손님이 ${event.order.tableLabel} 테이블에서 주문했어요 (${won(event.order.totalAmount)})`,
      effects: [
        {
          frame: GUEST,
          text: takeout
            ? "‘주문이 완료되었어요’ 화면에 큰 포장 주문번호와 입금 계좌가 보여요."
            : "‘주문이 완료되었어요’ 화면으로 넘어가고 입금 계좌가 보여요.",
        },
        {
          frame: CONSOLE,
          text: takeout
            ? "‘새 주문 · 포장’ 띠와 소리가 나고, ‘포장’ 꼬리표가 붙은 카드가 ‘입금 대기’로 생겨요. 자리 현황판은 그대로예요(포장은 자리를 안 써요)."
            : `‘새 주문 · ${event.order.tableLabel} 테이블’ 띠와 소리가 나고, 주문 카드가 ‘입금 대기’로 생겨요.`,
        },
        { frame: KITCHEN, quiet: true, text: "아직 아무것도 안 떠요. 입금이 확인된 주문만 떠요." },
      ],
    };
  }
  if (event.type === "order.item") {
    const table = where(event.order);
    const no = event.order.orderNo;
    const menu = event.item.name;
    const items = event.order.items || [];
    const done = items.filter((item) => item.doneAt).length;
    if (event.order.status === "READY") {
      return {
        from,
        cause: `${menu} 주방이 ${table} 주문의 ‘${menu}’ 완료를 눌렀어요 — 이 주문의 메뉴가 모두 끝났어요`,
        effects: [
          { frame: GUEST, text: "포장이면 ‘포장이 나왔어요! 지금 받으러 오세요’로 바뀌며 진동해요 · 테이블이면 ‘준비가 끝났어요!’로 바뀌어요." },
          {
            frame: CONSOLE,
            show: (doc) => doc.querySelector(".ops-serve"),
            text: `‘음식 나왔어요’ 띠와 소리가 나고, 맨 위 ‘서빙할 것’에 올라와요(포장이면 ‘건네줌’ 버튼과 함께).`,
          },
          { frame: KITCHEN, text: `카드가 빠지고, 맨 아래 ‘다 만든 주문 · 서빙 기다리는 중’에 ${table}이 남아요.` },
        ],
      };
    }
    return {
      from,
      cause: `${menu} 주방이 ${table} 주문의 ‘${menu}’ 완료를 눌렀어요 (메뉴 ${done}/${items.length})`,
      effects: [
        { frame: GUEST, quiet: event.from !== "PAID", text: "‘조리 중이에요’로 바뀌어요." },
        { frame: CONSOLE, show: consoleCard(no), text: `카드의 ‘${menu}’에 ✓가 붙고 ‘메뉴 ${done}/${items.length} 완료’가 보여요. 아직 ‘서빙할 것’엔 안 올라가요.` },
        { frame: KITCHEN, text: "이 주방에서는 카드가 빠져요(‘내 몫은 끝난 주문’에 남아요). 남은 메뉴를 맡은 주방이 완료해야 서빙할 것으로 넘어가요 — 위 메뉴 이름을 눌러 그 주방으로 바꿔 보세요." },
      ],
    };
  }
  if (event.type !== "order.status") return null;

  const takeout = isTakeout(event.order.tableLabel);
  const name = where(event.order);
  const no = event.order.orderNo;
  const byKitchen = from === KITCHEN;
  const wasInKitchen = event.from === "PAID" || event.from === "PREPARING";
  const map = {
    PAID: {
      cause: `스태프가 ${name} 주문의 ‘입금 확인’을 눌렀어요`,
      effects: [
        { frame: GUEST, text: "‘입금이 확인됐어요’로 바뀌고 입금 계좌 안내가 사라져요." },
        { frame: CONSOLE, text: "주문 카드가 ‘입금 확인’으로 바뀌고 ‘요리사 창에 떠 있어요’가 보여요." },
        {
          frame: KITCHEN,
          show: kitchenCard(no),
          text: takeout
            ? "그 메뉴를 맡은 주방에 소리와 함께 ‘포장 · 용기에 담아요’ 카드가 떠요(메뉴를 안 골랐으면 고르는 화면). 왼쪽 주황 띠로 테이블 주문과 구분돼요."
            : "그 메뉴를 맡은 주방에 소리와 함께 주문 카드가 떠요.",
        },
      ],
    },
    PREPARING: {
      cause: byKitchen ? `요리사가 ${name} 주문의 ‘조리 시작’을 눌렀어요` : `스태프가 콘솔에서 ${name} 주문의 ‘조리 시작’을 대신 눌렀어요`,
      effects: [
        { frame: GUEST, text: "‘조리 중이에요’로 바뀌어요." },
        { frame: CONSOLE, show: byKitchen ? consoleCard(no) : undefined, text: "주문 카드가 ‘조리 중’으로 바뀌어요." },
        { frame: KITCHEN, show: byKitchen ? undefined : kitchenCard(no), text: "카드 테두리가 보라색 ‘조리 중’으로 바뀌고 버튼이 ‘완료’가 돼요." },
      ],
    },
    READY: {
      cause: byKitchen ? `요리사가 ${name} 주문을 ‘완료’했어요` : `스태프가 콘솔에서 ${name} 주문의 ‘준비 완료’를 대신 눌렀어요(남은 메뉴를 모두 완료로)`,
      effects: [
        {
          frame: GUEST,
          text: takeout
            ? `‘포장이 나왔어요!’로 바뀌고 번호 카드가 주황색 ‘지금 받으러 오세요’가 돼요. 폰이 진동해요(아이폰은 화면만 바뀌어요).`
            : "‘준비가 끝났어요!’로 바뀌어요.",
        },
        {
          frame: CONSOLE,
          show: (doc) => doc.querySelector(".ops-serve"),
          text: takeout
            ? "‘음식 나왔어요 · 포장 … 손님이 받으러 와요’ 띠와 소리가 나고, 맨 위 ‘서빙할 것’에 ‘건네줌’ 버튼과 함께 올라와요."
            : "맨 위 ‘서빙할 것’에 올라와요.",
        },
        {
          frame: KITCHEN,
          show: byKitchen ? undefined : (doc) => doc.querySelector(".kt-served"),
          text: `카드가 목록에서 빠지고, 맨 아래 ‘다 만든 주문’에 ${takeout ? `포장 #${no}` : event.order.tableLabel}이 남아요.`,
        },
      ],
    },
    COMPLETED: {
      cause: takeout ? `스태프가 ${name}을 손님에게 ‘건네줌’ 했어요` : `스태프가 ${name} 주문의 ‘서빙 완료’를 눌렀어요`,
      effects: [
        { frame: GUEST, text: "‘맛있게 드세요!’로 바뀌어요." },
        { frame: CONSOLE, text: "‘서빙할 것’에서 빠져요. ‘오늘 전체’를 누르면 다시 볼 수 있어요." },
        { frame: KITCHEN, quiet: event.from !== "READY", text: "‘다 만든 주문’에서 빠져요." },
      ],
    },
    CANCELED: {
      cause: `스태프가 ${name} 주문을 취소했어요`,
      effects: [
        { frame: GUEST, text: "‘주문이 취소되었어요’로 바뀌어요." },
        { frame: CONSOLE, text: "‘처리 중’ 목록에서 빠져요." },
        wasInKitchen
          ? { frame: KITCHEN, text: "주방에 떠 있던 카드가 사라져요. 만들던 음식은 멈춰요." }
          : { frame: KITCHEN, quiet: true, text: "입금 전이라 요리사 창에는 뜬 적이 없어요." },
      ],
    },
  };
  return map[event.order.status] ? { from, ...map[event.order.status] } : null;
}

function findTarget(stepKey, doc, { order }) {
  const pick = (selector) => doc.querySelector(selector);
  const path = decodeURIComponent(doc.location?.pathname || "");
  if (stepKey === "order") {
    if (path.startsWith("/orders/")) return pick(".od-fixed .od-ghost");
    // 테이블 고르는 화면: 맨 위 '포장해 갈게요'.
    if (path === `/order/${BOOTH}`) return pick(".od-takeout-link");
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
  if (path !== `/ops/booth/${BOOTH}`) return pick('.v2-topbar a, a[href$="/ops/booth/' + BOOTH + '"]');
  return consoleCard(order.orderNo)(doc)?.querySelector(".ops-btn--primary") || null;
}

export const takeoutScenario = {
  id: "takeout",
  label: "포장 주문",
  shortLabel: "포장",
  subtitle: `주점 · 포장 주문 → 주방 → ${TAKEOUT_PICKUP}에서 건네주기`,
  frames,
  steps,
  progress,
  describe,
  findTarget,
  scrollAnchor: ".ops-order, .kt-order",
  ideas: [
    "포장 주문과 테이블 주문을 하나씩 넣으면 요리사 창 순서는?",
    "포장에 메뉴 두 개를 담고 한 메뉴만 ‘완료’하면 손님 폰은 아직 ‘조리 중’일까?",
    "포장 주문을 여섯 건 넘게 넣어도 받아질까? (테이블은 처리 중 5건까지)",
    "포장 주문을 넣은 뒤 콘솔 위 ‘현황판’을 열면 자리가 바뀌었을까?",
  ],
};
