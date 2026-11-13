// 눌러 보는 매뉴얼 · 총괄 공지와 공연 시간 흐름. 화면 둘(총괄 화면 · 손님 첫 화면)과 순서, 방금 일어난 일을 글로 바꾸는 규칙.
import { DEMO_ADMIN_TOKEN } from "./aimatchDomain";
import { DEMO_ADMIN_NAME, FEST_CLOCK_START, FEST_EVENT_EDIT, FEST_EVENT_START_NOTICE } from "./festDomain";

const ADMIN = "festAdmin";
const GUEST = "festGuest";

const frames = [
  {
    id: ADMIN,
    who: "총괄",
    label: "총괄 화면",
    sub: "총학 운영진이 노트북으로 여는 관리자 화면",
    home: "/admin",
    allow: [/^\/admin$/],
    staff: true,
    // 노트북 폭으로 그린다(왼쪽 메뉴가 보이는 폭). 폰에서 열면 폰 폭 그대로.
    width: 1040,
    local: [
      ["festflow_access_token", DEMO_ADMIN_TOKEN],
      ["festflow_admin_name", DEMO_ADMIN_NAME],
    ],
  },
  {
    id: GUEST,
    who: "손님",
    label: "손님 첫 화면",
    sub: "축제 탭 · 공지와 타임테이블",
    home: "/",
    allow: [/^\/$/],
  },
];

const steps = [
  {
    key: "write",
    frame: ADMIN,
    title: "공지 써서 올리기",
    body: "‘긴급 공지’를 열고 제목과 내용을 적은 뒤 ‘공지 등록’. 연습 화면의 시계는 축제 첫날(10.07) 낮 12시 57분에 맞춰 뒀어요.",
  },
  {
    key: "read",
    frame: GUEST,
    title: "방금 뜬 공지 눌러 보기",
    body: "새로고침하지 않아도 ‘공지’ 맨 위에 떠 있어요. 눌러서 펼치면 읽은 것으로 세어져요.",
  },
  {
    key: "refresh",
    frame: ADMIN,
    title: "‘새로고침’ 눌러 조회 수 보기",
    body: "총괄 화면은 저절로 바뀌지 않아요. 오른쪽 위 새로고침을 눌러야 손님이 읽은 수가 보여요.",
  },
  {
    key: "hide",
    frame: ADMIN,
    title: "지난 공지 내리기",
    body: "그 공지의 ‘수정’을 누르고 ‘홈 노출 활성화’를 끈 뒤 ‘공지 수정’. 지우지 않아도 손님 화면에서 사라지고, 나중에 다시 켤 수 있어요.",
  },
  {
    key: "startNotice",
    frame: ADMIN,
    title: "SUCL 결승 ‘시작 공지’ 누르기",
    body: "‘공연 관리’에서 SUCL의 ‘시작 공지’를 누르면, 글을 쓰지 않아도 시작 안내가 긴급 공지로 나가요.",
  },
  {
    key: "editTime",
    frame: ADMIN,
    title: "주간부스 끝나는 시간 바꾸기",
    body: "주간부스를 30분 더 열기로 했어요. 주간부스의 ‘수정’을 누르고 끝나는 시간을 16:30에서 17:00으로 바꾼 뒤 ‘공연 수정’.",
  },
  {
    key: "bulkDelay",
    frame: ADMIN,
    title: "비가 와요 — 오늘 일정을 한 번에 ‘지연 30분’",
    body: "‘여러 공연 한 번에 바꾸기’에서 날짜를 10.07로 고르고, 손님에게 보일 한 줄을 적은 뒤 ‘적용’.",
  },
  {
    key: "bulkClear",
    frame: ADMIN,
    title: "비가 그쳤어요 — ‘자동 상태로 되돌리기’",
    body: "같은 자리의 ‘자동 상태로 되돌리기’를 누르면 지연 표시와 안내 한 줄이 같이 사라져요.",
  },
];

function progress(snapshot) {
  const { flow, events } = snapshot.fest;
  return {
    done: {
      write: flow.noticeId != null,
      read: flow.viewed || flow.noticeHidden,
      refresh: flow.adminSawView || flow.noticeHidden,
      hide: flow.noticeHidden,
      startNotice: flow.startNotice,
      editTime: flow.timeEdited,
      bulkDelay: flow.bulkApplied,
      bulkClear: flow.bulkCleared,
    },
    context: {
      noticeTitle: flow.noticeTitle,
      startEvent: events.find((event) => event.id === FEST_EVENT_START_NOTICE) || null,
      editEvent: events.find((event) => event.id === FEST_EVENT_EDIT) || null,
    },
  };
}

