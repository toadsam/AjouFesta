import { getAccessToken } from "./utils/auth";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api"
)
  .trim()
  .replace(/\/+$/, "");
const NETWORK_ERROR_MESSAGE =
  "서버에 연결할 수 없습니다. 네트워크 상태 또는 운영 서버 연결을 확인해 주세요.";

async function fetch(...args) {
  try {
    return await globalThis.fetch(...args);
  } catch (error) {
    throw new Error(NETWORK_ERROR_MESSAGE, { cause: error });
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function withAuth(headers = {}) {
  const token = getAccessToken();
  if (!token) return headers;
  return { ...headers, Authorization: `Bearer ${token}` };
}

async function parseJson(response, errorMessage) {
  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      if (data && typeof data === "string") {
        detail = data;
      } else if (data && typeof data.message === "string") {
        detail = data.message;
      }
    } catch {
      detail = "";
    }
    const error = new Error(`${errorMessage}${detail ? ` (${detail})` : ""}`);
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return response.text();
  }
  return response.json();
}

export function getApiBase() {
  return API_BASE;
}

// width(240 · 480 · 960)를 주면 서버가 그 폭으로 줄인 JPEG 를 내려준다. 목록처럼 작게 보이는 곳에 쓴다.
// (AI 프로필 그림은 원본이 2MB 를 넘는다.) 서버 업로드 주소(/uploads/)에만 붙는다.
export function resolveApiAssetUrl(url, width) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) {
    const resolved = `${API_BASE.replace(/\/api$/i, "")}${url}`;
    return width ? `${resolved}?w=${width}` : resolved;
  }
  return url;
}

export async function loginAdmin(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return parseJson(response, "관리자 로그인에 실패했습니다.");
}

export async function fetchBooths() {
  const response = await fetch(`${API_BASE}/booths`);
  return parseJson(response, "부스 목록을 불러오지 못했습니다.");
}

export async function fetchBoothById(boothId) {
  const response = await fetch(`${API_BASE}/booths/${boothId}`);
  return parseJson(response, "부스 상세 정보를 불러오지 못했습니다.");
}

export async function fetchCongestion(boothId) {
  const response = await fetch(`${API_BASE}/booths/${boothId}/congestion`);
  return parseJson(response, "혼잡도 정보를 불러오지 못했습니다.");
}

export async function fetchEvents() {
  const response = await fetch(`${API_BASE}/events`);
  return parseJson(
    response,
    "공연 목록을 불러오지 못했습니다.",
  );
}

export async function sendGps(latitude, longitude) {
  const response = await fetch(`${API_BASE}/gps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  });
  return parseJson(response, "GPS 위치 전송에 실패했습니다.");
}

export async function askChat(question) {
  const response = await fetchWithTimeout(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  }, 9000);
  return parseJson(response, "챗봇 응답을 가져오지 못했습니다.");
}

export async function createBooth(payload) {
  const response = await fetch(`${API_BASE}/admin/booths`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "부스 등록에 실패했습니다.");
}

export async function updateBooth(id, payload) {
  const response = await fetch(`${API_BASE}/admin/booths/${id}`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "부스 수정에 실패했습니다.");
}

export async function updateBoothLiveStatus(id, payload) {
  const response = await fetch(`${API_BASE}/admin/booths/${id}/live-status`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(
    response,
    "부스 실시간 운영 상태 저장에 실패했습니다.",
  );
}

export async function uploadBoothImage(id, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/admin/booths/${id}/image`, {
    method: "POST",
    headers: withAuth(),
    body: formData,
  });
  return parseJson(response, "부스 이미지 업로드에 실패했습니다.");
}

export async function reorderBooths(boothIds) {
  const response = await fetch(`${API_BASE}/admin/booths/reorder`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ boothIds }),
  });

  if (!response.ok) {
    throw new Error("부스 순서 저장에 실패했습니다.");
  }
}

export async function deleteBooth(id) {
  const response = await fetch(`${API_BASE}/admin/booths/${id}`, {
    method: "DELETE",
    headers: withAuth(),
  });

  if (!response.ok) {
    throw new Error("부스 삭제에 실패했습니다.");
  }
}

export async function createEvent(payload) {
  const response = await fetch(`${API_BASE}/admin/events`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "공연 등록에 실패했습니다.");
}

export async function updateEvent(id, payload) {
  const response = await fetch(`${API_BASE}/admin/events/${id}`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "공연 수정에 실패했습니다.");
}

export async function deleteEvent(id) {
  const response = await fetch(`${API_BASE}/admin/events/${id}`, {
    method: "DELETE",
    headers: withAuth(),
  });

  if (!response.ok) {
    throw new Error("공연 삭제에 실패했습니다.");
  }
}

export async function importBoothCsv(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/admin/import/booths`, {
    method: "POST",
    headers: withAuth(),
    body: formData,
  });
  return parseJson(response, "부스 CSV 업로드에 실패했습니다.");
}

export async function importEventCsv(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/admin/import/events`, {
    method: "POST",
    headers: withAuth(),
    body: formData,
  });
  return parseJson(response, "공연 CSV 업로드에 실패했습니다.");
}

export async function fetchActiveNotices() {
  const response = await fetch(`${API_BASE}/notices/active`);
  return parseJson(response, "활성 공지를 불러오지 못했습니다.");
}

export async function fetchAdminNotices() {
  const response = await fetch(`${API_BASE}/admin/notices`, {
    headers: withAuth(),
  });
  return parseJson(
    response,
    "관리자 공지 목록을 불러오지 못했습니다.",
  );
}

export async function createNotice(payload) {
  const response = await fetch(`${API_BASE}/admin/notices`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "공지 등록에 실패했습니다.");
}

export async function updateNotice(id, payload) {
  const response = await fetch(`${API_BASE}/admin/notices/${id}`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "공지 수정에 실패했습니다.");
}

export async function deleteNotice(id) {
  const response = await fetch(`${API_BASE}/admin/notices/${id}`, {
    method: "DELETE",
    headers: withAuth(),
  });
  if (!response.ok) {
    throw new Error("공지 삭제에 실패했습니다.");
  }
}

export async function fetchAdminDashboardKpis() {
  const response = await fetch(`${API_BASE}/admin/dashboard/kpis`, {
    headers: withAuth(),
  });
  return parseJson(response, "관리자 KPI를 불러오지 못했습니다.");
}

