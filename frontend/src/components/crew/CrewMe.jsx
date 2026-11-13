// '나' 탭: 내 명찰(상태가 바뀌면 띠 색 · 치토 동작이 같이 바뀐다) → 지금 할 일 → 내 시간표.
import { useEffect, useMemo, useRef, useState } from "react";
import { updateCrewLocation, updateCrewStatus } from "../../api";
import { Avatar, Chito, Icon, NameChip, NameChips, Sheet, StatusIcon } from "./CrewKit";
import { useCrew } from "./crewContext";
import {
  STATUSES,
  ago,
  blocksOf,
  buzz,
  clock,
  dayLabel,
  deptLabel,
  duration,
  matchesQuery,
  nowAndNext,
  nowSlotFor,
  placeColor,
  placesOf,
  range,
  statusOf,
} from "./crewUtils";

const MEMO_HINT = {
  WORKING: "예: 메인부스 앞에 있어요",
  EATING: "예: 학식 · 1시 반까지",
  CLASS: "예: 3시까지 수업",
  RESTING: "예: 본부 텐트에서 쉬는 중",
  OFF: "예: 내일 9시에 와요",
};

export default function CrewMe() {
  const { me, data, days, defaultDay, fNow } = useCrew();
  const [day, setDay] = useState(defaultDay);
  const todayBlocks = useMemo(() => blocksOf(data.slots, me.name, fNow.day), [data.slots, me.name, fNow.day]);
  const blocks = useMemo(() => blocksOf(data.slots, me.name, day), [data.slots, me.name, day]);
  const notices = data.notices.filter((notice) => notice.day === day);

  return (
    <div className="crew-me">
      <StaffPass />
      <NowCard blocks={todayBlocks} />

      <section className="crew-section">
        <div className="crew-section__head">
          <h2 className="crew-h2">내 시간표</h2>
          <DayChips days={days} value={day} onChange={setDay} />
        </div>
        {notices.map((notice) => (
          <p key={notice.id} className="crew-notice"><Icon.megaphone size={16} /> {notice.text}</p>
        ))}
        <Timeline blocks={blocks} day={day} name={me.name} />
      </section>

      <PeekOthers />
      <AddToHome />
    </div>
  );
}

/**
 * 홈 화면에 추가 안내. 이미 홈 화면 앱으로 열었으면 안 보인다.
 * 안드로이드 크롬은 설치 창(beforeinstallprompt)을 띄울 수 있고, 아이폰은 공유 → '홈 화면에 추가'를 직접 눌러야 한다.
 */
function AddToHome() {
  const [prompt, setPrompt] = useState(null);
  const [done, setDone] = useState(false);
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (standalone || done) return null;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return (
    <section className="crew-section crew-home">
      <h2 className="crew-h2">홈 화면에 추가</h2>
      <p className="crew-home__text">
        <img src="/pwa-staff-192.png" alt="" width="40" height="40" />
        <span>
          홈 화면에 '스태프' 앱으로 두면 손님 화면을 거치지 않고 이 화면이 바로 열려요.
          {ios ? (
            <b>Safari 아래 공유 버튼 → '홈 화면에 추가'</b>
          ) : prompt ? null : (
            <b>브라우저 메뉴(⋮) → '홈 화면에 추가' 또는 '앱 설치'</b>
          )}
        </span>
      </p>
      {prompt ? (
        <button
          type="button"
          className="crew-home__btn"
          onClick={async () => {
            prompt.prompt();
            const choice = await prompt.userChoice.catch(() => null);
            if (choice?.outcome === "accepted") setDone(true);
            setPrompt(null);
          }}
        >
          <Icon.plus size={16} /> 홈 화면에 추가하기
        </button>
      ) : null}
    </section>
  );
}

export function DayChips({ days, value, onChange }) {
  return (
    <div className="crew-days" role="tablist" aria-label="날짜">
      {days.map((day) => (
        <button
          key={day}
          type="button"
          role="tab"
          aria-selected={value === day}
          className={`crew-days__chip${value === day ? " is-on" : ""}`}
          onClick={() => onChange(day)}
        >
          {dayLabel(day)}
        </button>
      ))}
    </div>
  );
}

