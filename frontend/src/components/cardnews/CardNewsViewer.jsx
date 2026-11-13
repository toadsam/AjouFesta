// 카드뉴스 뷰어. 첫 장은 카메라 뷰파인더, 나머지는 사진 앱 화면(뒤로 · 오늘 · 공유 · 좋아요 · 정보 · 필터 · 휴지통) 위의 유리 카드.
// 옆으로 밀어 넘긴다(scroll-snap). 앱 전역 CSS 를 피하려고 body 로 포털한다. 휴대폰 뒤로 가기를 누르면 닫힌다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CARD_NEWS, CARD_NEWS_IMG, NEWS_DAY_FILTERS, PAGE_INFO, PAGE_TITLES, cardNewsDayKey, findCardNews } from "../../data/cardNews";
import { CnIcon, OutlineText, StarDust } from "./CardNewsArt";
import {
  BoothMapPage,
  ContactPage,
  CoverPage,
  GoodsPage,
  GoodsPlacePage,
  KeyringPage,
  LeafletPage,
  SumSajuPage,
  TattooPage,
  TeePage,
  WishStampPage,
} from "./CardNewsPages";
import {
  BarRulesPage,
  BarrierAboutPage,
  BarrierMapPage,
  BarrierNotesPage,
  BarrierStepsPage,
  PhotoFramePage,
  PhotoPlacePage,
  StageBannedPage,
  StageEntryPage,
  StageEtcPage,
  StageQueuePage,
  StageTeamsPage,
} from "./CardNewsPages2";
import {
  AroInfoPage,
  AroMenuPage,
  AroPubPage,
  ArtistInfoPage,
  CheerOtPage,
  CheerPlaylistPage,
  CheerSloganPage,
  CheerTorchPage,
  RunCoursePage,
  RunInfoPage,
  RunItemsPage,
  SuclEventPage,
  SuclFinalPage,
} from "./CardNewsPages3";

const PAGES = {
  "booth-map": BoothMapPage,
  goods: GoodsPage,
  leaflet: LeafletPage,
  tattoo: TattooPage,
  "wish-stamp": WishStampPage,
  "sum-saju": SumSajuPage,
  contact: ContactPage,
  "goods-place": GoodsPlacePage,
  tee: TeePage,
  keyring: KeyringPage,
  "stage-entry": StageEntryPage,
  "stage-queue": StageQueuePage,
  "stage-teams": StageTeamsPage,
  "stage-banned": StageBannedPage,
  "stage-etc": StageEtcPage,
  "barrier-about": BarrierAboutPage,
  "barrier-steps": BarrierStepsPage,
  "barrier-map": BarrierMapPage,
  "barrier-notes": BarrierNotesPage,
  "photo-place": PhotoPlacePage,
  "photo-frame": PhotoFramePage,
  "bar-rules": BarRulesPage,
  "artist-info": ArtistInfoPage,
  "aro-info": AroInfoPage,
  "aro-pub": AroPubPage,
  "aro-menu": AroMenuPage,
  "run-info": RunInfoPage,
  "run-course": RunCoursePage,
  "run-items": RunItemsPage,
  "sucl-final": SuclFinalPage,
  "sucl-event": SuclEventPage,
  "cheer-playlist": CheerPlaylistPage,
  "cheer-ot": CheerOtPage,
  "cheer-torch": CheerTorchPage,
  "cheer-slogan": CheerSloganPage,
};

// 사진 앱 '필터' 버튼: 하늘 색을 바꾼다.
const FILTERS = [
  { key: "sky", label: "기본" },
  { key: "dusk", label: "노을" },
  { key: "night", label: "밤하늘" },
];

const LIKE_KEY = "festflow.cardnews.likes";