export async function fetchAuditLogs() {
  const response = await fetch(`${API_BASE}/admin/audit-logs`, {
    headers: withAuth(),
  });
  return parseJson(
    response,
    "관리자 작업 로그를 불러오지 못했습니다.",
  );
}

export async function triggerCongestionReliefNotice() {
  const response = await fetch(
    `${API_BASE}/admin/actions/congestion-relief-notice`,
    {
      method: "POST",
      headers: withAuth(),
    },
  );
  return parseJson(
    response,
    "혼잡 완화 공지 발행에 실패했습니다.",
  );
}

export async function triggerEventStartNotice(eventId) {
  const response = await fetch(
    `${API_BASE}/admin/actions/events/${eventId}/start-notice`,
    {
      method: "POST",
      headers: withAuth(),
    },
  );
  return parseJson(
    response,
    "공연 시작 공지 발행에 실패했습니다.",
  );
}

export async function fetchAdminAiBriefing() {
  const response = await fetch(`${API_BASE}/admin/ai/briefing`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ type: "briefing" }),
  });
  return parseJson(response, "AI 운영 브리핑을 생성하지 못했습니다.");
}

export async function createAdminAiNoticeDraft(type = "congestion", prompt = "") {
  const response = await fetch(`${API_BASE}/admin/ai/notice-draft`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ type, prompt }),
  });
  return parseJson(response, "AI 공지 추천을 생성하지 못했습니다.");
}

export async function fetchTrafficHourly() {
  const response = await fetch(`${API_BASE}/analytics/traffic-hourly`);
  return parseJson(
    response,
    "시간대별 방문 데이터를 불러오지 못했습니다.",
  );
}

export async function fetchPopularBooths() {
  const response = await fetch(`${API_BASE}/analytics/popular-booths`);
  return parseJson(response, "인기 부스 데이터를 불러오지 못했습니다.");
}

export async function fetchHeatmap() {
  const response = await fetch(`${API_BASE}/analytics/congestion-heatmap`);
  return parseJson(response, "혼잡 히트맵 데이터를 불러오지 못했습니다.");
}

export async function fetchAnalyticsDashboard(minutes = 15) {
  const response = await fetch(`${API_BASE}/analytics/dashboard?minutes=${minutes}`);
  return parseJson(response, "실시간 혼잡도 데이터를 불러오지 못했습니다.");
}

export async function fetchAiFestivalGuide() {
  const response = await fetch(`${API_BASE}/ai/guide`);
  return parseJson(response, "AI 축제 가이드를 불러오지 못했습니다.");
}

export async function fetchAiCongestionPredictions() {
  const response = await fetch(`${API_BASE}/ai/congestion/predictions`);
  return parseJson(response, "AI 혼잡도 예측을 불러오지 못했습니다.");
}

export async function fetchAiDecisionLogs() {
  const response = await fetch(`${API_BASE}/ai/decisions`);
  return parseJson(response, "AI 판단 이력을 불러오지 못했습니다.");
}

export async function fetchAiVisitorGuide(scope, timeoutMs = 15000) {
  const response = await fetchWithTimeout(`${API_BASE}/ai/visitor-guide/${scope}`, {}, timeoutMs);
  return parseJson(response, "AI 방문 가이드를 불러오지 못했습니다.");
}

export function createCongestionStream() {
  return new EventSource(`${API_BASE}/stream/congestion`);
}

export function createEventStream() {
  return new EventSource(`${API_BASE}/stream/events`);
}

export function createNoticeStream() {
  return new EventSource(`${API_BASE}/stream/notices`);
}

export function createBoothStream() {
  return new EventSource(`${API_BASE}/stream/booths`);
}

export async function fetchAdminStaff() {
  const response = await fetch(`${API_BASE}/admin/staff`, {
    headers: withAuth(),
  });
  return parseJson(response, "스태프 목록을 불러오지 못했습니다.");
}

/** 소개팅 새 가입 받기 / 막기(운영진). */
export async function setAdminAiMatchRegistrationOpen(open) {
  const response = await fetch(`${API_BASE}/admin/ai-match/registration`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ open: Boolean(open) }),
  });
  return parseJson(response, "가입 받기 설정을 바꾸지 못했습니다.");
}

export async function fetchAdminAiMatchOverview() {
  const response = await fetch(`${API_BASE}/admin/ai-match/overview`, {
    headers: withAuth(),
  });
  return parseJson(response, "AI 매칭 운영 현황을 불러오지 못했습니다.");
}

export async function fetchAdminAiMatchMeetupSchedule(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(`${API_BASE}/admin/ai-match/meetup-schedule${query}`, {
    headers: withAuth(),
  });
  return parseJson(response, "소개팅 부스 시간표를 불러오지 못했습니다.");
}

export async function updateAdminAiMatchConnectionStatus(requestId, connectionStatus) {
  const response = await fetch(`${API_BASE}/admin/ai-match/requests/${requestId}/connection-status`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ connectionStatus }),
  });
  return parseJson(response, "연결 상태 변경에 실패했습니다.");
}

export async function updateAdminAiMatchRequestNote(requestId, adminNote) {
  const response = await fetch(`${API_BASE}/admin/ai-match/requests/${requestId}/admin-note`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ adminNote }),
  });
  return parseJson(response, "관리자 메모 저장에 실패했습니다.");
}

export async function deleteAdminAiMatchProfile(profileId) {
  const response = await fetch(`${API_BASE}/admin/ai-match/profiles/${profileId}`, {
    method: "DELETE",
    headers: withAuth(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || "AI 프로필 삭제에 실패했습니다.");
    error.status = response.status;
    throw error;
  }
}

export async function purgeAdminAiMatchPhone(phoneNumber) {
  const response = await fetch(`${API_BASE}/admin/ai-match/phone-purge`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ phoneNumber }),
  });
  return parseJson(response, "전화번호 완전 삭제에 실패했습니다.");
}

export async function resetAdminAiMatchAll(confirm) {
  const response = await fetch(`${API_BASE}/admin/ai-match/reset`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ confirm }),
  });
  return parseJson(response, "소개팅 데이터 전체 삭제에 실패했습니다.");
}

export async function updateAdminStaff(id, payload) {
  const response = await fetch(`${API_BASE}/admin/staff/${id}`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "스태프 정보 수정에 실패했습니다.");
}

