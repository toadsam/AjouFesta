// 궁합을 "보는 느낌"으로. 목록 카드의 점수 링, 상단 TOP 3 부적, 상세의 궁합 리포트(명식 나란히 + 오행 관계).
// 점수·등급·이유는 서버(SajuCompatibility)가 주고, 여기서는 그리기만 한다.
// 스타일은 styles/saju.css 의 sm-*, styles/saju-list.css 의 sl-*.

import { useEffect, useRef, useState } from "react";
import { ELEMENT_HANJA, ELEMENT_WORD, PillarChart, elementRelation, stemHanja } from "./SajuChart";
import "../styles/saju-list.css";

export { elementRelation };

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 화면에 들어오면 0에서 점수까지 0.9초 동안 차오른다. 숫자도 같이 센다. */
function useCountUp(target, durationMs = 900, startDelayMs = 0) {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }
    const node = ref.current;
    if (!node || started.current) return undefined;
    let frame = 0;
    const run = () => {
      started.current = true;
      const from = 0;
      const startAt = performance.now() + startDelayMs;
      const tick = (now) => {
        const t = Math.max(0, Math.min(1, (now - startAt) / durationMs));
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(from + (target - from) * eased);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    if (typeof IntersectionObserver === "undefined") {
      run();
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        run();
      }
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs, startDelayMs]);

  return [value, ref];
}

function toneOf(score) {
  if (score >= 80) return "high";
  if (score >= 60) return "mid";
  return "low";
}

const TIPS = {
  same: "취향이 비슷할 확률이 높아요. 같은 메뉴를 시켜 놓고 얘기부터 시작해 보세요.",
  give: "내가 리드하면 잘 굴러가요. 공연 하나 골라서 같이 보자고 먼저 말해 보세요.",
  take: "상대 페이스에 맡기면 편해요. 질문을 많이 던지고 들어 주세요.",
  clash: "첫 만남은 짧게, 부담 없이. 주점에서 한 잔 하고 괜찮으면 두 번째 약속을 잡아요.",
};

