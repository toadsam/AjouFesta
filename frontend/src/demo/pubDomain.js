// 눌러 보는 매뉴얼의 연습용 서버 · 주점 주문 쪽.
// 실제 서버(OrderService · ReservationService · BoothSummaryService)와 같은 규칙으로 답한다. 서버 규칙을 바꾸면 여기도 같이 바꾼다.
import { NOT_HANDLED, httpError } from "./demoCore";

export const DEMO_BOOTH_ID = 1;
export const DEMO_OPS_KEY = "practice";
// 최소 주문 금액(원). 실제 서버의 app.order.min-amount 기본값과 같게 둔다.
const MIN_ORDER_AMOUNT = 14000;

const ORDER_FLOW = ["PENDING_PAYMENT", "PAID", "PREPARING", "READY", "COMPLETED", "CANCELED"];
const TERMINAL = new Set(["COMPLETED", "CANCELED"]);
const ACTIVE = new Set(["PENDING_PAYMENT", "PAID", "PREPARING", "READY"]);
const KEY_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

const MENU = [
  { name: "삼겹살/볶음김치 SET", price: "9,000원", description: "삼겹살 400g · 볶음김치 100g", soldOut: false, imageUrl: "/images/booths/menu/samgyeopsal-kimchi.webp" },
  { name: "두부김치", price: "7,000원", description: "두부 300g · 김치 400g", soldOut: false, imageUrl: "/images/booths/menu/dubu-kimchi.webp" },
  { name: "짜파게티/볶음김치 SET", price: "7,000원", description: "짜파게티 2개 · 볶음김치 100g", soldOut: false, imageUrl: "/images/booths/menu/jjapaghetti-kimchi.webp" },
  { name: "어묵탕", price: "5,000원", description: "어묵 336g · 물 500ml", soldOut: false, imageUrl: "/images/booths/menu/eomuk-tang.webp" },
];

function parsePrice(label) {
  const digits = `${label ?? ""}`.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

function parseMenuBoard(raw) {
  let rows;
  try {
    rows = JSON.parse(raw || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && `${row.name ?? ""}`.trim())
    .map((row) => ({
      name: `${row.name}`.trim(),
      description: `${row.description ?? ""}`.trim(),
      priceLabel: `${row.price ?? ""}`.trim(),
      price: parsePrice(row.price),
      soldOut: row.soldOut === true || `${row.soldOut}`.toLowerCase() === "true",
      imageUrl: `${row.imageUrl ?? ""}`.trim(),
    }));
}

function randomKey(length) {
  let out = "";
  for (let i = 0; i < length; i += 1) out += KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)];
  return out;
}

