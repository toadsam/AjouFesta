// 연습용 서버 · 총괄 영역(공지 · 공연 시간).
// 실제 서버의 NoticeService · EventService · AdminActionService 규칙을 그대로 옮겼다. 서버 규칙을 바꾸면 여기도 같이 바꾼다.
import { NOT_HANDLED, httpError, parseStamp } from "./demoCore";
import { DEMO_ADMIN_TOKEN } from "./aimatchDomain";

/** 이 흐름을 열면 연습용 시계를 이 시각(축제 첫날 낮)에 맞춘다. 화면 속 시계도 같이 간다. */
export const FEST_CLOCK_START = "2026-10-07T12:57:00";
export const DEMO_ADMIN_NAME = "연습 운영진";

/** 흐름이 다루는 일정. */
export const FEST_EVENT_START_NOTICE = 20; // SUCL
export const FEST_EVENT_EDIT = 19; // 주간부스(10.07)

// 실제 서버에 들어 있는 총학 타임테이블과 같은 값(2026-10-02 기준).
const EVENT_SEED = [
  [18, "뛰아주", "2026-10-07T10:30:00", "2026-10-07T12:00:00", "장소: 축구장 출발 → 혜령공원 반환 → 선구자상 도착"],
  [19, "주간부스", "2026-10-07T10:30:00", "2026-10-07T16:30:00", "장소: 아주대학교 성호관 잔디 / 가온마당"],
  [23, "야시장", "2026-10-07T10:30:00", "2026-10-08T01:00:00", "장소: 도서관 주차장 / 성호관 잔디밭"],
  [29, "아로새길 거리축제", "2026-10-07T14:00:00", "2026-10-07T23:00:00", "장소: 아로새길 및 아주대 삼거리 일대"],
  [21, "총학 주점", "2026-10-07T16:00:00", "2026-10-07T23:00:00", "장소: 아로새길 거리축제 총학생회 구역"],
  [20, "SUCL", "2026-10-07T15:00:00", "2026-10-07T19:00:00", "장소: 아주대학교 대운동장"],
  [22, "어썸 시네마", "2026-10-07T18:00:00", "2026-10-07T22:00:00", "장소: 노천극장(The Art)"],
  [25, "주간부스", "2026-10-08T10:30:00", "2026-10-08T16:30:00", "장소: 아주대학교 성호관 잔디 / 가온마당"],
  [27, "야간부스", "2026-10-08T10:30:00", "2026-10-09T01:00:00", "장소: 가온마당"],
  [26, "공연무대", "2026-10-08T17:00:00", "2026-10-09T01:00:00", "장소: 노천극장(The Art) · 입장 17:30 · 공연 18:00 ~ 22:00"],
];

const STAFF_LABEL = { STANDBY: "대기", MOVING: "이동", ON_DUTY: "업무중", URGENT: "긴급" };

const blank = (value) => value == null || `${value}`.trim() === "";
const normalizeBlank = (value) => (blank(value) ? null : `${value}`.trim());
/** 화면이 보내는 "2026-10-07T13:30" 도 서버처럼 초까지 채운다. */
const toStamp = (value) => {
  const text = `${value || ""}`.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return `${text}:00`;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text) ? text.slice(0, 19) : "";
};

