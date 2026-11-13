// 스태프 화면의 시트들: 사람 카드(전화 · 그 사람 시간표), 시간표 칸 고치기, 명단 고치기, 공지 고치기.
import { useEffect, useMemo, useState } from "react";
import { deleteCrewMember, deleteCrewNotice, deleteCrewSlot, saveCrewMember, saveCrewNotice, saveCrewSlot } from "../../api";
import { Avatar, Icon, Sheet, StatusIcon, useAsk } from "./CrewKit";
import { useCrew } from "./crewContext";
import { DayChips, Timeline } from "./CrewMe";
import {
  TIME_OPTIONS,
  ago,
  blocksOf,
  clashesFor,
  dayLabel,
  deptLabel,
  matchesQuery,
  placeColor,
  range,
  smsHref,
  statusOf,
  telHref,
  timeOptionLabel,
} from "./crewUtils";

/** 서버가 붙인 "…하지 못했어요. (이유)" 에서 이유만 보여 준다. */
function reason(error) {
  const match = /\((.+)\)$/.exec(error?.message || "");
  return match ? match[1] : error?.message || "다시 시도해 주세요.";
}

function names(list) {
  return list.length ? list.join(", ") : "아무도 없음";
}

/** 확인 창에 보여 줄 칸 내용. */
function slotLines(slot) {
  const lines = [
    ["날짜", dayLabel(slot.day)],
    ["시간", range(slot)],
    ["장소", `${slot.place} · ${slot.booth}`],
    ["사람", `${names(slot.members)}${slot.members.length ? ` (${slot.members.length}명)` : ""}`],
  ];
  if (slot.note) lines.push(["메모", slot.note]);
  return lines;
}

/** 고치기 전과 뒤에서 달라진 것만. */
function slotDiff(before, after) {
  const lines = [];
  if (before.day !== after.day) lines.push(["날짜", `${dayLabel(before.day)} → ${dayLabel(after.day)}`]);
  if (before.startMin !== after.startMin || before.endMin !== after.endMin) lines.push(["시간", `${range(before)} → ${range(after)}`]);
  if (before.place !== after.place) lines.push(["장소", `${before.place} → ${after.place}`]);
  if (before.booth !== after.booth) lines.push(["부스", `${before.booth} → ${after.booth}`]);
  const added = after.members.filter((name) => !before.members.includes(name));
  const removed = before.members.filter((name) => !after.members.includes(name));
  if (added.length) lines.push(["들어옴", added.join(", ")]);
  if (removed.length) lines.push(["빠짐", removed.join(", ")]);
  if (!added.length && !removed.length && before.members.join() !== after.members.join()) lines.push(["사람", "순서만 바뀜"]);
  if ((before.note || "") !== (after.note || "")) lines.push(["메모", after.note ? after.note : "지움"]);
  return lines;
}

/* ---------- 사람 카드 ---------- */

