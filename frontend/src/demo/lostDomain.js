// 연습용 서버 · 분실물.
// 실제 서버의 LostItemService · LostItemController 규칙을 그대로 옮겼다. 서버 규칙을 바꾸면 여기도 같이 바꾼다.
// (이번 축제는 화면에서 '내 물건이에요' 요청을 꺼 두었지만, 서버 규칙은 그대로라 여기에도 남겨 둔다.)
import { NOT_HANDLED, httpError, parseStamp } from "./demoCore";
import { DEMO_ADMIN_TOKEN } from "./aimatchDomain";
import { DEMO_ADMIN_NAME } from "./festDomain";

export const LOST_BUNDLE_CATEGORY = "잡화 모음";

const trimOrNull = (value) => {
  const text = value == null ? "" : `${value}`.trim();
  return text || null;
};

// 손님에게 나가는 연락처는 가운데를 가린다.
function maskContact(contact) {
  if (contact == null || !`${contact}`.trim()) return contact;
  const trimmed = `${contact}`.trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length >= 7) return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  if (trimmed.length <= 4) return "****";
  return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
}

const STATUS_LABEL = { REGISTERED: "Registered", OWNER_CLAIMED: "Owner Claimed", RETURNED: "Returned" };
const normalizeStatus = (status) => {
  const value = `${status || ""}`.trim().toUpperCase();
  return value === "OWNER_CLAIMED" || value === "RETURNED" ? value : "REGISTERED";
};

/** 총괄 화면의 등록 방식: 학생증 · 카드(사진 없이 가린 이름) / 잡화 모음(상자 사진 한 장) / 물건 하나. */
export function lostKind(item) {
  if (item.category === LOST_BUNDLE_CATEGORY) return "bundle";
  if (/^(학생증|카드)( · |$)/.test(item.title || "")) return "name";
  return "item";
}