export function createFestDomain({ nowMs, stamp, publish, emit }) {
  let state;
  const timers = new Set();

  function reset() {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    const now = nowMs();
    state = {
      nextNoticeId: 8,
      nextEventId: 30,
      nextLogId: 1,
      events: EVENT_SEED.map(([id, title, startTime, endTime, liveMessage]) => ({
        id,
        title,
        startTime,
        endTime,
        status: "예정",
        imageUrl: null,
        imageCredit: null,
        imageFocus: "center",
        statusOverride: "예정",
        liveMessage,
        delayMinutes: 0,
        statusUpdatedAt: stamp(now - 5 * 86400000),
      })),
      notices: [
        {
          id: 7,
          title: "축제 첫날이 시작됐어요",
          content: "오늘 일정은 아래 타임테이블에서 볼 수 있어요. 분실물은 분실물 탭에서 확인해 주세요.",
          category: "일반",
          active: true,
          createdAt: stamp(now - 3 * 3600000),
          updatedAt: stamp(now - 3 * 3600000),
          viewCount: 12,
          seed: true,
        },
      ],
      logs: [],
      staff: [
        { id: 1, staffNo: "S-01", name: "연습 스태프 1", team: "주점", status: "ON_DUTY", currentTask: "주문 받기", currentNote: "", assignedBoothId: 1 },
        { id: 2, staffNo: "S-02", name: "연습 스태프 2", team: "소개팅 부스", status: "STANDBY", currentTask: "", currentNote: "", assignedBoothId: null },
      ].map((member) => ({ ...member, latitude: null, longitude: null, locationSharingEnabled: false, lastUpdatedAt: stamp(now - 600000) })),
      // 흐름이 어디까지 왔는지(매뉴얼 화면이 읽는다).
      flow: {
        noticeId: null,
        noticeTitle: "",
        noticeHidden: false,
        viewed: false,
        adminSawView: false,
        startNotice: false,
        timeEdited: false,
        bulkApplied: false,
        bulkCleared: false,
      },
    };
  }

  /* ----- 공연 ----- */
  // EventService.resolveStatus: 취소는 그대로, 끝난 일정은 종료(직접 고른 상태도 풀림), 직접 고른 상태, 아니면 시각으로.
  function resolveStatus(event, now) {
    const override = normalizeBlank(event.statusOverride);
    if (override === "취소") return (event.status = override);
    const end = parseStamp(event.endTime);
    if (end && now > end) {
      if (override) event.statusOverride = null;
      return (event.status = "종료");
    }
    if (override) return (event.status = override);
    const start = parseStamp(event.startTime);
    return (event.status = start && now < start ? "예정" : "진행중");
  }

  const eventDto = (event) => {
    resolveStatus(event, nowMs());
    return { ...event };
  };
  const allEvents = () => [...state.events].sort((a, b) => parseStamp(a.startTime) - parseStamp(b.startTime)).map(eventDto);
  const findEvent = (id) => {
    const event = state.events.find((item) => item.id === Number(id));
    if (!event) throw httpError(404, "공연을 찾을 수 없습니다.");
    return event;
  };

  // FestivalEvent.update: 상태 · 안내 한 줄 · 지연 분이 바뀌면 statusUpdatedAt 을 새로 찍는다.
  function applyEvent(event, payload) {
    const nextOverride = normalizeBlank(payload.statusOverride);
    const nextMessage = normalizeBlank(payload.liveMessage);
    const delay = payload.delayMinutes == null || payload.delayMinutes === "" ? null : Number(payload.delayMinutes);
    const nextDelay = Number.isFinite(delay) && delay >= 0 ? delay : null;
    if (event.statusOverride !== nextOverride || event.liveMessage !== nextMessage || event.delayMinutes !== nextDelay) {
      event.statusUpdatedAt = stamp();
    }
    Object.assign(event, {
      title: payload.title,
      startTime: payload.startTime,
      endTime: payload.endTime,
      imageUrl: normalizeBlank(payload.imageUrl),
      imageCredit: normalizeBlank(payload.imageCredit),
      imageFocus: normalizeBlank(payload.imageFocus),
      statusOverride: nextOverride,
      liveMessage: nextMessage,
      delayMinutes: nextDelay,
    });
  }

  function readEventPayload(body) {
    const title = `${body?.title || ""}`.trim();
    const startTime = toStamp(body?.startTime);
    const endTime = toStamp(body?.endTime);
    if (!title || !startTime || !endTime) throw httpError(400, "제목과 시작 · 종료 시간을 확인해 주세요.");
    return { ...body, title, startTime, endTime };
  }

  // 실제 서버는 공연을 하나씩 고쳤을 때 바로 알리지 않고, 30초마다 도는 방송에 실어 보낸다. 연습에서는 그 기다림을 2초로 줄인다.
  function broadcastEventsSoon() {
    const timer = setTimeout(() => {
      timers.delete(timer);
      publish("events", allEvents());
    }, 2000);
    timers.add(timer);
  }

  function createEvent(body, role) {
    const payload = readEventPayload(body);
    const event = { id: state.nextEventId++, status: "예정", statusOverride: null, liveMessage: null, delayMinutes: null, statusUpdatedAt: null };
    applyEvent(event, payload);
    state.events.push(event);
    const dto = eventDto(event);
    log("CREATE", "EVENT", dto.id, dto.title);
    broadcastEventsSoon();
    emit({ type: "fest.event.created", role, event: dto });
    return dto;
  }

  function updateEvent(id, body, role) {
    const event = findEvent(id);
    const payload = readEventPayload(body);
    const before = { ...event };
    applyEvent(event, payload);
    const dto = eventDto(event);
    if (before.startTime !== dto.startTime || before.endTime !== dto.endTime) state.flow.timeEdited = true;
    log("UPDATE", "EVENT", dto.id, dto.title);
    broadcastEventsSoon();
    emit({ type: "fest.event.updated", role, event: dto, before });
    return dto;
  }

  function deleteEvent(id, role) {
    const event = findEvent(id);
    state.events = state.events.filter((item) => item !== event);
    log("DELETE", "EVENT", event.id, "공연 삭제");
    broadcastEventsSoon();
    emit({ type: "fest.event.deleted", role, event: { ...event } });
    return undefined;
  }

  // EventService.bulkUpdateStatus: 안내 한 줄 · 지연 분은 null 이면 그대로 두고, 값이 오면(빈 글자 포함) 그 값으로 바꾼다. 이것만 바로 방송한다.
  function bulkStatus(body, role) {
    const ids = Array.isArray(body?.eventIds) ? body.eventIds.map(Number) : [];
    if (!ids.length) return [];
    const statusOverride = normalizeBlank(body.statusOverride);
    const targets = state.events.filter((event) => ids.includes(event.id));
    targets.forEach((event) =>
      applyEvent(event, {
        ...event,
        statusOverride,
        liveMessage: body.liveMessage == null ? event.liveMessage : body.liveMessage,
        delayMinutes: body.delayMinutes == null ? event.delayMinutes : body.delayMinutes,
      }),
    );
    const result = targets.map(eventDto);
    if (statusOverride) state.flow.bulkApplied = true;
    else if (state.flow.bulkApplied) state.flow.bulkCleared = true;
    log("BULK_STATUS", "EVENT", null, `${statusOverride || "auto"} x${result.length}`);
    publish("events", allEvents());
    emit({
      type: "fest.events.bulk",
      role,
      count: result.length,
      statusOverride,
      delayMinutes: body.delayMinutes == null ? null : Number(body.delayMinutes),
      liveMessage: normalizeBlank(body.liveMessage),
      titles: result.map((event) => event.title),
    });
    return result;
  }

  /* ----- 공지 ----- */
  const noticeDto = ({ seed, ...notice }) => notice;
  const byNewest = (a, b) => parseStamp(b.createdAt) - parseStamp(a.createdAt) || b.id - a.id;
  const activeNotices = () => state.notices.filter((notice) => notice.active).sort(byNewest).map(noticeDto);
  const allNotices = () => [...state.notices].sort(byNewest).map(noticeDto);
  const findNotice = (id) => {
    const notice = state.notices.find((item) => item.id === Number(id));
    if (!notice) throw httpError(404, "공지를 찾을 수 없습니다.");
    return notice;
  };

  function readNoticePayload(body) {
    if (blank(body?.title) || blank(body?.content) || blank(body?.category)) throw httpError(400, "제목 · 내용 · 분류를 모두 넣어 주세요.");
    return { title: body.title, content: body.content, category: body.category, active: Boolean(body.active) };
  }

  function saveNotice(payload) {
    const notice = { id: state.nextNoticeId++, ...payload, createdAt: stamp(), updatedAt: stamp(), viewCount: 0 };
    state.notices.push(notice);
    publish("notices", activeNotices());
    return notice;
  }

  function createNotice(body, role) {
    const notice = saveNotice(readNoticePayload(body));
    if (state.flow.noticeId == null) {
      state.flow.noticeId = notice.id;
      state.flow.noticeTitle = notice.title;
      state.flow.noticeHidden = !notice.active;
    }
    log("CREATE", "NOTICE", notice.id, notice.title);
    emit({ type: "fest.notice.created", role, notice: noticeDto(notice) });
    return noticeDto(notice);
  }

  function updateNotice(id, body, role) {
    const notice = findNotice(id);
    const payload = readNoticePayload(body);
    const before = noticeDto(notice);
    Object.assign(notice, payload, { updatedAt: stamp() });
    if (notice.id === state.flow.noticeId) {
      state.flow.noticeTitle = notice.title;
      if (!notice.active) state.flow.noticeHidden = true;
    }
    publish("notices", activeNotices());
    log("UPDATE", "NOTICE", notice.id, notice.title);
    emit({ type: "fest.notice.updated", role, notice: noticeDto(notice), before });
    return noticeDto(notice);
  }

  function deleteNotice(id, role) {
    const notice = findNotice(id);
    state.notices = state.notices.filter((item) => item !== notice);
    if (notice.id === state.flow.noticeId) state.flow.noticeHidden = true;
    publish("notices", activeNotices());
    log("DELETE", "NOTICE", notice.id, "공지 삭제");
    emit({ type: "fest.notice.deleted", role, notice: noticeDto(notice) });
    return undefined;
  }

  // 손님이 공지를 펼쳤다. 기기당 한 번만 보내는 것은 화면 쪽이 거른다.
  function recordView(id, role) {
    const notice = state.notices.find((item) => item.id === Number(id));
    if (!notice) return undefined;
    notice.viewCount += 1;
    if (notice.id === state.flow.noticeId) state.flow.viewed = true;
    emit({ type: "fest.notice.viewed", role, notice: noticeDto(notice) });
    return undefined;
  }

  // AdminActionService: 버튼 하나로 나가는 공지. 문구는 서버가 정한다.
  function quickEventStartNotice(eventId, role) {
    const event = eventDto(findEvent(eventId));
    const notice = saveNotice({
      title: "공연 시작 안내",
      content: `지금부터 '${event.title}' 공연이 시작됩니다. 관객석으로 이동해 주세요.`,
      category: "긴급",
      active: true,
    });
    state.flow.startNotice = true;
    log("QUICK_ACTION", "NOTICE", notice.id, "공연 시작 안내 발행");
    emit({ type: "fest.notice.created", role, notice: noticeDto(notice), auto: "event-start", event });
    return noticeDto(notice);
  }

  function quickCongestionNotice(role) {
    const notice = saveNotice({
      title: "혼잡 완화 안내",
      content: "현장 전체 주변이 매우 붐빕니다. 중앙광장 우회 동선을 이용해 주세요.",
      category: "긴급",
      active: true,
    });
    log("QUICK_ACTION", "NOTICE", notice.id, "혼잡 완화 안내 자동 발행");
    emit({ type: "fest.notice.created", role, notice: noticeDto(notice), auto: "congestion" });
    return noticeDto(notice);
  }

  function adminNotices(role) {
    const flow = state.flow;
    if (flow.viewed && !flow.adminSawView) {
      flow.adminSawView = true;
      const notice = state.notices.find((item) => item.id === flow.noticeId);
      if (notice) emit({ type: "fest.admin.sawViews", role, notice: noticeDto(notice) });
    }
    return allNotices();
  }

  /* ----- 그 밖의 총괄 화면 값 ----- */
  function log(action, targetType, targetId, details) {
    state.logs.unshift({ id: state.nextLogId++, adminUsername: DEMO_ADMIN_NAME, action, targetType, targetId, details, createdAt: stamp() });
    state.logs = state.logs.slice(0, 50);
  }

  function kpis() {
    const now = nowMs();
    const soon = allEvents().find((event) => {
      const start = parseStamp(event.startTime);
      return start >= now && start <= now + 30 * 60000;
    });
    return { todayVisitorCount: 0, mostCongestedBooth: null, upcomingWithin30Minutes: soon || null };
  }

  const staffDto = (member) => ({ ...member, statusLabel: STAFF_LABEL[member.status] || "대기" });

  function updateStaff(id, body) {
    const member = state.staff.find((item) => item.id === Number(id));
    if (!member) throw httpError(404, "스태프를 찾을 수 없습니다.");
    Object.assign(member, {
      team: normalizeBlank(body?.team) ?? member.team,
      status: STAFF_LABEL[body?.status] ? body.status : member.status,
      currentTask: normalizeBlank(body?.currentTask) || "",
      currentNote: normalizeBlank(body?.currentNote) || "",
      assignedBoothId: body?.assignedBoothId == null ? null : Number(body.assignedBoothId),
      lastUpdatedAt: stamp(),
    });
    log("UPDATE", "STAFF", member.id, member.staffNo);
    return staffDto(member);
  }

  // 실제로는 AI 가 현장 값을 읽고 쓴다. 연습에서는 정해 둔 문구를 돌려준다.
  const AI_DRAFTS = {
    congestion: ["혼잡 완화 안내", "총학 주점 앞이 붐벼요. 아로새길 안쪽 길로 돌아오면 덜 기다려요.", "긴급"],
    event: ["공연 안내", "곧 대운동장에서 SUCL 결승이 시작돼요. 천천히 이동해 주세요.", "일반"],
    booth: ["부스 운영 안내", "총학 주점은 23시까지 열어요. 테이블 QR 로 자리에서 주문할 수 있어요.", "일반"],
    lost: ["분실물 안내", "주운 물건은 총학생회 부스로 가져다 주세요. 분실물 탭에서 들어온 물건을 볼 수 있어요.", "분실물"],
  };

  function aiAssist(kind, body) {
    const base = {
      title: "연습용 브리핑",
      summary: "연습 화면이라 AI 가 실제 현장 값을 읽지는 않아요. 아래는 정해 둔 예시예요.",
      highlights: ["총학 주점 테이블 12개 중 2개 이용 중", "15:00 SUCL 결승 시작 예정"],
      recommendedActions: ["SUCL 결승 시작 공지 내보내기", "주점 대기 줄 확인하기"],
      draftTitle: null,
      draftContent: null,
      draftCategory: null,
      confidence: "연습",
    };
    if (kind !== "notice-draft") return base;
    const [draftTitle, draftContent, draftCategory] = AI_DRAFTS[body?.type] || AI_DRAFTS.congestion;
    return { ...base, title: "연습용 공지 추천", draftTitle, draftContent, draftCategory };
  }

  function requireAdmin(headers) {
    if ((headers.authorization || "") !== `Bearer ${DEMO_ADMIN_TOKEN}`) throw httpError(401, "로그인이 필요합니다.");
  }

  function route(method, path, query, body, headers, role) {
    if (method === "GET" && path === "/events") return allEvents();
    if (method === "GET" && path === "/notices/active") return activeNotices();
    let match = path.match(/^\/notices\/(\d+)\/view$/);
    if (method === "POST" && match) return recordView(match[1], role);

    if (!path.startsWith("/admin/")) return NOT_HANDLED;
    const rest = path.slice("/admin".length);
    if (rest.startsWith("/ai-match")) return NOT_HANDLED;
    requireAdmin(headers);

    if (rest === "/notices") {
      if (method === "GET") return adminNotices(role);
      if (method === "POST") return createNotice(body, role);
    }
    match = rest.match(/^\/notices\/(\d+)$/);
    if (match && method === "PUT") return updateNotice(match[1], body, role);
    if (match && method === "DELETE") return deleteNotice(match[1], role);

    if (rest === "/events" && method === "POST") return createEvent(body, role);
    if (rest === "/events/bulk-status" && method === "PUT") return bulkStatus(body, role);
    match = rest.match(/^\/events\/(\d+)$/);
    if (match && method === "PUT") return updateEvent(match[1], body, role);
    if (match && method === "DELETE") return deleteEvent(match[1], role);

    if (rest === "/actions/congestion-relief-notice" && method === "POST") return quickCongestionNotice(role);
    match = rest.match(/^\/actions\/events\/(\d+)\/start-notice$/);
    if (match && method === "POST") return quickEventStartNotice(match[1], role);

    if (rest === "/dashboard/kpis" && method === "GET") return kpis();
    if (rest === "/audit-logs" && method === "GET") return state.logs.map((entry) => ({ ...entry }));
    if (rest === "/staff" && method === "GET") return state.staff.map(staffDto);
    match = rest.match(/^\/staff\/(\d+)$/);
    if (match && method === "PUT") return updateStaff(match[1], body);
    if (rest === "/ai/briefing" && method === "POST") return aiAssist("briefing", body);
    if (rest === "/ai/notice-draft" && method === "POST") return aiAssist("notice-draft", body);

    throw httpError(400, "연습 화면에서는 쓸 수 없는 기능이에요. 공지 · 공연만 눌러 볼 수 있어요.");
  }

  function snapshot() {
    return {
      now: stamp(),
      events: allEvents(),
      notices: allNotices(),
      flow: { ...state.flow },
    };
  }

  reset();
  return { route, snapshot, reset };
}
