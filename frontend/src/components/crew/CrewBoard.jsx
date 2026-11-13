// '다들' 탭: 서로의 상태를 한눈에. 위 막대(상태별 비율)나 칩을 누르면 그 상태만 걸러 본다.
// '장소별'로 바꾸면 시간표상 지금 어느 부스에 누가 있어야 하는지(와 그 사람의 실제 상태)를 본다.
import { useMemo, useState } from "react";
import { Avatar, Chito, Icon, NameChip, StatusIcon } from "./CrewKit";
import { useCrew } from "./crewContext";
import { NO_STATUS, STATUSES, ago, buzz, clock, deptLabel, nowSlotFor, placeColor, placesOf, range, statusOf, telHref } from "./crewUtils";

const FILTERS = [...STATUSES, { ...NO_STATUS, key: "NONE", short: "미정" }];

export default function CrewBoard() {
  const [mode, setMode] = useState("status");
  return (
    <div className="crew-board">
      <div className="crew-seg" role="tablist" aria-label="보기">
        <button type="button" role="tab" aria-selected={mode === "status"} className={mode === "status" ? "is-on" : ""} onClick={() => setMode("status")}>
          상태별
        </button>
        <button type="button" role="tab" aria-selected={mode === "place"} className={mode === "place" ? "is-on" : ""} onClick={() => setMode("place")}>
          지금 장소별
        </button>
      </div>
      {mode === "status" ? <ByStatus /> : <ByPlace />}
    </div>
  );
}

// '어디서' 거르기: 시간표 장소 그대로, 직접 적은 곳은 '기타' 하나로 묶는다.
const OTHER = "__other";
const NOWHERE = "__none";

function whereKey(member, places) {
  if (!member.location) return NOWHERE;
  return places.includes(member.location) ? member.location : OTHER;
}