export function createPubDomain({ nowMs, stamp, publish, emit }) {
  const minutesAgo = (minutes) => stamp(nowMs() - minutes * 60_000);

  function seedOrder(id, tableLabel, lines, minutes, depositorName) {
    const items = lines.map(([name, quantity], index) => {
      const unitPrice = parsePrice(MENU.find((m) => m.name === name)?.price);
      return { lineNo: index + 1, name, unitPrice, quantity, lineTotal: unitPrice * quantity, doneAt: minutesAgo(minutes - 9) };
    });
    return {
      id,
      orderNo: String(id - 100).padStart(4, "0"),
      tableLabel,
      depositorName,
      phoneNumber: "010-0000-0000",
      request: null,
      paymentMethod: "BANK_TRANSFER",
      status: "COMPLETED",
      totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
      createdAt: minutesAgo(minutes),
      paidAt: minutesAgo(minutes - 2),
      readyAt: minutesAgo(minutes - 9),
      completedAt: minutesAgo(minutes - 10),
      canceledAt: null,
      items,
      clientKey: randomKey(24),
      seed: true,
    };
  }

  function initialState() {
    const tables = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      tableName: `${index + 1}번`,
      totalSeats: 4,
      availableSeats: 4,
      displayOrder: index + 1,
      walkInSince: null,
    }));
    // 이미 손님이 앉아 있는 테이블 두 개. '25분째' · '1시간 5분째' 표시를 보여 준다.
    tables[1].walkInSince = minutesAgo(25);
    tables[4].walkInSince = minutesAgo(65);
    return {
      booth: {
        id: DEMO_BOOTH_ID,
        name: "총학생회 주점",
        latitude: 37.2776,
        longitude: 127.0444,
        description: "총학생회가 직접 여는 주점 · 주점 본부는 카페 안녕",
        displayOrder: 0,
        imageUrl: "/images/booths/주점사진.jpg",
        estimatedWaitMinutes: null,
        remainingStock: null,
        liveStatusMessage: null,
        liveStatusUpdatedAt: minutesAgo(90),
        boothIntro: null,
        menuImageUrl: null,
        menuBoardJson: JSON.stringify(MENU),
        category: "주점",
        dayPart: "야간",
        openTime: "16:00:00",
        closeTime: "23:00:00",
        tags: null,
        contentJson: null,
        reservationEnabled: true,
        orderEnabled: true,
        // 연습 화면이라 실제 계좌 대신 누가 봐도 연습용인 값을 쓴다.
        bankAccount: "연습은행 000-0000-0000",
        bankHolder: "연습용 계좌",
      },
      maxReservationMinutes: 10,
      tables,
      orders: [
        seedOrder(102, "5번", [["삼겹살/볶음김치 SET", 1], ["어묵탕", 1]], 62, "김바람"),
        seedOrder(101, "2번", [["두부김치", 1]], 24, "이갈대"),
      ],
      nextOrderId: 103,
      nextTableId: 13,
      // '자리 · 대기 안내' 흐름이 어디까지 왔는지(매뉴얼 화면이 읽는다).
      flow: { walkInTableId: null, walkInReleased: false, waitSet: false, waitCleared: false, soldOutSet: false },
    };
  }

  let state = initialState();

  /* ---------- 내보내는 모양 ---------- */
  const tableDto = (table) => {
    const inUse = Boolean(table.walkInSince);
    const status = inUse ? "IN_USE" : table.availableSeats <= 0 ? "FULL" : "AVAILABLE";
    return {
      id: table.id,
      tableName: table.tableName,
      totalSeats: table.totalSeats,
      availableSeats: table.availableSeats,
      displayOrder: table.displayOrder,
      reservableSeats: inUse ? 0 : table.availableSeats,
      occupancyStatus: status,
      occupancyLabel: status === "IN_USE" ? "이용중" : status === "FULL" ? "마감" : "예약 가능",
      activeReservationId: null,
      occupiedSince: table.walkInSince || null,
    };
  };

  const reservationState = () => ({
    maxReservationMinutes: state.maxReservationMinutes,
    tables: state.tables.map(tableDto),
    activeReservations: [],
    myReservation: null,
    penalty: null,
  });

  const boothDto = () => {
    const { orderEnabled, bankAccount, bankHolder, ...booth } = state.booth;
    const free = state.tables.filter((table) => !table.walkInSince);
    return {
      ...booth,
      reservationTableCount: state.tables.length,
      reservationAvailableSeats: free.reduce((sum, table) => sum + table.availableSeats, 0),
      reservationReservedTables: 0,
      reservationInUseTables: state.tables.length - free.length,
    };
  };

  const orderDto = (order) => {
    const { seed, ...rest } = order;
    return { ...rest, boothId: state.booth.id, boothName: state.booth.name, items: order.items.map((item) => ({ ...item })) };
  };
  const withoutClientKey = (dto) => ({ ...dto, clientKey: null });
  // 공개 실시간 통로에는 손님 이름 · 전화 · 요청 사항을 싣지 않는다(실제 서버와 같다).
  const forPublicStream = (dto) => ({ ...dto, depositorName: null, phoneNumber: null, request: null, clientKey: null });

  const opsOrders = () => ({
    orderEnabled: state.booth.orderEnabled,
    bankAccount: state.booth.bankAccount,
    bankHolder: state.booth.bankHolder,
    orders: [...state.orders].sort((a, b) => b.id - a.id).map((order) => withoutClientKey(orderDto(order))),
  });

  // BoothSummaryService 와 같은 셈법: 매출 · 메뉴별 판매량은 입금 확인된 주문만(입금 대기 · 취소 제외).
  const summary = () => {
    const completed = state.orders.filter((order) => order.status === "COMPLETED");
    const canceled = state.orders.filter((order) => order.status === "CANCELED");
    const paidLike = state.orders.filter((order) => order.status !== "CANCELED" && order.status !== "PENDING_PAYMENT");
    const tally = new Map();
    paidLike.forEach((order) => order.items.forEach((item) => {
      const row = tally.get(item.name) || { name: item.name, quantity: 0, amount: 0 };
      row.quantity += item.quantity;
      row.amount += item.quantity * item.unitPrice;
      tally.set(item.name, row);
    }));
    const ordersByHour = {};
    for (let hour = 0; hour < 24; hour += 1) ordersByHour[String((hour + 6) % 24).padStart(2, "0")] = 0;
    state.orders.forEach((order) => {
      ordersByHour[order.createdAt.slice(11, 13)] += 1;
    });
    const peak = Object.entries(ordersByHour).sort((x, y) => y[1] - x[1])[0];
    const today = stamp().slice(0, 10);
    return {
      date: today,
      from: `${today}T06:00:00`,
      to: `${today}T06:00:00`,
      orderCount: state.orders.length,
      completedOrderCount: completed.length,
      canceledOrderCount: canceled.length,
      revenue: paidLike.reduce((sum, order) => sum + order.totalAmount, 0),
      completedRevenue: completed.reduce((sum, order) => sum + order.totalAmount, 0),
      topItems: [...tally.values()].sort((x, y) => y.quantity - x.quantity).slice(0, 8),
      reservationCount: 0,
      checkedInCount: 0,
      noShowCount: 0,
      tableTurns: 0,
      averageWaitMinutes: 0,
      peakHour: peak && peak[1] > 0 ? `${peak[0]}시` : "",
      ordersByHour,
    };
  };

  /* ---------- 규칙 ---------- */
  function requireOps(headers) {
    if ((headers["x-ops-key"] || "") !== DEMO_OPS_KEY) throw httpError(401, "운영 키가 올바르지 않습니다.");
  }

  function findTable(tableId) {
    const table = state.tables.find((item) => String(item.id) === String(tableId));
    if (!table) throw httpError(404, "Table not found.");
    return table;
  }

  function createOrder(body, role) {
    if (!state.booth.orderEnabled) throw httpError(409, "이 부스는 지금 주문을 받지 않습니다.");
    if (body?.paymentMethod && body.paymentMethod !== "BANK_TRANSFER") throw httpError(400, "지금은 계좌이체만 가능합니다.");
    const depositorName = `${body?.depositorName ?? ""}`.trim();
    const phoneNumber = `${body?.phoneNumber ?? ""}`.trim();
    // OrderCreateRequestDto 의 검사와 같다: 입금자명 필수, 휴대폰 번호 필수(숫자 9자리 이상).
    if (!depositorName || !phoneNumber || !/^[0-9+()\-\s]+$/.test(phoneNumber) || phoneNumber.replace(/\D/g, "").length < 9) {
      throw httpError(400, "입력값을 다시 확인해 주세요.");
    }
    const tableLabel = `${body?.tableLabel ?? ""}`.trim().slice(0, 40);
    if (!tableLabel) throw httpError(400, "테이블 번호가 없습니다.");
    const table = state.tables.find((item) => item.tableName === tableLabel);
    // 포장(OrderService.TAKEOUT_LABEL): 테이블 목록 검사 · 테이블당 한도 · 자리 '이용 중' 표시를 건너뛴다.
    const takeout = tableLabel === "포장";
    if (!takeout && state.tables.length && !table) throw httpError(400, "없는 테이블 번호입니다. 테이블의 QR을 다시 찍어 주세요.");

    const menu = new Map(parseMenuBoard(state.booth.menuBoardJson).map((item) => [item.name, item]));
    const quantities = new Map();
    (Array.isArray(body?.items) ? body.items : []).forEach((line) => {
      const name = `${line?.name ?? ""}`.trim();
      if (!name) return;
      quantities.set(name, (quantities.get(name) || 0) + Math.max(1, Number(line.quantity) || 1));
    });
    if (!quantities.size) throw httpError(400, "담긴 메뉴가 없습니다.");
    if ([...quantities.values()].reduce((a, b) => a + b, 0) > 20) throw httpError(400, "한 번에 20개까지 주문할 수 있습니다.");
    if (!takeout && state.orders.filter((order) => order.tableLabel === tableLabel && ACTIVE.has(order.status)).length >= 5) {
      throw httpError(409, "이 테이블에 처리 중인 주문이 너무 많습니다. 스태프에게 말씀해 주세요.");
    }

    const items = [...quantities.entries()].map(([name, quantity], index) => {
      const menuItem = menu.get(name);
      if (!menuItem) throw httpError(400, `메뉴판에 없는 메뉴입니다: ${name}`);
      if (menuItem.soldOut) throw httpError(409, `품절된 메뉴입니다: ${name}`);
      return { lineNo: index + 1, name, unitPrice: menuItem.price, quantity, lineTotal: menuItem.price * quantity, doneAt: null };
    });

    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    if (MIN_ORDER_AMOUNT > 0 && total < MIN_ORDER_AMOUNT) {
      throw httpError(400, `주문은 ${MIN_ORDER_AMOUNT.toLocaleString("ko-KR")}원부터 가능합니다. ${(MIN_ORDER_AMOUNT - total).toLocaleString("ko-KR")}원 더 담아 주세요.`);
    }
    const now = stamp();
    const id = state.nextOrderId;
    state.nextOrderId += 1;
    const order = {
      id,
      orderNo: String(id - 100).padStart(4, "0"),
      tableLabel,
      depositorName,
      phoneNumber,
      request: `${body?.request ?? ""}`.trim() || null,
      paymentMethod: "BANK_TRANSFER",
      status: "PENDING_PAYMENT",
      totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
      createdAt: now,
      paidAt: null,
      readyAt: null,
      completedAt: null,
      canceledAt: null,
      items,
      clientKey: randomKey(24),
    };
    state.orders.push(order);

    // 주문이 들어온 테이블은 '이용 중'이 된다. 이미 이용 중이면 앉은 시각을 그대로 둔다.
    let seated = false;
    if (!takeout && table && !table.walkInSince) {
      table.walkInSince = now;
      seated = true;
      publish("reservations", { boothId: state.booth.id, tableId: table.id, status: "WALK_IN" });
    }
    const dto = orderDto(order);
    publish("orders", forPublicStream(dto));
    emit({ type: "order.created", role, order: withoutClientKey(dto), seated });
    return dto;
  }

  function updateOrderStatus(orderId, next, role) {
    const order = state.orders.find((item) => String(item.id) === String(orderId));
    if (!order) throw httpError(404, "주문을 찾을 수 없습니다.");
    if (!ORDER_FLOW.includes(next)) throw httpError(400, "알 수 없는 주문 상태입니다.");
    if (TERMINAL.has(order.status)) throw httpError(409, "이미 끝난 주문입니다.");
    if (next !== "CANCELED" && ORDER_FLOW.indexOf(next) <= ORDER_FLOW.indexOf(order.status)) {
      throw httpError(409, "주문 상태는 뒤로 돌릴 수 없습니다.");
    }
    const now = stamp();
    const from = order.status;
    order.status = next;
    if (next === "CANCELED") {
      order.canceledAt = now;
    } else {
      order.paidAt = order.paidAt || now;
      if (next === "READY") order.readyAt = now;
      if (next === "COMPLETED") {
        order.readyAt = order.readyAt || now;
        order.completedAt = now;
      }
      // 콘솔에서 '준비 완료'를 대신 누르거나 서빙이 끝나면 남은 줄도 모두 끝난 것으로(BoothOrder.transitionTo 와 같다).
      if (next === "READY" || next === "COMPLETED") order.items.forEach((item) => { item.doneAt = item.doneAt || now; });
    }
    const dto = withoutClientKey(orderDto(order));
    publish("orders", forPublicStream(dto));
    emit({ type: "order.status", role, order: dto, from });
    return dto;
  }

  // 메뉴별 요리사 창의 '완료'(OrderService.markItemDone): 입금 확인된 주문만. 첫 줄이 끝나면 PREPARING, 모든 줄이 끝나면 READY.
  function markItemDone(orderId, lineNo, role) {
    const order = state.orders.find((item) => String(item.id) === String(orderId));
    if (!order) throw httpError(404, "주문을 찾을 수 없습니다.");
    const item = order.items.find((line) => line.lineNo === lineNo);
    if (!item) throw httpError(404, "주문에 없는 메뉴입니다.");
    if (TERMINAL.has(order.status)) throw httpError(409, "이미 끝난 주문입니다.");
    if (order.status === "PENDING_PAYMENT") throw httpError(409, "아직 입금 확인 전 주문입니다.");
    if (item.doneAt) return withoutClientKey(orderDto(order));
    const now = stamp();
    const from = order.status;
    item.doneAt = now;
    if (order.items.every((line) => line.doneAt)) {
      order.status = "READY";
      order.readyAt = now;
    } else if (order.status === "PAID") {
      order.status = "PREPARING";
    }
    const dto = withoutClientKey(orderDto(order));
    publish("orders", forPublicStream(dto));
    emit({ type: "order.item", role, order: dto, item: { lineNo: item.lineNo, name: item.name, quantity: item.quantity }, from });
    return dto;
  }

  const seatCount = () => ({ free: state.tables.filter((table) => !table.walkInSince).length, total: state.tables.length });

  function setTable(tableId, occupied, role) {
    const table = findTable(tableId);
    if (occupied) {
      table.walkInSince = stamp();
      if (state.flow.walkInTableId == null) state.flow.walkInTableId = table.id;
      publish("reservations", { boothId: state.booth.id, tableId: table.id, status: "WALK_IN" });
      publish("booths", [boothDto()]);
      emit({ type: "table.occupied", role, table: tableDto(table), ...seatCount() });
      return tableDto(table);
    }
    if (!table.walkInSince) throw httpError(404, "Active table reservation not found.");
    table.walkInSince = null;
    if (state.flow.walkInTableId === table.id) state.flow.walkInReleased = true;
    publish("reservations", { boothId: state.booth.id, tableId: table.id, status: "RELEASED" });
    publish("booths", [boothDto()]);
    emit({ type: "table.released", role, table: tableDto(table), ...seatCount() });
    return undefined;
  }

  function updateLiveStatus(body, role) {
    const before = parseMenuBoard(state.booth.menuBoardJson);
    const old = { wait: state.booth.estimatedWaitMinutes, message: state.booth.liveStatusMessage };
    // 대기 시간 · 남은 재고 · 안내 한 줄은 온 값 그대로(비어 오면 지움), 나머지는 값이 올 때만 바꾼다.
    ["estimatedWaitMinutes", "remainingStock", "liveStatusMessage"].forEach((key) => {
      state.booth[key] = body?.[key] ?? null;
    });
    ["boothIntro", "menuImageUrl", "menuBoardJson", "category", "dayPart", "tags", "contentJson"].forEach((key) => {
      if (body?.[key] != null) state.booth[key] = body[key];
    });
    ["openTime", "closeTime"].forEach((key) => {
      if (body?.[key]) state.booth[key] = `${body[key]}`.length === 5 ? `${body[key]}:00` : body[key];
    });
    if (typeof body?.reservationEnabled === "boolean") state.booth.reservationEnabled = body.reservationEnabled;
    state.booth.liveStatusUpdatedAt = stamp();
    const after = parseMenuBoard(state.booth.menuBoardJson);
    const flipped = after.filter((item) => {
      const old = before.find((row) => row.name === item.name);
      return old && old.soldOut !== item.soldOut;
    });
    const wait = Number(state.booth.estimatedWaitMinutes) || 0;
    if (wait > 0) state.flow.waitSet = true;
    else if (state.flow.waitSet) state.flow.waitCleared = true;
    if (flipped.some((item) => item.soldOut)) state.flow.soldOutSet = true;
    const dto = boothDto();
    publish("booths", [dto]);
    emit({
      type: "booth.updated",
      role,
      soldOut: flipped.map((item) => ({ name: item.name, soldOut: item.soldOut })),
      wait: { before: Number(old.wait) || 0, after: wait },
      message: { before: old.message || "", after: state.booth.liveStatusMessage || "" },
    });
    return dto;
  }

  function updateTables(body, role) {
    const minutes = Number(body?.maxReservationMinutes);
    if (Number.isFinite(minutes) && minutes >= 1) state.maxReservationMinutes = minutes;
    const rows = Array.isArray(body?.tables) ? body.tables : [];
    state.tables = rows
      .filter((row) => `${row?.tableName ?? ""}`.trim())
      .map((row, index) => {
        const old = row.id != null ? state.tables.find((table) => String(table.id) === String(row.id)) : null;
        const totalSeats = Math.max(1, Number(row.totalSeats) || 1);
        let id = old?.id;
        if (id == null) {
          id = state.nextTableId;
          state.nextTableId += 1;
        }
        return {
          id,
          tableName: `${row.tableName}`.trim(),
          totalSeats,
          availableSeats: Math.min(totalSeats, Math.max(0, Number(row.availableSeats) || 0)),
          displayOrder: index + 1,
          walkInSince: old?.walkInSince || null,
        };
      });
    publish("reservations", { boothId: state.booth.id, status: "CONFIG" });
    emit({ type: "tables.updated", role, ...seatCount() });
    return reservationState();
  }

  function updateOrderConfig(body, role) {
    const before = state.booth.orderEnabled;
    if (typeof body?.orderEnabled === "boolean") state.booth.orderEnabled = body.orderEnabled;
    state.booth.bankAccount = `${body?.bankAccount ?? ""}`.trim();
    state.booth.bankHolder = `${body?.bankHolder ?? ""}`.trim();
    emit({ type: "order.config", role, orderEnabled: state.booth.orderEnabled, toggled: before !== state.booth.orderEnabled });
    return opsOrders();
  }

  /* ---------- 길 찾기 ---------- */
  function route(method, path, query, body, headers, role) {
    const boothPath = `/booths/${DEMO_BOOTH_ID}`;
    const opsPath = `/ops/booth/${DEMO_BOOTH_ID}`;
    let match;

    if (method === "GET" && path === "/booths") return [boothDto()];
    if (method === "GET" && path === boothPath) return boothDto();
    if (method === "GET" && path === `${boothPath}/congestion`) {
      return { boothId: state.booth.id, boothName: state.booth.name, level: "보통", nearbyUserCount: 12 };
    }
    if (method === "GET" && path === `${boothPath}/reservations`) return reservationState();
    if (method === "GET" && path === `${boothPath}/order-menu`) {
      return {
        boothId: state.booth.id,
        boothName: state.booth.name,
        boothCategory: state.booth.category,
        boothImageUrl: state.booth.imageUrl,
        boothIntro: state.booth.boothIntro,
        openTime: state.booth.openTime?.slice(0, 5) ?? null,
        closeTime: state.booth.closeTime?.slice(0, 5) ?? null,
        tableLabel: `${query.get("table") ?? ""}`.trim(),
        orderEnabled: state.booth.orderEnabled,
        bankAccount: state.booth.bankAccount,
        bankHolder: state.booth.bankHolder,
        items: parseMenuBoard(state.booth.menuBoardJson),
        minOrderAmount: MIN_ORDER_AMOUNT,
      };
    }
    if (method === "POST" && path === `${boothPath}/orders`) return createOrder(body, role);
    match = path.match(/^\/orders\/(\d+)$/);
    if (method === "GET" && match) {
      const order = state.orders.find((item) => String(item.id) === match[1]);
      if (!order) throw httpError(404, "주문을 찾을 수 없습니다.");
      if ((query.get("key") || "").trim() !== order.clientKey) throw httpError(403, "주문 조회 키가 맞지 않습니다.");
      return orderDto(order);
    }

    if (path.startsWith(opsPath)) {
      requireOps(headers);
      const rest = path.slice(opsPath.length);
      if (method === "GET" && rest === "/bootstrap") {
        return {
          booth: boothDto(),
          congestion: { boothId: state.booth.id, boothName: state.booth.name, level: "보통", nearbyUserCount: 12 },
          reservations: reservationState(),
        };
      }
      if (method === "GET" && rest === "/reservations") return reservationState();
      if (method === "PUT" && rest === "/reservations/config") return updateTables(body, role);
      match = rest.match(/^\/reservations\/tables\/(\d+)\/(occupy|release)$/);
      if (method === "POST" && match) return setTable(match[1], match[2] === "occupy", role);
      if (method === "GET" && rest === "/orders") return opsOrders();
      if (method === "PUT" && rest === "/orders/config") return updateOrderConfig(body, role);
      match = rest.match(/^\/orders\/(\d+)\/status$/);
      if (method === "PUT" && match) return updateOrderStatus(match[1], body?.status, role);
      match = rest.match(/^\/orders\/(\d+)\/items\/(\d+)\/done$/);
      if (method === "PUT" && match) return markItemDone(match[1], Number(match[2]), role);
      if (method === "GET" && rest === "/summary") return summary();
      if (method === "GET" && rest === "/orders/history") {
        const orders = opsOrders().orders || [];
        const paid = orders.filter((order) => order.status !== "PENDING_PAYMENT" && order.status !== "CANCELED");
        const today = stamp().slice(0, 10);
        return {
          date: today,
          from: null,
          to: null,
          days: orders.length ? [{ date: today, orderCount: orders.length, paidRevenue: paid.reduce((sum, order) => sum + (order.totalAmount || 0), 0) }] : [],
          orderCount: orders.length,
          completedOrderCount: orders.filter((order) => order.status === "COMPLETED").length,
          canceledOrderCount: orders.filter((order) => order.status === "CANCELED").length,
          paidRevenue: paid.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
          orders: [...orders].reverse(),
        };
      }
      if (method === "GET" && rest === "/orders/history.csv") throw httpError(400, "연습 화면에서는 CSV 를 내려받을 수 없어요.");
      if (method === "PUT" && rest === "/live-status") return updateLiveStatus(body, role);
      if (method === "POST" && /image$/.test(rest)) throw httpError(400, "연습 화면에서는 사진을 올릴 수 없어요.");
    }

    return NOT_HANDLED;
  }

  return {
    route,
    snapshot() {
      return {
        orders: state.orders.map((order) => ({ ...withoutClientKey(orderDto(order)), seed: Boolean(order.seed) })),
        tables: state.tables.map(tableDto),
        menu: parseMenuBoard(state.booth.menuBoardJson),
        orderEnabled: state.booth.orderEnabled,
        booth: boothDto(),
        flow: { ...state.flow },
      };
    },
    reset() {
      state = initialState();
    },
  };
}
