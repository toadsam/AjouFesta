// 주점 탭. 부스 목록을 검색·카테고리로 고르고 상세로 들어간다.
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { createBoothStream, fetchBooths } from "../api";
import { IconChevronRight, IconSearch, IconX } from "../components/UxIcons";
import { DishGrid, DishSheet } from "../components/v2/DishGrid";
import { IconBeer, Mascot } from "../components/v2/V2Kit";
import { resolveBoothImageUrl } from "../config/boothImages";
import { FESTIVAL, MAIN_BOOTH_FALLBACK, findMainBooth } from "../config/festival";
import { fallbackBooths } from "../data/festivalUiData";

function minutesOf(value) {
  const text = `${value || ""}`;
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 운영 시간이 둘 다 있을 때만 판단한다. 자정을 넘기는 시간대도 처리한다. */
export function isOpenNow(booth, now = new Date()) {
  const open = minutesOf(booth?.openTime);
  const close = minutesOf(booth?.closeTime);
  if (open === null || close === null) return null;
  const current = now.getHours() * 60 + now.getMinutes();
  if (open === close) return true;
  if (open < close) return current >= open && current < close;
  return current >= open || current < close;
}

function timeRange(booth) {
  if (!booth?.openTime && !booth?.closeTime) return "";
  const cut = (value) => `${value || "--:--"}`.slice(0, 5);
  return `${cut(booth.openTime)} ~ ${cut(booth.closeTime)}`;
}

function waitLabel(booth) {
  const value = Number(booth?.estimatedWaitMinutes);
  if (!Number.isFinite(value)) return "대기 확인 중";
  if (value <= 0) return "바로 입장";
  return `대기 ${value}분`;
}

function seatLabel(booth) {
  if (booth?.reservationEnabled === false) return "";
  const seats = Number(booth?.reservationAvailableSeats);
  if (!Number.isFinite(seats)) return "";
  return seats > 0 ? `예약 ${seats}석` : "예약 마감";
}

/** 서버에 총학 주점이 아직 없을 때 보여 주는 화면. 메뉴는 config/festival.js 의 기본값. */
function MainBoothPreview({ loading = false }) {
  const [dish, setDish] = useState(null);
  return (
    <section className="v2-page" data-i18n-skip>
      <div className="v2-title v2-title--row">
        <div>
          <h1>{MAIN_BOOTH_FALLBACK.name}</h1>
          <p>{MAIN_BOOTH_FALLBACK.description}</p>
        </div>
        <Mascot style={{ width: "3.6rem", height: "auto", flex: "0 0 auto" }} />
      </div>
      <div className="v2-seats v2-seats--none">
        <div>
          <span className="v2-seats__label">지금 빈 자리</span>
          <strong>{loading ? "불러오는 중…" : "자리 정보 준비 중"}</strong>
          <p>{loading ? "서버에서 자리 정보를 받아오고 있어요." : "운영진이 테이블을 등록하면 실시간으로 보여요."}</p>
        </div>
      </div>
      <section className="v2-section">
        <div className="v2-section__head">
          <h2>메뉴</h2>
          <span>{MAIN_BOOTH_FALLBACK.menu.length}개</span>
        </div>
        <DishGrid items={MAIN_BOOTH_FALLBACK.menu} onSelect={setDish} />
        <p className="v2-note" style={{ marginTop: "0.9rem" }}>
          운영 콘솔에서 이름에 &quot;{FESTIVAL.mainBoothKeyword}&quot;이 들어간 부스를 만들면 실제 메뉴판·사진·자리 예약이 이 자리에 붙어요.
        </p>
      </section>
      <DishSheet dish={dish} onClose={() => setDish(null)} />
    </section>
  );
}

export default function BoothListPage() {
  const location = useLocation();
  // 이번 축제는 주점이 하나라 /booths 는 총학 주점으로 바로 간다. /booths/all 만 전체 목록.
  const showAll = location.pathname.endsWith("/all");
  const [booths, setBooths] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let mounted = true;
    fetchBooths()
      .then((data) => {
        if (!mounted) return;
        setBooths(Array.isArray(data) ? data : []);
        setFailed(false);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    let stream = null;
    try {
      stream = createBoothStream();
      stream.addEventListener("booths", (event) => {
        try {
          const next = JSON.parse(event.data);
          if (Array.isArray(next)) setBooths(next);
        } catch {
          // 잘못된 페이로드는 무시한다.
        }
      });
    } catch {
      // 스트림은 없어도 된다.
    }

    const clock = window.setInterval(() => setNow(new Date()), 60000);
    return () => {
      mounted = false;
      stream?.close();
      window.clearInterval(clock);
    };
  }, []);

  const source = booths.length ? booths : failed ? fallbackBooths : [];

  const categories = useMemo(() => {
    const set = new Set();
    source.forEach((booth) => {
      const value = `${booth.category || ""}`.trim();
      if (value) set.add(value);
    });
    return ["전체", ...set];
  }, [source]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return [...source]
      .filter((booth) => category === "전체" || `${booth.category || ""}`.trim() === category)
      .filter((booth) => {
        if (!keyword) return true;
        return [booth.name, booth.description, booth.boothIntro, booth.tags, booth.category]
          .some((field) => `${field || ""}`.toLowerCase().includes(keyword));
      })
      .sort((a, b) => {
        const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 9999;
        const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return `${a.name || ""}`.localeCompare(`${b.name || ""}`, "ko");
      });
  }, [source, category, query]);

  const openCount = source.filter((booth) => isOpenNow(booth, now) !== false).length;
  const mainBooth = findMainBooth(booths);

  if (!showAll) {
    if (mainBooth) return <Navigate to={`/booths/${mainBooth.id}`} replace />;
    // 서버가 느리거나 죽어도 화면이 비지 않게, 기다리는 동안에도 미리보기를 먼저 보여 준다.
    return <MainBoothPreview loading={!loaded} />;
  }

  return (
    <section className="v2-page" data-i18n-skip>
      <div className="v2-title v2-title--row">
        <div>
          <h1>주점</h1>
          <p>{loaded ? `${openCount}곳이 열려 있어요` : "부스를 불러오는 중이에요"}</p>
        </div>
      </div>

      <label className="v2-search">
        <IconSearch />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="주점 이름, 메뉴, 태그 검색"
          aria-label="주점 검색"
        />
        {query ? (
          <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")}>
            <IconX />
          </button>
        ) : null}
      </label>

      {categories.length > 2 && (
        <div className="v2-chips" style={{ marginTop: "0.85rem" }}>
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={`v2-chip${category === item ? " v2-chip--active" : ""}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {failed && <p className="v2-note">실시간 부스 정보를 불러오지 못해 기본 목록을 보여드려요.</p>}

      <div className="v2-booth-list" style={{ marginTop: "1rem" }}>
        {!loaded && !visible.length
          ? [0, 1, 2, 3].map((index) => (
              <div key={index} className="v2-skeleton" style={{ height: "6.9rem", borderRadius: 20 }} />
            ))
          : visible.map((booth, index) => {
              const open = isOpenNow(booth, now);
              const wait = Number(booth.estimatedWaitMinutes) || 0;
              const seats = seatLabel(booth);
              const range = timeRange(booth);
              return (
                <Link
                  key={booth.id}
                  to={`/booths/${booth.id}`}
                  className="v2-booth v2-rise"
                  style={{ "--i": Math.min(index, 8) }}
                >
                  <span className={`v2-booth__thumb${open === false ? " v2-booth__thumb--closed" : ""}`}>
                    <img src={resolveBoothImageUrl(booth)} alt="" loading="lazy" />
                  </span>
                  <span className="v2-booth__body">
                    <span className="v2-booth__tags">
                      {open === false ? (
                        <span className="v2-badge">운영 전 · 종료</span>
                      ) : open === true ? (
                        <span className="v2-badge v2-badge--green v2-badge--live">운영 중</span>
                      ) : null}
                      {booth.category ? <span className="v2-badge">{booth.category}</span> : null}
                    </span>
                    <strong>{booth.name}</strong>
                    <p>{booth.description || booth.boothIntro || "메뉴와 자리를 확인해 보세요"}</p>
                    <span className="v2-booth__meta">
                      <em className={wait >= 30 ? "is-busy" : ""}>{waitLabel(booth)}</em>
                      {seats ? <span>{seats}</span> : null}
                      {range ? <span>{range}</span> : null}
                    </span>
                    {booth.liveStatusMessage ? <p className="v2-booth__live">{booth.liveStatusMessage}</p> : null}
                  </span>
                  <span className="v2-row__trail">
                    <IconChevronRight />
                  </span>
                </Link>
              );
            })}
        {loaded && !visible.length && (
          <div className="v2-empty">
            <span className="v2-empty__icon">
              <IconBeer />
            </span>
            <strong>{query || category !== "전체" ? "조건에 맞는 주점이 없어요" : "등록된 주점이 아직 없어요"}</strong>
            <p>{query || category !== "전체" ? "검색어나 카테고리를 바꿔 보세요." : "운영진이 등록하면 바로 보여드릴게요."}</p>
          </div>
        )}
      </div>
    </section>
  );
}