export function MatchRing({ score, size = 52, stroke = 5, delayMs = 0 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, Number(score) || 0));
  const [shown, ref] = useCountUp(safe, 900, delayMs);
  return (
    <span ref={ref} className={`sm-ring sm-ring--${toneOf(safe)}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="sm-ring__track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="sm-ring__fill"
          strokeWidth={stroke}
          strokeDasharray={`${(shown / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <strong style={{ fontSize: Math.round(size * 0.34) }}>{Math.round(shown)}</strong>
    </span>
  );
}

/** 목록 카드 안. 점수가 있으면 링 + 등급 + 오행 관계 + 한 줄, 없으면 이유를 짧게. */
export function MatchCardBlock({ compatibility, viewerHasSaju, targetHasSaju, viewerSaju, targetSaju, onFixMine, onOpen }) {
  if (compatibility) {
    const tone = toneOf(compatibility.score);
    const relation = viewerSaju && targetSaju ? elementRelation(viewerSaju.dayMasterElement, targetSaju.dayMasterElement) : null;
    const Tag = onOpen ? "button" : "div";
    return (
      <Tag
        type={onOpen ? "button" : undefined}
        className={`sm-card sm-card--${tone}${onOpen ? " sm-card--tap" : ""}`}
        onClick={onOpen}
      >
        <MatchRing score={compatibility.score} />
        <div className="sm-card__body">
          <span className="sm-card__row">
            <span className={`sm-grade sm-grade--${tone}`}>{compatibility.grade}</span>
            {relation ? (
              <span className={`sm-card__rel sm-card__rel--${relation.key}`} title={relation.copy}>
                <i>{relation.hanja}</i>
                {relation.label}
              </span>
            ) : null}
          </span>
          <p>{compatibility.headline}</p>
        </div>
        {onOpen ? (
          <span className="sm-card__go" aria-hidden="true">
            궁합 보기 ›
          </span>
        ) : null}
      </Tag>
    );
  }
  if (!viewerHasSaju) {
    return (
      <button type="button" className="sm-card sm-card--empty" onClick={onFixMine}>
        <span className="sm-card__q">?</span>
        <div className="sm-card__body">
          <p>내 생년월일을 넣으면 이 사람과의 궁합 점수가 보여요.</p>
        </div>
      </button>
    );
  }
  if (!targetHasSaju) {
    return (
      <div className="sm-card sm-card--empty">
        <span className="sm-card__q">–</span>
        <div className="sm-card__body">
          <p>상대가 아직 사주를 안 넣었어요.</p>
        </div>
      </div>
    );
  }
  return null;
}

/** 부적 한 장. 앞면은 사진·점수, 누르면 뒤집혀서 두 일간의 관계와 이유가 나온다. */
function Talisman({ profile, rank, flipped, viewerSaju, resolveImage, onFlip, onUnflip, onOpen }) {
  const score = Number(profile.compatibility.score) || 0;
  const tone = toneOf(score);
  const [shown, ref] = useCountUp(score, 900, rank * 160 + 300);
  const element = profile.saju?.dayMasterElement || "";
  const relation = viewerSaju && profile.saju ? elementRelation(viewerSaju.dayMasterElement, profile.saju.dayMasterElement) : null;
  const firstReason = (profile.compatibility.reasons || [])[0] || profile.compatibility.headline;

  return (
    <div className={`sl-fuda sl-fuda--${rank + 1} sl-fuda--${tone}${flipped ? " is-flip" : ""}`} style={{ "--i": rank }}>
      <button
        type="button"
        className="sl-fuda__face sl-fuda__front"
        onClick={onFlip}
        aria-label={`${rank + 1}위 ${profile.nickname}, 궁합 ${score}점. 누르면 뒤집혀요`}
        tabIndex={flipped ? -1 : 0}
      >
        <span className="sl-fuda__rank">{rank + 1}</span>
        {element ? (
          <span className={`sl-fuda__el sl-fuda__el--${element}`} aria-hidden="true">
            {ELEMENT_HANJA[element]}
          </span>
        ) : null}
        <span ref={ref} className="sl-fuda__photo">
          {profile.generatedImageUrl ? (
            <img src={resolveImage(profile.generatedImageUrl, 480)} alt="" loading="lazy" decoding="async" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="currentColor" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="currentColor" />
            </svg>
          )}
          <em className="sl-fuda__score">{Math.round(shown)}</em>
        </span>
        <strong className="sl-fuda__name">{profile.nickname}</strong>
        <small className="sl-fuda__grade">{profile.compatibility.grade}</small>
        <span className="sl-fuda__tap" aria-hidden="true">
          뒤집기
        </span>
      </button>

      <div className="sl-fuda__face sl-fuda__back" aria-hidden={!flipped}>
        <button type="button" className="sl-fuda__undo" onClick={onUnflip} aria-label="앞면으로" tabIndex={flipped ? 0 : -1}>
          ↺
        </button>
        <span className="sl-fuda__seal" aria-hidden="true">
          緣
        </span>
        {relation ? (
          <>
            <span className={`sl-fuda__pair sl-fuda__pair--${relation.key}`} aria-label={`내 일간 ${viewerSaju.dayMaster}, 상대 일간 ${profile.saju.dayMaster}`}>
              {stemHanja(viewerSaju.dayMaster)}
              <i>{relation.hanja}</i>
              {stemHanja(profile.saju.dayMaster)}
            </span>
            <small className="sl-fuda__rel">{relation.label}</small>
          </>
        ) : null}
        <p className="sl-fuda__why">{firstReason}</p>
        <button type="button" className="sl-fuda__go" onClick={() => onOpen(profile)} tabIndex={flipped ? 0 : -1}>
          궁합 보기 ›
        </button>
      </div>
    </div>
  );
}

/** 나와 잘 맞는 세 명. 부적 세 장, 누르면 뒤집힌다(한 번에 한 장). */
export function MatchTop3({ profiles, resolveImage, onOpen, viewerSaju }) {
  const [flippedId, setFlippedId] = useState(null);
  if (!profiles.length) return null;
  return (
    <section className="sl-top">
      <div className="sl-top__head">
        <strong>오늘 나와 궁합 TOP {profiles.length}</strong>
        <span>부적을 누르면 뒤집혀요</span>
      </div>
      <div className={`sl-top__row sl-top__row--${Math.min(3, profiles.length)}`}>
        {profiles.map((profile, index) => (
          <Talisman
            key={profile.id}
            profile={profile}
            rank={index}
            flipped={flippedId === profile.id}
            viewerSaju={viewerSaju}
            resolveImage={resolveImage}
            onFlip={() => setFlippedId(profile.id)}
            onUnflip={() => setFlippedId(null)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

export function MatchMissingBanner({ onEdit }) {
  return (
    <button type="button" className="sm-banner" onClick={onEdit}>
      <span className="sm-banner__icon">☯</span>
      <span className="sm-banner__text">
        <strong>생년월일만 넣으면 모두와의 궁합이 보여요</strong>
        <small>이름과 생년월일은 공개되지 않아요 · 내 프로필 수정으로 가기</small>
      </span>
      <span className="sm-banner__chev">›</span>
    </button>
  );
}

/**
 * 궁합 공개. 화면에 들어오면 두 사람의 일간이 양쪽에서 다가오고, 붉은 실(인연의 실)이 둘을 묶고,
 * 점수가 차오른 뒤 등급 도장이 찍힌다.
 */
function MatchReveal({ compatibility, mine, theirs, myNickname, nickname, tone }) {
  const ref = useRef(null);
  const [play, setPlay] = useState(prefersReducedMotion());
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setPlay(true);
      return undefined;
    }
    setPlay(false);
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        setPlay(true);
      }
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [run]);

  // 도장이 찍히는 순간 짧게 진동
  useEffect(() => {
    if (!play || prefersReducedMotion()) return undefined;
    const id = window.setTimeout(() => {
      try {
        window.navigator.vibrate?.(35);
      } catch {
        /* 진동 없는 기기 */
      }
    }, 2350);
    return () => window.clearTimeout(id);
  }, [play, run]);

  const quick = prefersReducedMotion();

  return (
    <div ref={ref} key={run} className={`sm-reveal sm-reveal--${tone}${play ? " is-play" : ""}`}>
      <div className="sm-reveal__pair">
        <div className={`sm-coin sm-coin--mine sm-el--${mine?.dayMasterElement || ""}`}>
          <b>{mine?.dayMaster ? stemHanja(mine.dayMaster) : "?"}</b>
          <small>{myNickname || "나"}</small>
        </div>
        <svg className="sm-thread" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength="100" d="M2 30 C34 2, 64 58, 100 30 S166 2, 198 30" />
          <circle cx="100" cy="30" r="5" />
        </svg>
        <div className={`sm-coin sm-coin--theirs sm-el--${theirs?.dayMasterElement || ""}`}>
          <b>{theirs?.dayMaster ? stemHanja(theirs.dayMaster) : "?"}</b>
          <small>{nickname}</small>
        </div>
      </div>

      <div className="sm-reveal__score">
        <MatchRing key={`ring-${run}`} score={compatibility.score} size={116} stroke={9} delayMs={quick ? 0 : 1300} />
        <div className="sm-reveal__copy">
          <strong>{compatibility.headline}</strong>
          <small>
            {myNickname || "나"} × {nickname}
          </small>
        </div>
        <span className={`sm-stamp sm-stamp--${tone}`} aria-label={`등급 ${compatibility.grade}`}>
          {compatibility.grade}
        </span>
      </div>

      {!quick ? (
        <button type="button" className="sm-replay" onClick={() => setRun((value) => value + 1)}>
          ↻ 다시 보기
        </button>
      ) : null}
    </div>
  );
}

/** 상세 화면의 궁합 리포트. */
export function MatchReport({ compatibility, mine, theirs, myNickname, nickname }) {
  if (!compatibility) return null;
  const tone = toneOf(compatibility.score);
  const relation = mine && theirs ? elementRelation(mine.dayMasterElement, theirs.dayMasterElement) : null;

  return (
    <section className={`sm-report sm-report--${tone}`}>
      <MatchReveal
        compatibility={compatibility}
        mine={mine}
        theirs={theirs}
        myNickname={myNickname}
        nickname={nickname}
        tone={tone}
      />

      {mine && theirs ? (
        <>
          <div className="sm-section">
            <h4>두 사람의 기운</h4>
            <div className="sm-elements">
              <div className={`sm-el sm-el--${mine.dayMasterElement}`}>
                <b>{stemHanja(mine.dayMaster)}</b>
                <span>{mine.dayMaster} · {ELEMENT_HANJA[mine.dayMasterElement]} {ELEMENT_WORD[mine.dayMasterElement]}</span>
                <small>{myNickname || "나"}</small>
              </div>
              <div className={`sm-elements__link sm-elements__link--${relation?.key || "same"}`}>
                <i />
                <span>{relation?.label}</span>
              </div>
              <div className={`sm-el sm-el--${theirs.dayMasterElement}`}>
                <b>{stemHanja(theirs.dayMaster)}</b>
                <span>{theirs.dayMaster} · {ELEMENT_HANJA[theirs.dayMasterElement]} {ELEMENT_WORD[theirs.dayMasterElement]}</span>
                <small>{nickname}</small>
              </div>
            </div>
            {relation ? <p className="sm-section__copy">{relation.copy}</p> : null}
          </div>

          <div className="sm-section sm-section--chart">
            <h4>사주 나란히 · 명식</h4>
            <PillarChart
              title={null}
              people={[
                { saju: mine, name: myNickname || "나" },
                { saju: theirs, name: nickname },
              ]}
            />
          </div>
        </>
      ) : null}

      <div className="sm-section">
        <h4>이렇게 봤어요</h4>
        <ul className="sm-reasons">
          {(compatibility.reasons || []).map((reason, index) => (
            <li key={reason} style={{ "--i": index }}>{reason}</li>
          ))}
        </ul>
      </div>

      {relation ? (
        <div className="sm-tip">
          <strong>축제에서 만난다면</strong>
          <p>{TIPS[relation.key]}</p>
        </div>
      ) : null}
    </section>
  );
}