export function createLostDomain({ nowMs, stamp, publish, emit }) {
  let state;

  function reset() {
    const ago = (minutes) => stamp(nowMs() - minutes * 60000);
    const seed = (id, title, category, foundLocation, description, minutes, extra = {}) => ({
      id,
      title,
      description,
      category,
      foundLocation,
      finderContact: null,
      imageUrl: null,
      status: "REGISTERED",
      reporterType: "ADMIN",
      reporterRef: DEMO_ADMIN_NAME,
      resolveNote: null,
      claimantName: null,
      claimantContact: null,
      claimantNote: null,
      claimedAt: null,
      createdAt: ago(minutes),
      updatedAt: ago(minutes),
      seed: true,
      ...extra,
    });
    state = {
      nextId: 4,
      items: [
        seed(3, "파란색 텀블러", "생활용품", "성호관 잔디 벤치", "뚜껑에 스티커가 붙어 있어요", 42, { finderContact: "010-1234-5678" }),
        seed(2, "학생증 · 이*람", "학생증", "노천극장 입구 계단", "", 95),
        seed(1, "검정 접이식 우산", "기타", "총학 주점 3번 테이블", "", 180, { status: "RETURNED", resolveNote: "학생증으로 본인 확인", updatedAt: ago(120) }),
      ],
      // 흐름이 어디까지 왔는지(매뉴얼 화면이 읽는다).
      flow: { itemId: null, nameId: null, bundleId: null, pickedUp: false },
      lastCreated: null,
    };
  }

  const isAdmin = (headers) => (headers.authorization || "") === `Bearer ${DEMO_ADMIN_TOKEN}`;
  function requireStaff(headers) {
    if (!isAdmin(headers)) throw httpError(403, "Only admin or staff can modify lost items.");
  }

  // 신청자 정보는 본부만 본다. 공개 응답에는 아예 싣지 않는다.
  const dto = ({ seed, ...item }, masked) => ({
    ...item,
    statusLabel: STATUS_LABEL[item.status] || "Registered",
    finderContact: masked ? maskContact(item.finderContact) : item.finderContact,
    claimantName: masked ? null : item.claimantName,
    claimantContact: masked ? null : item.claimantContact,
    claimantNote: masked ? null : item.claimantNote,
  });
  const list = (masked) => [...state.items].sort((a, b) => parseStamp(b.createdAt) - parseStamp(a.createdAt) || b.id - a.id).map((item) => dto(item, masked));
  const find = (id) => {
    const item = state.items.find((entry) => entry.id === Number(id));
    if (!item) throw httpError(404, "Lost item not found.");
    return item;
  };
  // 실시간 통로에는 늘 가린 목록이 나간다. 총괄 화면은 이걸 신호로만 쓰고 자기 권한으로 다시 읽는다.
  const broadcast = () => publish("lost-items", list(true));
  const storedCount = () => state.items.filter((item) => item.status !== "RETURNED").length;

  function create(body, role) {
    const title = trimOrNull(body?.title);
    const foundLocation = trimOrNull(body?.foundLocation);
    if (!title || !foundLocation) throw httpError(400, "물건 이름과 발견 위치를 적어 주세요.");
    const item = {
      id: state.nextId++,
      title,
      description: `${body?.description ?? ""}`.trim(),
      category: trimOrNull(body?.category) || "기타",
      foundLocation,
      finderContact: trimOrNull(body?.finderContact),
      // 연습 화면에서 고른 사진은 이 브라우저 안에서만 보인다(서버로 올라가지 않는다).
      imageUrl: body?.file?.url || null,
      status: "REGISTERED",
      reporterType: "ADMIN",
      reporterRef: DEMO_ADMIN_NAME,
      resolveNote: null,
      claimantName: null,
      claimantContact: null,
      claimantNote: null,
      claimedAt: null,
      createdAt: stamp(),
      updatedAt: stamp(),
    };
    state.items.push(item);
    const kind = lostKind(item);
    const key = kind === "bundle" ? "bundleId" : kind === "name" ? "nameId" : "itemId";
    if (state.flow[key] == null) state.flow[key] = item.id;
    state.lastCreated = { id: item.id, title: item.title, at: nowMs() };
    broadcast();
    emit({ type: "lost.created", role, item: dto(item, false), kind, stored: storedCount() });
    return dto(item, false);
  }

  function updateStatus(id, body, role) {
    const item = find(id);
    const before = item.status;
    item.status = normalizeStatus(body?.status);
    item.resolveNote = trimOrNull(body?.resolveNote);
    item.updatedAt = stamp();
    if (item.status === "RETURNED") state.flow.pickedUp = true;
    broadcast();
    emit({ type: "lost.status", role, item: dto(item, false), before, stored: storedCount() });
    return dto(item, false);
  }

  function claim(id, body, role) {
    const item = find(id);
    if (item.status === "RETURNED") throw httpError(400, "이미 주인에게 돌아간 물건이에요.");
    // 먼저 온 요청을 다른 사람이 덮어쓰지 못하게 한다. 본부에서 확인 후 상태를 바꾸면 다시 열린다.
    if (item.status === "OWNER_CLAIMED") throw httpError(409, "이미 주인 확인 요청이 들어와 있어요. 본부에 직접 문의해 주세요.");
    const claimantName = trimOrNull(body?.claimantName);
    const claimantContact = trimOrNull(body?.claimantContact);
    if (!claimantName) throw httpError(400, "claimantName is required.");
    if (!claimantContact) throw httpError(400, "claimantContact is required.");
    Object.assign(item, { claimantName, claimantContact, claimantNote: trimOrNull(body?.claimantNote), claimedAt: stamp(), status: "OWNER_CLAIMED", updatedAt: stamp() });
    broadcast();
    emit({ type: "lost.claimed", role, item: dto(item, false) });
    return dto(item, true);
  }

  function remove(id, role) {
    const item = find(id);
    state.items = state.items.filter((entry) => entry !== item);
    // '사진 다시 찍기'는 같은 이름으로 새로 올린 뒤 예전 것을 지운다. 그 경우는 '지웠다'가 아니라 '사진을 바꿨다'로 알린다.
    const last = state.lastCreated;
    const replaced = Boolean(last && last.id !== item.id && last.title === item.title && nowMs() - last.at < 8000);
    ["itemId", "nameId", "bundleId"].forEach((key) => {
      if (state.flow[key] === item.id && replaced) state.flow[key] = last.id;
    });
    broadcast();
    emit({ type: "lost.deleted", role, item: dto(item, false), replaced, stored: storedCount() });
    return undefined;
  }

  function route(method, path, query, body, headers, role) {
    if (!path.startsWith("/lost-items")) return NOT_HANDLED;
    if (path === "/lost-items") {
      if (method === "GET") return list(!isAdmin(headers));
      if (method === "POST") {
        requireStaff(headers);
        return create(body, role);
      }
    }
    let match = path.match(/^\/lost-items\/(\d+)\/claim$/);
    if (match && method === "PUT") return claim(match[1], body, role);
    match = path.match(/^\/lost-items\/(\d+)\/status$/);
    if (match && method === "PUT") {
      requireStaff(headers);
      return updateStatus(match[1], body, role);
    }
    match = path.match(/^\/lost-items\/(\d+)$/);
    if (match && method === "DELETE") {
      requireStaff(headers);
      return remove(match[1], role);
    }
    throw httpError(400, "연습 화면에서는 쓸 수 없는 기능이에요.");
  }

  function snapshot() {
    return { items: list(false), stored: storedCount(), flow: { ...state.flow } };
  }

  reset();
  return { route, snapshot, reset };
}
