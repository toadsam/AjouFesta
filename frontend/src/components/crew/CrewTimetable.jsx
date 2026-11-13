// '시간표' 탭: 날짜 → 장소 → 부스 순서의 전체 표. 칸을 누르면 바로 고칠 수 있고, 고친 기록은 맨 아래에 남는다.
// 부스 카드마다 그날 근무를 한 줄 막대로 먼저 보여 준다(지금 시각에는 치토 불꽃 바늘). 막대 조각을 누르면 그 줄로 간다.
import { useMemo, useRef, useState } from "react";
import { importCrew, restoreCrew } from "../../api";
import { Chito, Icon, PersonChip, useAsk } from "./CrewKit";
import { useCrew } from "./crewContext";
import { DayChips } from "./CrewMe";
import { describeChanges, downloadCrewExcel, readCrewExcel } from "./crewExcel";
import { ago, buzz, clock, placeColor, range } from "./crewUtils";

export default function CrewTimetable() {
  const { data, days, defaultDay, fNow, me, openNotice, openSlot, now } = useCrew();
  const [day, setDay] = useState(defaultDay);
  const [mine, setMine] = useState(false);
  const [folded, setFolded] = useState(() => new Set());

  const places = useMemo(() => {
    const map = new Map();
    data.slots
      .filter((slot) => slot.day === day && (!mine || slot.members.includes(me.name)))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.startMin - b.startMin)
      .forEach((slot) => {
        if (!map.has(slot.place)) map.set(slot.place, new Map());
        const booths = map.get(slot.place);
        if (!booths.has(slot.booth)) booths.set(slot.booth, []);
        booths.get(slot.booth).push(slot);
      });
    return [...map.entries()].map(([place, booths]) => [
      place,
      [...booths.entries()].map(([booth, slots]) => [booth, [...slots].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)]),
    ]);
  }, [data.slots, day, mine, me.name]);

  const notices = data.notices.filter((notice) => notice.day === day);
  const isToday = day === fNow.day;
  const boothKeys = places.flatMap(([place, booths]) => booths.map(([booth]) => `${place}/${booth}`));
  const allFolded = boothKeys.length > 0 && boothKeys.every((key) => folded.has(key));

  function toggle(key) {
    buzz(6);
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function jump(place) {
    document.getElementById(`crew-place-${place}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="crew-table">
      <div className="crew-sticky">
        <div className="crew-table__bar">
          <DayChips days={days} value={day} onChange={setDay} />
          <span className="crew-table__tools">
            <button type="button" className={`crew-toggle${mine ? " is-on" : ""}`} aria-pressed={mine} onClick={() => setMine((value) => !value)}>
              내 칸만
            </button>
            <button
              type="button"
              className="crew-toggle"
              onClick={() => document.getElementById("crew-excel")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              엑셀
            </button>
          </span>
        </div>
        {places.length > 1 ? (
          <div className="crew-jump" aria-label="장소로 바로 가기">
            {places.map(([place]) => (
              <button key={place} type="button" style={{ "--place": placeColor(place) }} onClick={() => jump(place)}>{place}</button>
            ))}
          </div>
        ) : null}
      </div>

      {/* 그날 공지: 치토가 말해 주는 말풍선 */}
      <section className="crew-say">
        <Chito src="/images/chito-flame.png" className="crew-say__chito" />
        <div className="crew-say__bubbles">
          {notices.map((notice) => (
            <button key={notice.id} type="button" className="crew-say__bubble" onClick={() => openNotice(notice)}>
              <span>{notice.text}</span>
              <Icon.edit size={14} />
            </button>
          ))}
          {notices.length === 0 ? <p className="crew-say__empty">이날 공지는 아직 없어요.</p> : null}
          <button type="button" className="crew-link" onClick={() => openNotice({ day })}>
            <Icon.plus size={14} /> 공지 더하기
          </button>
        </div>
      </section>

      {places.length === 0 ? (
        <p className="crew-empty">{mine ? "이날 내 칸이 없어요." : "이날은 아직 시간표가 없어요."}</p>
      ) : (
        <div className="crew-fold-all">
          <button type="button" className="crew-link" onClick={() => setFolded(allFolded ? new Set() : new Set(boothKeys))}>
            {allFolded ? "모두 펼치기" : "모두 접기"}
          </button>
        </div>
      )}

      {places.map(([place, booths]) => (
        <section key={place} id={`crew-place-${place}`} className="crew-tplace" style={{ "--place": placeColor(place) }}>
          <h2 className="crew-tplace__name">
            <span className="crew-tplace__pin"><Icon.pin size={15} /></span>
            {place}
            <small>{booths.length > 1 ? `${booths.length}곳` : ""}</small>
          </h2>
          {booths.map(([booth, slots]) => (
            <BoothCard
              key={booth}
              day={day}
              place={place}
              booth={booth}
              slots={slots}
              isToday={isToday}
              folded={folded.has(`${place}/${booth}`)}
              onToggle={() => toggle(`${place}/${booth}`)}
            />
          ))}
        </section>
      ))}

      <button
        type="button"
        className="crew-btn crew-btn--dashed crew-btn--block"
        onClick={() => openSlot({ day, place: "", booth: "", startMin: 9 * 60, endMin: 10 * 60, members: [], note: "" })}
      >
        <Icon.plus size={18} /> 새 장소 · 부스에 칸 만들기
      </button>

      <ExcelCard />

      <ChangeLog logs={data.logs} now={now} />
    </div>
  );
}

/** 엑셀로 한꺼번에 고치기: 내려받기 → 엑셀에서 고치기 → 올리기(무엇이 바뀌는지 확인 후), 잘못 올렸으면 직전으로 되돌리기. */
function ExcelCard() {
  const { data, days, me, key, refresh, notify, now } = useCrew();
  const [ask, askNode] = useAsk();
  const [busy, setBusy] = useState("");
  const [errors, setErrors] = useState([]);
  const fileRef = useRef(null);

  async function download() {
    setBusy("down");
    try {
      await downloadCrewExcel(data, `바람-스태프-시간표-${new Date().toISOString().slice(5, 10).replace("-", "")}.xlsx`);
      notify("엑셀로 내려받았어요");
    } catch {
      notify("엑셀을 만들지 못했어요. 다시 눌러 주세요.", "error");
    } finally {
      setBusy("");
    }
  }

  async function upload(file) {
    setErrors([]);
    setBusy("up");
    try {
      const { request, errors: problems } = await readCrewExcel(file, { ...data, days });
      if (problems.length) {
        setErrors(problems);
        notify("엑셀에 고칠 곳이 있어요. 아래를 봐 주세요.", "error");
        return;
      }
      const { lines, examples, empty } = describeChanges(data, request);
      if (empty) {
        notify("지금 시간표와 똑같아서 바꿀 게 없어요.");
        return;
      }
      const ok = await ask({
        title: "엑셀대로 통째로 바꿀까요?",
        lines,
        note: `${examples.length ? `예: ${examples.join(" / ")}. ` : ""}바꾸기 전 모습은 남겨 둬서 '직전으로 되돌리기'로 돌아갈 수 있어요.`,
        confirmLabel: "엑셀대로 바꾸기",
      });
      if (!ok) return;
      await importCrew(request, me.name, key);
      notify("엑셀대로 바꿨어요");
      await refresh(true);
    } catch (error) {
      notify(error.message || "엑셀을 읽지 못했어요.", "error");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function restore() {
    const backup = data.backup;
    const ok = await ask({
      title: "직전으로 되돌릴까요?",
      lines: [["돌아갈 모습", `${backup.actor}님이 ${ago(backup.at, now)} 통째로 바꾸기 전`]],
      note: "지금 모습은 남지 않아요. 되돌린 뒤에 또 되돌릴 수는 없어요.",
      confirmLabel: "되돌리기",
      danger: true,
    });
    if (!ok) return;
    setBusy("restore");
    try {
      await restoreCrew(me.name, key);
      notify("직전 모습으로 되돌렸어요");
      await refresh(true);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <section id="crew-excel" className="crew-excel">
      <div className="crew-excel__head">
        <span className="crew-excel__icon" aria-hidden="true"><Icon.grid size={22} /></span>
        <div>
          <h2 className="crew-h2">엑셀로 한꺼번에 고치기</h2>
          <p>많이 바꿀 때는 엑셀이 편해요. 한 줄이 한 칸이에요.</p>
        </div>
      </div>
      <ol className="crew-excel__steps">
        <li><b>1</b> 지금 시간표를 엑셀로 받기</li>
        <li><b>2</b> 엑셀에서 줄을 고치고 · 더하고 · 지우기</li>
        <li><b>3</b> 다시 올리면 무엇이 바뀌는지 보고 확인</li>
      </ol>
      <div className="crew-excel__actions">
        <button type="button" className="crew-btn crew-btn--soft" onClick={download} disabled={Boolean(busy)}>
          {busy === "down" ? "만드는 중…" : "엑셀로 받기"}
        </button>
        <label className={`crew-btn crew-btn--primary crew-excel__upload${busy ? " is-busy" : ""}`}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={Boolean(busy)}
            onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])}
          />
          {busy === "up" ? "읽는 중…" : "엑셀 올리기"}
        </label>
      </div>
      {errors.length ? (
        <ul className="crew-excel__errors">
          {errors.slice(0, 12).map((error) => <li key={error}>{error}</li>)}
          {errors.length > 12 ? <li>…그 밖에 {errors.length - 12}곳</li> : null}
        </ul>
      ) : null}
      {data.backup ? (
        <button type="button" className="crew-excel__restore" onClick={restore} disabled={Boolean(busy)}>
          <Icon.history size={16} />
          <span>
            직전으로 되돌리기
            <small>{data.backup.actor}님이 {ago(data.backup.at, now)} 통째로 바꾸기 전 모습</small>
          </span>
        </button>
      ) : null}
      {askNode}
    </section>
  );
}

/** 겹치는 칸(입장관리 · 줄관리처럼 같은 시간에 여러 무리)이 있으면 막대를 여러 줄로 쌓는다. */
function laneOf(slots) {
  const ends = [];
  return slots.map((slot) => {
    let lane = ends.findIndex((end) => end <= slot.startMin);
    if (lane === -1) {
      lane = ends.length;
      ends.push(slot.endMin);
    } else {
      ends[lane] = slot.endMin;
    }
    return lane;
  });
}

function BoothCard({ day, place, booth, slots, isToday, folded, onToggle }) {
  const { fNow, me, byName, openPerson, openSlot } = useCrew();
  const rowRefs = useRef({});
  const [flash, setFlash] = useState(null);

  const start = Math.min(...slots.map((slot) => slot.startMin));
  const end = Math.max(...slots.map((slot) => slot.endMin));
  const span = Math.max(1, end - start);
  const lanes = laneOf(slots);
  const laneCount = Math.max(...lanes) + 1;
  const people = new Set(slots.flatMap((slot) => slot.members)).size;
  const isLive = (slot) => isToday && slot.startMin <= fNow.minute && fNow.minute < slot.endMin;
  const isPast = (slot) => (isToday && slot.endMin <= fNow.minute) || day < fNow.day;
  const liveSlots = slots.filter(isLive);
  const hasMe = slots.some((slot) => slot.members.includes(me.name));
  const nowPct = isToday && fNow.minute >= start && fNow.minute <= end ? ((fNow.minute - start) / span) * 100 : null;

  function goTo(slot) {
    buzz(8);
    const reveal = () => {
      rowRefs.current[slot.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(slot.id);
      window.setTimeout(() => setFlash(null), 1500);
    };
    if (folded) {
      onToggle();
      window.setTimeout(reveal, 60);
    } else {
      reveal();
    }
  }

  return (
    <article className={`crew-tbooth${folded ? " is-folded" : ""}${liveSlots.length ? " is-live" : ""}`}>
      <header className="crew-tbooth__head">
        <button type="button" className="crew-tbooth__toggle" aria-expanded={!folded} onClick={onToggle}>
          <span className="crew-tbooth__title">
            <h3>{booth}</h3>
            {hasMe ? <em className="crew-me-tag">내 칸</em> : null}
          </span>
          <span className="crew-tbooth__meta">
            {clock(start)}–{clock(end)} · {slots.length}칸{people ? ` · ${people}명` : ""}
          </span>
        </button>
        <button
          type="button"
          className="crew-icon-btn"
          aria-label={`${booth}에 칸 더하기`}
          onClick={() => {
            const last = slots[slots.length - 1];
            openSlot({ day, place, booth, startMin: last.endMin, endMin: Math.min(last.endMin + 60, 27 * 60), members: [], note: "" });
          }}
        >
          <Icon.plus size={18} />
        </button>
        <button type="button" className="crew-icon-btn crew-tbooth__chev" aria-label={folded ? "펼치기" : "접기"} onClick={onToggle}>
          <Icon.chevron size={18} />
        </button>
      </header>

      <div className={`crew-tbar${nowPct !== null ? " has-now" : ""}`} style={{ "--lanes": laneCount }}>
        {slots.map((slot, index) => (
          <button
            key={slot.id}
            type="button"
            className={`crew-tbar__seg${isLive(slot) ? " is-live" : ""}${isPast(slot) ? " is-past" : ""}${slot.members.includes(me.name) ? " is-mine" : ""}`}
            style={{
              left: `${((slot.startMin - start) / span) * 100}%`,
              width: `${((slot.endMin - slot.startMin) / span) * 100}%`,
              top: `${lanes[index] * 12}px`,
            }}
            aria-label={`${range(slot)} 줄로 가기`}
            onClick={() => goTo(slot)}
          />
        ))}
        {nowPct !== null ? (
          <span className="crew-tbar__now" style={{ left: `${nowPct}%` }} aria-hidden="true">
            <Chito src="/images/chito-flame.png" className="crew-tbar__flame" />
          </span>
        ) : null}
      </div>
      <div className="crew-tbar__ticks" aria-hidden="true">
        <span>{clock(start)}</span>
        <span>{clock(end)}</span>
      </div>

      {folded && liveSlots.length ? (
        <button type="button" className="crew-tbooth__nowline" onClick={() => goTo(liveSlots[0])}>
          <i className="crew-pulse" aria-hidden="true" /> 지금 {range(liveSlots[0])} · {liveSlots[0].members.join(", ") || liveSlots[0].note}
        </button>
      ) : null}

      {!folded ? (
        <ul className="crew-trows">
          {slots.map((slot) => {
            const live = isLive(slot);
            const mineRow = slot.members.includes(me.name);
            return (
              <li key={slot.id} ref={(node) => { rowRefs.current[slot.id] = node; }}>
                {/* 칸 안에 이름 버튼이 있어 button 안에 button 을 둘 수 없다 → 눌리는 div */}
                <div
                  role="button"
                  tabIndex={0}
                  className={`crew-trow${live ? " is-live" : ""}${mineRow ? " is-mine" : ""}${isPast(slot) ? " is-past" : ""}${flash === slot.id ? " is-flash" : ""}`}
                  onClick={() => openSlot(slot)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openSlot(slot);
                    }
                  }}
                >
                  <span className="crew-trow__time">
                    <b>{clock(slot.startMin)}</b>
                    <small>{clock(slot.endMin)}</small>
                  </span>
                  <span className="crew-trow__rail" aria-hidden="true"><i /></span>
                  <span className="crew-trow__people">
                    {live ? (
                      <span className="crew-trow__live">
                        <Chito src="/images/chito-flame.png" className="crew-trow__flame" /> 지금
                      </span>
                    ) : null}
                    {slot.members.map((name) => (
                      <PersonChip key={name} name={name} member={byName.get(name)} me={name === me.name} onOpen={openPerson} />
                    ))}
                    {slot.note ? <span className="crew-trow__note"><Icon.megaphone size={13} /> {slot.note}</span> : null}
                    {slot.members.length === 0 && !slot.note ? <span className="crew-tl__solo">아직 비어 있어요 · 눌러서 사람 넣기</span> : null}
                  </span>
                  <Icon.edit size={14} className="crew-trow__edit" />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}

function ChangeLog({ logs, now }) {
  const [open, setOpen] = useState(false);
  if (!logs.length) return null;
  const shown = open ? logs : logs.slice(0, 3);
  return (
    <section className="crew-log">
      <h2 className="crew-h2"><Icon.history size={18} /> 최근 바뀐 것</h2>
      <ul>
        {shown.map((log) => (
          <li key={log.id}>
            <span className="crew-log__who">{log.actor}</span>
            <span className="crew-log__text">{log.text}</span>
            <span className="crew-log__at">{ago(log.at, now)}</span>
          </li>
        ))}
      </ul>
      {logs.length > 3 ? (
        <button type="button" className="crew-link" onClick={() => setOpen((value) => !value)}>
          {open ? "접기" : `${logs.length - 3}개 더 보기`}
        </button>
      ) : null}
    </section>
  );
}
