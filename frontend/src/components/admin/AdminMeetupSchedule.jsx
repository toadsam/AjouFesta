// 운영진용 소개팅 부스 시간표. 그날 잡힌 20분 슬롯과 두 사람이 어디서 기다리는지.
// 맨 위 '지금' 카드는 이 순간 부스에 있어야 할 쌍·다음 쌍·5분 뒤 대기 장소로 가야 할 사람을 보여 준다.
// 줄마다 도착 체크 · 만남 완료 · 노쇼(슬롯 반납)를 누를 수 있다. 10초마다 새로 받는다.
// '한눈에 표': 날짜를 열로, 시간을 줄로 놓고 모든 칸의 쌍을 한 표에서 본다(날짜별 시간표를 합쳐 그린다).
// 제목 아래 '남은 칸' 줄: 날짜별로 지금 새로 잡을 수 있는 칸. 얼마 안 남으면 색이 바뀐다.
// 두 사람이 모두 '부스 도착'이 되면 '채팅 시작' 버튼이 뜬다. 눌러 확인하면 10분 타이머가 돌고,
// 줄에 채팅 상태(채팅 중 · 선택 중 · 둘 다 얼굴 보기)가 뜬다.
// '대기 장소' 명단: 성호관·중앙도서관 담당 스태프가 자기 장소 사람만 보고 도착 확인 → 출발하기 → 만났어요 → 부스 도착을 넘긴다.
// 넘긴 단계는 참가자 티켓의 단계 바(배달 앱처럼)에 그대로 보인다.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAdminAiMatchChatLog,
  fetchAdminAiMatchMeetupSchedule,
  markAdminAiMatchMet,
  markAdminAiMatchNoShow,
  setAdminAiMatchEscortStage,
  startAdminAiMatchChat,
} from "../../api";
import "../../styles/saju-meetup.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SLOT_MINUTES = 20;
const SLOT_MS = SLOT_MINUTES * 60_000;
const SOON_MS = 5 * 60_000;
// 새로 잡을 수 있는 칸이 이만큼 이하로 남으면 경고색으로 바꾼다.
const SCARCE_SLOTS = 10;

function pad(value) {
  return `${value}`.padStart(2, "0");
}