export function createStaffStream(staffToken) {
  return new EventSource(`${API_BASE}/stream/staff?token=${encodeURIComponent(staffToken || "")}`);
}

export function createLostItemStream() {
  return new EventSource(`${API_BASE}/stream/lost-items`);
}

export function createReservationStream() {
  return new EventSource(`${API_BASE}/stream/reservations`);
}

// ---------- 테이블 QR 주문 ----------

export function createOrderStream() {
  return new EventSource(`${API_BASE}/stream/orders`);
}

export async function fetchOrderMenu(boothId, table) {
  const query = table ? `?table=${encodeURIComponent(table)}` : "";
  const response = await fetch(`${API_BASE}/booths/${boothId}/order-menu${query}`);
  return parseJson(response, "메뉴를 불러오지 못했습니다.");
}

export async function createBoothOrder(boothId, payload) {
  const response = await fetch(`${API_BASE}/booths/${boothId}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response, "주문 접수에 실패했습니다.");
}

export async function fetchOrder(orderId, key) {
  const response = await fetch(`${API_BASE}/orders/${orderId}?key=${encodeURIComponent(key || "")}`);
  return parseJson(response, "주문을 불러오지 못했습니다.");
}

export async function fetchOpsBoothOrders(boothId, key) {
  const response = await fetch(opsUrl(`/ops/booth/${boothId}/orders`), { headers: opsHeaders(key) });
  return parseJson(response, "주문 목록을 불러오지 못했습니다.");
}

export async function updateOpsBoothOrderConfig(boothId, payload, key) {
  const response = await fetch(opsUrl(`/ops/booth/${boothId}/orders/config`), {
    method: "PUT",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "주문 설정 저장에 실패했습니다.");
}

export async function updateOpsBoothOrderStatus(boothId, orderId, status, key) {
  const response = await fetch(opsUrl(`/ops/booth/${boothId}/orders/${orderId}/status`), {
    method: "PUT",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({ status }),
  });
  return parseJson(response, "주문 상태 변경에 실패했습니다.");
}

/** 메뉴별 요리사 창: 주문의 한 줄(메뉴)을 다 만들었음. 모든 줄이 끝나면 서버가 주문을 '서빙할 것'으로 올린다. */
export async function markOpsBoothOrderItemDone(boothId, orderId, lineNo, key) {
  const response = await fetch(opsUrl(`/ops/booth/${boothId}/orders/${orderId}/items/${lineNo}/done`), {
    method: "PUT",
    headers: opsHeaders(key),
  });
  return parseJson(response, "완료를 보내지 못했습니다.");
}

export function downloadBoothCsv() {
  window.open(`${API_BASE}/export/booths.csv`, "_blank", "noopener,noreferrer");
}

export function downloadEventCsv() {
  window.open(`${API_BASE}/export/events.csv`, "_blank", "noopener,noreferrer");
}

// 이 기기의 번호(무작위). 서버는 맞는 키로 들어온 적이 있는 기기를 기억해 두고,
// 같은 와이파이에서 누가 틀린 키를 여러 번 보내 그 IP 가 잠겨도 이 기기는 계속 쓰게 해 준다.
const OPS_DEVICE_STORAGE_KEY = "festflow-ops-device";
let opsDeviceId = "";

function getOpsDeviceId() {
  if (opsDeviceId) return opsDeviceId;
  try {
    opsDeviceId = window.localStorage.getItem(OPS_DEVICE_STORAGE_KEY) || "";
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 쓰는 번호를 만든다.
  }
  if (!/^[A-Za-z0-9-]{16,64}$/.test(opsDeviceId)) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    opsDeviceId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    try {
      window.localStorage.setItem(OPS_DEVICE_STORAGE_KEY, opsDeviceId);
    } catch {
      // 저장하지 못해도 이번 방문에는 쓸 수 있다.
    }
  }
  return opsDeviceId;
}

function opsHeaders(key, headers = {}) {
  return key ? { ...headers, "X-OPS-KEY": key, "X-OPS-DEVICE": getOpsDeviceId() } : headers;
}

function opsUrl(path) {
  return `${API_BASE}${path}`;
}

export async function fetchOpsMasterBootstrap(key) {
  const response = await fetch(opsUrl("/ops/master/bootstrap"), {
    headers: opsHeaders(key),
  });
  return parseJson(
    response,
    "통합 운영 콘솔을 불러오지 못했습니다.",
  );
}

export async function updateOpsMasterBoothLiveStatus(boothId, payload, key) {
  const response = await fetch(
    opsUrl(`/ops/master/booths/${boothId}/live-status`),
    {
      method: "PUT",
      headers: opsHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    },
  );
  return parseJson(response, "통합 운영 부스 상태 저장에 실패했습니다.");
}

export async function fetchOpsBoothBootstrap(boothId, key) {
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/bootstrap`),
    { headers: opsHeaders(key) },
  );
  return parseJson(response, "부스 운영 대시보드를 불러오지 못했습니다.");
}