/* ---------- 방금 일어난 일 ---------- */
// 이름 뒤에 붙는 조사(을/를 · 이/가)를 받침에 맞춘다.
const hasBatchim = (word) => {
  const code = `${word}`.trim().charCodeAt(`${word}`.trim().length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
};
const eul = (word) => `‘${word}’${hasBatchim(word) ? "을" : "를"}`;
const iga = (word) => `‘${word}’${hasBatchim(word) ? "이" : "가"}`;

const clock = (stamp) => `${stamp || ""}`.slice(11, 16);
const span = (event) => `${clock(event.startTime)} ~ ${clock(event.endTime)}`;
const shown = (node) => Boolean(node) && node.getBoundingClientRect().height > 4;

// 손님 화면에서 바뀐 자리를 찾아 준다(매뉴얼 화면이 거기로 내려가 잠깐 표시한다).
const guestNotice = (title) => (doc) =>
  [...doc.querySelectorAll(".v2-notice")].find((node) => node.querySelector("strong")?.textContent.trim() === title) || null;
const guestNoticeArea = (doc) =>
  doc.querySelector(".v2-notice")?.closest(".v2-section") || doc.querySelector(".v2-main-booth")?.closest(".v2-section") || null;
const guestTimeline = (doc) => doc.querySelector(".v2-timeline") || doc.getElementById("festival-schedule");
const guestEvent = (title) => (doc) =>
  [...doc.querySelectorAll(".v2-timeline__item")].find((node) => shown(node) && node.querySelector("strong")?.textContent.trim() === title) ||
  guestTimeline(doc);

const EVENT_WAIT = "실제로는 30초 안에 바뀌어요(연습에서는 2초).";

function describe(event) {
  const from = event.role === GUEST ? GUEST : ADMIN;
  switch (event.type) {
    case "fest.notice.created": {
      const { notice } = event;
      if (event.auto) {
        const cause =
          event.auto === "event-start" ? `총괄이 ‘${event.event.title}’의 ‘시작 공지’를 눌렀어요` : "총괄이 ‘혼잡 완화 공지’를 눌렀어요";
        return {
          from,
          cause,
          effects: [
            { frame: GUEST, text: `‘공지’ 맨 위에 [긴급] ${iga(notice.title)} 바로 떠요. “${notice.content}”`, show: guestNotice(notice.title) },
            { frame: ADMIN, quiet: true, text: "‘긴급 공지’ 목록에도 같은 공지가 생겨요. 문구는 거기서 고치거나 내릴 수 있어요." },
          ],
        };
      }
      return {
        from,
        cause: `총괄이 공지 ${eul(notice.title)} 올렸어요`,
        effects: [
          notice.active
            ? { frame: GUEST, text: "새로고침하지 않아도 ‘공지’ 맨 위에 바로 떠요. 손님 화면에는 최근 3개까지 보여요.", show: guestNotice(notice.title) }
            : { frame: GUEST, quiet: true, text: "‘홈 노출 활성화’를 끄고 올려서 손님 화면에는 보이지 않아요." },
          { frame: ADMIN, text: `공지 목록 맨 위에 ‘${notice.active ? "활성" : "비활성"} · 조회 0’으로 생겨요.` },
        ],
      };
    }
    case "fest.notice.viewed":
      return {
        from,
        cause: `손님이 공지 ${eul(event.notice.title)} 펼쳐 봤어요`,
        effects: [
          { frame: GUEST, text: "공지 내용이 펼쳐져요." },
          { frame: ADMIN, quiet: true, text: "조회 수가 1 올랐어요. 총괄 화면은 저절로 바뀌지 않아서 ‘새로고침’을 눌러야 보여요." },
        ],
      };
    case "fest.admin.sawViews":
      return {
        from,
        cause: "총괄이 화면을 새로 읽었어요",
        effects: [{ frame: ADMIN, text: `‘긴급 공지’ 목록에서 그 공지의 조회가 ${event.notice.viewCount}로 보여요. 같은 폰으로 여러 번 펼쳐도 한 번만 세요.` }],
      };
    case "fest.notice.updated": {
      const { notice, before } = event;
      if (before.active && !notice.active) {
        return {
          from,
          cause: `총괄이 공지 ‘${notice.title}’의 홈 노출을 껐어요`,
          effects: [
            { frame: GUEST, text: "그 공지가 첫 화면에서 바로 사라져요.", show: guestNoticeArea },
            { frame: ADMIN, text: "목록에서 ‘비활성’으로 바뀌어요. 지운 게 아니라서 다시 켤 수 있어요." },
          ],
        };
      }
      if (!before.active && notice.active) {
        return {
          from,
          cause: `총괄이 공지 ${eul(notice.title)} 다시 켰어요`,
          effects: [
            { frame: GUEST, text: "그 공지가 첫 화면에 바로 다시 떠요.", show: guestNotice(notice.title) },
            { frame: ADMIN, text: "목록에서 ‘활성’으로 바뀌어요." },
          ],
        };
      }
      return {
        from,
        cause: `총괄이 공지 ${eul(before.title)} 고쳤어요`,
        effects: [
          notice.active
            ? { frame: GUEST, text: "첫 화면의 공지 제목 · 내용이 바로 바뀌어요.", show: guestNotice(notice.title) }
            : { frame: GUEST, quiet: true, text: "꺼 둔 공지라 손님 화면에는 보이지 않아요." },
          { frame: ADMIN, text: "목록의 제목 · 내용이 바뀌어요." },
        ],
      };
    }
    case "fest.notice.deleted":
      return {
        from,
        cause: `총괄이 공지 ${eul(event.notice.title)} 지웠어요`,
        effects: [
          event.notice.active
            ? { frame: GUEST, text: "그 공지가 첫 화면에서 바로 사라져요.", show: guestNoticeArea }
            : { frame: GUEST, quiet: true, text: "꺼 둔 공지였어서 손님 화면은 그대로예요." },
          { frame: ADMIN, text: "목록에서 없어져요. 지운 공지는 되살릴 수 없어요." },
        ],
      };
    case "fest.event.updated": {
      const { before } = event;
      const next = event.event;
      const timeChanged = before.startTime !== next.startTime || before.endTime !== next.endTime;
      return {
        from,
        cause: timeChanged
          ? `총괄이 ‘${next.title}’ 시간을 바꿨어요 (${span(before)} → ${span(next)})`
          : `총괄이 ‘${before.title}’ 정보를 고쳤어요`,
        effects: [
          {
            frame: GUEST,
            text: `타임테이블의 ‘${next.title}’ ${timeChanged ? `시간이 ${span(next)}` : "내용이 새 값으"}로 바뀌어요. ${EVENT_WAIT}`,
            show: guestEvent(next.title),
            showDelay: 2700,
          },
          { frame: ADMIN, text: "공연 목록의 시간이 바뀌어요." },
        ],
      };
    }
    case "fest.event.created":
      return {
        from,
        cause: `총괄이 공연 ‘${event.event.title}’(${span(event.event)}) 일정을 추가했어요`,
        effects: [
          { frame: GUEST, text: `그 날짜의 타임테이블에 생겨요. ${EVENT_WAIT}`, show: guestEvent(event.event.title), showDelay: 2700 },
          { frame: ADMIN, text: "공연 목록에 생겨요." },
        ],
      };
    case "fest.event.deleted":
      return {
        from,
        cause: `총괄이 공연 ${eul(event.event.title)} 지웠어요`,
        effects: [
          { frame: GUEST, text: `타임테이블에서 사라져요. ${EVENT_WAIT}`, show: guestTimeline, showDelay: 2700 },
          { frame: ADMIN, text: "공연 목록에서 없어져요." },
        ],
      };
    case "fest.events.bulk": {
      const { count, statusOverride, delayMinutes, liveMessage } = event;
      if (!statusOverride) {
        return {
          from,
          cause: `총괄이 공연 ${count}개를 자동 상태로 되돌렸어요`,
          effects: [
            { frame: GUEST, text: "지연 · 취소 표시와 안내 한 줄이 바로 사라져요.", show: guestTimeline },
            { frame: ADMIN, quiet: true, text: "공연 목록에는 시각만 나와서 달라 보이지 않아요." },
          ],
        };
      }
      const label = `${statusOverride}${statusOverride === "지연" && delayMinutes ? ` ${delayMinutes}분` : ""}`;
      const line = liveMessage ? ` “${liveMessage}”도 같이 보여요.` : "";
      const guestText =
        statusOverride === "지연"
          ? `그 일정들에 ‘${delayMinutes ? `${delayMinutes}분 ` : ""}지연’이 바로 붙어요. 시작 시각 숫자는 그대로예요.${line}`
          : statusOverride === "취소"
            ? `그 일정들에 ‘취소’가 바로 붙어요.${line}`
            : `첫 화면 타임테이블은 시각을 보고 LIVE · 종료를 정해서, ‘${statusOverride}’ 상태로는 달라지지 않아요.${line}`;
      const visible = statusOverride === "지연" || statusOverride === "취소" || Boolean(liveMessage);
      return {
        from,
        cause: `총괄이 공연 ${count}개를 한 번에 ‘${label}’ 상태로 바꿨어요`,
        effects: [
          visible ? { frame: GUEST, text: guestText, show: guestTimeline } : { frame: GUEST, quiet: true, text: guestText },
          { frame: ADMIN, quiet: true, text: "공연 목록에는 시각만 나와서 달라 보이지 않아요." },
        ],
      };
    }
    default:
      return null;
  }
}

/* ---------- 지금 누를 곳 ---------- */
const onScreen = (node) => Boolean(node) && node.getClientRects().length > 0;
const navButton = (doc, label) =>
  [...doc.querySelectorAll(".admin-console-sidebar nav button, .admin-console-mobile-tabs button")].find(
    (button) => onScreen(button) && button.textContent.trim() === label,
  ) || null;
const buttonIn = (root, text) => (root ? [...root.querySelectorAll("button")].find((button) => button.textContent.trim() === text) || null : null);
const cards = (panel) => [...panel.querySelectorAll(".admin-console-list > .admin-console-list-card")];
const noticeCard = (panel, title) =>
  cards(panel).find((card) => card.querySelector(".admin-console-list-card__head p")?.textContent.trim().endsWith(`] ${title}`)) || null;
// 이름이 같은 일정(주간부스)이 날짜마다 있어서 시작 시각까지 본다.
const eventCard = (panel, event) =>
  event
    ? cards(panel).find(
        (card) =>
          card.querySelector(".admin-console-list-card__head p")?.textContent.trim() === event.title &&
          card.querySelector("small")?.textContent.trim().startsWith(event.startTime.slice(0, 16).replace("T", " ")),
      ) || null
    : null;
const submitOf = (panel) => panel.querySelector("form .admin-console-submit");

function findTarget(stepKey, doc, { noticeTitle, startEvent, editEvent }) {
  if (stepKey === "read") return guestNotice(noticeTitle)(doc);
  if (stepKey === "refresh") return doc.querySelector(".ahome-top__icon");

  if (stepKey === "write" || stepKey === "hide") {
    const panel = doc.getElementById("admin-notices");
    if (!panel) return navButton(doc, "긴급 공지");
    const submit = submitOf(panel);
    if (stepKey === "write") {
      const title = panel.querySelector('form input[placeholder="공지 제목"]');
      if (title && !title.value.trim()) return title;
      const content = panel.querySelector("form textarea");
      if (content && !content.value.trim()) return content;
      return submit;
    }
    if (submit?.textContent.trim() === "공지 수정") {
      const check = panel.querySelector(".admin-console-checkline input");
      return check?.checked ? check.closest("label") : submit;
    }
    return buttonIn(noticeCard(panel, noticeTitle), "수정");
  }

  const panel = doc.getElementById("admin-events");
  if (!panel) return navButton(doc, "공연 관리");
  if (stepKey === "startNotice") return buttonIn(eventCard(panel, startEvent), "시작 공지");
  if (stepKey === "editTime") {
    const submit = submitOf(panel);
    if (submit?.textContent.trim() === "공연 수정" && editEvent) {
      const [start, end] = panel.querySelectorAll('form input[type="datetime-local"]');
      const untouched = start?.value === editEvent.startTime.slice(0, 16) && end?.value === editEvent.endTime.slice(0, 16);
      return untouched ? end : submit;
    }
    return buttonIn(eventCard(panel, editEvent), "수정");
  }
  const bulk = panel.querySelector(".admin-console-bulk");
  if (!bulk) return null;
  if (stepKey === "bulkDelay") {
    const day = bulk.querySelector("select");
    if (day && !day.value) return day;
    const line = bulk.querySelector('input[placeholder^="손님에게 보일 한 줄"]');
    if (line && !line.value.trim()) return line;
    return bulk.querySelector(".admin-console-action-row .danger");
  }
  if (stepKey === "bulkClear") return bulk.querySelector(".admin-console-action-row button:not(.danger)");
  return null;
}

export const festScenario = {
  id: "notice",
  label: "공지 · 공연 시간",
  shortLabel: "공지",
  subtitle: "총괄 · 공지와 공연 시간 (연습 시계: 축제 첫날 낮)",
  /** 이 흐름을 열면 연습용 시계를 이 시각에 맞춘다. */
  clockStart: FEST_CLOCK_START,
  frames,
  steps,
  progress,
  describe,
  findTarget,
  scrollAnchor: ".admin-console-list-card",
  ideas: [
    "공연 상태를 ‘취소’로 바꿔 적용하면 손님 타임테이블은?",
    "공지를 네 개 넘게 올리면 손님 화면에는 몇 개가 보일까?",
    "‘혼잡도 모니터링’의 ‘공지 추천’을 누르면 공지 칸에 무엇이 채워질까?",
    "‘운영 로그’에 방금 한 일이 남았는지 보기",
  ],
};