function readLikes() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(LIKE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function writeLikes(set) {
  try {
    window.localStorage.setItem(LIKE_KEY, JSON.stringify([...set]));
  } catch {
    // 저장이 막혀도 이번 화면에서는 켜져 보인다.
  }
}

function timeLabel(date) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${m}`;
}

export function shareUrl(setId, index = 0) {
  const url = new URL(window.location.origin + "/");
  url.searchParams.set("news", setId);
  if (index) url.searchParams.set("p", String(index + 1));
  return url.toString();
}

export default function CardNewsViewer({ setId, startIndex = 0, onClose }) {
  const navigate = useNavigate();
  const [currentSetId, setCurrentSetId] = useState(setId);
  const set = findCardNews(currentSetId) || CARD_NEWS[0];
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), set.pages.length - 1));
  const [filter, setFilter] = useState(0);
  const [likes, setLikes] = useState(readLikes);
  const [burst, setBurst] = useState(0);
  const [panel, setPanel] = useState(null); // "info" | "menu"
  const [toast, setToast] = useState(null);
  const [wobble, setWobble] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [leaving, setLeaving] = useState(false);
  const trackRef = useRef(null);
  const pushedRef = useRef(false);
  const toastTimer = useRef(0);
  const pendingJump = useRef(null);

  const pageKey = set.pages[index];
  const likeId = `${set.id}:${pageKey}`;
  const liked = likes.has(likeId);

  const showToast = useCallback((text) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  // 닫기: 우리가 넣은 방문 기록이 있으면 뒤로 가기로 닫아 기록을 깨끗이 둔다.
  const requestClose = useCallback(() => {
    if (pushedRef.current) {
      window.history.back();
      return;
    }
    setLeaving(true);
    window.setTimeout(() => onClose?.(), 220);
  }, [onClose]);

  useEffect(() => {
    try {
      window.history.pushState({ ...(window.history.state || {}), festflowCardNews: true }, "");
      pushedRef.current = true;
    } catch {
      pushedRef.current = false;
    }
    const onPop = () => {
      pushedRef.current = false;
      setLeaving(true);
      window.setTimeout(() => onClose?.(), 220);
    };
    window.addEventListener("popstate", onPop);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const clock = window.setInterval(() => setNow(new Date()), 20000);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = previous;
      window.clearInterval(clock);
      window.clearTimeout(toastTimer.current);
    };
    // onClose 는 열릴 때 한 번만 묶는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback((next, smooth = true) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(next, track.children.length - 1));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // 처음 열 때와 묶음을 바꿀 때 해당 장으로 바로 이동
  useEffect(() => {
    const target = pendingJump.current ?? index;
    pendingJump.current = null;
    requestAnimationFrame(() => goTo(target, false));
    setIndex(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSetId]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        if (panel) setPanel(null);
        else requestClose();
      }
      if (event.key === "ArrowRight") goTo(index + 1);
      if (event.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, panel, requestClose]);

  function onScroll(event) {
    const track = event.currentTarget;
    const next = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    if (next !== index) {
      setIndex(next);
      setPanel(null);
    }
  }

  function toggleLike() {
    const next = new Set(likes);
    if (next.has(likeId)) next.delete(likeId);
    else {
      next.add(likeId);
      setBurst(Date.now());
    }
    setLikes(next);
    writeLikes(next);
    try {
      navigator.vibrate?.(8);
    } catch {
      // 무시
    }
  }

  async function share() {
    const url = shareUrl(set.id, index);
    const title = `바람 · ${set.title} — ${PAGE_TITLES[pageKey] || ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: PAGE_INFO[pageKey] || title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("링크를 복사했어요");
    } catch (error) {
      if (error?.name !== "AbortError") showToast("공유하지 못했어요");
    }
  }

  function cycleFilter() {
    const next = (filter + 1) % FILTERS.length;
    setFilter(next);
    showToast(`필터 · ${FILTERS[next].label}`);
  }

  function trash() {
    setWobble(Date.now());
    showToast("바람은 지울 수 없어요. 축제에서 만나요!");
    try {
      navigator.vibrate?.([12, 50, 12]);
    } catch {
      // 무시
    }
  }

  function jump(targetSet, targetPage) {
    const target = findCardNews(targetSet);
    if (!target) return;
    const pageIndex = Math.max(0, target.pages.indexOf(targetPage));
    setPanel(null);
    if (target.id === set.id) {
      goTo(pageIndex);
      return;
    }
    pendingJump.current = pageIndex;
    setCurrentSetId(target.id);
  }

  // 다른 화면으로 갈 때는 뷰어가 넣은 기록 자리를 그 화면으로 바꿔 끼운다(뒤로 가기 하면 첫 화면).
  function leaveTo(path) {
    pushedRef.current = false;
    onClose?.();
    navigate(path, { replace: true });
  }

  const onCover = pageKey === "cover";
  const pages = useMemo(() => set.pages, [set]);

  const node = (
    <div
      className={`cn-viewer cn-theme--${FILTERS[filter].key}${set.tone ? ` cn-tone--${set.tone}` : ""}${leaving ? " is-leaving" : ""}${onCover ? " is-cover" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${set.title} 카드뉴스`}
      data-i18n-skip
    >
      <div className="cn-viewer__bg" aria-hidden="true">
        <div className="cn-viewer__paper" />
        <StarDust seed={2} dust={80} glow={8} className="cn-viewer__stars" />
      </div>

      <div className="cn-viewer__column">
        <div className="cn-track" ref={trackRef} onScroll={onScroll}>
          {pages.map((key, i) => {
            const Page = PAGES[key];
            const active = i === index;
            return (
              <section
                key={`${set.id}-${key}-${i}`}
                className={`cn-slide${active ? " is-active" : ""}${key === "cover" ? " cn-slide--cover" : ""}`}
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${pages.length} · ${PAGE_TITLES[key]}`}
                aria-hidden={!active}
              >
                {key === "cover" ? (
                  <CoverPage set={set} active={active} onMenu={() => setPanel("menu")} onFilter={cycleFilter} />
                ) : Page ? (
                  <div key={active && wobble ? wobble : "still"} className={`cn-slide__card${active && wobble ? " is-wobble" : ""}`}>
                    <Page
                      active={active}
                      onJump={jump}
                      onGo={() => leaveTo("/ai-match")}
                      onLeave={leaveTo}
                      onSchedule={() => {
                        requestClose();
                        window.setTimeout(() => document.getElementById("festival-schedule")?.scrollIntoView({ behavior: "smooth", block: "start" }), 380);
                      }}
                    />
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {/* 사진 앱 윗줄 */}
        <div className="cn-chrome cn-chrome--top">
          <button type="button" className="cn-glass cn-glass--round" aria-label="닫기" onClick={requestClose}>
            <CnIcon.back />
          </button>
          <div className="cn-glass cn-glass--pill cn-chrome__when">
            <b>오늘</b>
            <span>{timeLabel(now)}</span>
          </div>
          <button type="button" className="cn-glass cn-glass--round" aria-label="목록" onClick={() => setPanel(panel === "menu" ? null : "menu")}>
            <CnIcon.more />
          </button>
        </div>

        {/* 표지에서도 닫을 수 있게 */}
        <button type="button" className="cn-cover-close" aria-label="닫기" onClick={requestClose}>
          <CnIcon.close />
        </button>

        <div className="cn-dots" aria-hidden="true">
          {pages.map((key, i) => (
            <button key={key + i} type="button" tabIndex={-1} className={i === index ? "is-on" : ""} onClick={() => goTo(i)} />
          ))}
        </div>

        {/* 사진 앱 아랫줄 */}
        <div className="cn-chrome cn-chrome--bottom">
          <button type="button" className="cn-glass cn-glass--round" aria-label="공유" onClick={share}>
            <CnIcon.share />
          </button>
          <div className="cn-glass cn-glass--pill cn-chrome__tools">
            <button type="button" aria-label={liked ? "좋아요 취소" : "좋아요"} aria-pressed={liked} className={`cn-like${liked ? " is-on" : ""}`} onClick={toggleLike}>
              <CnIcon.heart filled={liked} />
              {burst ? (
                <span key={burst} className="cn-like__burst" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <i key={i} style={{ "--a": `${i * 45}deg` }} />
                  ))}
                </span>
              ) : null}
            </button>
            <button type="button" aria-label="정보" aria-pressed={panel === "info"} className={panel === "info" ? "is-on" : ""} onClick={() => setPanel(panel === "info" ? null : "info")}>
              <CnIcon.info />
            </button>
            <button type="button" aria-label={`필터 바꾸기 (지금 ${FILTERS[filter].label})`} onClick={cycleFilter}>
              <CnIcon.sliders />
            </button>
          </div>
          <button type="button" className="cn-glass cn-glass--round" aria-label="지우기" onClick={trash}>
            <CnIcon.trash />
          </button>
        </div>

        {panel === "info" ? (
          <div className="cn-panelsheet" role="note">
            <strong>{PAGE_TITLES[pageKey]}</strong>
            <p>{PAGE_INFO[pageKey]}</p>
          </div>
        ) : null}

        {panel === "menu" ? (
          <div className="cn-menu" role="menu">
            <div className="cn-menu__head">
              <strong>{set.title}</strong>
              <button type="button" aria-label="닫기" onClick={() => setPanel(null)}>
                <CnIcon.close />
              </button>
            </div>
            <ol>
              {pages.map((key, i) => (
                <li key={key + i}>
                  <button
                    type="button"
                    role="menuitem"
                    className={i === index ? "is-on" : ""}
                    onClick={() => {
                      setPanel(null);
                      goTo(i);
                    }}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {PAGE_TITLES[key]}
                  </button>
                </li>
              ))}
            </ol>
            <div className="cn-menu__others">
              {CARD_NEWS.filter((other) => other.id !== set.id).map((other) => (
                <button key={other.id} type="button" onClick={() => jump(other.id, "cover")}>
                  다른 소식 · {other.title} <CnIcon.arrow />
                </button>
              ))}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl(set.id, index));
                    showToast("링크를 복사했어요");
                  } catch {
                    showToast("복사하지 못했어요");
                  }
                  setPanel(null);
                }}
              >
                이 장 링크 복사
              </button>
            </div>
          </div>
        ) : null}

        {toast ? (
          <div key={toast.key} className="cn-toast" role="status" aria-live="polite">
            {toast.text}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

/* ---------- 첫 화면 진열대: 표지 미니어처를 가로로 ---------- */
function shelfLines(set) {
  return set.shelfTitle || set.cover?.lines || [set.title];
}

function shortDate(set) {
  const date = set.cover?.date || "";
  if (date.includes("-")) return "10.07 – 10.08";
  return date.replace(/\s/g, "").replace(/\.?\(/, " (");
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function CardNewsShelf({ onOpen }) {
  // 축제 당일에는 그날 소식부터 보여 준다. 그 밖의 날은 전체.
  const [day, setDay] = useState(() => {
    const today = todayKey();
    return NEWS_DAY_FILTERS.some((item) => item.key === today) ? today : "all";
  });
  const [picked, setPicked] = useState(false);
  const shelfRef = useRef(null);
  const sets = day === "all" ? CARD_NEWS : CARD_NEWS.filter((set) => cardNewsDayKey(set) === day);

  function pick(next) {
    setDay(next);
    setPicked(true);
    shelfRef.current?.scrollTo({ left: 0 });
  }

  return (
    <>
      <div className="v2-chips cn-shelf-chips" role="group" aria-label="날짜로 골라 보기">
        {NEWS_DAY_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`v2-chip${day === item.key ? " v2-chip--active" : ""}`}
            aria-pressed={day === item.key}
            onClick={() => pick(item.key)}
          >
            {item.label}
            <small>{item.key === "all" ? CARD_NEWS.length : CARD_NEWS.filter((set) => cardNewsDayKey(set) === item.key).length}</small>
          </button>
        ))}
      </div>
      <div className="cn-shelf" role="list" ref={shelfRef}>
        {sets.map((set, i) => (
          <button key={set.id} type="button" role="listitem" className="cn-shelf__item v2-rise" style={{ "--i": (picked ? 0 : 4) + i }} onClick={() => onOpen(set.id, 0)}>
            {set.cover?.thumb ? (
              <span className="cn-mini cn-mini--photo" aria-hidden="true">
                <img className="cn-mini__photo" src={`${CARD_NEWS_IMG}/${set.cover.thumb}.webp`} alt="" loading="lazy" />
              </span>
            ) : (
            <span className={`cn-mini${set.tone ? ` cn-mini--${set.tone}` : ""}`} aria-hidden="true">
              <span className="cn-mini__paper" />
              <StarDust seed={11 + CARD_NEWS.indexOf(set)} dust={40} glow={4} className="cn-mini__stars" />
              <span className="cn-mini__grid">
                <i /><i /><i /><i />
              </span>
              <span className="cn-mini__brand">
                <small>2026 아주대학교 가을축제</small>
                <b>바람</b>
              </span>
              <img className="cn-mini__bird" src={`${CARD_NEWS_IMG}/bird.webp`} alt="" />
              <span className="cn-mini__focus" />
              <span className="cn-mini__title" style={{ "--len": Math.max(...shelfLines(set).map((line) => line.length)) }}>
                {shelfLines(set).map((line) => (
                  <OutlineText key={line}>{line}</OutlineText>
                ))}
              </span>
              <span className="cn-mini__date">{shortDate(set)}</span>
            </span>
            )}
            <span className="cn-shelf__meta">
              <strong>{set.title}</strong>
              <small>{set.pages.length}장 · 넘겨 보기</small>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