export async function updateOpsBoothLiveStatus(boothId, payload, key) {
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/live-status`),
    {
      method: "PUT",
      headers: opsHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    },
  );
  return parseJson(response, "부스 운영 상태 저장에 실패했습니다.");
}

export async function uploadOpsBoothMenuImage(boothId, file, key) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/menu-image`),
    {
      method: "POST",
      headers: opsHeaders(key),
      body: formData,
    },
  );
  return parseJson(response, "메뉴 이미지 업로드에 실패했습니다.");
}
export async function createOpsMasterNotice(payload, key) {
  const response = await fetch(opsUrl("/ops/master/notices"), {
    method: "POST",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "통합 운영 공지 등록에 실패했습니다.");
}

export async function updateOpsMasterNotice(id, payload, key) {
  const response = await fetch(opsUrl(`/ops/master/notices/${id}`), {
    method: "PUT",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "통합 운영 공지 수정에 실패했습니다.");
}

export async function deleteOpsMasterNotice(id, key) {
  const response = await fetch(opsUrl(`/ops/master/notices/${id}`), {
    method: "DELETE",
    headers: opsHeaders(key),
  });
  if (!response.ok) {
    throw new Error("통합 운영 공지 삭제에 실패했습니다.");
  }
}

export async function createOpsMasterEvent(payload, key) {
  const response = await fetch(opsUrl("/ops/master/events"), {
    method: "POST",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "공연 등록에 실패했습니다.");
}

export async function updateOpsMasterEvent(id, payload, key) {
  const response = await fetch(opsUrl(`/ops/master/events/${id}`), {
    method: "PUT",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "공연 수정에 실패했습니다.");
}

export async function deleteOpsMasterEvent(id, key) {
  const response = await fetch(opsUrl(`/ops/master/events/${id}`), {
    method: "DELETE",
    headers: opsHeaders(key),
  });
  if (!response.ok) {
    throw new Error("공연 삭제에 실패했습니다.");
  }
}

export async function createOpsMasterBooth(payload, key) {
  const response = await fetch(opsUrl("/ops/master/booths"), {
    method: "POST",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "부스 등록에 실패했습니다.");
}

export async function updateOpsMasterBooth(id, payload, key) {
  const response = await fetch(opsUrl(`/ops/master/booths/${id}`), {
    method: "PUT",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "부스 수정에 실패했습니다.");
}

export async function deleteOpsMasterBooth(id, key) {
  const response = await fetch(opsUrl(`/ops/master/booths/${id}`), {
    method: "DELETE",
    headers: opsHeaders(key),
  });
  if (!response.ok) {
    throw new Error("부스 삭제에 실패했습니다.");
  }
}

export async function reorderOpsMasterBooths(boothIds, key) {
  const response = await fetch(opsUrl("/ops/master/booths/reorder"), {
    method: "PUT",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({ boothIds }),
  });
  if (!response.ok) {
    throw new Error("부스 순서 저장에 실패했습니다.");
  }
}

export async function triggerOpsMasterCongestionReliefNotice(key) {
  const response = await fetch(
    opsUrl("/ops/master/actions/congestion-relief-notice"),
    {
      method: "POST",
      headers: opsHeaders(key),
    },
  );
  return parseJson(response, "혼잡 완화 공지 발행에 실패했습니다.");
}

export async function triggerOpsMasterEventStartNotice(eventId, key) {
  const response = await fetch(
    opsUrl(`/ops/master/actions/events/${eventId}/start-notice`),
    {
      method: "POST",
      headers: opsHeaders(key),
    },
  );
  return parseJson(response, "공연 시작 공지 발행에 실패했습니다.");
}

export async function fetchOpsMasterAiBriefing(key) {
  const response = await fetch(opsUrl("/ops/master/ai/briefing"), {
    method: "POST",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({ type: "briefing" }),
  });
  return parseJson(response, "AI 운영 브리핑을 생성하지 못했습니다.");
}

export async function createOpsMasterAiNoticeDraft(type, prompt, key) {
  const response = await fetch(opsUrl("/ops/master/ai/notice-draft"), {
    method: "POST",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({ type, prompt }),
  });
  return parseJson(response, "AI 공지 초안을 생성하지 못했습니다.");
}

export async function fetchOpsSimulationStatus(key) {
  const response = await fetch(opsUrl("/ops/master/simulation"), {
    headers: opsHeaders(key),
  });
  return parseJson(response, "시뮬레이션 상태를 불러오지 못했습니다.");
}

export async function updateOpsSimulation(payload, key) {
  const response = await fetch(opsUrl("/ops/master/simulation"), {
    method: "PUT",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "시뮬레이션 설정 저장에 실패했습니다.");
}

export async function startOpsSimulation(key) {
  const response = await fetch(opsUrl("/ops/master/simulation/start"), {
    method: "POST",
    headers: opsHeaders(key),
  });
  return parseJson(response, "시뮬레이션 시작에 실패했습니다.");
}

export async function stopOpsSimulation(key) {
  const response = await fetch(opsUrl("/ops/master/simulation/stop"), {
    method: "POST",
    headers: opsHeaders(key),
  });
  return parseJson(response, "시뮬레이션 정지에 실패했습니다.");
}

export async function resetOpsSimulation(key) {
  const response = await fetch(opsUrl("/ops/master/simulation/reset"), {
    method: "POST",
    headers: opsHeaders(key),
  });
  return parseJson(response, "시뮬레이션 리셋에 실패했습니다.");
}

export async function applyOpsSimulationScenario(scenario, key) {
  const response = await fetch(opsUrl(`/ops/master/simulation/scenarios/${scenario}`), {
    method: "POST",
    headers: opsHeaders(key),
  });
  return parseJson(response, "시뮬레이션 시나리오 적용에 실패했습니다.");
}

export async function fetchStaffAiZoneSummary(staffToken) {
  const response = await fetch(`${API_BASE}/staff/ai/zone-summary`, {
    method: "POST",
    headers: staffToken
      ? { "Content-Type": "application/json", "X-Staff-Token": staffToken }
      : { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "zone-summary" }),
  });
  return parseJson(response, "AI 구역 요약을 생성하지 못했습니다.");
}

export async function createStaffAiLostItemAssist(prompt, staffToken) {
  const response = await fetch(`${API_BASE}/staff/ai/lost-item-assist`, {
    method: "POST",
    headers: staffToken
      ? { "Content-Type": "application/json", "X-Staff-Token": staffToken }
      : { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "lost-item", prompt }),
  });
  return parseJson(response, "분실물 AI 응대를 생성하지 못했습니다.");
}

export async function createStaffAiReplyDraft(prompt, staffToken) {
  const response = await fetch(`${API_BASE}/staff/ai/reply-draft`, {
    method: "POST",
    headers: staffToken
      ? { "Content-Type": "application/json", "X-Staff-Token": staffToken }
      : { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "reply", prompt }),
  });
  return parseJson(response, "응대 문구를 생성하지 못했습니다.");
}

export async function fetchStaffAiFieldChecklist(staffToken) {
  const response = await fetch(`${API_BASE}/staff/ai/field-checklist`, {
    method: "POST",
    headers: staffToken
      ? { "Content-Type": "application/json", "X-Staff-Token": staffToken }
      : { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "field-checklist" }),
  });
  return parseJson(response, "AI 현장 체크리스트를 생성하지 못했습니다.");
}

export async function fetchStageCrowd(minutes = 10) {
  const response = await fetch(
    `${API_BASE}/analytics/stage-crowd?minutes=${minutes}`,
  );
  return parseJson(
    response,
    "무대 혼잡 데이터를 불러오지 못했습니다.",
  );
}

export async function fetchBoothReservations(boothId, reservationToken) {
  const response = await fetch(`${API_BASE}/booths/${boothId}/reservations`, {
    headers: reservationToken
      ? { "X-Reservation-Token": reservationToken }
      : undefined,
  });
  return parseJson(response, "예약 현황을 불러오지 못했습니다.");
}

export async function createBoothReservation(
  boothId,
  payload,
  reservationToken,
) {
  const response = await fetch(`${API_BASE}/booths/${boothId}/reservations`, {
    method: "POST",
    headers: reservationToken
      ? {
          "Content-Type": "application/json",
          "X-Reservation-Token": reservationToken,
        }
      : { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response, "예약에 실패했습니다.");
}

export async function createBoothReservationCheckInToken(
  boothId,
  reservationId,
  reservationToken,
) {
  const response = await fetch(
    `${API_BASE}/booths/${boothId}/reservations/${reservationId}/check-in-token`,
    {
      method: "POST",
      headers: reservationToken
        ? { "X-Reservation-Token": reservationToken }
        : undefined,
    },
  );
  return parseJson(response, "QR 토큰 발급에 실패했습니다.");
}

export async function fetchOpsBoothReservations(boothId, key) {
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/reservations`),
    { headers: opsHeaders(key) },
  );
  return parseJson(response, "예약 대시보드를 불러오지 못했습니다.");
}

export async function updateOpsBoothReservationConfig(boothId, payload, key) {
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/reservations/config`),
    {
      method: "PUT",
      headers: opsHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    },
  );
  return parseJson(response, "예약 설정 저장에 실패했습니다.");
}

export async function checkInOpsBoothReservation(boothId, reservationId, key) {
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/reservations/${reservationId}/check-in`),
    {
      method: "POST",
      headers: opsHeaders(key),
    },
  );
  return parseJson(response, "체크인 처리에 실패했습니다.");
}

export async function completeOpsBoothReservation(boothId, reservationId, key) {
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/reservations/${reservationId}/complete`),
    {
      method: "POST",
      headers: opsHeaders(key),
    },
  );
  return parseJson(response, "테이블 비우기에 실패했습니다.");
}

export async function occupyOpsBoothReservationTable(boothId, tableId, key) {
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/reservations/tables/${tableId}/occupy`),
    { method: "POST", headers: opsHeaders(key) },
  );
  return parseJson(response, "테이블을 이용 중으로 바꾸지 못했습니다.");
}

export async function uploadOpsBoothMenuItemImage(boothId, file, key) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(opsUrl(`/ops/booth/${boothId}/menu-item-image`), {
    method: "POST",
    headers: opsHeaders(key),
    body: formData,
  });
  return parseJson(response, "메뉴 사진 업로드에 실패했습니다.");
}

export async function releaseOpsBoothReservationTable(boothId, tableId, key) {
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/reservations/tables/${tableId}/release`),
    {
      method: "POST",
      headers: opsHeaders(key),
    },
  );
  return parseJson(response, "테이블 가용 처리에 실패했습니다.");
}

