// 스태프 화면(/staff)에서 같이 쓰는 값과 계산. 시각은 "그날 0시부터 센 분" — 자정을 넘기면 1440(24:00), 1500(1:00)처럼 이어 센다.

export const STATUSES = [
  { key: "WORKING", label: "일하는 중", short: "일하는 중", color: "#2f7cf6", soft: "#e6f0ff", chito: "/images/chito-cheer.png" },
  { key: "EATING", label: "밥 먹는 중", short: "밥 먹는 중", color: "#ff8a3d", soft: "#fff0e5", chito: "/images/chito-party.png" },
  { key: "CLASS", label: "수업 듣는 중", short: "수업 중", color: "#7c5cff", soft: "#f0ecff", chito: "/images/chito.png" },
  { key: "RESTING", label: "쉬는 중", short: "쉬는 중", color: "#12a58c", soft: "#e2f6f2", chito: "/images/chito-wave.png" },
  { key: "OFF", label: "퇴근", short: "퇴근", color: "#6b7684", soft: "#eef0f3", chito: "/images/chito-wave.png" },
];

export const NO_STATUS = { key: null, label: "상태를 골라 주세요", short: "미정", color: "#b0b8c1", soft: "#f2f4f6", chito: "/images/chito.png" };

export function statusOf(key) {
  return STATUSES.find((status) => status.key === key) || NO_STATUS;
}

// 국 색은 총학 명단 표의 칸 색을 따른다(문화기획 파랑 · 중앙조정 분홍 · 생활복지 노랑 · 교육행정 초록 · 대외협력 주황 · 미디어홍보 하늘 · 소통개발 회색).
const DEPT_COLORS = {
  문화기획국: "#4c7dff",
  중앙조정국: "#ec5b73",
  생활복지국: "#e9a321",
  교육행정국: "#22a86b",
  대외협력국: "#f2784b",
  미디어홍보국: "#1aa9c4",
  소통개발국: "#5b6475",
};

export function deptColor(dept) {
  return DEPT_COLORS[dept] || "#1b2b52";
}

// 장소 색: 시간표에서 같은 장소를 한눈에 알아보게. 표에 있는 장소는 고정, 새 장소는 이름으로 돌려 고른다.
const PLACE_COLORS = {
  "성호관 앞 잔디밭": "#2f7cf6",
  대운동장: "#16a34a",
  "도서관 앞 주차장": "#f97316",
  노천극장: "#8b5cf6",
  "노천극장 입구": "#6366f1",
  응급부스: "#e5484d",
  가온마당: "#0ea5a4",
  아로새길: "#d97706",
};
const EXTRA_PLACE_COLORS = ["#0891b2", "#db2777", "#65a30d", "#7c3aed", "#ea580c"];

export function placeColor(place = "") {
  if (PLACE_COLORS[place]) return PLACE_COLORS[place];
  let hash = 0;
  for (const char of place) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return EXTRA_PLACE_COLORS[hash % EXTRA_PLACE_COLORS.length];
}

/** 시간표에 나오는 장소들(시간표 순서대로, 겹치지 않게). 엑셀로 장소가 바뀌면 같이 바뀐다. */
export function placesOf(slots) {
  return [...new Set(slots.map((slot) => slot.place).filter(Boolean))];
}

/** 시간표상 지금 이 사람이 있어야 하는 칸. */
export function nowSlotFor(slots, name, fNow) {
  return slots.find((slot) => slot.day === fNow.day && slot.members.includes(name)
    && slot.startMin <= fNow.minute && fNow.minute < slot.endMin) || null;
}

export function deptLabel(member) {
  if (!member) return "";
  if (!member.dept) return member.role || "회장단";
  return member.role ? `${member.dept} · ${member.role}` : member.dept;
}

/** 아바타 글자: 성을 뗀 이름(정재훈 → 재훈). */
export function givenName(name = "") {
  return name.length >= 3 ? name.slice(1) : name;
}

export function clock(minute) {
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  const shown = hour > 24 || (hour === 24 && min > 0) ? hour - 24 : hour;
  return `${shown}:${String(min).padStart(2, "0")}`;
}

