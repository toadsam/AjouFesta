// 스태프 명단 · 시간표를 엑셀로 내려받고, 고친 엑셀을 다시 읽는다.
// 엑셀은 한 줄에 한 칸(날짜 · 장소 · 부스 · 시작 · 끝 · 사람 · 메모). 칸을 합친 표는 읽기 어려워서 이 모양으로 주고받는다.
// 라이브러리는 버튼을 누를 때만 내려받는다(스태프 화면을 여는 데는 필요 없다).
import { clock, dayLabel } from "./crewUtils.js"; // .js 까지 적어 두면 Node 스크립트에서도 그대로 불러 쓸 수 있다

const SLOT_HEAD = ["날짜", "장소", "부스", "시작", "끝", "사람", "메모"];
const MEMBER_HEAD = ["이름", "국", "직책", "번호"];
const NOTICE_HEAD = ["날짜", "내용"];

const GUIDE = [
  "이 엑셀을 고쳐서 스태프 화면 → 시간표 탭 → '엑셀 올리기'로 올리면 명단 · 시간표 · 공지가 통째로 바뀌어요.",
  "",
  "[시간표] 한 줄 = 한 칸이에요.",
  "· 날짜: 10.07 처럼 (10/7, 2026-10-07 도 돼요)",
  "· 시작 · 끝: 9:30 처럼. 자정을 넘기면 24:00, 1:00 처럼 그대로 적으면 돼요(끝이 시작보다 이르면 다음 날로 봐요).",
  "· 사람: 이름을 쉼표나 띄어쓰기로 이어 적어요. 명단 시트에 있는 이름만 쓸 수 있어요.",
  "· 메모: 담당 · 안내 같은 한마디(없어도 돼요). 사람 없이 메모만 있는 칸도 돼요(예: 국차장 상주).",
  "· 줄을 지우면 그 칸이 없어지고, 줄을 더하면 칸이 생겨요.",
  "",
  "[명단] 이름 · 국 · 직책 · 번호. 시트를 통째로 지우면 명단은 그대로 두고 시간표만 바꿔요.",
  "[공지] 날짜 · 내용. 시트를 통째로 지우면 공지는 그대로 둬요.",
  "",
  "올리기 전에 무엇이 바뀌는지 먼저 보여 주고, 확인을 눌러야 바뀌어요.",
  "잘못 올렸으면 시간표 탭의 '직전으로 되돌리기'로 바로 전 모습으로 돌아갈 수 있어요.",
];

function shortDay(day) {
  const [, month, date] = day.split("-");
  return `${Number(month)}.${date}`;
}

/** 지금 명단 · 시간표 · 공지를 엑셀 파일로 내려받는다. */
export async function downloadCrewExcel(data, fileName) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  await writeXlsxFile(crewSheets(data)).toFile(fileName);
}

/** 엑셀 시트 네 장(시간표 · 명단 · 공지 · 적는 법)의 내용. 브라우저 내려받기와 파일 만들기 스크립트가 같이 쓴다. */
export function crewSheets(data) {
  const head = (cells) => cells.map((value) => ({ value, fontWeight: "bold", backgroundColor: "#E7F0FF" }));
  // 글자 칸으로 적어 둔다(엑셀이 9:30 을 시각 숫자로, 10.07 을 소수로 바꾸지 않게).
  const text = (value) => (value === null || value === undefined || value === "" ? null : { value: String(value), type: String });

  const slots = [...data.slots].sort((a, b) => a.day.localeCompare(b.day) || a.sortOrder - b.sortOrder || a.startMin - b.startMin);
  const members = [...data.members].sort((a, b) => a.sortOrder - b.sortOrder);
  const notices = [...data.notices].sort((a, b) => a.day.localeCompare(b.day));

  return [
    {
      sheet: "시간표",
      data: [
        head(SLOT_HEAD),
        ...slots.map((slot) => [
          text(shortDay(slot.day)),
          text(slot.place),
          text(slot.booth),
          text(clock(slot.startMin)),
          text(clock(slot.endMin)),
          text(slot.members.join(", ")),
          text(slot.note),
        ]),
      ],
      columns: [{ width: 8 }, { width: 18 }, { width: 18 }, { width: 7 }, { width: 7 }, { width: 60 }, { width: 40 }],
      stickyRowsCount: 1,
    },
    {
      sheet: "명단",
      data: [head(MEMBER_HEAD), ...members.map((member) => [text(member.name), text(member.dept), text(member.role), text(member.phone)])],
      columns: [{ width: 10 }, { width: 14 }, { width: 8 }, { width: 16 }],
      stickyRowsCount: 1,
    },
    {
      sheet: "공지",
      data: [head(NOTICE_HEAD), ...notices.map((notice) => [text(shortDay(notice.day)), text(notice.text)])],
      columns: [{ width: 8 }, { width: 80 }],
      stickyRowsCount: 1,
    },
    {
      sheet: "적는 법",
      data: GUIDE.map((line) => [text(line)]),
      columns: [{ width: 110 }],
    },
  ];
}