function ByStatus() {
  const { members, data, fNow, now, me, openPerson } = useCrew();
  const [filter, setFilter] = useState("ALL");
  const [where, setWhere] = useState("ALL");
  const places = useMemo(() => placesOf(data.slots), [data.slots]);
  const whereChips = useMemo(() => {
    const counts = new Map();
    members.forEach((member) => {
      const k = whereKey(member, places);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const chips = places.filter((place) => counts.has(place)).map((place) => ({ key: place, label: place, color: placeColor(place), count: counts.get(place) }));
    if (counts.has(OTHER)) chips.push({ key: OTHER, label: "기타", color: "#56647b", count: counts.get(OTHER) });
    if (chips.length && counts.has(NOWHERE)) chips.push({ key: NOWHERE, label: "안 적음", color: "#b0b8c1", count: counts.get(NOWHERE) });
    return chips;
  }, [members, places]);
  const whereOn = where !== "ALL" && whereChips.some((chip) => chip.key === where) ? where : "ALL";

  const counts = useMemo(() => {
    const map = Object.fromEntries(FILTERS.map((item) => [item.key, 0]));
    members.forEach((member) => {
      map[member.status || "NONE"] += 1;
    });
    return map;
  }, [members]);

  const list = useMemo(() => members
    .filter((member) => filter === "ALL" || (member.status || "NONE") === filter)
    .filter((member) => whereOn === "ALL" || whereKey(member, places) === whereOn)
    .sort((a, b) => (b.statusAt || 0) - (a.statusAt || 0) || a.sortOrder - b.sortOrder), [members, filter, whereOn, places]);

  const total = members.length || 1;
  // 김하은 → [정재훈]: 김하은이 지금 정재훈 대신 자리를 맡고 있다.
  const covering = useMemo(() => {
    const map = new Map();
    members.forEach((member) => {
      if (member.status === "EATING" && member.relief) {
        if (!map.has(member.relief)) map.set(member.relief, []);
        map.get(member.relief).push(member);
      }
    });
    return map;
  }, [members]);

  return (
    <>
      <section className="crew-tally">
        <div className="crew-tally__head">
          <h2 className="crew-h2">지금 다들</h2>
          <span className="crew-tally__total">{members.length}명</span>
        </div>
        <div className="crew-tally__bar" role="presentation">
          {FILTERS.filter((item) => counts[item.key] > 0).map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? "is-on" : ""}
              style={{ "--w": `${(counts[item.key] / total) * 100}%`, "--c": item.color }}
              onClick={() => { buzz(8); setFilter(filter === item.key ? "ALL" : item.key); }}
              aria-label={`${item.short} ${counts[item.key]}명`}
            />
          ))}
        </div>
        <div className="crew-filter" role="tablist" aria-label="상태로 거르기">
          <button type="button" role="tab" aria-selected={filter === "ALL"} className={`crew-filter__chip${filter === "ALL" ? " is-on" : ""}`} onClick={() => setFilter("ALL")}>
            전체 <b>{members.length}</b>
          </button>
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              className={`crew-filter__chip${filter === item.key ? " is-on" : ""}`}
              style={{ "--c": item.color, "--soft": item.soft }}
              onClick={() => setFilter(item.key)}
            >
              <StatusIcon status={item.key === "NONE" ? null : item.key} size={15} />
              {item.short} <b>{counts[item.key]}</b>
            </button>
          ))}
        </div>
        {whereChips.length ? (
          <div className="crew-filter crew-filter--scroll crew-where-filter" role="tablist" aria-label="있는 곳으로 거르기">
            <span className="crew-where-filter__label"><Icon.pin size={14} /> 어디서</span>
            {whereChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={whereOn === chip.key}
                className={`crew-filter__chip crew-filter__chip--dept${whereOn === chip.key ? " is-on" : ""}`}
                style={{ "--c": chip.color }}
                onClick={() => { buzz(8); setWhere(whereOn === chip.key ? "ALL" : chip.key); }}
              >
                {chip.label} <b>{chip.count}</b>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {list.length === 0 ? (
        <div className="crew-empty-card">
          <Chito src="/images/chito-wave.png" className="crew-empty-card__chito" />
          <p>{whereOn === "ALL" ? "지금 이 상태인 사람이 없어요." : "고른 상태 · 장소에 맞는 사람이 없어요."}</p>
        </div>
      ) : (
        <ul className="crew-people">
          {list.map((member, index) => {
            const status = statusOf(member.status);
            const slot = nowSlotFor(data.slots, member.name, fNow);
            return (
              <li key={member.id} className="crew-person" style={{ "--i": Math.min(index, 12), "--c": status.color, "--soft": status.soft }}>
                <button type="button" className="crew-person__main" onClick={() => openPerson(member.name)}>
                  <Avatar member={member} size={44} />
                  <span className="crew-person__text">
                    <span className="crew-person__name">
                      {member.name}
                      {member.name === me.name ? <em className="crew-me-tag">나</em> : null}
                      <small>{deptLabel(member)}</small>
                    </span>
                    <span className="crew-person__status">
                      <span className="crew-pill"><StatusIcon status={status.key} size={13} />{status.short}</span>
                      {member.location ? (
                        <span className="crew-person__where" style={{ "--c": placeColor(member.location) }}><Icon.pin size={12} />{member.location}</span>
                      ) : null}
                      {member.status === "EATING" && member.relief ? <span className="crew-person__relief">대신: {member.relief}</span> : null}
                      {member.statusMemo ? <span className="crew-person__memo">{member.statusMemo}</span> : null}
                      {status.key ? <span className="crew-person__ago">{ago(member.statusAt, now)}</span> : null}
                    </span>
                    {slot ? (
                      <span className="crew-person__duty"><Icon.clock size={12} /> 근무표 · {slot.booth} {range(slot)}</span>
                    ) : null}
                    {(covering.get(member.name) || []).map((eater) => {
                      const eaterSlot = nowSlotFor(data.slots, eater.name, fNow);
                      return (
                        <span key={eater.id} className="crew-person__duty is-covering">
                          <Icon.swap size={12} /> {eater.name} 대신 {eaterSlot ? `${eaterSlot.booth} ` : ""}맡는 중 (밥 교대)
                        </span>
                      );
                    })}
                  </span>
                </button>
                {member.name !== me.name ? (
                  <a className="crew-call" href={telHref(member.phone)} aria-label={`${member.name}에게 전화`}>
                    <Icon.phone size={18} />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function ByPlace() {
  const { data, fNow, byName, openPerson, me } = useCrew();
  const reliefFor = (name) => {
    const member = byName.get(name);
    return member?.status === "EATING" ? member.relief : null;
  };
  const { members } = useCrew();
  const groups = useMemo(() => {
    const live = data.slots.filter((slot) => slot.day === fNow.day && slot.startMin <= fNow.minute && fNow.minute < slot.endMin);
    const map = new Map();
    const group = (place) => {
      if (!map.has(place)) map.set(place, { slots: [], here: [] });
      return map.get(place);
    };
    live.forEach((slot) => group(slot.place).slots.push(slot));
    members.forEach((member) => {
      if (member.location) group(member.location).here.push(member);
    });
    return [...map.entries()];
  }, [data.slots, members, fNow.day, fNow.minute]);

  if (groups.length === 0) {
    return (
      <div className="crew-empty-card">
        <Chito src="/images/chito.png" className="crew-empty-card__chito" />
        <p>지금({clock(fNow.minute % 1440)}) 시간표에 잡힌 근무도, 있는 곳을 고른 사람도 없어요.<br />'시간표' 탭에서 날짜별 전체 표를 볼 수 있어요.</p>
      </div>
    );
  }

  return (
    <div className="crew-places">
      <p className="crew-hint"><i className="crew-pulse" aria-hidden="true" /> 시간표상 지금 {clock(fNow.minute)} 기준 · 이름 옆 점은 그 사람이 고른 상태, '지금 여기'는 스스로 고른 있는 곳이에요</p>
      {groups.map(([place, { slots, here }]) => (
        <section key={place} className="crew-place" style={{ "--place": placeColor(place) }}>
          <h2 className="crew-place__name"><Icon.pin size={16} /> {place}</h2>
          {here.length ? (
            <div className="crew-place__here">
              <span className="crew-place__here-label">지금 여기</span>
              <div className="crew-chips">
                {here.map((member) => (
                  <NameChip key={member.id} name={member.name} member={member} me={member.name === me.name} onOpen={openPerson} />
                ))}
              </div>
            </div>
          ) : null}
          {slots.map((slot) => (
            <div key={slot.id} className="crew-place__booth">
              <div className="crew-place__booth-head">
                <b>{slot.booth}</b>
                <span>{range(slot)}</span>
              </div>
              {slot.note ? <p className="crew-place__note">{slot.note}</p> : null}
              <div className="crew-chips">
                {slot.members.map((name) => (
                  <NameChip
                    key={name}
                    name={name}
                    member={byName.get(name)}
                    me={name === me.name}
                    onOpen={openPerson}
                    tag={byName.get(name)?.status === "EATING" ? "밥" : null}
                  />
                ))}
                {slot.members.map(reliefFor).filter((name) => name && !slot.members.includes(name)).map((name) => (
                  <NameChip key={`r-${name}`} name={name} member={byName.get(name)} me={name === me.name} onOpen={openPerson} tag="대신" />
                ))}
                {slot.members.length === 0 && !slot.note ? <span className="crew-tl__solo">아직 사람이 없어요</span> : null}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