export function range(slot) {
  return `${clock(slot.startMin)}–${clock(slot.endMin)}`;
}

export function duration(minutes) {
  const value = Math.max(0, Math.round(minutes));
  if (value < 60) return `${value}분`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export function dayLabel(day) {
  const date = new Date(`${day}T12:00:00`);
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, "0")} ${WEEKDAY[date.getDay()]}`;
}

function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 지금을 시간표 기준으로: 새벽 5시 전이면 전날의 24:00 이후로 센다(주점 · 야간부스는 1시까지 한다). */
export function festivalNow(date = new Date()) {
  const minute = date.getHours() * 60 + date.getMinutes();
  if (date.getHours() < 5) {
    const yesterday = new Date(date);
    yesterday.setDate(date.getDate() - 1);
    return { day: isoDay(yesterday), minute: minute + 1440 };
  }
  return { day: isoDay(date), minute };
}

export function ago(at, now = Date.now()) {
  if (!at) return "";
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function slotsOf(slots, name, day) {
  return slots
    .filter((slot) => slot.day === day && slot.members.includes(name))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

/**
 * 한 사람의 하루를 '근무 덩어리'로 묶는다. 같은 부스에서 끊김 없이 이어지는 칸은 하나로(같이 일하는 사람은 칸마다 parts 에).
 * 담당 칸(사람 없이 메모만 있는 칸)은 묶지 않는다.
 */
export function blocksOf(slots, name, day) {
  const blocks = [];
  for (const slot of slotsOf(slots, name, day)) {
    const last = blocks[blocks.length - 1];
    if (last && last.place === slot.place && last.booth === slot.booth && last.endMin === slot.startMin) {
      last.endMin = slot.endMin;
      last.parts.push(slot);
      if (slot.note && !last.notes.includes(slot.note)) last.notes.push(slot.note);
      continue;
    }
    blocks.push({
      key: `b-${slot.id}`,
      place: slot.place,
      booth: slot.booth,
      startMin: slot.startMin,
      endMin: slot.endMin,
      parts: [slot],
      notes: slot.note ? [slot.note] : [],
    });
  }
  return blocks;
}

/** 지금 하는 근무와 다음 근무. */
export function nowAndNext(blocks, minute) {
  const current = blocks.find((block) => block.startMin <= minute && minute < block.endMin) || null;
  const next = blocks.find((block) => block.startMin > minute) || null;
  return { current, next };
}

export function overlaps(a, b) {
  return a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin;
}

/** 같은 날 같은 시간에 다른 칸에도 들어가 있는지(시간표를 고칠 때 알려 준다). */
export function clashesFor(slots, name, draft, ignoreId) {
  return slots.filter((slot) => slot.id !== ignoreId && slot.members.includes(name) && overlaps(slot, draft));
}

const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

function initials(text) {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0) - 0xac00;
      return code >= 0 && code < 11172 ? CHOSEONG[Math.floor(code / 588)] : char;
    })
    .join("");
}

/** 이름 · 국 · 번호로 찾는다. 'ㅈㅈㅎ' 처럼 초성만 쳐도 된다. */
export function matchesQuery(member, query) {
  const q = query.replace(/\s+/g, "").toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && member.phone.replace(/\D/g, "").includes(digits)) return true;
  const hay = `${member.name}${member.dept}${member.role}`.toLowerCase();
  if (hay.includes(q)) return true;
  return /^[ㄱ-ㅎ]+$/.test(q) && initials(member.name).includes(q);
}

export function telHref(phone) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function smsHref(phone) {
  return `sms:${phone.replace(/[^\d+]/g, "")}`;
}

/** 10분 간격 시각 고르기(6:00 ~ 다음 날 3:00). */
export const TIME_OPTIONS = Array.from({ length: (27 * 60 - 6 * 60) / 10 + 1 }, (_, index) => 6 * 60 + index * 10);

export function timeOptionLabel(minute) {
  if (minute === 1440) return "24:00 (자정)";
  if (minute > 1440) return `${clock(minute)} (새벽)`;
  return clock(minute);
}

export function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 진동이 없는 기기
  }
}