export async function checkInOpsBoothReservationByToken(boothId, token, key) {
  const response = await fetch(
    opsUrl(`/ops/booth/${boothId}/reservations/check-in/by-token`),
    {
      method: "POST",
      headers: opsHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({ token }),
    },
  );
  return parseJson(response, "QR 체크인 처리에 실패했습니다.");
}

export async function sendReservationAuthCode(phoneNumber) {
  const response = await fetch(`${API_BASE}/reservations/auth/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });
  return parseJson(response, "인증번호 발송에 실패했습니다.");
}

export async function verifyReservationAuthCode(phoneNumber, code) {
  const response = await fetch(`${API_BASE}/reservations/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, code }),
  });
  return parseJson(response, "인증번호 확인에 실패했습니다.");
}

export async function loginStaff(staffNo, pin) {
  const response = await fetch(`${API_BASE}/staff/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staffNo, pin }),
  });
  return parseJson(response, "스태프 로그인에 실패했습니다.");
}

export async function logoutStaff(staffToken) {
  const response = await fetch(`${API_BASE}/staff/auth/logout`, {
    method: "POST",
    headers: staffToken ? { "X-Staff-Token": staffToken } : undefined,
  });
  if (!response.ok) {
    throw new Error("스태프 로그아웃에 실패했습니다.");
  }
}

export async function fetchStaffBootstrap(staffToken) {
  const response = await fetch(`${API_BASE}/staff/bootstrap`, {
    headers: staffToken ? { "X-Staff-Token": staffToken } : undefined,
  });
  return parseJson(response, "스태프 대시보드를 불러오지 못했습니다.");
}

export async function updateMyStaffStatus(staffToken, payload) {
  const response = await fetch(`${API_BASE}/staff/me/status`, {
    method: "PUT",
    headers: staffToken
      ? { "Content-Type": "application/json", "X-Staff-Token": staffToken }
      : { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response, "스태프 상태 업데이트에 실패했습니다.");
}

export async function fetchLostItems(staffToken) {
  const headers = {};
  const adminToken = getAccessToken();
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  if (staffToken) {
    headers["X-Staff-Token"] = staffToken;
  }
  const response = await fetch(`${API_BASE}/lost-items`, {
    headers: Object.keys(headers).length ? headers : undefined,
  });
  return parseJson(response, "분실물 목록을 불러오지 못했습니다.");
}

export async function createLostItem(form, file, staffToken) {
  const formData = new FormData();
  formData.append("title", form.title || "");
  formData.append("description", form.description || "");
  formData.append("category", form.category || "기타");
  formData.append("foundLocation", form.foundLocation || "");
  formData.append("finderContact", form.finderContact || "");
  if (file) {
    formData.append("file", file);
  }

  const headers = {};
  const adminToken = getAccessToken();
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  if (staffToken) {
    headers["X-Staff-Token"] = staffToken;
  }

  const response = await fetch(`${API_BASE}/lost-items`, {
    method: "POST",
    headers,
    body: formData,
  });
  return parseJson(response, "분실물 등록에 실패했습니다.");
}

export async function updateLostItemStatus(id, payload, staffToken) {
  const headers = { "Content-Type": "application/json" };
  const adminToken = getAccessToken();
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  if (staffToken) {
    headers["X-Staff-Token"] = staffToken;
  }

  const response = await fetch(`${API_BASE}/lost-items/${id}/status`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(response, "분실물 상태 변경에 실패했습니다.");
}

export async function updateLostItem(id, payload, staffToken) {
  const headers = { "Content-Type": "application/json" };
  const adminToken = getAccessToken();
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  if (staffToken) {
    headers["X-Staff-Token"] = staffToken;
  }

  const response = await fetch(`${API_BASE}/lost-items/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(response, "분실물 수정에 실패했습니다.");
}

export async function claimLostItem(id, payload) {
  const response = await fetch(`${API_BASE}/lost-items/${id}/claim`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response, "내 물건 표시 요청에 실패했습니다.");
}

export async function deleteLostItem(id, staffToken) {
  const headers = {};
  const adminToken = getAccessToken();
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  if (staffToken) {
    headers["X-Staff-Token"] = staffToken;
  }

  const response = await fetch(`${API_BASE}/lost-items/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "분실물 삭제에 실패했습니다.");
  }
}

export async function translateText(payload) {
  const response = await fetch(`${API_BASE}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response, "실시간 번역에 실패했습니다.");
}

export async function fetchTranslateMetrics() {
  const response = await fetch(`${API_BASE}/translate/metrics`);
  return parseJson(response, "통역 지표를 불러오지 못했습니다.");
}

/** 소개팅 첫 화면용 운영 상태(새 가입을 받는지). 로그인 없이 읽는다. */
export async function fetchAiMatchStatus() {
  const response = await fetch(`${API_BASE}/ai-match/status`);
  return parseJson(response, "소개팅 상태를 불러오지 못했습니다.");
}

export async function checkAiMatchNickname(nickname, profileId) {
  const params = new URLSearchParams({ nickname: nickname || "" });
  if (profileId) params.set("profileId", String(profileId));
  const response = await fetch(`${API_BASE}/ai-match/nickname-check?${params.toString()}`);
  return parseJson(response, "닉네임 확인에 실패했습니다.");
}

// 가입 화면에서 생년월일을 넣자마자 보여 주는 사주. 저장하지 않는다.
export async function previewAiMatchSaju(birthDate, birthTime, nickname) {
  const params = new URLSearchParams({ birthDate: birthDate || "" });
  if (birthTime) params.set("birthTime", birthTime);
  if (nickname) params.set("nickname", nickname);
  const response = await fetch(`${API_BASE}/ai-match/saju-preview?${params.toString()}`);
  return parseJson(response, "사주를 미리 볼 수 없습니다.");
}

export async function checkAiMatchPhoneNumber(phoneNumber) {
  const params = new URLSearchParams({ phoneNumber: phoneNumber || "" });
  const response = await fetch(`${API_BASE}/ai-match/phone-check?${params.toString()}`);
  return parseJson(response, "전화번호 확인에 실패했습니다.");
}

export async function createAiMatchImagePreview(file, phoneNumber) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("phoneNumber", phoneNumber || "");

  const response = await fetchWithTimeout(`${API_BASE}/ai-match/image-preview`, {
    method: "POST",
    body: formData,
  }, 120000);
  return parseJson(response, "웹툰 이미지 변환에 실패했습니다.");
}

