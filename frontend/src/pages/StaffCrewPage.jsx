/*
 * 스태프 화면(/staff). 총학생회 스태프가 축제 이틀 동안 폰에 켜 두고 쓰는 곳.
 *  - 나: 내 명찰 · 상태 바꾸기 · 지금 할 일 · 내 시간표
 *  - 다들: 서로의 상태(일하는 중 · 밥 · 수업 · 쉼 · 퇴근)를 모아 보기, 장소별로 지금 누가 있나
 *  - 연락처: 누르면 바로 전화
 *  - 시간표: 장소 · 부스별 전체 표, 칸을 눌러 바로 고치기
 * 부스 암호 하나로 열고, 이 폰의 주인은 이름으로 고른다(PIN 없음 — 스태프끼리 믿고 쓴다).
 * 앱 껍데기(.app-shell) 밖에서 그린다 — index.css 의 전역 !important 규칙과 싸우지 않으려고(/guide/live 와 같은 방식).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchCrewState, importCrew } from "../api";
import { Avatar, Chito, Icon, useAsk } from "../components/crew/CrewKit";
import { CrewContext, useCrew } from "../components/crew/crewContext";
import { deptColor, festivalNow, matchesQuery } from "../components/crew/crewUtils";
import CrewMe from "../components/crew/CrewMe";
import CrewBoard from "../components/crew/CrewBoard";
import CrewContacts from "../components/crew/CrewContacts";
import CrewTimetable from "../components/crew/CrewTimetable";
import { MemberSheet, NoticeSheet, PersonSheet, SlotSheet } from "../components/crew/CrewSheets";
import "../styles/crew.css";

const KEY_STORAGE = "festflow_crew_key";
const BOOTH_KEY_STORAGE = "festflow_ops_booth_key"; // 부스 콘솔에서 이미 넣은 암호가 있으면 그대로 쓴다.
const ME_STORAGE = "festflow_crew_me";
const TAB_STORAGE = "festflow_crew_tab";
const POLL_MS = 15000;

function readStorage(storage, key) {
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(storage, key, value) {
  try {
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드)면 이번 방문 동안만 기억한다.
  }
}

const TABS = [
  { key: "me", label: "나", icon: Icon.me },
  { key: "board", label: "다들", icon: Icon.users },
  { key: "contacts", label: "연락처", icon: Icon.phone },
  { key: "table", label: "시간표", icon: Icon.grid },
];

export default function StaffCrewPage() {
  const [key, setKey] = useState(() => readStorage(localStorage, KEY_STORAGE) || readStorage(sessionStorage, BOOTH_KEY_STORAGE));
  const [keyError, setKeyError] = useState("");
  const [meName, setMeName] = useState(() => readStorage(localStorage, ME_STORAGE));
  const [tab, setTab] = useState(() => {
    const saved = readStorage(localStorage, TAB_STORAGE);
    return TABS.some((item) => item.key === saved) ? saved : "me";
  });
  const [data, setData] = useState(null);
  const [sync, setSync] = useState({ at: 0, failed: false });
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState(null);
  const [person, setPerson] = useState(null);
  const [slotEdit, setSlotEdit] = useState(null);
  const [memberEdit, setMemberEdit] = useState(null);
  const [noticeEdit, setNoticeEdit] = useState(null);
  const versionRef = useRef(0);
  const toastTimer = useRef(0);

  useEffect(() => {
    document.documentElement.classList.add("crew-root");
    document.title = "바람 스태프";
    // 홈 화면에 추가하면 손님 앱이 아니라 스태프 화면(/staff)만 뜨게: 이 화면에 있는 동안 매니페스트 · 아이콘 · 이름을 스태프용으로 바꾼다.
    const swaps = [
      ['link[rel="manifest"]', "href", "/staff.webmanifest"],
      ['link[rel="apple-touch-icon"]', "href", "/apple-touch-icon-staff.png"],
      ['meta[name="apple-mobile-web-app-title"]', "content", "바람 스태프"],
    ];
    const restore = swaps.map(([selector, attr, value]) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const before = node.getAttribute(attr);
      node.setAttribute(attr, value);
      return () => node.setAttribute(attr, before);
    });
    return () => {
      document.documentElement.classList.remove("crew-root");
      restore.forEach((undo) => undo?.());
    };
  }, []);

  const notify = useCallback((text, tone = "default") => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, tone, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const signOut = useCallback((message = "") => {
    writeStorage(localStorage, KEY_STORAGE, "");
    writeStorage(sessionStorage, BOOTH_KEY_STORAGE, "");
    versionRef.current = 0;
    setData(null);
    setKey("");
    setKeyError(message);
  }, []);

  /** force 면 버전을 묻지 않고 전체를 받는다(방금 내가 고친 직후). */
  const refresh = useCallback(async (force = false) => {
    if (!key) return;
    try {
      const next = await fetchCrewState(key, force ? 0 : versionRef.current);
      versionRef.current = next.version;
      if (!next.unchanged) setData(next);
      setSync({ at: Date.now(), failed: false });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        signOut("암호가 맞지 않아요. 부스 암호를 다시 넣어 주세요.");
        return;
      }
      // 429 는 '암호를 여러 번 틀림'일 수도, '같은 와이파이에서 요청이 몰림'일 수도 있다.
      // 이미 이 암호로 들어와 있던 폰은 암호를 지우지 않고 다음 차례에 다시 읽는다(한 번에 모두가 쫓겨나지 않게).
      if (error.status === 429 && !versionRef.current) {
        signOut("암호를 여러 번 틀려서 잠깐 막혔어요. 10분 뒤에 다시 넣어 주세요.");
        return;
      }
      setSync((current) => ({ ...current, failed: true }));
    }
  }, [key, signOut]);

  useEffect(() => {
    if (!key) return undefined;
    refresh(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [key, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    writeStorage(localStorage, TAB_STORAGE, tab);
    window.scrollTo({ top: 0 });
  }, [tab]);

  const members = data?.members || [];
  const byName = useMemo(() => new Map(members.map((member) => [member.name, member])), [members]);
  const me = byName.get(meName) || null;

  const days = useMemo(() => {
    const set = new Set((data?.slots || []).map((slot) => slot.day));
    (data?.notices || []).forEach((notice) => set.add(notice.day));
    return [...set].sort();
  }, [data]);

  const fNow = festivalNow(new Date(now));
  const defaultDay = days.includes(fNow.day) ? fNow.day : days.find((day) => day > fNow.day) || days[days.length - 1] || fNow.day;

  // 내가 방금 바꾼 상태를 서버 응답 전에 화면에 먼저 반영한다.
  const patchMember = useCallback((next) => {
    setData((current) => current && {
      ...current,
      members: current.members.map((member) => (member.id === next.id ? { ...member, ...next } : member)),
    });
  }, []);

  const chooseMe = useCallback((name) => {
    writeStorage(localStorage, ME_STORAGE, name);
    setMeName(name);
  }, []);

  const value = useMemo(() => ({
    key,
    data,
    members,
    byName,
    me,
    meName,
    days,
    defaultDay,
    fNow,
    now,
    refresh,
    notify,
    patchMember,
    openPerson: (name) => setPerson(name),
    openSlot: (slot) => setSlotEdit(slot),
    openMember: (member) => setMemberEdit(member),
    openNotice: (notice) => setNoticeEdit(notice),
    goTab: setTab,
  }), [key, data, members, byName, me, meName, days, defaultDay, fNow.day, fNow.minute, now, refresh, notify, patchMember]);

  let body;
  if (!key) {
    body = (
      <KeyGate
        error={keyError}
        onSubmit={(next) => {
          writeStorage(localStorage, KEY_STORAGE, next);
          versionRef.current = 0;
          setKeyError("");
          setKey(next);
        }}
      />
    );
  } else if (!data) {
    body = <Loading failed={sync.failed} onRetry={() => refresh(true)} />;
  } else if (members.length === 0) {
    body = <ImportGate onDone={() => refresh(true)} />;
  } else if (!me) {
    body = <WhoGate onPick={chooseMe} />;
  } else {
    body = (
      <>
        <TopBar sync={sync} onSwitch={() => chooseMe("")} onSignOut={() => signOut("")} />
        <main className="crew-main" key={tab}>
          {tab === "me" ? <CrewMe /> : null}
          {tab === "board" ? <CrewBoard /> : null}
          {tab === "contacts" ? <CrewContacts /> : null}
          {tab === "table" ? <CrewTimetable /> : null}
        </main>
        <nav className="crew-nav" aria-label="스태프 메뉴">
          {TABS.map((item) => {
            const TabIcon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`crew-nav__item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(item.key)}
              >
                <TabIcon size={22} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <PersonSheet name={person} onClose={() => setPerson(null)} />
        <SlotSheet slot={slotEdit} onClose={() => setSlotEdit(null)} />
        <MemberSheet member={memberEdit} onClose={() => setMemberEdit(null)} />
        <NoticeSheet notice={noticeEdit} onClose={() => setNoticeEdit(null)} />
      </>
    );
  }

  return (
    <CrewContext.Provider value={value}>
      <div className="crew">
        {body}
        {toast ? (
          <div key={toast.id} className={`crew-toast crew-toast--${toast.tone}`} role="status" aria-live="polite">
            {toast.text}
          </div>
        ) : null}
      </div>
    </CrewContext.Provider>
  );
}

function TopBar({ sync, onSwitch, onSignOut }) {
  const { me, now } = useCrew();
  const [menu, setMenu] = useState(false);
  const stale = sync.failed || (sync.at && now - sync.at > POLL_MS * 4);
  return (
    <header className="crew-top">
      <div className="crew-top__brand">
        <span className="crew-top__mark">바람</span>
        <span className="crew-top__sub">STAFF</span>
      </div>
      <span className={`crew-live${stale ? " is-stale" : ""}`}>
        <i aria-hidden="true" />
        {stale ? "연결 끊김 · 다시 시도 중" : "실시간"}
      </span>
      <button type="button" className="crew-top__me" onClick={() => setMenu((open) => !open)} aria-expanded={menu} aria-label="내 메뉴">
        <Avatar member={me} size={34} />
      </button>
      {menu ? (
        <>
          <div className="crew-menu-backdrop" onClick={() => setMenu(false)} aria-hidden="true" />
          <div className="crew-menu" role="menu">
            <p className="crew-menu__who">
              <strong>{me.name}</strong>
              <span>이 폰은 {me.name}님 것으로 기억해요</span>
            </p>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); onSwitch(); }}>
              <Icon.swap size={18} /> 다른 사람으로 바꾸기
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); onSignOut(); }}>
              <Icon.logout size={18} /> 이 폰에서 나가기
            </button>
          </div>
        </>
      ) : null}
    </header>
  );
}

function KeyGate({ error, onSubmit }) {
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(0);
  useEffect(() => {
    if (error) setShake((count) => count + 1);
  }, [error]);
  return (
    <section className="crew-gate">
      <div className="crew-gate__sky" aria-hidden="true" />
      <div className="crew-gate__card" key={shake} data-shake={shake ? "true" : undefined}>
        <Chito src="/images/chito-wave.png" className="crew-gate__chito" />
        <p className="crew-eyebrow">아주대 축제 바람 · 스태프 전용</p>
        <h1 className="crew-gate__title">오늘도 고생 많아요!</h1>
        <p className="crew-gate__lead">부스 암호를 넣으면 시간표 · 연락처 · 서로의 상태를 볼 수 있어요.</p>
        <form
          className="crew-gate__form"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = value.trim();
            if (trimmed) onSubmit(trimmed);
          }}
        >
          <label className="crew-field">
            <span>부스 암호</span>
            <input
              type="password"
              autoComplete="current-password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="암호를 넣어 주세요"
              autoFocus
            />
          </label>
          {error ? <p className="crew-error">{error}</p> : null}
          <button type="submit" className="crew-btn crew-btn--primary crew-btn--block" disabled={!value.trim()}>
            들어가기
          </button>
        </form>
        <p className="crew-gate__foot">한 번 넣으면 이 폰에서는 다시 묻지 않아요.</p>
      </div>
    </section>
  );
}

function Loading({ failed, onRetry }) {
  return (
    <section className="crew-gate">
      <div className="crew-gate__sky" aria-hidden="true" />
      <div className="crew-gate__card crew-gate__card--quiet">
        <Chito src="/images/chito.png" className="crew-gate__chito is-bob" />
        {failed ? (
          <>
            <h1 className="crew-gate__title">서버에 닿지 않아요</h1>
            <p className="crew-gate__lead">와이파이나 데이터가 켜져 있는지 확인하고 다시 눌러 주세요.</p>
            <button type="button" className="crew-btn crew-btn--primary crew-btn--block" onClick={onRetry}>다시 불러오기</button>
          </>
        ) : (
          <p className="crew-gate__lead">시간표를 불러오는 중…</p>
        )}
      </div>
    </section>
  );
}

/** 명단이 비어 있을 때만: 명단 · 시간표 파일(엑셀 .xlsx 또는 .json)을 한 번 올린다. 번호가 든 파일이라 코드 저장소에는 두지 않는다. */
function ImportGate({ onDone }) {
  const { key, notify } = useCrew();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, askNode] = useAsk();

  async function readFile(file) {
    setError("");
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readCrewExcel } = await import("../components/crew/crewExcel");
        const { request, errors } = await readCrewExcel(file, { members: [], slots: [], notices: [], days: [] });
        if (errors.length) throw new Error(errors.slice(0, 3).join(" / "));
        setPreview(request);
        return;
      }
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.members) || parsed.members.length === 0) throw new Error("명단(members)이 없는 파일이에요.");
      setPreview(parsed);
    } catch (readError) {
      setPreview(null);
      setError(readError.message || "파일을 읽지 못했어요.");
    }
  }

  async function upload() {
    const ok = await ask({
      title: "이 파일로 올릴까요?",
      lines: [
        ["스태프", `${preview.members.length}명`],
        ["시간표", `${preview.slots?.length || 0}칸`],
        ["공지", `${preview.notices?.length || 0}개`],
      ],
      note: "한 번 올리면 그다음부터는 화면에서 한 칸씩 고쳐요.",
      confirmLabel: "올리기",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await importCrew(preview, "처음 올림", key);
      notify("명단과 시간표를 올렸어요!");
      onDone();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="crew-gate">
      <div className="crew-gate__sky" aria-hidden="true" />
      <div className="crew-gate__card">
        <Chito src="/images/chito-party.png" className="crew-gate__chito" />
        <p className="crew-eyebrow">처음 한 번만</p>
        <h1 className="crew-gate__title">명단 · 시간표 파일 올리기</h1>
        <p className="crew-gate__lead">아직 스태프 명단이 비어 있어요. 받은 <b>스태프 명단 · 시간표 파일(엑셀 또는 .json)</b>을 골라 주세요.</p>
        <label className="crew-file">
          <input type="file" accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} />
          <span>{preview ? "다른 파일 고르기" : "파일 고르기"}</span>
        </label>
        {preview ? (
          <p className="crew-gate__lead">
            스태프 <b>{preview.members.length}명</b> · 시간표 <b>{preview.slots?.length || 0}칸</b> · 공지 {preview.notices?.length || 0}개
          </p>
        ) : null}
        {error ? <p className="crew-error">{error}</p> : null}
        <button type="button" className="crew-btn crew-btn--primary crew-btn--block" disabled={!preview || busy} onClick={upload}>
          {busy ? "올리는 중…" : "이대로 올리기"}
        </button>
      </div>
      {askNode}
    </section>
  );
}

/** 이 폰의 주인 고르기. 국별로 묶어 보여 주고, 이름 · 초성으로 찾을 수 있다. */
function WhoGate({ onPick }) {
  const { members } = useCrew();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const groups = useMemo(() => {
    const map = new Map();
    members.filter((member) => matchesQuery(member, query)).forEach((member) => {
      const group = member.dept || "회장단";
      if (!map.has(group)) map.set(group, []);
      map.get(group).push(member);
    });
    return [...map.entries()];
  }, [members, query]);

  return (
    <section className="crew-who">
      <header className="crew-who__head">
        <Chito src="/images/chito.png" className="crew-who__chito" />
        <div>
          <p className="crew-eyebrow">거의 다 왔어요</p>
          <h1 className="crew-who__title">누구세요?</h1>
          <p className="crew-who__lead">내 이름을 고르면 내 시간표가 바로 떠요.</p>
        </div>
      </header>
      <label className="crew-search">
        <Icon.search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 초성 (예: ㅈㅈㅎ)" />
      </label>
      <div className="crew-who__groups">
        {groups.map(([group, list]) => (
          <section key={group} className="crew-who__group" style={{ "--dept": deptColor(list[0].dept) }}>
            <h2>{group}</h2>
            <div className="crew-who__grid">
              {list.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`crew-who__name${picked === member.name ? " is-picked" : ""}`}
                  onClick={() => {
                    setPicked(member.name);
                    window.setTimeout(() => onPick(member.name), 260);
                  }}
                >
                  <Avatar member={member} size={34} showStatus={false} />
                  <span>{member.name}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 ? <p className="crew-empty">"{query}" 와 맞는 이름이 없어요.</p> : null}
      </div>
    </section>
  );
}
