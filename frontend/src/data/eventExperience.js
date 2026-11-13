import { resolveApiAssetUrl } from "../api";

export const EVENT_REMINDER_KEY = "festa_event_reminders";
export const EVENT_REMINDER_LEAD_MS = 10 * 60 * 1000;
export const EVENT_MAX_TIMER_MS = 2_147_483_647;

// 2026 가을축제 "바람" 이틀. 서버에 일정이 없어도 이 두 날짜 탭은 항상 보인다.
export const EVENT_DATE_TABS = ["2026-10-07", "2026-10-08"];

// 장소로 거른다. 일정의 stage(장소)나 제목에 이 글자가 들어가면 잡힌다.
export const EVENT_STAGE_FILTERS = ["전체", "노천극장", "성호관", "가온마당", "아로새길", "대운동장"];

export const EVENT_STATUS = {
  LIVE: "진행 중",
  SOON: "10분 후 시작",
  SCHEDULED: "예정",
  ENDED: "종료",
  DELAYED: "지연",
  CANCELED: "취소",
  REMINDER: "알림 설정",
};

const CONCERT_IMAGE = "https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=1200";
const BUSKING_IMAGE = "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=900&q=80";
const CHEER_IMAGE = "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=900";
const FIREWORKS_IMAGE = "https://images.pexels.com/photos/949592/pexels-photo-949592.jpeg?auto=compress&cs=tinysrgb&w=900";
const DJ_IMAGE = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80";

const HOST = "아주대학교 총학생회";

