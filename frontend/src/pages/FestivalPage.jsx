// 축제 살펴보기. 바람 축제의 첫 화면. 포스터 컨셉(뷰파인더·하늘·갈대·종이비행기) 위에 일정·공지·공연·주점을 얹는다.
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createBoothStream,
  createEventStream,
  createNoticeStream,
  fetchActiveNotices,
  fetchBooths,
  fetchEvents,
  recordNoticeView,
} from "../api";
import { IconBox, IconChevronRight } from "../components/UxIcons";
import { CountUp, HeroReeds, IconBeer, IconHeartSaju, Mascot, PaperPlane } from "../components/v2/V2Kit";
import { resolveBoothImageUrl } from "../config/boothImages";
import { TableDots } from "../components/v2/TableMap";
import { FESTIVAL, MAIN_BOOTH_FALLBACK, findMainBooth } from "../config/festival";
import { EVENT_STATUS, normalizeEvents } from "../data/eventExperience";
import { findCardNews, newsForEvent } from "../data/cardNews";
import CardNewsViewer, { CardNewsShelf } from "../components/cardnews/CardNewsViewer";
import HighlightBanner from "../components/cardnews/HighlightBanner";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function toDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDay(date, withWeekday = true) {
  const base = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return withWeekday ? `${base}(${WEEKDAY[date.getDay()]})` : base;
}

function festivalRange() {
  const start = toDate(`${FESTIVAL.startDate}T00:00:00`);
  const end = toDate(`${FESTIVAL.endDate}T00:00:00`);
  if (!start) return "";
  if (!end || dayKey(start) === dayKey(end)) return formatDay(start);
  if (start.getMonth() === end.getMonth()) {
    return `${formatDay(start)} ~ ${end.getDate()}일(${WEEKDAY[end.getDay()]})`;
  }
  return `${formatDay(start)} ~ ${formatDay(end)}`;
}

function relativeTime(at) {
  if (!at) return "확인 중";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 5) return "방금";
  if (seconds < 60) return `${seconds}초 전`;
  return `${Math.floor(seconds / 60)}분 전`;
}

function eventState(event, now) {
  const start = toDate(event.startTime);
  const end = toDate(event.endTime);
  if (!start) return "upcoming";
  if (end && end < now) return "done";
  if (start <= now && (!end || end >= now)) return "live";
  return "upcoming";
}

