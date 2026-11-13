// 테이블 QR 주문 장바구니 + 내가 낸 주문 기억 (둘 다 localStorage).
const CART_PREFIX = "festflow_order_cart:";
const MY_ORDERS_KEY = "festflow_my_orders";
const ORDER_MEMORY_HOURS = 12;

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function read(key, fallback) {
  try {
    return safeParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 조용히 넘긴다 (시크릿 모드 등)
  }
}

function cartKey(boothId, table) {
  return `${CART_PREFIX}${boothId}:${table}`;
}

export function getCart(boothId, table) {
  const cart = read(cartKey(boothId, table), { items: [] });
  return Array.isArray(cart.items) ? cart.items : [];
}

export function setCart(boothId, table, items) {
  write(cartKey(boothId, table), { items, updatedAt: Date.now() });
  return items;
}

export function addToCart(boothId, table, name, quantity) {
  const items = getCart(boothId, table);
  const existing = items.find((item) => item.name === name);
  const next = existing
    ? items.map((item) => (item.name === name ? { ...item, quantity: item.quantity + quantity } : item))
    : [...items, { name, quantity }];
  return setCart(boothId, table, next);
}

export function updateCartQuantity(boothId, table, name, quantity) {
  const items = getCart(boothId, table);
  const next = quantity <= 0
    ? items.filter((item) => item.name !== name)
    : items.map((item) => (item.name === name ? { ...item, quantity } : item));
  return setCart(boothId, table, next);
}

export function clearCart(boothId, table) {
  try {
    localStorage.removeItem(cartKey(boothId, table));
  } catch {
    // ignore
  }
}

export function rememberOrder(order) {
  const list = read(MY_ORDERS_KEY, []).filter((item) => item && item.id !== order.id);
  const next = [
    {
      id: order.id,
      clientKey: order.clientKey,
      boothId: order.boothId,
      tableLabel: order.tableLabel,
      createdAt: order.createdAt || new Date().toISOString(),
    },
    ...list,
  ].slice(0, 20);
  write(MY_ORDERS_KEY, next);
}

export function getRememberedOrder(orderId) {
  return read(MY_ORDERS_KEY, []).find((item) => String(item?.id) === String(orderId)) || null;
}

export function getLatestOrderForTable(boothId, table) {
  const cutoff = Date.now() - ORDER_MEMORY_HOURS * 60 * 60 * 1000;
  return (
    read(MY_ORDERS_KEY, []).find(
      (item) =>
        item &&
        String(item.boothId) === String(boothId) &&
        String(item.tableLabel) === String(table) &&
        new Date(item.createdAt).getTime() > cutoff,
    ) || null
  );
}

// 포장 주문: 테이블 이름 자리에 이 글자가 온다(/order/{부스}/포장). 서버 OrderService.TAKEOUT_LABEL 과 같아야 한다.
export const TAKEOUT_TABLE = "포장";
// 포장 음식을 받는 곳. 손님 화면에 그대로 적는다.
export const TAKEOUT_PICKUP = "총학 주점";

export function isTakeout(table) {
  return String(table ?? "").trim() === TAKEOUT_TABLE;
}

/** "3번 테이블" / "포장" — 스태프 화면 · 알림에 쓰는 이름. */
export function tableName(table) {
  return isTakeout(table) ? "포장" : `${table} 테이블`;
}

export function formatWon(value) {
  const number = Number(value) || 0;
  return `${number.toLocaleString("ko-KR")}원`;
}