/** 명찰. 기울여 보면 따라 움직이고, 상태를 고르면 띠 색과 치토가 바뀐다. */
function StaffPass() {
  const { me, key, patchMember, notify, now } = useCrew();
  const status = statusOf(me.status);
  const [memo, setMemo] = useState(me.statusMemo || "");
  const [pop, setPop] = useState(0);
  const [askRelief, setAskRelief] = useState(false);
  const cardRef = useRef(null);
  const editingMemo = useRef(false);

  useEffect(() => {
    if (!editingMemo.current) setMemo(me.statusMemo || "");
  }, [me.statusMemo]);

  // relief: 밥 먹는 동안 대신 맡은 사람. 밥 먹는 중이 아니면 서버가 지운다.
  async function save(nextStatus, nextMemo, nextRelief = null) {
    const previous = {
      status: me.status, statusMemo: me.statusMemo, statusAt: me.statusAt, relief: me.relief, location: me.location, locationAt: me.locationAt,
    };
    const relief = nextStatus === "EATING" ? nextRelief || null : null;
    const optimistic = { id: me.id, status: nextStatus, statusMemo: nextStatus ? nextMemo || null : null, statusAt: Date.now(), relief };
    if (nextStatus === "OFF") Object.assign(optimistic, { location: null, locationAt: null }); // 퇴근하면 있는 곳도 지운다
    patchMember(optimistic);
    try {
      const saved = await updateCrewStatus(me.id, { status: nextStatus || "", memo: nextMemo || "", relief: relief || "", by: me.name }, key);
      patchMember(saved);
      return true;
    } catch (error) {
      patchMember({ id: me.id, ...previous });
      notify(error.message, "error");
      return false;
    }
  }

  async function pick(next) {
    if (next === me.status) return;
    buzz();
    if (next === "EATING") {
      setAskRelief(true); // 밥은 누구랑 교대했는지 먼저 묻는다
      return;
    }
    setPop((count) => count + 1);
    setMemo("");
    if (await save(next, "")) notify(`${statusOf(next).label}으로 바꿨어요`);
  }

  async function eatWith(relief) {
    setAskRelief(false);
    const changing = me.status === "EATING";
    if (!changing) {
      setPop((count) => count + 1);
      setMemo("");
    }
    if (await save("EATING", changing ? me.statusMemo : "", relief)) {
      notify(relief ? `${relief}님과 교대하고 밥 먹는 중이에요` : "밥 먹는 중으로 바꿨어요");
    }
  }

  function tilt(event) {
    const card = cardRef.current;
    if (!card || event.pointerType === "touch") return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
    card.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
  }

  function untilt() {
    cardRef.current?.style.setProperty("--rx", "0deg");
    cardRef.current?.style.setProperty("--ry", "0deg");
  }

  return (
    <section className="crew-pass-wrap">
      <div className="crew-lanyard" aria-hidden="true" />
      <article
        ref={cardRef}
        className="crew-pass"
        style={{ "--status": status.color, "--status-soft": status.soft }}
        onPointerMove={tilt}
        onPointerLeave={untilt}
      >
        <div className="crew-pass__hole" aria-hidden="true" />
        <div className="crew-pass__top">
          <span className="crew-pass__tag">STAFF</span>
          <span className="crew-pass__event">바람 · 2026 아주대 축제</span>
        </div>
        <div className="crew-pass__body">
          <div className="crew-pass__who">
            <h1 className="crew-pass__name">{me.name}</h1>
            <p className="crew-pass__dept">{deptLabel(me)}</p>
            {me.location ? (
              <p key={me.location} className="crew-pass__where" style={{ "--c": placeColor(me.location) }}>
                <Icon.pin size={13} /> {me.location}
              </p>
            ) : null}
          </div>
          <Chito key={`${status.key}-${pop}`} src={status.chito} className="crew-pass__chito" />
        </div>
        <div className="crew-pass__band">
          <span className="crew-pass__status">
            <StatusIcon status={status.key} size={18} />
            {status.key ? status.label : "지금 뭐 하고 있어요?"}
          </span>
          <span className="crew-pass__since">
            {!status.key ? "아래에서 골라 주세요" : me.relief ? `${me.relief}님과 교대 · ${ago(me.statusAt, now)}` : ago(me.statusAt, now)}
          </span>
        </div>
        <div className="crew-pass__shine" aria-hidden="true" />
      </article>

      <div className="crew-status-pick" role="radiogroup" aria-label="내 상태">
        {STATUSES.map((item) => {
          const on = item.key === me.status;
          return (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={on}
              className={`crew-status-pick__item${on ? " is-on" : ""}`}
              style={{ "--c": item.color, "--soft": item.soft }}
              onClick={() => pick(item.key)}
            >
              <span className="crew-status-pick__icon"><StatusIcon status={item.key} size={22} /></span>
              <span className="crew-status-pick__label">{item.short}</span>
            </button>
          );
        })}
      </div>

      {me.status !== "OFF" ? <WherePick /> : null}

      {me.status ? (
        <form
          className="crew-memo"
          onSubmit={async (event) => {
            event.preventDefault();
            editingMemo.current = false;
            event.currentTarget.querySelector("input")?.blur();
            if ((memo.trim() || null) === (me.statusMemo || null)) return;
            if (await save(me.status, memo.trim(), me.relief)) notify(memo.trim() ? "한마디를 남겼어요" : "한마디를 지웠어요");
          }}
        >
          <input
            value={memo}
            maxLength={60}
            onFocus={() => { editingMemo.current = true; }}
            onBlur={() => { editingMemo.current = false; }}
            onChange={(event) => setMemo(event.target.value)}
            placeholder={MEMO_HINT[me.status] || "한마디 남기기"}
            aria-label="상태 한마디"
          />
          <button type="submit" className="crew-btn crew-btn--ghost" disabled={(memo.trim() || null) === (me.statusMemo || null)}>
            남기기
          </button>
        </form>
      ) : null}

      {me.status === "EATING" ? (
        <button type="button" className="crew-relief-row" onClick={() => setAskRelief(true)}>
          <span className="crew-relief-row__icon" aria-hidden="true"><Icon.swap size={16} /></span>
          <span className="crew-relief-row__text">
            {me.relief ? <>내 자리는 <b>{me.relief}</b>님이 맡는 중</> : "교대 없이 밥 먹는 중"}
          </span>
          <span className="crew-relief-row__edit">{me.relief ? "바꾸기" : "교대한 사람 적기"}</span>
        </button>
      ) : null}

      <ReliefSheet open={askRelief} current={me.relief} onClose={() => setAskRelief(false)} onPick={eatWith} />
    </section>
  );
}