export async function createAiMatchProfile(form, file) {
  const formData = new FormData();
  formData.append("nickname", form.nickname || "");
  formData.append("gender", form.gender || "");
  formData.append("intro", form.intro || "");
  formData.append("pin", form.pin || "");
  formData.append("phoneNumber", form.phoneNumber || "");
  formData.append("meetPlace", form.meetPlace || "");
  formData.append("consent", String(Boolean(form.consent)));
  // 사주용. 실명과 생년월일은 저장만 되고 다른 참가자에게는 공개되지 않는다.
  formData.append("realName", form.realName || "");
  formData.append("birthDate", form.birthDate || "");
  formData.append("birthTime", form.birthTime || "");
  if (form.originalImageUrl) {
    formData.append("originalImageUrl", form.originalImageUrl);
  }
  if (form.generatedImageUrl) {
    formData.append("generatedImageUrl", form.generatedImageUrl);
  }
  if (file) {
    formData.append("file", file);
  }

  const response = await fetchWithTimeout(`${API_BASE}/ai-match/profiles`, {
    method: "POST",
    body: formData,
  }, 120000);
  return parseJson(response, "AI 프로필 등록에 실패했습니다.");
}

export async function accessAiMatchProfile(nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/profiles/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "프로필 인증에 실패했습니다.");
}

// 신청함만 가볍게 다시 읽는다(15초마다). 사람 목록(profiles)은 들어 있지 않다.
export async function fetchAiMatchInbox(nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/profiles/inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "신청함을 불러오지 못했습니다.");
}

export async function updateAiMatchProfile(profileId, payload) {
  const response = await fetch(`${API_BASE}/ai-match/profiles/${profileId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response, "AI 프로필 수정에 실패했습니다.");
}

export async function deleteAiMatchProfile(profileId, payload) {
  const response = await fetch(`${API_BASE}/ai-match/profiles/${profileId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || "AI 프로필 삭제에 실패했습니다.");
    error.status = response.status;
    throw error;
  }
}

export async function createAiMatchRequest(profileId, payload) {
  const response = await fetch(`${API_BASE}/ai-match/profiles/${profileId}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requesterNickname: payload.requesterNickname || "",
      requesterPin: payload.requesterPin || "",
      meetPlace: payload.meetPlace || "",
      message: payload.message || "",
    }),
  });
  return parseJson(response, "데이트 신청에 실패했습니다.");
}

export async function toggleAiMatchFavorite(profileId, nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/profiles/${profileId}/favorite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "좋아요 처리에 실패했습니다.");
}

export async function acceptAiMatchRequest(requestId, nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/requests/${requestId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "데이트 신청 수락에 실패했습니다.");
}

export async function rejectAiMatchRequest(requestId, nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/requests/${requestId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "데이트 신청 거절에 실패했습니다.");
}

export async function cancelAiMatchRequest(requestId, nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/requests/${requestId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "데이트 신청 취소에 실패했습니다.");
}

export async function proposeAiMatchMeetup(requestId, payload) {
  const response = await fetch(`${API_BASE}/ai-match/requests/${requestId}/meetup/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nickname: payload.nickname || "",
      pin: payload.pin || "",
      meetupPlace: payload.meetupPlace || "",
      meetupAt: payload.meetupAt || "",
    }),
  });
  return parseJson(response, "약속 제안에 실패했습니다.");
}