export function PersonSheet({ name, onClose }) {
  const { byName, data, days, defaultDay, me, now, notify, openMember } = useCrew();
  const [day, setDay] = useState(defaultDay);
  const member = name ? byName.get(name) : null;
  const blocks = useMemo(() => (name ? blocksOf(data.slots, name, day) : []), [data.slots, name, day]);
  useEffect(() => {
    if (name) setDay(defaultDay);
  }, [name, defaultDay]);

  const status = statusOf(member?.status);
  return (
    <Sheet open={Boolean(name)} onClose={onClose} title={member ? `${member.name}${member.name === me.name ? " (나)" : ""}` : name || ""} tall>
      {member ? (
        <div className="crew-person-card">
          <div className="crew-person-card__head" style={{ "--c": status.color, "--soft": status.soft }}>
            <Avatar member={member} size={64} />
            <div>
              <p className="crew-person-card__dept">{deptLabel(member)}</p>
              <p className="crew-person-card__status">
                <span className="crew-pill"><StatusIcon status={status.key} size={14} />{status.key ? status.label : "상태 미정"}</span>
                {status.key ? <span className="crew-person__ago">{ago(member.statusAt, now)}</span> : null}
              </p>
              {member.location ? (
                <p className="crew-person-card__where" style={{ "--c": placeColor(member.location) }}>
                  <Icon.pin size={13} /> 지금 {member.location}<span> · {ago(member.locationAt, now)}</span>
                </p>
              ) : null}
              {member.status === "EATING" && member.relief ? <p className="crew-person-card__memo">{member.relief}님과 교대하고 밥 먹는 중</p> : null}
              {member.statusMemo ? <p className="crew-person-card__memo">“{member.statusMemo}”</p> : null}
            </div>
          </div>
          {member.name !== me.name ? (
            <div className="crew-person-card__actions">
              <a className="crew-btn crew-btn--primary" href={telHref(member.phone)}>
                <Icon.phone size={18} /> 전화 걸기
              </a>
              <a className="crew-btn crew-btn--soft" href={smsHref(member.phone)}>
                <Icon.message size={18} /> 문자
              </a>
              <button
                type="button"
                className="crew-btn crew-btn--soft"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(member.phone);
                    notify("번호를 복사했어요");
                  } catch {
                    notify(member.phone);
                  }
                }}
              >
                <Icon.copy size={18} /> 복사
              </button>
            </div>
          ) : null}
          <p className="crew-person-card__phone">{member.phone}</p>

          <div className="crew-section__head">
            <h3 className="crew-h3">{member.name === me.name ? "내" : `${member.name}님`} 시간표</h3>
            <DayChips days={days} value={day} onChange={setDay} />
          </div>
          <Timeline blocks={blocks} day={day} name={member.name} compact />

          <button type="button" className="crew-link crew-person-card__edit" onClick={() => { onClose(); openMember(member); }}>
            <Icon.edit size={14} /> 이름 · 국 · 번호 고치기
          </button>
        </div>
      ) : (
        <p className="crew-empty">명단에 없는 이름이에요. 시간표에서 이름을 고쳐 주세요.</p>
      )}
    </Sheet>
  );
}

/* ---------- 시간표 칸 고치기 ---------- */