/**
 * 지금 어디 있어요? 시간표에 나오는 장소 + 기타(직접 적기). 상태와 따로 저장하고, 퇴근하면 서버가 지운다.
 * 근무 시간이면 근무표 장소를 맨 앞에 두어 한 번에 누르게 한다. 고른 걸 다시 누르면 지운다.
 */
function WherePick() {
  const { me, data, fNow, now, key, patchMember, notify } = useCrew();
  const places = useMemo(() => placesOf(data.slots), [data.slots]);
  const duty = nowSlotFor(data.slots, me.name, fNow)?.place || null;
  const ordered = duty ? [duty, ...places.filter((place) => place !== duty)] : places;
  const custom = Boolean(me.location) && !places.includes(me.location);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");

  async function save(next) {
    const previous = { location: me.location, locationAt: me.locationAt };
    patchMember({ id: me.id, location: next, locationAt: next ? Date.now() : null });
    try {
      patchMember(await updateCrewLocation(me.id, { location: next || "", by: me.name }, key));
      notify(next ? `지금 ${next}에 있어요` : "있는 곳을 지웠어요");
    } catch (error) {
      patchMember({ id: me.id, ...previous });
      notify(error.message, "error");
    }
  }

  function pick(place) {
    buzz(8);
    setTyping(false);
    save(place === me.location ? null : place);
  }

  function openOther() {
    buzz(8);
    if (typing) {
      setTyping(false);
      return;
    }
    setText(custom ? me.location : "");
    setTyping(true);
  }

  return (
    <section className="crew-where" aria-label="지금 있는 곳">
      <p className="crew-where__label">
        <Icon.pin size={15} /> 지금 어디 있어요?
        <span>{me.location ? `${ago(me.locationAt, now)} 골랐어요` : "안 골라도 돼요"}</span>
      </p>
      <div className="crew-where__chips">
        {ordered.map((place) => {
          const on = place === me.location;
          return (
            <button
              key={place}
              type="button"
              aria-pressed={on}
              className={`crew-where__chip${on ? " is-on" : ""}`}
              style={{ "--c": placeColor(place) }}
              onClick={() => pick(place)}
            >
              {place}
              {place === duty ? <em>근무표</em> : null}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={custom}
          aria-expanded={typing}
          className={`crew-where__chip crew-where__chip--etc${custom ? " is-on" : ""}${typing ? " is-typing" : ""}`}
          onClick={openOther}
        >
          <Icon.edit size={13} /> {custom ? `기타 · ${me.location}` : "기타"}
        </button>
      </div>
      {typing ? (
        <form
          className="crew-memo crew-where__form"
          onSubmit={(event) => {
            event.preventDefault();
            const next = text.trim();
            setTyping(false);
            if ((next || null) === (me.location || null)) return;
            save(next || null);
          }}
        >
          <input
            value={text}
            maxLength={40}
            autoFocus
            onChange={(event) => setText(event.target.value)}
            placeholder="예: 학생회관 2층, 학식"
            aria-label="있는 곳 직접 적기"
          />
          <button type="submit" className="crew-btn crew-btn--ghost">
            {text.trim() || !custom ? "적기" : "지우기"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

/** 밥 먹으러 가기 전에: 누구랑 교대했어요? 명단 전체에서 이름 · 초성으로 찾는다. */
function ReliefSheet({ open, current, onClose, onPick }) {
  const { members, me } = useCrew();
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  const list = members.filter((member) => member.name !== me.name && matchesQuery(member, query));
  return (
    <Sheet open={open} onClose={onClose} title="누구랑 교대했어요?" tall>
      <div className="crew-relief">
        <p className="crew-relief__lead">밥 먹는 동안 내 자리를 맡아 주는 사람을 골라 주세요. 상태를 다시 바꾸면 교대 표시는 저절로 사라져요.</p>
        <button type="button" className="crew-relief__none" onClick={() => onPick(null)}>
          교대 없이 밥 먹기
        </button>
        <label className="crew-search">
          <Icon.search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 초성으로 찾기" />
        </label>
        <ul className="crew-relief__list">
          {list.map((member) => {
            const state = statusOf(member.status);
            return (
              <li key={member.id}>
                <button
                  type="button"
                  className={`crew-relief__item${current === member.name ? " is-on" : ""}`}
                  onClick={() => onPick(member.name)}
                >
                  <Avatar member={member} size={36} />
                  <span className="crew-relief__name">
                    {member.name}
                    <small>{deptLabel(member)}</small>
                  </span>
                  {state.key ? (
                    <span className="crew-pill" style={{ "--c": state.color, "--soft": state.soft }}>
                      <StatusIcon status={state.key} size={13} />{state.short}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {list.length === 0 ? <li className="crew-empty">맞는 이름이 없어요.</li> : null}
        </ul>
      </div>
    </Sheet>
  );
}

/** 지금 할 일. 근무 중이면 남은 시간 막대, 아니면 다음 근무까지 남은 시간. */
function NowCard({ blocks }) {
  const { me, fNow, days, data, openPerson, byName, key, patchMember, notify } = useCrew();
  const { current, next } = nowAndNext(blocks, fNow.minute);
  const beforeFestival = days.length > 0 && fNow.day < days[0];
  const afterFestival = days.length > 0 && fNow.day > days[days.length - 1];

  if (current) {
    const total = current.endMin - current.startMin;
    const done = fNow.minute - current.startMin;
    const part = current.parts.find((slot) => slot.startMin <= fNow.minute && fNow.minute < slot.endMin) || current.parts[0];
    const mates = part.members.filter((name) => name !== me.name);
    const needsStatus = me.status !== "WORKING";
    return (
      <section className="crew-now crew-now--live">
        <p className="crew-now__eyebrow"><i className="crew-pulse" aria-hidden="true" /> 지금 근무 시간</p>
        <h2 className="crew-now__title">{current.booth}</h2>
        <p className="crew-now__place"><Icon.pin size={15} /> {current.place} · {range(current)}</p>
        <div className="crew-meter" style={{ "--p": `${Math.min(100, (done / total) * 100)}%` }}>
          <span />
        </div>
        <p className="crew-now__left">끝까지 <b>{duration(current.endMin - fNow.minute)}</b></p>
        {mates.length ? (
          <div className="crew-now__mates">
            <span>같이 있는 사람</span>
            <div className="crew-chips">
              {mates.map((name) => <NameChip key={name} name={name} member={byName.get(name)} onOpen={openPerson} />)}
            </div>
          </div>
        ) : null}
        {current.notes.length ? <p className="crew-now__note">{current.notes.join(" · ")}</p> : null}
        {needsStatus ? (
          <button
            type="button"
            className="crew-now__nudge"
            onClick={async () => {
              buzz();
              patchMember({ id: me.id, status: "WORKING", statusMemo: null, statusAt: Date.now() });
              try {
                patchMember(await updateCrewStatus(me.id, { status: "WORKING", memo: "", by: me.name }, key));
                notify("일하는 중으로 바꿨어요");
              } catch (error) {
                notify(error.message, "error");
              }
            }}
          >
            근무 시간이에요 — '일하는 중'으로 바꾸기
          </button>
        ) : null}
      </section>
    );
  }

  let title;
  let detail = null;
  let chito = "/images/chito-wave.png";
  if (next) {
    title = `다음 근무까지 ${duration(next.startMin - fNow.minute)}`;
    detail = `${clock(next.startMin)} · ${next.booth} (${next.place})`;
    chito = "/images/chito.png";
  } else if (beforeFestival) {
    const first = data.slots
      .filter((slot) => slot.members.includes(me.name))
      .sort((a, b) => a.day.localeCompare(b.day) || a.startMin - b.startMin)[0];
    title = "축제가 곧 시작해요";
    detail = first ? `첫 근무 · ${dayLabel(first.day)} ${clock(first.startMin)} ${first.booth}` : "아직 잡힌 근무가 없어요";
    chito = "/images/chito-cheer.png";
  } else if (afterFestival) {
    title = "축제가 끝났어요. 정말 수고했어요!";
    chito = "/images/chito-party.png";
  } else {
    title = blocks.length ? "오늘 근무 끝! 수고했어요" : "오늘은 잡힌 근무가 없어요";
    detail = blocks.length ? "상태를 '쉬는 중'이나 '퇴근'으로 바꿔 두면 다들 알아요." : null;
    chito = "/images/chito-party.png";
  }
  return (
    <section className="crew-now">
      <div>
        <p className="crew-now__eyebrow">지금</p>
        <h2 className="crew-now__title crew-now__title--sm">{title}</h2>
        {detail ? <p className="crew-now__place">{detail}</p> : null}
      </div>
      <Chito src={chito} className="crew-now__chito" />
    </section>
  );
}

/**
 * 하루 근무 목록. 한눈에 '몇 시부터 몇 시까지 · 어디서'만 보이게, 같이 일하는 사람은 접어 둔다.
 * 장소마다 색을 정해 두어(왼쪽 띠 · 장소 표) 같은 장소가 이어지면 바로 알아본다.
 */
export function Timeline({ blocks, day, name, compact = false }) {
  const { fNow } = useCrew();
  if (blocks.length === 0) {
    return (
      <div className="crew-empty-card">
        <Chito src="/images/chito-wave.png" className="crew-empty-card__chito" />
        <p>{dayLabel(day)}에는 잡힌 근무가 없어요.</p>
      </div>
    );
  }
  const isToday = day === fNow.day;
  const total = blocks.reduce((sum, block) => sum + block.endMin - block.startMin, 0);
  return (
    <>
      <p className="crew-day-sum">
        근무 <b>{blocks.length}개</b> · 모두 <b>{duration(total)}</b>
        <span>{clock(blocks[0].startMin)} 시작 · {clock(blocks[blocks.length - 1].endMin)} 끝</span>
      </p>
      <ol className={`crew-shifts${compact ? " is-compact" : ""}`}>
        {blocks.map((block) => {
          const live = isToday && block.startMin <= fNow.minute && fNow.minute < block.endMin;
          const past = (isToday && block.endMin <= fNow.minute) || day < fNow.day;
          return <ShiftCard key={block.key} block={block} name={name} live={live} past={past} />;
        })}
      </ol>
    </>
  );
}

function ShiftCard({ block, name, live, past }) {
  const { byName, openPerson, openSlot } = useCrew();
  const [open, setOpen] = useState(false);
  const mates = [...new Set(block.parts.flatMap((slot) => slot.members))].filter((other) => other !== name);
  const single = block.parts.length === 1;
  return (
    <li
      className={`crew-shift${live ? " is-live" : ""}${past ? " is-past" : ""}`}
      style={{ "--place": placeColor(block.place) }}
    >
      <button type="button" className="crew-shift__main" onClick={() => openSlot(block.parts[0])}>
        <span className="crew-shift__time">
          {clock(block.startMin)}<i>–</i>{clock(block.endMin)}
          {live ? <em className="crew-shift__badge">지금</em> : null}
          {past ? <em className="crew-shift__badge is-done">끝남</em> : null}
        </span>
        <span className="crew-shift__booth">{block.booth}</span>
        <span className="crew-shift__place"><Icon.pin size={14} /> {block.place}</span>
        <span className="crew-shift__len">{duration(block.endMin - block.startMin)}</span>
      </button>
      {block.notes.length ? <p className="crew-shift__note">{block.notes.join(" · ")}</p> : null}
      {mates.length ? (
        <>
          <button type="button" className={`crew-shift__mates${open ? " is-open" : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <span className="crew-shift__faces" aria-hidden="true">
              {mates.slice(0, 3).map((other) => <Avatar key={other} member={byName.get(other)} name={other} size={22} showStatus={false} />)}
            </span>
            같이 {mates.length <= 2 ? mates.join(" · ") : `${mates[0]} 외 ${mates.length - 1}명`}
            <Icon.chevron size={15} className="crew-shift__chev" />
          </button>
          {open ? (
            <div className="crew-shift__more">
              {single ? (
                <NameChips names={mates} byName={byName} onOpen={openPerson} limit={99} />
              ) : (
                <ul className="crew-tl__parts">
                  {block.parts.map((slot) => {
                    const partMates = slot.members.filter((other) => other !== name);
                    return (
                      <li key={slot.id}>
                        <button type="button" className="crew-tl__part-time" onClick={() => openSlot(slot)}>{range(slot)}</button>
                        <NameChips names={partMates} byName={byName} onOpen={openPerson} limit={99} empty={<span className="crew-tl__solo">혼자</span>} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <p className="crew-shift__solo">혼자 맡아요</p>
      )}
    </li>
  );
}

/** 다른 사람 시간표 보기: 이름을 치면 바로 아래에 뜨고, 누르면 그 사람 카드가 열린다. */
function PeekOthers() {
  const { members, me, openPerson } = useCrew();
  const [query, setQuery] = useState("");
  const hits = query.trim() ? members.filter((member) => member.name !== me.name && matchesQuery(member, query)).slice(0, 6) : [];
  return (
    <section className="crew-section crew-peek">
      <h2 className="crew-h2">다른 사람 시간표 보기</h2>
      <label className="crew-search">
        <Icon.search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 초성으로 찾기" />
      </label>
      {hits.length ? (
        <ul className="crew-peek__list">
          {hits.map((member) => (
            <li key={member.id}>
              <button type="button" onClick={() => openPerson(member.name)}>
                <Avatar member={member} size={34} />
                <span className="crew-peek__name">{member.name}<small>{deptLabel(member)}</small></span>
                <Icon.chevron size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