export default function FestivalPage() {
  const [booths, setBooths] = useState([]);
  const [events, setEvents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [openNoticeId, setOpenNoticeId] = useState(null);
  const [posterOk, setPosterOk] = useState(Boolean(FESTIVAL.posterUrl));
  const [now, setNow] = useState(() => new Date());
  const [boothsUpdatedAt, setBoothsUpdatedAt] = useState(0);
  // 공연 목록은 기본으로 접혀 있다. 지난 공연은 숨기고 진행 중 + 다음 몇 개만 보여 준다.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // 타임테이블에서 고른 날짜. 고르기 전에는 오늘(축제 전이면 첫날)을 보여 준다.
  const [pickedDay, setPickedDay] = useState(null);
  // 총학 카드뉴스 뷰어. 공유 링크(/?news=묶음&p=장)로 들어오면 바로 연다.
  const [searchParams, setSearchParams] = useSearchParams();
  const [cardNews, setCardNews] = useState(null);

  useEffect(() => {
    const id = searchParams.get("news");
    if (!id || !findCardNews(id)) return;
    const page = Math.max(0, (Number(searchParams.get("p")) || 1) - 1);
    setCardNews({ id, page });
    const next = new URLSearchParams(searchParams);
    next.delete("news");
    next.delete("p");
    setSearchParams(next, { replace: true });
    // 처음 들어올 때 한 번만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([fetchBooths(), fetchEvents(), fetchActiveNotices()]).then(
      ([boothResult, eventResult, noticeResult]) => {
        if (!mounted) return;
        if (boothResult.status === "fulfilled" && Array.isArray(boothResult.value)) {
          setBooths(boothResult.value);
          setBoothsUpdatedAt(Date.now());
        }
        if (eventResult.status === "fulfilled" && Array.isArray(eventResult.value)) setEvents(eventResult.value);
        if (noticeResult.status === "fulfilled" && Array.isArray(noticeResult.value)) setNotices(noticeResult.value);
        setLoaded(true);
      },
    );

    const streams = [];
    const subscribe = (factory, name, setter) => {
      try {
        const stream = factory();
        stream.addEventListener(name, (event) => {
          try {
            const next = JSON.parse(event.data);
            if (Array.isArray(next)) setter(next);
          } catch {
            // 잘못된 페이로드는 무시한다.
          }
        });
        streams.push(stream);
      } catch {
        // 스트림은 없어도 화면은 뜬다.
      }
    };
    subscribe(createBoothStream, "booths", (next) => {
      setBooths(next);
      setBoothsUpdatedAt(Date.now());
    });
    subscribe(createEventStream, "events", setEvents);
    subscribe(createNoticeStream, "notices", setNotices);

    const clock = window.setInterval(() => setNow(new Date()), 30000);
    return () => {
      mounted = false;
      streams.forEach((stream) => stream.close());
      window.clearInterval(clock);
    };
  }, []);

  // 서버 일정에 장소·설명을 붙이고, 옛 데모 일정이면 총학 타임테이블로 바꾼다.
  const eventSource = useMemo(() => normalizeEvents(events), [events]);

  const scheduleDays = useMemo(() => {
    const dated = eventSource
      .map((event) => ({ ...event, start: toDate(event.startTime), end: toDate(event.endTime) }))
      .filter((event) => event.start)
      .sort((a, b) => a.start - b.start);
    const days = [...new Set(dated.map((event) => dayKey(event.start)))];
    const today = dayKey(now);
    const forDay = (day) => {
      const items = dated.filter((event) => dayKey(event.start) === day);
      return { day, items, dayLabel: !items.length ? "" : day === today ? "오늘" : formatDay(items[0].start, false) };
    };
    const autoDay = days.includes(today) ? today : days.find((day) => day > today) || days[days.length - 1] || "";
    // 날짜 칩은 축제 기간 것만(예전에 시험 삼아 넣은 일정의 날짜가 칩으로 뜨지 않게). 기간 안에 일정이 없으면 있는 날 전부.
    const inFestival = days.filter((day) => day >= FESTIVAL.startDate && day <= FESTIVAL.endDate);
    const chips = (inFestival.length ? inFestival : days).map((day) => {
      const { items } = forDay(day);
      const date = items[0].start;
      const label = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${WEEKDAY[date.getDay()]}`;
      return { day, label, count: items.length };
    });
    return { auto: forDay(autoDay), chips, forDay };
  }, [eventSource, now]);

  // 상단 통계는 늘 오늘(축제 전이면 첫날) 기준, 타임테이블은 고른 날 기준.
  const todaySchedule = scheduleDays.auto;
  const schedule = useMemo(
    () => (pickedDay && scheduleDays.chips.some((chip) => chip.day === pickedDay) ? scheduleDays.forDay(pickedDay) : scheduleDays.auto),
    [pickedDay, scheduleDays],
  );

  // 운영진이 '취소'로 바꾼 일정은 시간이 됐어도 진행 중으로 세지 않는다.
  const liveCount = schedule.items.filter((event) => event.status !== EVENT_STATUS.CANCELED && eventState(event, now) === "live").length;

  // 접혔을 때 보이는 공연: 진행 중 전부 + 다음 공연 3개. 다 끝났으면 마지막 3개.
  const scheduleParts = useMemo(() => {
    const items = schedule.items.map((event) => ({ event, state: eventState(event, now) }));
    const done = items.filter((entry) => entry.state === "done");
    const live = items.filter((entry) => entry.state === "live");
    const upcoming = items.filter((entry) => entry.state === "upcoming");
    const keepUpcoming = Math.max(0, 3 - live.length);
    let past = done;
    let shown = [...live, ...upcoming.slice(0, keepUpcoming)];
    let later = upcoming.slice(keepUpcoming);
    if (!shown.length && done.length) {
      past = done.slice(0, Math.max(0, done.length - 3));
      shown = done.slice(-3);
    }
    return { past, shown, later, hiddenCount: past.length + later.length };
  }, [schedule.items, now]);

  const festivalStatus = useMemo(() => {
    const start = toDate(`${FESTIVAL.startDate}T00:00:00`);
    const end = toDate(`${FESTIVAL.endDate}T23:59:59`);
    if (!start) return { label: "일정 준비 중", dday: null };
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const dday = Math.round((start - today) / 86400000);
    if (dday > 0) return { label: `D-${dday}`, dday };
    if (end && now > end) return { label: "축제 종료", dday: 0 };
    return { label: "축제 진행 중", dday: 0 };
  }, [now]);

  const mainBooth = findMainBooth(booths);
  // 테이블 기준 빈 자리. 부스 스트림이 밀어 주는 값이라 스태프가 현황판을 누르면 바로 바뀐다.
  const mainBoothSeats = useMemo(() => {
    const total = Number(mainBooth?.reservationTableCount) || 0;
    if (!total) return null;
    const used = (Number(mainBooth?.reservationReservedTables) || 0) + (Number(mainBooth?.reservationInUseTables) || 0);
    return { total, free: Math.max(0, total - used) };
  }, [mainBooth]);
  const activeNotices = notices.filter((notice) => notice.active !== false).slice(0, 3);

  function renderEvent(event, state, index) {
    // 이 일정을 다룬 총학 카드뉴스가 있으면 바로 열 수 있게 한다.
    const newsLinks = newsForEvent(event.title);
    // 운영진이 고른 상태. 취소는 배지로, 지연은 시간 줄에 붙여 보여 준다.
    const canceled = event.status === EVENT_STATUS.CANCELED;
    return (
      <div
        key={event.id || `${event.title}-${index}`}
        className={`v2-timeline__item v2-rise v2-timeline__item--${canceled ? "upcoming" : state}`}
        style={{ "--i": Math.min(index, 6) }}
      >
        <span className="v2-timeline__time">{formatClock(event.start)}</span>
        <div className="v2-timeline__body">
          <strong>{event.title}</strong>
          <small>
            {event.end ? `${formatClock(event.start)} ~ ${formatClock(event.end)}` : "시간 확인 중"}
            {event.stage || event.artist ? ` · ${event.stage || event.artist}` : ""}
            {event.liveMessage && !`${event.liveMessage}`.startsWith("장소") ? ` · ${event.liveMessage}` : ""}
            {Number(event.delayMinutes) > 0 ? ` · ${event.delayMinutes}분 지연` : event.status === EVENT_STATUS.DELAYED ? " · 지연" : ""}
          </small>
          {newsLinks.length ? (
            <div className="cn-links">
              {newsLinks.map((link) => (
                <button key={`${link.set}-${link.index}`} type="button" className="cn-link" onClick={() => setCardNews({ id: link.set, page: link.index })}>
                  {link.label}
                  <IconChevronRight />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {canceled ? <span className="v2-badge v2-badge--red">취소</span> : null}
        {!canceled && state === "live" ? <span className="v2-badge v2-badge--blue">LIVE</span> : null}
        {!canceled && state === "done" ? <span className="v2-badge">종료</span> : null}
      </div>
    );
  }

  return (
    <section className="v2-page" data-i18n-skip>
      <header className="v2-hero">
        {posterOk ? (
          <img className="v2-hero__poster" src={FESTIVAL.posterUrl} alt="" onError={() => setPosterOk(false)} />
        ) : (
          <>
            <div className="v2-hero__sky" aria-hidden="true" />
            <HeroReeds height={160} />
            <PaperPlane className="v2-hero__plane v2-hero__plane--small" />
            <PaperPlane className="v2-hero__plane" />
          </>
        )}
        <div className="v2-hero__fade" aria-hidden="true" />
        <Mascot className="v2-hero__mascot v2-pop" />
        <div className="v2-hero__frame" aria-hidden="true">
          <span />
        </div>

        <div className="v2-hero__top">
          <span className="v2-hero__rec">REC</span>
          <div className="v2-hero__meta">
            <span>{FESTIVAL.title}</span>
            <span>
              {FESTIVAL.place} · @{FESTIVAL.instagram}
            </span>
          </div>
        </div>

        <div className="v2-hero__body">
          <span className="v2-hero__eyebrow v2-rise" style={{ "--i": 0 }}>
            {festivalStatus.label}
          </span>
          <h1 className="v2-rise" style={{ "--i": 1 }}>
            {FESTIVAL.name}
            <small>{FESTIVAL.tagline}</small>
          </h1>
          <p className="v2-rise" style={{ "--i": 2 }}>
            {festivalRange()} · {FESTIVAL.place}
          </p>
        </div>

        <div className="v2-hero__stats">
          <div className="v2-stat v2-rise" style={{ "--i": 3 }}>
            <small>축제까지</small>
            <strong>
              {festivalStatus.dday > 0 ? <CountUp value={festivalStatus.dday} suffix="일" /> : festivalStatus.label}
            </strong>
          </div>
          <div className="v2-stat v2-rise" style={{ "--i": 4 }}>
            <small>{todaySchedule.dayLabel || "오늘"} 공연</small>
            <strong>
              <CountUp value={todaySchedule.items.length} suffix="개" />
            </strong>
          </div>
          <div className="v2-stat v2-rise" style={{ "--i": 5 }}>
            <small>지금 진행 중</small>
            <strong>
              <CountUp value={liveCount} suffix="개" />
            </strong>
          </div>
        </div>
      </header>

      <nav className="v2-quick v2-section" aria-label="바로가기">
        <Link to="/booths" className="v2-quick__item v2-rise" style={{ "--i": 4 }}>
          <span>
            <IconBeer />
          </span>
          총학 주점
        </Link>
        <Link to="/ai-match" className="v2-quick__item v2-rise" style={{ "--i": 5 }}>
          <span>
            <IconHeartSaju />
          </span>
          사주 소개팅
        </Link>
        <Link to="/lost-found" className="v2-quick__item v2-rise" style={{ "--i": 6 }}>
          <span>
            <IconBox />
          </span>
          분실물
        </Link>
      </nav>

      <HighlightBanner now={now} paused={Boolean(cardNews)} onOpen={(id, page) => setCardNews({ id, page })} />

      <section className="v2-section">
        <div className="v2-section__head">
          <h2>축제 소식</h2>
          <span>총학생회 카드뉴스</span>
        </div>
        <CardNewsShelf onOpen={(id, page) => setCardNews({ id, page })} />
      </section>

      {activeNotices.length > 0 && (
        <section className="v2-section">
          <div className="v2-section__head">
            <h2>공지</h2>
            <span>{activeNotices.length}건</span>
          </div>
          {activeNotices.map((notice, index) => {
            const open = openNoticeId === notice.id;
            return (
              <button
                key={notice.id}
                type="button"
                className={`v2-notice v2-card--press v2-rise${open ? " v2-notice--open" : ""}`}
                style={{ "--i": index + 6, border: 0, width: "100%", textAlign: "left" }}
                onClick={() => {
                  setOpenNoticeId(open ? null : notice.id);
                  if (!open) recordNoticeView(notice.id);
                }}
              >
                <span className="v2-notice__tag">{notice.category || "안내"}</span>
                <div className="v2-notice__body">
                  <strong>{notice.title}</strong>
                  {notice.content ? <p>{notice.content}</p> : null}
                </div>
              </button>
            );
          })}
        </section>
      )}

      <section className="v2-section">
        <div className="v2-section__head">
          <h2>총학 주점</h2>
          <span>
            {`${mainBooth?.openTime || MAIN_BOOTH_FALLBACK.openTime}`.slice(0, 5)} ~ {`${mainBooth?.closeTime || MAIN_BOOTH_FALLBACK.closeTime}`.slice(0, 5)}
          </span>
        </div>
        <Link to={mainBooth ? `/booths/${mainBooth.id}` : "/booths"} className="v2-main-booth v2-rise" style={{ "--i": 6 }}>
          <img src={mainBooth ? resolveBoothImageUrl(mainBooth) : resolveBoothImageUrl(null)} alt="" />
          <span className="v2-badge v2-badge--blue">
            {mainBooth?.liveStatusMessage ? mainBooth.liveStatusMessage : "테이블 QR로 자리에서 주문"}
          </span>
          <div>
            <strong>{mainBooth?.name || MAIN_BOOTH_FALLBACK.name}</strong>
            <p>{mainBooth?.description || mainBooth?.boothIntro || MAIN_BOOTH_FALLBACK.description}</p>
            {mainBoothSeats ? (
              <span className={`v2-main-booth__seats${mainBoothSeats.free === 0 ? " is-full" : ""}`}>
                {mainBoothSeats.free === 0 ? "지금 만석" : `빈 테이블 ${mainBoothSeats.free}/${mainBoothSeats.total}`}
                <TableDots free={mainBoothSeats.free} total={mainBoothSeats.total} />
                <small style={{ fontWeight: 500, color: "var(--v2-text-3)" }}>· {relativeTime(boothsUpdatedAt)}</small>
              </span>
            ) : null}
          </div>
        </Link>
      </section>

      <section className="v2-section" id="festival-schedule">
        <div className="v2-section__head">
          <h2>{schedule.dayLabel ? `${schedule.dayLabel} 공연` : "공연"}</h2>
          {liveCount > 0 ? <span className="v2-badge v2-badge--blue v2-badge--live">진행 중</span> : null}
        </div>
        {scheduleDays.chips.length > 1 ? (
          <div className="v2-chips cn-shelf-chips" role="group" aria-label="날짜 고르기">
            {scheduleDays.chips.map((chip) => (
              <button
                key={chip.day}
                type="button"
                className={`v2-chip${schedule.day === chip.day ? " v2-chip--active" : ""}`}
                aria-pressed={schedule.day === chip.day}
                onClick={() => {
                  setPickedDay(chip.day);
                  // 다른 날을 골라 볼 때는 그날 일정을 다 펼쳐 보여 준다. 오늘(기본)로 돌아오면 다시 접는다.
                  setScheduleOpen(chip.day !== todaySchedule.day);
                }}
              >
                {chip.label}
                <small>{chip.count}</small>
              </button>
            ))}
          </div>
        ) : null}
        {!loaded && !schedule.items.length ? (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            <div className="v2-skeleton" style={{ height: "3.2rem" }} />
            <div className="v2-skeleton" style={{ height: "3.2rem" }} />
          </div>
        ) : schedule.items.length ? (
          <>
            <div className="v2-timeline">
              {scheduleParts.past.length > 0 ? (
                <div className={`v2-collapse${scheduleOpen ? " v2-collapse--open" : ""}`}>
                  <div>{scheduleParts.past.map((entry, index) => renderEvent(entry.event, entry.state, index))}</div>
                </div>
              ) : null}
              {!scheduleOpen && scheduleParts.past.length > 0 ? (
                <button type="button" className="v2-timeline__more" onClick={() => setScheduleOpen(true)}>
                  지난 공연 {scheduleParts.past.length}개 보기
                </button>
              ) : null}
              {scheduleParts.shown.map((entry, index) => renderEvent(entry.event, entry.state, index))}
              {scheduleParts.later.length > 0 ? (
                <div className={`v2-collapse${scheduleOpen ? " v2-collapse--open" : ""}`}>
                  <div>{scheduleParts.later.map((entry, index) => renderEvent(entry.event, entry.state, index))}</div>
                </div>
              ) : null}
            </div>
            {scheduleParts.hiddenCount > 0 ? (
              <button
                type="button"
                className={`v2-btn v2-btn--gray v2-btn--sm v2-toggle${scheduleOpen ? " v2-toggle--open" : ""}`}
                style={{ width: "100%", marginTop: "0.75rem" }}
                onClick={() => setScheduleOpen((open) => !open)}
                aria-expanded={scheduleOpen}
              >
                {scheduleOpen ? "접기" : `전체 ${schedule.items.length}개 공연 보기`}
                <IconChevronRight className="v2-toggle__chev" />
              </button>
            ) : null}
          </>
        ) : (
          <div className="v2-empty">
            <Mascot kind="flame" className="v2-empty__mascot" />
            <strong>공연 일정이 아직 없어요</strong>
            <p>일정이 올라오면 여기서 바로 보여드릴게요.</p>
          </div>
        )}
      </section>

      <div className="v2-divider--thick" />

      <section className="v2-section" style={{ marginTop: 0 }}>
        <Link to="/lost-found" className="v2-row">
          <span className="v2-row__icon v2-row__icon--blue">
            <IconBox />
          </span>
          <span className="v2-row__body">
            <strong>물건을 잃어버렸다면</strong>
            <small>분실물 센터에 들어온 물건을 바로 확인해요</small>
          </span>
          <span className="v2-row__trail">
            <IconChevronRight />
          </span>
        </Link>
        <Link to="/ai-match" className="v2-row">
          <span className="v2-row__icon v2-row__icon--yellow">
            <IconHeartSaju />
          </span>
          <span className="v2-row__body">
            <strong>사주로 보는 축제 인연</strong>
            <small>생년월일만 넣으면 궁합 점수까지 나와요</small>
          </span>
          <span className="v2-row__trail">
            <IconChevronRight />
          </span>
        </Link>
      </section>

      {FESTIVAL.siteContact?.phone ? (
        <footer className="v2-contact">
          사이트 이용 중 오류나 문의는
          <br />
          {FESTIVAL.siteContact.role} {FESTIVAL.siteContact.name}{" "}
          <a href={`tel:${FESTIVAL.siteContact.phone.replace(/[^0-9+]/g, "")}`}>{FESTIVAL.siteContact.phone}</a>
        </footer>
      ) : null}

      {/* 만든 사람. 홈에만 작게 둔다. */}
      <p className="v2-credit">© 2026 바람 · made by 정재훈</p>

      {cardNews ? (
        <CardNewsViewer key={cardNews.id} setId={cardNews.id} startIndex={cardNews.page} onClose={() => setCardNews(null)} />
      ) : null}
    </section>
  );
}