export function SlotSheet({ slot, onClose }) {
  const { data, days, members, byName, me, key, refresh, notify, now } = useCrew();
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, askNode] = useAsk();

  useEffect(() => {
    if (!slot) return;
    setDraft({
      day: slot.day || days[0],
      place: slot.place || "",
      booth: slot.booth || "",
      startMin: slot.startMin ?? 540,
      endMin: slot.endMin ?? 600,
      members: [...(slot.members || [])],
      note: slot.note || "",
    });
    setQuery("");
    // days 는 15초마다 다시 받을 때 새 배열이 된다. 여기에 걸면 고치던 내용이 그때마다 지워진다 — 칸을 열 때만 채운다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  const places = useMemo(() => [...new Set(data.slots.map((item) => item.place))], [data.slots]);
  const booths = useMemo(
    () => [...new Set(data.slots.filter((item) => !draft?.place || item.place === draft.place).map((item) => item.booth))],
    [data.slots, draft?.place],
  );

  if (!draft) return <Sheet open={false} onClose={onClose} title="" />;

  const isNew = !slot?.id;
  const dirty = isNew
    ? Boolean(draft.place && draft.booth)
    : JSON.stringify(draft) !== JSON.stringify({
      day: slot.day, place: slot.place, booth: slot.booth, startMin: slot.startMin, endMin: slot.endMin, members: slot.members, note: slot.note || "",
    });
  const badTime = draft.endMin <= draft.startMin;
  const hits = query.trim()
    ? members.filter((member) => !draft.members.includes(member.name) && matchesQuery(member, query)).slice(0, 8)
    : [];

  function set(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function add(name) {
    set({ members: [...draft.members, name] });
    setQuery("");
  }

  async function save() {
    const target = { ...draft, place: draft.place.trim(), booth: draft.booth.trim(), note: draft.note.trim() };
    const clashes = target.members
      .map((name) => [name, clashesFor(data.slots, name, target, slot?.id)[0]])
      .filter(([, clash]) => clash)
      .map(([name, clash]) => `${name}(${clash.booth})`);
    const ok = await ask({
      title: isNew ? "이 칸을 더할까요?" : "이렇게 바꿀까요?",
      lines: isNew ? slotLines(target) : slotDiff(slot, target),
      note: clashes.length ? `같은 시간 다른 칸에도 있어요: ${clashes.join(", ")}` : null,
      confirmLabel: isNew ? "더하기" : "바꾸기",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await saveCrewSlot(slot?.id, { ...draft, baseUpdatedAt: slot?.updatedAt ?? null, by: me.name }, key);
      notify(isNew ? "칸을 더했어요" : "시간표를 고쳤어요");
      await refresh(true);
      onClose();
    } catch (error) {
      notify(reason(error), "error");
      if (error.status === 409 || error.status === 404) {
        await refresh(true);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await ask({
      title: "이 칸을 지울까요?",
      lines: slotLines(slot),
      note: "지우면 되돌릴 수 없어요. 기록은 '최근 바뀐 것'에 남아요.",
      confirmLabel: "지우기",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteCrewSlot(slot.id, me.name, key);
      notify("칸을 지웠어요");
      await refresh(true);
      onClose();
    } catch (error) {
      notify(reason(error), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={Boolean(slot)} onClose={onClose} title={isNew ? "칸 더하기" : "시간표 칸 고치기"} tall>
      <div className="crew-form">
        {!isNew ? (
          <p className="crew-form__meta">
            {slot.booth} · {range(slot)}
            {slot.updatedBy && slot.updatedBy !== "처음 올림" ? <span> · 마지막으로 {slot.updatedBy}님이 {ago(slot.updatedAt, now)} 고침</span> : <span> · 처음 올린 그대로</span>}
          </p>
        ) : null}

        <div className="crew-field">
          <span>날짜</span>
          <DayChips days={days} value={draft.day} onChange={(day) => set({ day })} />
        </div>

        <div className="crew-form__row">
          <label className="crew-field">
            <span>시작</span>
            <select value={draft.startMin} onChange={(event) => set({ startMin: Number(event.target.value) })}>
              {TIME_OPTIONS.map((minute) => <option key={minute} value={minute}>{timeOptionLabel(minute)}</option>)}
            </select>
          </label>
          <label className="crew-field">
            <span>끝</span>
            <select value={draft.endMin} onChange={(event) => set({ endMin: Number(event.target.value) })}>
              {TIME_OPTIONS.map((minute) => <option key={minute} value={minute}>{timeOptionLabel(minute)}</option>)}
            </select>
          </label>
        </div>
        {badTime ? <p className="crew-error">끝나는 시간이 시작보다 늦어야 해요.</p> : null}

        <div className="crew-form__row">
          <label className="crew-field">
            <span>장소</span>
            <input list="crew-places" value={draft.place} onChange={(event) => set({ place: event.target.value })} placeholder="예: 성호관 앞 잔디밭" />
          </label>
          <label className="crew-field">
            <span>부스 · 맡은 일</span>
            <input list="crew-booths" value={draft.booth} onChange={(event) => set({ booth: event.target.value })} placeholder="예: 푸드트럭" />
          </label>
        </div>
        <datalist id="crew-places">{places.map((place) => <option key={place} value={place} />)}</datalist>
        <datalist id="crew-booths">{booths.map((booth) => <option key={booth} value={booth} />)}</datalist>

        <div className="crew-field">
          <span>사람 ({draft.members.length}명)</span>
          <div className="crew-edit-people">
            {draft.members.map((name) => {
              const clashes = clashesFor(data.slots, name, draft, slot?.id);
              return (
                <span key={name} className={`crew-edit-person${clashes.length ? " is-clash" : ""}`}>
                  <Avatar member={byName.get(name)} name={name} size={26} showStatus={false} />
                  <span className="crew-edit-person__text">
                    {name}
                    {clashes.length ? <small>같은 시간 {clashes[0].booth}에도 있어요</small> : null}
                  </span>
                  <button type="button" aria-label={`${name} 빼기`} onClick={() => set({ members: draft.members.filter((other) => other !== name) })}>
                    <Icon.close size={14} />
                  </button>
                </span>
              );
            })}
            {draft.members.length === 0 ? <span className="crew-tl__solo">아직 아무도 없어요</span> : null}
          </div>
          <label className="crew-search crew-search--sm">
            <Icon.plus size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사람 더하기 — 이름 · 초성" />
          </label>
          {hits.length ? (
            <ul className="crew-suggest">
              {hits.map((member) => {
                const clashes = clashesFor(data.slots, member.name, draft, slot?.id);
                return (
                  <li key={member.id}>
                    <button type="button" onClick={() => add(member.name)}>
                      <Avatar member={member} size={30} />
                      <span className="crew-suggest__name">{member.name}<small>{deptLabel(member)}</small></span>
                      {clashes.length ? <em>이 시간 {clashes[0].booth}</em> : <em className="is-free">이 시간 비어 있음</em>}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <label className="crew-field">
          <span>메모 (선택)</span>
          <input value={draft.note} maxLength={200} onChange={(event) => set({ note: event.target.value })} placeholder="예: 끝나고 바로 아로새길 주점으로" />
        </label>

        <div className="crew-form__actions">
          {!isNew ? (
            <button type="button" className="crew-btn crew-btn--danger" onClick={remove} disabled={busy}>
              <Icon.trash size={16} /> 칸 지우기
            </button>
          ) : null}
          <button type="button" className="crew-btn crew-btn--primary" onClick={save} disabled={busy || !dirty || badTime || !draft.place.trim() || !draft.booth.trim()}>
            {busy ? "저장 중…" : isNew ? "칸 더하기" : "고친 대로 저장"}
          </button>
        </div>
      </div>
      {askNode}
    </Sheet>
  );
}

/* ---------- 명단 고치기 ---------- */

const ROLES = ["국장", "차장", "국원"];

export function MemberSheet({ member, onClose }) {
  const { members, data, me, key, refresh, notify } = useCrew();
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ask, askNode] = useAsk();

  useEffect(() => {
    if (!member) return;
    setDraft({ name: member.name || "", dept: member.dept || "", role: member.role || "국원", phone: member.phone || "" });
  }, [member]);

  const depts = useMemo(() => [...new Set(members.map((item) => item.dept).filter(Boolean))], [members]);
  if (!draft) return <Sheet open={false} onClose={onClose} title="" />;

  const isNew = !member?.id;
  const slotCount = isNew ? 0 : data.slots.filter((slot) => slot.members.includes(member.name)).length;

  async function save() {
    const next = { name: draft.name.trim(), dept: draft.dept.trim(), role: draft.role, phone: draft.phone.trim() };
    const fields = [["이름", "name"], ["국", "dept"], ["직책", "role"], ["번호", "phone"]];
    const lines = isNew
      ? fields.map(([label, field]) => [label, next[field] || "없음"])
      : fields
        .filter(([, field]) => (member[field] || "") !== next[field])
        .map(([label, field]) => [label, `${member[field] || "없음"} → ${next[field] || "없음"}`]);
    if (!isNew && lines.length === 0) {
      onClose();
      return;
    }
    const ok = await ask({
      title: isNew ? "명단에 더할까요?" : `${member.name}님 정보를 바꿀까요?`,
      lines,
      note: !isNew && next.name !== member.name && slotCount ? `시간표 ${slotCount}칸의 이름도 같이 바뀌어요.` : null,
      confirmLabel: isNew ? "더하기" : "바꾸기",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await saveCrewMember(member?.id, { ...draft, by: me.name }, key);
      notify(isNew ? `${draft.name.trim()}님을 명단에 더했어요` : "명단을 고쳤어요");
      await refresh(true);
      onClose();
    } catch (error) {
      notify(reason(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await ask({
      title: `${member.name}님을 명단에서 뺄까요?`,
      lines: [["국 · 직책", deptLabel(member)], ["번호", member.phone]],
      note: slotCount ? `시간표 ${slotCount}칸에서도 같이 빠져요. 되돌릴 수 없어요.` : "되돌릴 수 없어요.",
      confirmLabel: "명단에서 빼기",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteCrewMember(member.id, me.name, key);
      notify(`${member.name}님을 명단에서 뺐어요`);
      await refresh(true);
      onClose();
    } catch (error) {
      notify(reason(error), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={Boolean(member)} onClose={onClose} title={isNew ? "명단에 사람 더하기" : `${member.name} 고치기`}>
      <div className="crew-form">
        <div className="crew-form__row">
          <label className="crew-field">
            <span>이름</span>
            <input value={draft.name} maxLength={30} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label className="crew-field">
            <span>국</span>
            <input list="crew-depts" value={draft.dept} maxLength={30} onChange={(event) => setDraft({ ...draft, dept: event.target.value })} placeholder="예: 소통개발국" />
          </label>
        </div>
        <datalist id="crew-depts">{depts.map((dept) => <option key={dept} value={dept} />)}</datalist>
        <div className="crew-field">
          <span>직책</span>
          <div className="crew-days">
            {[...new Set([...ROLES, draft.role].filter(Boolean))].map((role) => (
              <button key={role} type="button" className={`crew-days__chip${draft.role === role ? " is-on" : ""}`} onClick={() => setDraft({ ...draft, role })}>
                {role}
              </button>
            ))}
          </div>
        </div>
        <label className="crew-field">
          <span>휴대폰 번호</span>
          <input type="tel" inputMode="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="010-0000-0000" />
        </label>
        {!isNew && draft.name.trim() !== member.name && slotCount ? (
          <p className="crew-form__meta">이름을 바꾸면 시간표 {slotCount}칸의 이름도 같이 바뀌어요.</p>
        ) : null}
        <div className="crew-form__actions">
          {!isNew && member.name !== me.name ? (
            <button type="button" className="crew-btn crew-btn--danger" onClick={remove} disabled={busy}>
              <Icon.trash size={16} /> 명단에서 빼기
            </button>
          ) : null}
          <button type="button" className="crew-btn crew-btn--primary" onClick={save} disabled={busy || !draft.name.trim() || !draft.phone.trim()}>
            {busy ? "저장 중…" : isNew ? "더하기" : "저장"}
          </button>
        </div>
      </div>
      {askNode}
    </Sheet>
  );
}

/* ---------- 공지 ---------- */

export function NoticeSheet({ notice, onClose }) {
  const { days, me, key, refresh, notify } = useCrew();
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ask, askNode] = useAsk();

  useEffect(() => {
    if (!notice) return;
    setDraft({ day: notice.day || days[0], text: notice.text || "" });
    // 위 칸 고치기와 같은 이유로 공지를 열 때만 채운다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  if (!draft) return <Sheet open={false} onClose={onClose} title="" />;
  const isNew = !notice?.id;

  async function run(question, action, done) {
    if (!(await ask(question))) return;
    setBusy(true);
    try {
      await action();
      notify(done);
      await refresh(true);
      onClose();
    } catch (error) {
      notify(reason(error), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={Boolean(notice)} onClose={onClose} title={isNew ? "공지 더하기" : "공지 고치기"}>
      <div className="crew-form">
        <div className="crew-field">
          <span>날짜</span>
          <DayChips days={days} value={draft.day} onChange={(day) => setDraft({ ...draft, day })} />
        </div>
        <label className="crew-field">
          <span>내용</span>
          <textarea rows={3} maxLength={300} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} placeholder="예: 노천극장 3시 조기 입장 — 늦어지면 다른 부스 돕기" />
        </label>
        <div className="crew-form__actions">
          {!isNew ? (
            <button
              type="button"
              className="crew-btn crew-btn--danger"
              disabled={busy}
              onClick={() => run(
                { title: "이 공지를 지울까요?", lines: [["날짜", dayLabel(notice.day)], ["내용", notice.text]], note: "되돌릴 수 없어요.", confirmLabel: "지우기", danger: true },
                () => deleteCrewNotice(notice.id, me.name, key),
                "공지를 지웠어요",
              )}
            >
              <Icon.trash size={16} /> 지우기
            </button>
          ) : null}
          <button
            type="button"
            className="crew-btn crew-btn--primary"
            disabled={busy || !draft.text.trim()}
            onClick={() => run(
              {
                title: isNew ? "이 공지를 더할까요?" : "공지를 이렇게 바꿀까요?",
                lines: [["날짜", dayLabel(draft.day)], ["내용", draft.text.trim()]],
                confirmLabel: isNew ? "더하기" : "바꾸기",
              },
              () => saveCrewNotice(notice?.id, { ...draft, by: me.name }, key),
              isNew ? "공지를 더했어요" : "공지를 고쳤어요",
            )}
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
      {askNode}
    </Sheet>
  );
}