function preset(id, title, stage, day, start, end, extra) {
  // "25:00" 처럼 자정을 넘는 시간은 다음 날로 넘긴다.
  const [endHour, endMinute] = end.split(":").map(Number);
  const endDate = endHour >= 24 ? nextDay(day) : day;
  const endText = `${String(endHour % 24).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
  return {
    id,
    title,
    stage,
    startTime: `${day}T${start}:00`,
    endTime: `${endDate}T${endText}:00`,
    status: EVENT_STATUS.SCHEDULED,
    badge: "예정",
    age: "전체 관람가",
    host: HOST,
    distance: "-",
    waitTime: "-",
    crowd: "보통",
    weather: "-",
    ...extra,
  };
}

function nextDay(day) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 총학생회 확정 타임테이블. 서버 일정이 비어 있을 때의 기본값이자, 서버 일정에 붙는 설명·사진의 출처. */
export const EVENT_PRESETS = [
  preset("d1-run", "뛰아주", "축구장 출발 · 선구자상 도착", "2026-10-07", "10:30", "12:00", {
    imageUrl: CHEER_IMAGE,
    lead: "캠퍼스를 달리는 축제의 시작",
    description:
      "축구장에서 출발해 혜령공원에서 반환하고 선구자상에 도착하는 러닝입니다. 10:30 참가자 확인 · 스트레칭 · 배번 및 물 배부, 10:40 시작, 12:00 종료 & 사진 촬영.",
    genre: "참여 프로그램",
  }),
  preset("d1-day-booth", "주간부스", "성호관 잔디 · 가온마당", "2026-10-07", "10:30", "16:30", {
    imageUrl: BUSKING_IMAGE,
    lead: "낮의 축제, 성호관 잔디와 가온마당",
    description: "성호관 잔디와 가온마당에서 학과·동아리 주간 부스가 열립니다. 사주 소개팅 부스도 여기에 있어요.",
    genre: "부스",
  }),
  preset("d1-aro", "아로새길 거리축제", "아로새길 · 아주대 삼거리 일대", "2026-10-07", "14:00", "23:00", {
    imageUrl: BUSKING_IMAGE,
    lead: "아로새길에서 열리는 거리축제",
    description: "총학생회 구역 · 상인회 주민자치회 구역 · 도시재단 구역으로 나누어 부스가 열립니다. 총학생회 구역에는 주점부스와 쌈지공원 메인무대가 있어요.",
    genre: "거리축제",
  }),
  preset("d1-sucl", "SUCL", "대운동장", "2026-10-07", "15:00", "19:00", {
    imageUrl: CONCERT_IMAGE,
    lead: "SUCL 2026 with 아주대학교 결승",
    description: "일레븐 VS FC미디어, 결승전이 대운동장에서 열립니다. 경기 장면을 인스타그램 스토리에 올리는 관람 인증 이벤트도 있어요.",
    genre: "스포츠",
  }),
  preset("d1-pub", "총학 주점", "아로새길 총학생회 구역", "2026-10-07", "16:00", "23:00", {
    imageUrl: DJ_IMAGE,
    lead: "아로새길에 차려지는 총학 주점",
    description: "총학생회가 아로새길 거리축제 총학생회 구역에서 운영하는 주점입니다. 주점 탭에서 메뉴와 자리를 볼 수 있어요. 모든 판매수익은 기부 예정이에요.",
    genre: "주점",
  }),
  preset("d1-cinema", "어썸 시네마", "노천극장(The Art)", "2026-10-07", "18:00", "22:00", {
    imageUrl: FIREWORKS_IMAGE,
    lead: "노천극장에서 보는 가을밤 영화",
    description: "노천극장(The Art)에서 야외 상영이 진행됩니다. 담요를 챙기면 더 좋아요.",
    genre: "영화",
  }),
  preset("d1-night-market", "야시장", "도서관 주차장 · 성호관 잔디밭", "2026-10-07", "10:30", "25:00", {
    imageUrl: DJ_IMAGE,
    lead: "밤늦게까지 이어지는 야시장",
    description: "도서관 주차장과 성호관 잔디밭에서 야시장이 열립니다. 새벽 1시까지 운영해요.",
    genre: "야시장",
  }),
  preset("d2-day-booth", "주간부스", "성호관 잔디 · 가온마당", "2026-10-08", "10:30", "16:30", {
    imageUrl: BUSKING_IMAGE,
    lead: "둘째 날 주간 부스",
    description: "성호관 잔디와 가온마당에서 주간 부스가 이어집니다. 사주 소개팅 부스 만남도 이 시간에 잡을 수 있어요.",
    genre: "부스",
  }),
  preset("d2-stage", "공연무대", "노천극장(The Art)", "2026-10-08", "17:00", "25:00", {
    imageUrl: CONCERT_IMAGE,
    lead: "축제의 마지막 밤, 노천극장 공연",
    description:
      "노천극장(The Art)에서 축제 공연무대가 열립니다. 입장은 17:30부터(아주인만, 학생증 확인), 공연은 18:00 ~ 22:00. 학생참여공연 · 응원대제전 · 스페셜 아티스트 fromis_9 무대가 준비돼 있어요.",
    genre: "공연",
  }),
  preset("d2-night-booth", "야간부스", "가온마당", "2026-10-08", "10:30", "25:00", {
    imageUrl: FIREWORKS_IMAGE,
    lead: "가온마당의 야간 부스",
    description: "가온마당에서 야간 부스가 운영됩니다. 공연 전후로 들르기 좋아요.",
    genre: "부스",
  }),
];

// 예전 데모 공연 제목. 서버가 아직 이런 데이터를 주면 위 실제 일정으로 바꿔서 보여 준다.
const SEED_TITLES = new Set([
  "밴드 연습실",
  "DJ Awesome",
  "에일리",
  "싸이",
  "득근득근 포징 공연",
  "하이키",
  "오프닝 공연",
  "밴드 라이브",
  "댄스팀 쇼케이스",
  "DJ 피날레",
  "오프닝 퍼레이드",
  "버스킹 릴레이",
  "응원단 합동 무대",
  "인디밴드 쇼케이스",
  "DJ 나이트",
  "폐막 불꽃 카운트다운",
  "재즈 버스킹",
  "댄스 배틀 예선",
  "동아리 랜덤 플레이댄스",
  "심야 어쿠스틱",
  "셔틀 막차 안내 방송",
]);

export function readEventReminders() {
  try {
    return new Set(JSON.parse(localStorage.getItem(EVENT_REMINDER_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function saveEventReminders(next) {
  localStorage.setItem(EVENT_REMINDER_KEY, JSON.stringify([...next]));
}

export function eventKey(event, index = 0) {
  return String(event?.id || event?.slug || `${event?.title || "event"}-${event?.startTime || index}`);
}

export function eventDateKey(value) {
  return value ? String(value).slice(0, 10) : "all";
}

export function formatEventTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${value || ""}`.slice(11, 16) || "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function eventDurationMinutes(event) {
  const start = new Date(event?.startTime).getTime();
  const end = new Date(event?.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}

export function eventDateLabel(value, compact = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "").slice(5, 10).replace("-", ".");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const base = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  return compact ? `${base}(${weekdays[date.getDay()]})` : `${base}(${weekdays[date.getDay()]})`;
}

export function eventDayHeading(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "전체 일정";
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const dayIndex = EVENT_DATE_TABS.indexOf(eventDateKey(value));
  const dayLabel = dayIndex >= 0 ? `${dayIndex + 1}일차 · ` : "";
  return `${dayLabel}${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}(${weekdays[date.getDay()]}) 전체 일정`;
}