/* ---------- 읽기 ---------- */

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseDay(value, year) {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  // 엑셀이 10.07 을 숫자로 바꿨으면 10.07 → "10.07", 10.1 → "10.10"
  const raw = typeof value === "number" ? value.toFixed(2) : cellText(value);
  let match = /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(raw);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = /^(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(raw);
  if (match) return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return null;
}

function parseClock(value) {
  if (value instanceof Date) return value.getUTCHours() * 60 + value.getUTCMinutes();
  if (typeof value === "number") {
    if (value >= 0 && value < 1) return Math.round(value * 1440); // 엑셀 시각 칸(하루의 몇 분의 몇)
    if (Number.isInteger(value) && value <= 27) return value * 60;
    return null;
  }
  const match = /^(\d{1,2})\s*(?:[:시.]\s*(\d{1,2}))?/.exec(cellText(value));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour > 27 || minute > 59) return null;
  return hour * 60 + minute;
}

function splitNames(value) {
  return cellText(value)
    .split(/[\s,·/、]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** 꼭 있어야 할 제목(required)이 다 있는 줄을 제목 줄로 보고, 그 줄의 모든 '제목 → 몇 번째 열'을 만든다. 열 순서가 바뀌어도 읽을 수 있게. */
function columnsOf(rows, required) {
  const headIndex = rows.findIndex((row) => required.every((title) => row.some((cell) => cellText(cell) === title)));
  if (headIndex === -1) return null;
  const index = {};
  rows[headIndex].forEach((cell, column) => {
    const title = cellText(cell);
    if (title && index[title] === undefined) index[title] = column;
  });
  return { headIndex, index };
}

function phoneText(value) {
  if (typeof value === "number") {
    const digits = String(Math.round(value));
    return digits.startsWith("0") ? digits : `0${digits}`; // 엑셀이 앞의 0 을 지웠을 때
  }
  return cellText(value);
}

/**
 * 고친 엑셀을 읽어 서버에 보낼 모양으로 만든다.
 * 명단 시트가 없으면 지금 명단을 그대로, 공지 시트가 없으면 공지는 건드리지 않는다(notices: null).
 * 문제가 있는 줄은 errors 에 '시트 · 몇 번째 줄 · 무엇'으로 모은다.
 */
export async function readCrewExcel(file, current) {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  const byName = Object.fromEntries(sheets.map((sheet) => [sheet.sheet.trim(), sheet.data]));
  const errors = [];
  const year = (current.days[0] || "2026-01-01").slice(0, 4);

  // 명단
  let members;
  if (byName["명단"]) {
    const rows = byName["명단"];
    const cols = columnsOf(rows, ["이름", "번호"]);
    if (!cols) {
      errors.push("명단 시트에 '이름' · '번호' 제목 줄이 없어요.");
      members = [];
    } else {
      members = [];
      rows.slice(cols.headIndex + 1).forEach((row, offset) => {
        const line = cols.headIndex + offset + 2;
        const name = cellText(row[cols.index["이름"]]);
        const phone = phoneText(row[cols.index["번호"]]);
        const dept = cols.index["국"] === undefined ? "" : cellText(row[cols.index["국"]]);
        const role = cols.index["직책"] === undefined ? "" : cellText(row[cols.index["직책"]]);
        if (!name && !phone) return;
        if (!name) errors.push(`명단 ${line}번째 줄: 이름이 비어 있어요.`);
        else if (phone.replace(/\D/g, "").length < 10) errors.push(`명단 ${line}번째 줄: ${name}님 번호를 다시 봐 주세요.`);
        members.push({ name, dept, role, phone, sortOrder: members.length });
      });
      const seen = new Set();
      members.forEach((member) => {
        if (seen.has(member.name)) errors.push(`명단: '${member.name}' 이 두 번 있어요.`);
        seen.add(member.name);
      });
    }
  } else {
    members = current.members.map((member) => ({ name: member.name, dept: member.dept, role: member.role, phone: member.phone, sortOrder: member.sortOrder }));
  }
  const roster = new Set(members.map((member) => member.name));

  // 시간표
  const slots = [];
  if (!byName["시간표"]) {
    errors.push("'시간표' 시트가 없어요. 내려받은 엑셀의 시트 이름을 그대로 두세요.");
  } else {
    const rows = byName["시간표"];
    const cols = columnsOf(rows, SLOT_HEAD.slice(0, 5));
    if (!cols) {
      errors.push("시간표 시트에 '날짜 · 장소 · 부스 · 시작 · 끝' 제목 줄이 없어요.");
    } else {
      const get = (row, title) => (cols.index[title] === undefined ? null : row[cols.index[title]]);
      rows.slice(cols.headIndex + 1).forEach((row, offset) => {
        const line = cols.headIndex + offset + 2;
        if (row.every((cell) => cellText(cell) === "")) return;
        const day = parseDay(get(row, "날짜"), year);
        const place = cellText(get(row, "장소"));
        const booth = cellText(get(row, "부스"));
        let startMin = parseClock(get(row, "시작"));
        let endMin = parseClock(get(row, "끝"));
        const names = splitNames(get(row, "사람"));
        const note = cellText(get(row, "메모"));
        const problems = [];
        if (!day) problems.push("날짜");
        if (!place) problems.push("장소");
        if (!booth) problems.push("부스");
        if (startMin === null) problems.push("시작");
        if (endMin === null) problems.push("끝");
        if (problems.length) {
          errors.push(`시간표 ${line}번째 줄: ${problems.join(" · ")}을(를) 다시 봐 주세요.`);
          return;
        }
        if (startMin < 5 * 60) startMin += 1440; // 새벽에 시작하는 칸은 전날 밤으로
        if (endMin <= startMin) endMin += 1440; // 23:00 – 1:00 처럼 자정을 넘기는 칸
        if (endMin <= startMin || endMin - startMin > 20 * 60) {
          errors.push(`시간표 ${line}번째 줄: 시간(${cellText(get(row, "시작"))}–${cellText(get(row, "끝"))})을 다시 봐 주세요.`);
          return;
        }
        const unknown = names.filter((name) => !roster.has(name));
        if (unknown.length) {
          errors.push(`시간표 ${line}번째 줄: 명단에 없는 이름 ${unknown.join(", ")}`);
          return;
        }
        slots.push({ day, place, booth, startMin, endMin, members: [...new Set(names)], note, sortOrder: slots.length });
      });
    }
  }

  // 공지
  let notices = null;
  if (byName["공지"]) {
    const rows = byName["공지"];
    const cols = columnsOf(rows, NOTICE_HEAD);
    notices = [];
    if (cols) {
      rows.slice(cols.headIndex + 1).forEach((row, offset) => {
        const line = cols.headIndex + offset + 2;
        const text = cellText(row[cols.index["내용"]]);
        if (!text) return;
        const day = parseDay(row[cols.index["날짜"]], year);
        if (!day) errors.push(`공지 ${line}번째 줄: 날짜를 다시 봐 주세요.`);
        else notices.push({ day, text });
      });
    }
  }

  if (members.length === 0 && !errors.length) errors.push("명단이 비어 있어요.");
  return { request: { members, slots, notices }, errors };
}

/* ---------- 무엇이 바뀌나 ---------- */

function slotKey(slot) {
  return `${slot.day}|${slot.place}|${slot.booth}|${slot.startMin}|${slot.endMin}`;
}

function label(slot) {
  return `${dayLabel(slot.day).slice(0, 5)} ${slot.booth} ${clock(slot.startMin)}–${clock(slot.endMin)}`;
}

/** 지금과 올릴 엑셀을 견줘, 확인 창에 보여 줄 줄들을 만든다. 바뀐 게 없으면 empty: true. */
export function describeChanges(current, request) {
  const groups = (slots) => {
    const map = new Map();
    slots.forEach((slot) => {
      const key = slotKey(slot);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(slot);
    });
    return map;
  };
  const before = groups(current.slots);
  const after = groups(request.slots);
  let added = 0;
  let removed = 0;
  let changed = 0;
  const examples = [];
  const keys = new Set([...before.keys(), ...after.keys()]);
  keys.forEach((key) => {
    const olds = before.get(key) || [];
    const news = after.get(key) || [];
    const shared = Math.min(olds.length, news.length);
    for (let i = 0; i < shared; i += 1) {
      const inName = news[i].members.filter((name) => !olds[i].members.includes(name));
      const outName = olds[i].members.filter((name) => !news[i].members.includes(name));
      if (inName.length || outName.length || (olds[i].note || "") !== (news[i].note || "")) {
        changed += 1;
        if (examples.length < 3) {
          const parts = [];
          if (inName.length) parts.push(`+${inName.join(", ")}`);
          if (outName.length) parts.push(`−${outName.join(", ")}`);
          if (!parts.length) parts.push("메모");
          examples.push(`${label(news[i])} ${parts.join(" ")}`);
        }
      }
    }
    if (news.length > shared) {
      added += news.length - shared;
      if (examples.length < 3) examples.push(`새 칸 ${label(news[shared])}`);
    }
    if (olds.length > shared) {
      removed += olds.length - shared;
      if (examples.length < 3) examples.push(`없어짐 ${label(olds[shared])}`);
    }
  });

  const oldNames = new Map(current.members.map((member) => [member.name, member]));
  const newNames = new Set(request.members.map((member) => member.name));
  const joined = request.members.filter((member) => !oldNames.has(member.name)).map((member) => member.name);
  const left = current.members.filter((member) => !newNames.has(member.name)).map((member) => member.name);
  const edited = request.members.filter((member) => {
    const old = oldNames.get(member.name);
    return old && (old.dept !== member.dept || old.role !== member.role || old.phone.replace(/\D/g, "") !== member.phone.replace(/\D/g, ""));
  }).map((member) => member.name);

  const noticeChanged = request.notices !== null
    && JSON.stringify(current.notices.map((notice) => [notice.day, notice.text]).sort())
      !== JSON.stringify(request.notices.map((notice) => [notice.day, notice.text]).sort());

  const lines = [["시간표", `${current.slots.length}칸 → ${request.slots.length}칸`]];
  if (changed) lines.push(["사람이 바뀌는 칸", `${changed}칸`]);
  if (added) lines.push(["새로 생기는 칸", `${added}칸`]);
  if (removed) lines.push(["없어지는 칸", `${removed}칸`]);
  if (joined.length) lines.push(["명단에 더함", joined.join(", ")]);
  if (left.length) lines.push(["명단에서 뺌", left.join(", ")]);
  if (edited.length) lines.push(["정보가 바뀜", edited.join(", ")]);
  if (noticeChanged) lines.push(["공지", `${current.notices.length}개 → ${request.notices.length}개`]);

  const empty = !changed && !added && !removed && !joined.length && !left.length && !edited.length && !noticeChanged;
  return { lines, examples, empty };
}