function parseLocal(value) {
  if (!value) return null;
  const [datePart, timePart = "00:00:00"] = `${value}`.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

function dateLabel(dateText) {
  const date = parseLocal(`${dateText}T00:00:00`);
  return date ? `${pad(date.getMonth() + 1)}.${pad(date.getDate())} (${WEEKDAYS[date.getDay()]})` : dateText;
}

function timeLabel(value) {
  const date = parseLocal(value);
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
}

function minutesUntil(value, now) {
  const at = parseLocal(value)?.getTime();
  if (!at) return null;
  return Math.round((at - now) / 60_000);
}

const OUTCOME_LABELS = {
  MET: "만남 완료",
  NO_SHOW_REQUESTER: "신청자 노쇼",
  NO_SHOW_PROFILE: "상대 노쇼",
  NO_SHOW_BOTH: "둘 다 노쇼",
};

// 대기 장소 → 부스 안내 단계. next 는 스태프가 다음에 누를 버튼.
const ESCORT_STEPS = ["NONE", "ARRIVED", "DEPARTED", "PICKED_UP", "AT_BOOTH"];
const ESCORT_LABELS = {
  NONE: "아직 안 옴",
  ARRIVED: "대기 장소 도착",
  DEPARTED: "스태프 가는 중",
  PICKED_UP: "스태프와 이동 중",
  AT_BOOTH: "부스 도착",
};
const ESCORT_NEXT = {
  NONE: "도착 확인",
  ARRIVED: "출발하기",
  DEPARTED: "만났어요",
  PICKED_UP: "부스 도착",
};
const PLACE_TAB_KEY = "festflow.meetupPlaceTab";

// "10304분 뒤" 대신 "7일 뒤" · "2시간 10분 뒤" 처럼 읽기 쉽게
function untilLabel(mins) {
  if (mins >= 1440) return `${Math.floor(mins / 1440)}일 뒤`;
  if (mins >= 60) return mins % 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분 뒤` : `${Math.floor(mins / 60)}시간 뒤`;
  return `${mins}분 뒤`;
}

function EscortControl({ stage = "NONE", stageAt, busy, onStage }) {
  const index = Math.max(0, ESCORT_STEPS.indexOf(stage));
  const next = ESCORT_STEPS[index + 1];
  return (
    <span className="mu-esc">
      <span className={`mu-esc__chip mu-esc__chip--${stage.toLowerCase()}`}>
        {ESCORT_LABELS[stage] || stage}
        {stageAt && stage !== "NONE" ? ` · ${timeLabel(stageAt)}` : ""}
      </span>
      {next ? (
        <button type="button" className="mu-esc__next" disabled={busy} onClick={() => onStage(next, stage)}>
          {ESCORT_NEXT[stage]}
        </button>
      ) : null}
      {index > 0 ? (
        <button type="button" className="mu-esc__undo" disabled={busy} onClick={() => onStage(ESCORT_STEPS[index - 1], stage)} title="한 단계 되돌리기">
          되돌리기
        </button>
      ) : null}
    </span>
  );
}

// 블라인드 채팅 상태. 서버 시각과 이 기기 시각이 달라도 남은 시간이 맞게 clockOffset(서버 - 기기)을 더한다.
function ChatChip({ phase, endsAt, now, clockOffset }) {
  if (!phase || phase === "NONE" || phase === "CLOSED") return null;
  let label = "";
  if (phase === "OPEN") {
    const left = Math.max(0, (parseLocalSeconds(endsAt) || 0) - (now + clockOffset));
    // 화면 시계가 5초마다 움직여서 올림하면 시작 직후 '11분'이 된다. 반올림으로 보여 준다.
    label = `💬 채팅 중 · ${Math.max(1, Math.round(left / 60_000))}분 남음`;
  } else if (phase === "CHOOSING") {
    label = "🤔 얼굴 보기 고르는 중";
  } else if (phase === "MATCH") {
    label = "💛 둘 다 얼굴 보기 — 가림막을 걷어 주세요";
  } else if (phase === "NO_MATCH") {
    label = "여기까지 — 한 분씩 따로 안내해 주세요";
  }
  return <span className={`mu-chat mu-chat--${phase.toLowerCase()}`}>{label}</span>;
}

function parseLocalSeconds(value) {
  if (!value) return null;
  const time = new Date(`${value}`.slice(0, 23)).getTime();
  return Number.isFinite(time) ? time : null;
}

// 신고 확인용 채팅 기록. 눌렀을 때만 불러온다.
function ChatLog({ requestId }) {
  const [lines, setLines] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetchAdminAiMatchChatLog(requestId)
      .then((data) => alive && setLines(Array.isArray(data) ? data : []))
      .catch((loadError) => alive && setError(loadError.message || "채팅 기록을 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [requestId]);
  if (error) return <p className="mu-admin__empty">{error}</p>;
  if (!lines) return <p className="mu-admin__empty">불러오는 중…</p>;
  if (!lines.length) return <p className="mu-admin__empty">나눈 대화가 없어요.</p>;
  return (
    <ol className="mu-chatlog">
      {lines.map((line) => (
        <li key={line.id} className={line.type === "TOPIC" ? "is-topic" : ""}>
          <time>{`${line.createdAt}`.slice(11, 16)}</time>
          <b>{line.senderNickname}</b>
          <span>{line.type === "TOPIC" ? `[주제] ${line.content}` : line.content}</span>
        </li>
      ))}
    </ol>
  );
}

function Person({ nickname, gender, place, phone, stage, stageAt, onStage, busy }) {
  const arrived = stage && stage !== "NONE";
  return (
    <div className={`mu-admin__pair${arrived ? " is-arrived" : ""}`}>
      <b>{nickname || "?"}</b>
      <span>{gender || ""}</span>
      <em>{place}</em>
      {phone ? <a href={`tel:${phone}`}>{phone}</a> : null}
      <EscortControl stage={stage || "NONE"} stageAt={stageAt} busy={busy} onStage={onStage} />
    </div>
  );
}

// 대기 장소 담당 스태프용 명단. 아직 안 끝난 확정 약속에서 그 장소 사람들을 시간순으로.
function PlaceBoard({ items, now, busyId, onStage }) {
  const places = [...new Set(items.flatMap((item) => [item.requesterWaitingPlace, item.profileWaitingPlace]).filter(Boolean))].sort();
  const [tab, setTab] = useState(() => {
    try {
      return window.localStorage.getItem(PLACE_TAB_KEY) || "";
    } catch {
      return "";
    }
  });
  const place = places.includes(tab) ? tab : places[0] || "";
  function choose(next) {
    setTab(next);
    try {
      window.localStorage.setItem(PLACE_TAB_KEY, next);
    } catch {
      // 저장이 안 돼도 탭은 바뀐다.
    }
  }
  const people = items
    .filter((item) => item.confirmed && item.meetupOutcome !== "MET")
    .filter((item) => (parseLocal(item.slotAt)?.getTime() || 0) + SLOT_MS > now)
    .flatMap((item) => [
      { item, side: "REQUESTER", nickname: item.requesterNickname, phone: item.requesterPhoneNumber, place: item.requesterWaitingPlace, stage: item.requesterEscortStage, stageAt: item.requesterEscortStageAt },
      { item, side: "PROFILE", nickname: item.profileNickname, phone: item.profilePhoneNumber, place: item.profileWaitingPlace, stage: item.profileEscortStage, stageAt: item.profileEscortStageAt },
    ])
    .filter((person) => person.place === place && person.stage !== "AT_BOOTH")
    .slice(0, 12);
  if (!places.length) return null;
  return (
    <div className="mu-board" aria-label="대기 장소 명단">
      <div className="mu-board__head">
        <strong>대기 장소 명단</strong>
        <div className="mu-board__tabs" role="tablist">
          {places.map((item) => (
            <button key={item} type="button" role="tab" aria-selected={item === place} className={item === place ? "is-on" : ""} onClick={() => choose(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      {people.length ? (
        <ul className="mu-board__list">
          {people.map((person) => {
            const mins = minutesUntil(person.item.slotAt, now);
            return (
              <li key={`${person.item.requestId}-${person.side}`} className={`mu-board__row mu-board__row--${(person.stage || "NONE").toLowerCase()}`}>
                <span className="mu-board__time">
                  <b>{timeLabel(person.item.slotAt)}</b>
                  <small>{mins > 0 ? untilLabel(mins) : mins > -SLOT_MINUTES ? "진행 중" : "지남"}</small>
                </span>
                <span className="mu-board__who">
                  <b>{person.nickname}</b>
                  {person.phone ? <a href={`tel:${person.phone}`}>{person.phone}</a> : null}
                </span>
                <EscortControl
                  stage={person.stage || "NONE"}
                  stageAt={person.stageAt}
                  busy={busyId === person.item.requestId}
                  onStage={(stage, fromStage) => onStage(person.item.requestId, person.side, stage, fromStage)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mu-admin__empty">{place}에서 기다릴 사람이 지금은 없어요.</p>
      )}
    </div>
  );
}

// 한눈에 표: 줄은 시간 칸, 열은 날짜. 칸마다 그 시간에 만나는 두 사람과 상태(확정 · 임시 · 완료 · 빈 칸).
// 날짜마다 여는 시간이 달라서(10/7 10:00~, 10/8 09:00~) 그날 부스가 안 여는 시간은 회색으로 막는다.
// 날짜마다 시간표를 따로 받아 합친다(보고 있는 날짜의 것은 이미 받은 걸 쓴다). 지금 시간 줄은 강조.
function minuteOf(text) {
  const [hh, mm] = `${text || ""}`.split(":").map(Number);
  return Number.isFinite(hh) ? hh * 60 + (mm || 0) : null;
}

function OverviewGrid({ dates, current, now, onPick }) {
  const [sheets, setSheets] = useState({});
  const key = dates.join(",");

  useEffect(() => {
    let alive = true;
    const others = dates.filter((item) => item !== current?.date);
    Promise.all(others.map((item) => fetchAdminAiMatchMeetupSchedule(item).then((sheet) => [item, sheet]).catch(() => [item, null]))).then((pairs) => {
      if (!alive) return;
      setSheets(Object.fromEntries(pairs.filter(([, sheet]) => sheet)));
    });
    return () => {
      alive = false;
    };
    // 보고 있는 날짜를 바꾸거나 10초마다 새로 받을 때 같이 받는다.
  }, [key, current]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = dates.map((item) => (item === current?.date ? current : sheets[item])).filter(Boolean);
  if (!columns.length) return null;
  const opens = columns.map((sheet) => minuteOf(sheet.openTime)).filter((value) => value != null);
  const lasts = columns.map((sheet) => minuteOf(sheet.lastSlotTime)).filter((value) => value != null);
  if (!opens.length || !lasts.length) return null;
  const first = Math.min(...opens);
  const last = Math.max(...lasts);
  const rows = [];
  for (let minute = first; minute <= last; minute += SLOT_MINUTES) rows.push(minute);
  const today = new Date(now);
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const nowMinute = today.getHours() * 60 + today.getMinutes();

  return (
    <div className="mu-grid" aria-label="소개팅 시간표 한눈에 표">
      <div className="mu-grid__head">
        <strong>한눈에 표</strong>
        <small>날짜별 · 시간별로 누가 누구와 만나는지. 칸을 누르면 그 날짜로 갑니다.</small>
      </div>
      <div className="mu-grid__scroll">
        <table className="mu-grid__table">
          <thead>
            <tr>
              <th scope="col">시간</th>
              {columns.map((sheet) => (
                <th key={sheet.date} scope="col" className={sheet.date === current?.date ? "is-on" : ""}>
                  {dateLabel(sheet.date)}
                  <small>
                    {sheet.openTime} ~ {sheet.lastSlotTime} · {sheet.totalSlots}칸
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((minute) => {
              const label = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
              return (
                <tr key={minute}>
                  <th scope="row">{label}</th>
                  {columns.map((sheet) => {
                    const open = minuteOf(sheet.openTime);
                    const lastAt = minuteOf(sheet.lastSlotTime);
                    const closed = minute < open || minute > lastAt;
                    const item = (sheet.items || []).find((entry) => timeLabel(entry.slotAt) === label);
                    const live = sheet.date === todayKey && minute <= nowMinute && nowMinute < minute + SLOT_MINUTES;
                    const done = item?.meetupOutcome === "MET";
                    const tone = closed ? "closed" : !item ? "free" : done ? "done" : item.confirmed ? "ok" : "hold";
                    return (
                      <td key={sheet.date} className={`mu-grid__cell mu-grid__cell--${tone}${live ? " is-live" : ""}`}>
                        {closed ? (
                          <span className="mu-grid__muted">—</span>
                        ) : item ? (
                          <button type="button" className="mu-grid__pair" onClick={() => onPick(sheet.date)} title={`${sheet.date} ${label} · ${item.confirmed ? "확정" : "임시"}`}>
                            <b>{item.requesterNickname || "?"}</b>
                            <i>·</i>
                            <b>{item.profileNickname || "?"}</b>
                            <small>{done ? "완료" : item.confirmed ? "확정" : "임시"}</small>
                          </button>
                        ) : (
                          <span className="mu-grid__muted">빈 칸</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NowCard({ items, now }) {
  const current = items.find((item) => {
    const at = parseLocal(item.slotAt)?.getTime() || 0;
    return at <= now && now < at + SLOT_MS && item.meetupOutcome !== "MET";
  });
  const next = items.find((item) => (parseLocal(item.slotAt)?.getTime() || 0) > now);
  const soon = next && (parseLocal(next.slotAt)?.getTime() || 0) - now <= SOON_MS ? next : null;

  return (
    <div className="mu-now" aria-label="지금 부스 상황">
      <div className={`mu-now__cell${current ? " is-live" : ""}`}>
        <small>지금 부스</small>
        {current ? (
          <>
            <strong>
              {current.requesterNickname} · {current.profileNickname}
            </strong>
            <span>
              {timeLabel(current.slotAt)} 시작 · {Math.max(0, SLOT_MINUTES - Math.floor((now - (parseLocal(current.slotAt)?.getTime() || now)) / 60_000))}분 남음
              {current.requesterArrivedAt && current.profileArrivedAt ? " · 둘 다 도착" : current.requesterArrivedAt || current.profileArrivedAt ? " · 한 명 도착" : " · 아직 아무도 안 옴"}
            </span>
          </>
        ) : (
          <>
            <strong>비어 있어요</strong>
            <span>이 시간에 잡힌 쌍이 없어요</span>
          </>
        )}
      </div>
      <div className={`mu-now__cell${soon ? " is-soon" : ""}`}>
        <small>{soon ? "곧 대기 장소로" : "다음 쌍"}</small>
        {next ? (
          <>
            <strong>
              {next.requesterNickname} · {next.profileNickname}
            </strong>
            <span>
              {timeLabel(next.slotAt)} · {untilLabel(minutesUntil(next.slotAt, now))}
              {soon ? ` · ${next.requesterWaitingPlace} / ${next.profileWaitingPlace} 확인` : ""}
            </span>
          </>
        ) : (
          <>
            <strong>없어요</strong>
            <span>오늘 남은 약속이 없어요</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminMeetupSchedule({ onChanged }) {
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [noShowId, setNoShowId] = useState(null);
  const [chatLogId, setChatLogId] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const tabsRef = useRef(null);

  // 날짜가 많아 탭이 옆으로 넘어갈 때, 보고 있는 날짜가 보이게 탭 줄만 움직인다.
  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelector(".mu-admin__tab.is-on");
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [date]);

  const load = useCallback((nextDate) => {
    return fetchAdminAiMatchMeetupSchedule(nextDate)
      .then((response) => {
        setData(response);
        setDate(response.date);
        const serverMs = parseLocalSeconds(response.serverNow);
        if (serverMs) setClockOffset(serverMs - Date.now());
        setError("");
      })
      .catch((loadError) => setError(loadError.message || "시간표를 불러오지 못했습니다."));
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  useEffect(() => {
    if (!date) return undefined;
    const id = window.setInterval(() => load(date), 10_000);
    return () => window.clearInterval(id);
  }, [date, load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  async function run(requestId, task) {
    setBusyId(requestId);
    try {
      await task();
      await load(date);
      onChanged?.();
    } catch (actionError) {
      // 다른 스태프가 먼저 바꿨거나 순서가 안 맞으면 서버가 거절한다. 지금 상태를 다시 읽어 보여 준 뒤 이유를 띄운다.
      await load(date);
      setError(actionError.message || "처리하지 못했습니다.");
    } finally {
      setBusyId(null);
      setNoShowId(null);
    }
  }

  const items = data?.items || [];
  // 아직 안 지난 첫 약속을 강조한다(20분 슬롯이 끝나기 전까지).
  const nextIndex = items.findIndex((item) => (parseLocal(item.slotAt)?.getTime() || 0) + SLOT_MS > now);
  const confirmedCount = items.filter((item) => item.confirmed).length;
  const isToday = date && parseLocal(`${date}T00:00:00`)?.toDateString() === new Date(now).toDateString();
  const days = data?.days || [];
  const totalFree = days.reduce((sum, day) => sum + (day.freeSlots || 0), 0);
  const totalAll = days.reduce((sum, day) => sum + (day.totalSlots || 0), 0);

  return (
    <section className="mu-admin" aria-label="소개팅 부스 시간표">
      <div className="mu-admin__head">
        <div>
          <h2>소개팅 부스 시간표</h2>
          <small>
            {data ? `${data.boothName} · 확정 ${confirmedCount}쌍 · 임시 ${items.length - confirmedCount}쌍 · 전체 ${data.totalSlots}칸` : "불러오는 중…"}
          </small>
        </div>
        <div className="mu-admin__tabs" role="tablist" aria-label="날짜" ref={tabsRef}>
          {(data?.dates || []).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={item === date}
              className={`mu-admin__tab${item === date ? " is-on" : ""}`}
              onClick={() => load(item)}
            >
              {dateLabel(item)}
            </button>
          ))}
        </div>
      </div>

      {days.length ? (
        <div
          className={`mu-cap${totalFree === 0 ? " is-full" : totalFree <= SCARCE_SLOTS ? " is-low" : ""}`}
          aria-label="남은 부스 칸"
          title="지난 칸과 30분 안에 시작하는 칸은 빼고, 지금 새로 잡을 수 있는 칸만 센 숫자예요."
        >
          <strong>
            남은 칸 {totalFree}
            <small> / {totalAll}</small>
          </strong>
          {days.map((day) => (
            <span key={day.date} className={day.freeSlots === 0 ? "is-full" : ""}>
              <b>{dateLabel(day.date)}</b> {day.freeSlots > 0 ? `${day.freeSlots}칸 남음` : "마감"}
              <small> · 확정 {day.confirmedSlots} · 임시 {day.heldSlots}</small>
            </span>
          ))}
          {totalFree === 0 ? (
            <em>칸이 모두 찼어요. 새로 성사된 커플은 시간을 잡을 수 없어요.</em>
          ) : totalFree <= SCARCE_SLOTS ? (
            <em>칸이 얼마 안 남았어요.</em>
          ) : null}
        </div>
      ) : null}

      {isToday || !data ? <NowCard items={items} now={now} /> : null}

      {data ? <OverviewGrid dates={data.dates || []} current={data} now={now} onPick={(next) => load(next)} /> : null}

      <PlaceBoard
        items={items}
        now={now}
        busyId={busyId}
        onStage={(requestId, side, stage, fromStage) => run(requestId, () => setAdminAiMatchEscortStage(requestId, side, stage, fromStage))}
      />

      {error ? <p className="mu-admin__empty">{error}</p> : null}

      {items.length ? (
        <div className="mu-admin__list">
          {items.map((item, index) => {
            const busy = busyId === item.requestId;
            const done = item.meetupOutcome === "MET";
            // 만남 완료는 얼굴 보기 결과가 나온 뒤에만(그 전에 누르면 채팅이 못 열리거나 닫힌다).
            // 노쇼는 채팅을 시작하기 전까지만(시작했다면 두 사람 다 온 것이다). 서버도 같은 규칙으로 막는다.
            const chatResult = item.chatPhase === "MATCH" || item.chatPhase === "NO_MATCH";
            const chatStarted = Boolean(item.chatPhase) && item.chatPhase !== "NONE";
            return (
              <article
                key={item.requestId}
                className={`mu-admin__row${index === nextIndex ? " mu-admin__row--next" : ""}${done ? " mu-admin__row--done" : ""}`}
              >
                <span className="mu-admin__time">{timeLabel(item.slotAt)}</span>
                <div className="mu-admin__pairs">
                  <span className={`mu-admin__state mu-admin__state--${done ? "done" : item.confirmed ? "ok" : "hold"}`}>
                    {done ? "만남 완료" : item.confirmed ? "확정" : `임시 · ${timeLabel(item.heldUntil)}까지 확정 대기`}
                  </span>
                  {!done ? <ChatChip phase={item.chatPhase} endsAt={item.chatEndsAt} now={now} clockOffset={clockOffset} /> : null}
                  {!done && item.confirmed && (!item.chatPhase || item.chatPhase === "NONE") ? (
                    item.requesterEscortStage === "AT_BOOTH" && item.profileEscortStage === "AT_BOOTH" ? (
                      <button
                        type="button"
                        className="mu-esc__next mu-chat-start"
                        disabled={busy}
                        onClick={() => {
                          const ok = window.confirm(
                            [
                              `${item.requesterNickname} · ${item.profileNickname}`,
                              "",
                              "블라인드 채팅을 시작할까요?",
                              "누르는 순간 두 사람 화면에 채팅방이 열리고 10분 타이머가 시작돼요.",
                              "두 사람이 자리에 앉아 앱을 켠 걸 확인한 뒤 눌러 주세요.",
                            ].join("\n"),
                          );
                          if (ok) run(item.requestId, () => startAdminAiMatchChat(item.requestId));
                        }}
                      >
                        💬 채팅 시작 (10분 타이머)
                      </button>
                    ) : item.requesterEscortStage === "AT_BOOTH" || item.profileEscortStage === "AT_BOOTH" ? (
                      <span className="mu-chat mu-chat--wait">한 분 더 부스에 도착하면 채팅을 시작할 수 있어요</span>
                    ) : null
                  ) : null}
                  <Person
                    nickname={item.requesterNickname}
                    gender={item.requesterGender}
                    place={item.requesterWaitingPlace}
                    phone={item.requesterPhoneNumber}
                    stage={item.requesterEscortStage}
                    stageAt={item.requesterEscortStageAt}
                    busy={busy || done}
                    onStage={(stage, fromStage) => run(item.requestId, () => setAdminAiMatchEscortStage(item.requestId, "REQUESTER", stage, fromStage))}
                  />
                  <Person
                    nickname={item.profileNickname}
                    gender={item.profileGender}
                    place={item.profileWaitingPlace}
                    phone={item.profilePhoneNumber}
                    stage={item.profileEscortStage}
                    stageAt={item.profileEscortStageAt}
                    busy={busy || done}
                    onStage={(stage, fromStage) => run(item.requestId, () => setAdminAiMatchEscortStage(item.requestId, "PROFILE", stage, fromStage))}
                  />
                  {!done && (chatResult || !chatStarted) ? (
                    <div className="mu-admin__actions">
                      {chatResult ? (
                        <button
                          type="button"
                          className="mu-admin__btn mu-admin__btn--met is-ready"
                          disabled={busy}
                          onClick={() => {
                            const ok = window.confirm(
                              [
                                `${item.requesterNickname} · ${item.profileNickname}`,
                                "",
                                "만남 완료로 기록할까요?",
                                "얼굴 보기 결과는 그대로 남고, 이 약속은 끝난 것으로 정리돼요.",
                              ].join("\n"),
                            );
                            if (ok) run(item.requestId, () => markAdminAiMatchMet(item.requestId));
                          }}
                        >
                          만남 완료
                        </button>
                      ) : null}
                      {chatStarted ? null : noShowId === item.requestId ? (
                        <span className="mu-admin__noshow">
                          <small>누가 안 왔나요? 확정된 약속이면 두 사람에게 취소 문자가 가요.</small>
                          {[
                            ["REQUESTER", item.requesterNickname],
                            ["PROFILE", item.profileNickname],
                            ["BOTH", "둘 다"],
                          ].map(([side, label]) => (
                            <button
                              key={side}
                              type="button"
                              className="mu-admin__btn mu-admin__btn--danger"
                              disabled={busy}
                              onClick={() => {
                                const ok = window.confirm(
                                  [
                                    `${side === "BOTH" ? "두 사람 모두" : label} 노쇼로 처리할까요?`,
                                    "",
                                    "약속이 취소되고 시간 칸이 비워져요.",
                                    item.confirmed ? "두 사람에게 취소 문자가 가요. 되돌릴 수 없어요." : "되돌릴 수 없어요.",
                                  ].join("\n"),
                                );
                                if (ok) run(item.requestId, () => markAdminAiMatchNoShow(item.requestId, side));
                              }}
                            >
                              {label}
                            </button>
                          ))}
                          <button type="button" className="mu-admin__btn" onClick={() => setNoShowId(null)}>
                            취소
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="mu-admin__btn mu-admin__btn--ghost"
                          disabled={busy}
                          onClick={() => setNoShowId(item.requestId)}
                        >
                          노쇼 · 슬롯 반납
                        </button>
                      )}
                    </div>
                  ) : null}
                  {item.chatPhase && item.chatPhase !== "NONE" ? (
                    <div className="mu-admin__chatlog">
                      <button
                        type="button"
                        className="mu-esc__undo"
                        onClick={() => setChatLogId(chatLogId === item.requestId ? null : item.requestId)}
                        aria-expanded={chatLogId === item.requestId}
                      >
                        {chatLogId === item.requestId ? "채팅 기록 닫기" : "채팅 기록 보기 (신고 확인용)"}
                      </button>
                      {chatLogId === item.requestId ? <ChatLog requestId={item.requestId} /> : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : !error ? (
        <p className="mu-admin__empty">이 날짜에 잡힌 약속이 아직 없습니다.</p>
      ) : null}
    </section>
  );
}

export { OUTCOME_LABELS };