export function normalizeStatus(rawStatus, fallbackStatus = EVENT_STATUS.SCHEDULED) {
  const raw = `${rawStatus || ""}`.trim();
  if (!raw) return fallbackStatus;
  if (raw.includes("진행")) return EVENT_STATUS.LIVE;
  if (raw.includes("10분") || raw.includes("곧") || raw.includes("임박")) return EVENT_STATUS.SOON;
  if (raw.includes("취소")) return EVENT_STATUS.CANCELED;
  if (raw.includes("지연")) return EVENT_STATUS.DELAYED;
  if (raw.includes("종료")) return EVENT_STATUS.ENDED;
  if (raw.includes("알림")) return EVENT_STATUS.REMINDER;
  return raw;
}

export function statusTone(status) {
  if (status === EVENT_STATUS.LIVE) return "live";
  if (status === EVENT_STATUS.SOON || status === EVENT_STATUS.DELAYED) return "soon";
  if (status === EVENT_STATUS.REMINDER) return "reminded";
  if (status === EVENT_STATUS.ENDED || status === EVENT_STATUS.CANCELED) return "done";
  return "scheduled";
}

/** 일정에 붙일 기본 정보. 같은 제목·같은 날짜 → 같은 제목 → 순서 순으로 찾는다. */
function presetFor(event, index = 0) {
  if (event?.title) {
    const date = eventDateKey(event.startTime);
    const exact = EVENT_PRESETS.find((item) => item.title === event.title && eventDateKey(item.startTime) === date);
    if (exact) return exact;
    const byTitle = EVENT_PRESETS.find((item) => item.title === event.title);
    if (byTitle) return byTitle;
  }
  return EVENT_PRESETS[index % EVENT_PRESETS.length];
}

export function normalizeEvents(events = []) {
  const isSeedDataset =
    Array.isArray(events)
    && events.length > 0
    && events.some((event) => SEED_TITLES.has(event?.title) || `${event?.imageUrl || ""}`.includes("Bodybuilder"));
  const source = Array.isArray(events) && events.length && !isSeedDataset ? events : EVENT_PRESETS;
  return source.map((event, index) => normalizeEvent(event, index));
}

export function normalizeEvent(event, index = 0) {
  const seedLike = !event || SEED_TITLES.has(event.title) || `${event.imageUrl || ""}`.includes("Bodybuilder");
  const base = seedLike ? EVENT_PRESETS[index % EVENT_PRESETS.length] : presetFor(event, index);
  const title = seedLike ? base.title : event.title || base.title;
  const stage = seedLike
    ? base.stage
    : event.stage || event.locationName || event.venue || event.artist || base.stage;
  const imageUrl = seedLike ? base.imageUrl : resolveApiAssetUrl(event.imageUrl) || base.imageUrl;
  const status = normalizeStatus(event?.statusOverride || event?.status, base.status);
  // 서버의 liveMessage 는 "장소: ..." 같은 운영 메모라 설명으로는 preset 문장을 먼저 쓴다.
  const liveMessage = `${event?.liveMessage || ""}`.trim();

  return {
    ...base,
    ...(seedLike ? {} : event),
    id: event?.id || base.id,
    title,
    stage,
    imageUrl,
    status,
    badge: status === EVENT_STATUS.SCHEDULED ? base.badge : status,
    description: event?.description || base.description || liveMessage,
    lead: event?.lead || base.lead,
    genre: event?.genre || base.genre,
    age: event?.age || base.age,
    host: event?.host || event?.artist || base.host,
    distance: event?.distance || base.distance,
    waitTime: event?.waitTime || base.waitTime,
    crowd: event?.crowd || base.crowd,
    weather: event?.weather || base.weather,
    startTime: (seedLike ? null : event?.startTime) || base.startTime,
    endTime: (seedLike ? null : event?.endTime) || base.endTime,
  };
}

export function sortedEvents(events) {
  return [...events].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

export function uniqueEventDates(events) {
  const dates = new Set(EVENT_DATE_TABS);
  events.forEach((event) => dates.add(eventDateKey(event.startTime)));
  return [...dates].filter((date) => date && date !== "all").sort();
}

export function primaryFestivalDate(events) {
  // 축제 기간 중이면 오늘, 아니면 1일차부터.
  const today = eventDateKey(new Date().toISOString());
  if (EVENT_DATE_TABS.includes(today)) return today;
  const counts = new Map();
  events.forEach((event) => {
    const key = eventDateKey(event.startTime);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const first = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))[0]?.[0];
  return EVENT_DATE_TABS[0] || first || "2026-10-07";
}