/** 소개팅 부스 20분 슬롯 현황. date 가 비면 서버가 알맞은 축제 날짜를 고른다. */
export async function fetchAiMatchMeetupSlots(date, requestId) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (requestId) params.set("requestId", `${requestId}`);
  const query = params.toString();
  const response = await fetch(`${API_BASE}/ai-match/meetup-slots${query ? `?${query}` : ""}`);
  return parseJson(response, "시간표를 불러오지 못했습니다.");
}

export async function cancelAiMatchMeetup(requestId, nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/requests/${requestId}/meetup/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "약속 취소에 실패했습니다.");
}

/** 부스 시간을 못 잡은 커플의 연락처 공유 동의. 둘 다 누르면 응답의 sharedPhoneNumber 에 상대 번호가 실린다. */
export async function consentAiMatchContactShare(requestId, nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/requests/${requestId}/contact/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "연락처 공유 동의에 실패했습니다.");
}

export async function markAiMatchMeetupArrived(requestId, nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/requests/${requestId}/meetup/arrived`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "도착을 알리지 못했습니다.");
}

// ---- 소개팅 부스 블라인드 채팅 ----
// 입장은 닉네임·비밀번호로 한 번, 그 뒤는 받은 토큰을 X-Chat-Token 헤더에 넣는다.
export async function enterAiMatchChat(requestId, nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/requests/${requestId}/chat/enter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "채팅방에 들어가지 못했습니다.");
}

export async function fetchAiMatchChatState(token, afterId = 0) {
  const response = await fetch(`${API_BASE}/ai-match/chat/state?afterId=${afterId}`, {
    headers: { "X-Chat-Token": token },
    cache: "no-store",
  });
  return parseJson(response, "채팅을 불러오지 못했습니다.");
}

export async function sendAiMatchChatMessage(token, { content, topicId }) {
  const response = await fetch(`${API_BASE}/ai-match/chat/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Chat-Token": token },
    body: JSON.stringify({ content, topicId }),
  });
  return parseJson(response, "메시지를 보내지 못했습니다.");
}

export async function chooseAiMatchChatReveal(token, reveal) {
  const response = await fetch(`${API_BASE}/ai-match/chat/choice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Chat-Token": token },
    body: JSON.stringify({ reveal }),
  });
  return parseJson(response, "선택을 보내지 못했습니다.");
}

export async function startAdminAiMatchChat(requestId) {
  const response = await fetch(`${API_BASE}/admin/ai-match/requests/${requestId}/chat/start`, {
    method: "POST",
    headers: withAuth(),
  });
  return parseJson(response, "채팅을 시작하지 못했습니다.");
}

export async function fetchAdminAiMatchChatLog(requestId) {
  const response = await fetch(`${API_BASE}/admin/ai-match/requests/${requestId}/chat`, { headers: withAuth() });
  return parseJson(response, "채팅 기록을 불러오지 못했습니다.");
}

// fromStage: 누른 화면에 보이던 지금 단계. 서버 단계와 다르면(다른 스태프가 먼저 바꿈) 서버가 바꾸지 않고 409 를 준다.
export async function setAdminAiMatchEscortStage(requestId, side, stage, fromStage) {
  const response = await fetch(`${API_BASE}/admin/ai-match/requests/${requestId}/escort`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ side, stage, fromStage }),
  });
  return parseJson(response, "단계를 바꾸지 못했습니다.");
}

export async function confirmAiMatchMeetup(requestId, nickname, pin) {
  const response = await fetch(`${API_BASE}/ai-match/requests/${requestId}/meetup/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin }),
  });
  return parseJson(response, "약속 확정에 실패했습니다.");
}

// ---------- 소개팅: 신고(사용자) · 현장 체크인 · 숨김 · 사진 검수 · CSV(관리자) ----------
export async function reportAiMatchProfile(profileId, nickname, pin, reason, detail) {
  const response = await fetch(`${API_BASE}/ai-match/profiles/${profileId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, pin, reason, detail }),
  });
  return parseJson(response, "신고를 접수하지 못했습니다.");
}

export async function markAdminAiMatchArrival(requestId, side, arrived) {
  const response = await fetch(`${API_BASE}/admin/ai-match/requests/${requestId}/arrival`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ side, arrived }),
  });
  return parseJson(response, "도착 체크에 실패했습니다.");
}

export async function markAdminAiMatchMet(requestId) {
  const response = await fetch(`${API_BASE}/admin/ai-match/requests/${requestId}/met`, {
    method: "POST",
    headers: withAuth(),
  });
  return parseJson(response, "만남 완료 처리에 실패했습니다.");
}

export async function markAdminAiMatchNoShow(requestId, side) {
  const response = await fetch(`${API_BASE}/admin/ai-match/requests/${requestId}/no-show`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ side }),
  });
  return parseJson(response, "노쇼 처리에 실패했습니다.");
}

export async function setAdminAiMatchProfileHidden(profileId, hidden, reason) {
  const response = await fetch(`${API_BASE}/admin/ai-match/profiles/${profileId}/hidden`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ hidden, reason }),
  });
  return parseJson(response, "숨김 처리에 실패했습니다.");
}

export async function reviewAdminAiMatchPhoto(profileId, decision, reason) {
  const response = await fetch(`${API_BASE}/admin/ai-match/profiles/${profileId}/photo-review`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ decision, reason }),
  });
  return parseJson(response, "사진 검수 처리에 실패했습니다.");
}

export async function resolveAdminAiMatchReport(reportId, action, note) {
  const response = await fetch(`${API_BASE}/admin/ai-match/reports/${reportId}/resolve`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action, note }),
  });
  return parseJson(response, "신고 처리에 실패했습니다.");
}

export async function downloadAdminAiMatchCsv({ statsOnly = false } = {}) {
  const response = await fetch(`${API_BASE}/admin/ai-match/export.csv${statsOnly ? "?statsOnly=true" : ""}`, { headers: withAuth() });
  if (!response.ok) {
    const error = new Error("CSV를 내려받지 못했습니다.");
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `사주소개팅-${statsOnly ? "통계" : "운영보고"}-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- 부스: 손님 호출 · 마감 정산 / 공지 조회 / 공연 일괄 상태 ----------
export async function callOpsBoothReservation(boothId, reservationId, key) {
  const response = await fetch(opsUrl(`/ops/booth/${boothId}/reservations/${reservationId}/call`), {
    method: "POST",
    headers: opsHeaders(key),
  });
  return parseJson(response, "손님 호출에 실패했습니다.");
}

/** 지난 주문 내역(영업일 하나) + 주문 있었던 날짜 목록. date 없으면 오늘 영업일. */
export async function fetchOpsBoothOrderHistory(boothId, date, key) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(opsUrl(`/ops/booth/${boothId}/orders/history${query}`), { headers: opsHeaders(key) });
  return parseJson(response, "지난 주문을 불러오지 못했습니다.");
}

/** 같은 내역을 CSV(Blob)로. 화면이 파일로 저장한다. */
export async function downloadOpsBoothOrderCsv(boothId, date, key) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(opsUrl(`/ops/booth/${boothId}/orders/history.csv${query}`), { headers: opsHeaders(key) });
  if (!response.ok) {
    await parseJson(response, "CSV 를 만들지 못했습니다.");
  }
  return response.blob();
}

