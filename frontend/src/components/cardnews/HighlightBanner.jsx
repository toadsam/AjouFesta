// 첫 화면 하이라이트 배너. 고른 소식 몇 장이 5초마다 옆으로 넘어간다.
// 손으로 밀 수 있고, 손을 대면 잠깐 멈춘다. 축제 당일에는 그날 소식만 나온다(data/cardNews.js 의 highlightsFor).
import { useEffect, useRef, useState } from "react";
import { CARD_NEWS_IMG, findCardNews, highlightsFor } from "../../data/cardNews";
import { IconChevronRight } from "../UxIcons";
import { StarDust } from "./CardNewsArt";

const ROTATE_MS = 5000;
const HOLD_MS = 8000;
const img = (name) => `${CARD_NEWS_IMG}/${name}.webp`;

export default function HighlightBanner({ now, paused = false, onOpen }) {
  const { today, items } = highlightsFor(now);
  const listKey = items.map((item) => item.id).join(",");
  const [index, setIndex] = useState(0);
  const trackRef = useRef(null);
  const indexRef = useRef(0);
  const holdRef = useRef(0);

  function show(next, smooth = true) {
    const track = trackRef.current;
    const first = track?.children[0];
    const target = track?.children[next];
    if (!track || !first || !target) return;
    // 가로로만 민다(scrollIntoView 는 화면 전체를 끌고 간다).
    track.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: smooth ? "smooth" : "auto" });
    indexRef.current = next;
    setIndex(next);
  }

  // 날이 바뀌거나 끝난 행사가 뒤로 가서 목록이 달라지면 처음부터.
  useEffect(() => {
    show(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  useEffect(() => {
    if (paused || items.length < 2) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden || Date.now() < holdRef.current) return;
      show((indexRef.current + 1) % items.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, items.length, listKey]);

  function onScroll(event) {
    const track = event.currentTarget;
    const step = track.children.length > 1 ? track.children[1].offsetLeft - track.children[0].offsetLeft : track.clientWidth;
    const next = Math.max(0, Math.min(items.length - 1, Math.round(track.scrollLeft / Math.max(step, 1))));
    if (next !== indexRef.current) {
      indexRef.current = next;
      setIndex(next);
    }
  }

  function hold() {
    holdRef.current = Date.now() + HOLD_MS;
  }

  function open(item) {
    const set = findCardNews(item.set);
    if (!set) return;
    onOpen?.(set.id, Math.max(0, set.pages.indexOf(item.page)));
  }

  if (!items.length) return null;

  return (
    <section className="v2-section cn-hl">
      <div className="v2-section__head">
        <h2>{today ? "오늘의 하이라이트" : "축제 하이라이트"}</h2>
        <span>
          {index + 1} / {items.length}
        </span>
      </div>
      <div className="cn-hl__track" ref={trackRef} onScroll={onScroll} onPointerDown={hold} onTouchStart={hold} onWheel={hold}>
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`cn-hl__slide${item.photo ? " cn-hl__slide--photo" : ""}${item.tone ? ` cn-hl__slide--${item.tone}` : ""}`}
            aria-label={`${item.label} · ${item.title.join(" ")} 소식 보기`}
            onClick={() => open(item)}
          >
            {item.photo ? (
              <img className="cn-hl__photo" src={img(item.photo)} alt="" />
            ) : (
              <>
                <span className="cn-hl__paper" aria-hidden="true" />
                <StarDust seed={31 + i} dust={34} glow={4} className="cn-hl__stars" />
                <span className={`cn-hl__art cn-hl__art--${item.artKind || "plain"}`} aria-hidden="true">
                  {item.art.map((name, order) => (
                    <img key={name} src={img(name)} alt="" loading="lazy" style={{ "--n": order }} />
                  ))}
                  {item.artKind === "versus" ? <i>VS</i> : null}
                </span>
              </>
            )}
            <span className="cn-hl__bar">
              <span className="cn-hl__text">
                <small>{item.label}</small>
                <b>
                  {item.title.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </b>
                <em>{item.meta}</em>
              </span>
              <span className="cn-hl__go">
                소식 보기
                <IconChevronRight />
              </span>
            </span>
          </button>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="cn-hl__dots" aria-hidden="true">
          {items.map((item, i) => (
            <i key={item.id} className={i === index ? "is-on" : ""} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