export async function fetchOpsBoothSummary(boothId, date, key) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(opsUrl(`/ops/booth/${boothId}/summary${query}`), { headers: opsHeaders(key) });
  return parseJson(response, "마감 정산을 불러오지 못했습니다.");
}

const NOTICE_VIEW_KEY = "festa_notice_views";

/** 공지를 펼쳐 봤다고 서버에 알린다. 같은 기기에서는 공지당 한 번만 보낸다. */
export async function recordNoticeView(noticeId) {
  let seen = [];
  try {
    seen = JSON.parse(localStorage.getItem(NOTICE_VIEW_KEY) || "[]");
  } catch {
    seen = [];
  }
  if (seen.includes(noticeId)) return;
  try {
    localStorage.setItem(NOTICE_VIEW_KEY, JSON.stringify([...seen, noticeId].slice(-200)));
  } catch {
    // 저장 못 해도 보낸다
  }
  try {
    await fetch(`${API_BASE}/notices/${noticeId}/view`, { method: "POST" });
  } catch {
    // 조회 수는 실패해도 화면에 영향 없음
  }
}

export async function bulkUpdateOpsMasterEventStatus(payload, key) {
  const response = await fetch(opsUrl("/ops/master/events/bulk-status"), {
    method: "PUT",
    headers: opsHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "공연 상태 일괄 변경에 실패했습니다.");
}

export async function bulkUpdateAdminEventStatus(payload) {
  const response = await fetch(`${API_BASE}/admin/events/bulk-status`, {
    method: "PUT",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "공연 상태 일괄 변경에 실패했습니다.");
}

export async function fetchAdminAiMatchSummary() {
  const response = await fetch(`${API_BASE}/admin/ai-match/summary`, { headers: withAuth() });
  return parseJson(response, "소개팅 요약을 불러오지 못했습니다.");
}

/* ---------- 스태프 화면(/staff): 명단 · 시간표 · 상태. 부스 암호(X-OPS-KEY)로 연다. ---------- */

async function crewRequest(path, key, { method = "GET", body, errorMessage }) {
  const response = await fetchWithTimeout(opsUrl(`/ops/crew${path}`), {
    method,
    headers: opsHeaders(key, body === undefined ? {} : { "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseJson(response, errorMessage);
}

// version 을 주면, 그 뒤로 바뀐 것이 없을 때 서버가 { unchanged: true } 만 돌려준다.
export function fetchCrewState(key, version) {
  const query = version ? `?v=${encodeURIComponent(version)}` : "";
  return crewRequest(query, key, { errorMessage: "스태프 정보를 불러오지 못했어요." });
}

export function updateCrewStatus(memberId, payload, key) {
  return crewRequest(`/members/${memberId}/status`, key, { method: "PUT", body: payload, errorMessage: "상태를 바꾸지 못했어요." });
}

export function updateCrewLocation(memberId, payload, key) {
  return crewRequest(`/members/${memberId}/location`, key, { method: "PUT", body: payload, errorMessage: "있는 곳을 바꾸지 못했어요." });
}

export function saveCrewSlot(slotId, payload, key) {
  return slotId
    ? crewRequest(`/slots/${slotId}`, key, { method: "PUT", body: payload, errorMessage: "시간표를 고치지 못했어요." })
    : crewRequest("/slots", key, { method: "POST", body: payload, errorMessage: "칸을 더하지 못했어요." });
}

export function deleteCrewSlot(slotId, by, key) {
  return crewRequest(`/slots/${slotId}?by=${encodeURIComponent(by || "")}`, key, { method: "DELETE", errorMessage: "칸을 지우지 못했어요." });
}

export function saveCrewMember(memberId, payload, key) {
  return memberId
    ? crewRequest(`/members/${memberId}`, key, { method: "PUT", body: payload, errorMessage: "명단을 고치지 못했어요." })
    : crewRequest("/members", key, { method: "POST", body: payload, errorMessage: "명단에 더하지 못했어요." });
}

export function deleteCrewMember(memberId, by, key) {
  return crewRequest(`/members/${memberId}?by=${encodeURIComponent(by || "")}`, key, { method: "DELETE", errorMessage: "명단에서 빼지 못했어요." });
}

export function saveCrewNotice(noticeId, payload, key) {
  return noticeId
    ? crewRequest(`/notices/${noticeId}`, key, { method: "PUT", body: payload, errorMessage: "공지를 고치지 못했어요." })
    : crewRequest("/notices", key, { method: "POST", body: payload, errorMessage: "공지를 더하지 못했어요." });
}

export function deleteCrewNotice(noticeId, by, key) {
  return crewRequest(`/notices/${noticeId}?by=${encodeURIComponent(by || "")}`, key, { method: "DELETE", errorMessage: "공지를 지우지 못했어요." });
}

export function importCrew(payload, by, key) {
  return crewRequest(`/import?by=${encodeURIComponent(by || "")}`, key, { method: "POST", body: payload, errorMessage: "명단 파일을 올리지 못했어요." });
}

// 가장 최근 '통째로 바꾸기'(엑셀 올리기) 직전 모습으로 되돌린다.
export function restoreCrew(by, key) {
  return crewRequest(`/restore?by=${encodeURIComponent(by || "")}`, key, { method: "POST", errorMessage: "되돌리지 못했어요." });
}
