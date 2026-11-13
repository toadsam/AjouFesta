// 카드뉴스 세 번째 묶음: 아로새길 거리축제, 뛰아주, SUCL 결승, 응원대제전.
// 원본 카드의 글을 그대로 옮기고, 구역 고르기 · 코스 달려 보기 · 팀 응원 · 함성 키우기처럼 손으로 해 볼 거리를 붙였다.
import { useEffect, useState } from "react";
import { ARO, ARTIST, CARD_NEWS_IMG, CHEER, RUN, STAGE, SUCL } from "../../data/cardNews";
import { CnIcon, PinMap } from "./CardNewsArt";
import { GlassCard, InfoRows, vibrate } from "./CardNewsPages";
import { Rich, useWhen } from "./CardNewsPages2";

const img = (name) => `${CARD_NEWS_IMG}/${name}.webp`;
const MAP_RATIO = 1687 / 1463;

function readSaved(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSaved(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장이 막혀도 이번 화면에서는 켜진다.
  }
}

/* 지도 그림 위에 얹는 구역 표시 */
function ZoneBox({ box, tone, on }) {
  return (
    <span
      className={`cn-zonebox cn-zonebox--${tone}${on ? " is-on" : ""}`}
      style={{ left: `${box[0]}%`, top: `${box[1]}%`, width: `${box[2]}%`, height: `${box[3]}%` }}
      aria-hidden="true"
    />
  );
}

/* ================= 아로새길 거리축제 ================= */
export function AroInfoPage() {
  const [zone, setZone] = useState("A");
  const current = ARO.zones.find((item) => item.key === zone) || ARO.zones[0];
  return (
    <GlassCard title="아로새길 거리축제 안내" seed={107} className="cn-card--wide-title">
      <div className="cn-map--narrow cn-in" style={{ "--d": 1 }}>
        <PinMap src={img("aro-map")} ratio={MAP_RATIO} alt="아로새길 거리축제 구역 지도" zoomable>
          {ARO.zones.map((item) => (
            <ZoneBox key={item.key} box={item.box} tone={item.tone} on={item.key === zone} />
          ))}
        </PinMap>
      </div>
      <div className="cn-zones cn-in" style={{ "--d": 2 }} role="tablist" aria-label="구역">
        {ARO.zones.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === zone}
            className={`cn-zone cn-zone--${item.tone}${item.key === zone ? " is-on" : ""}`}
            onClick={() => {
              setZone(item.key);
              vibrate();
            }}
          >
            {item.key}구역
          </button>
        ))}
      </div>
      <p key={zone} className="cn-zoneinfo" role="status">
        <b>{current.name}</b>
        {current.subs.map((line) => (
          <small key={line}>{line}</small>
        ))}
      </p>
      <dl className="cn-duo cn-in" style={{ "--d": 3 }}>
        <div>
          <dt>운영일시</dt>
          <dd>{ARO.when}</dd>
        </div>
        <div>
          <dt>운영장소</dt>
          <dd>{ARO.place}</dd>
        </div>
        <div className="cn-duo__wide">
          <dt>행사 내용</dt>
          <dd>{ARO.about}</dd>
        </div>
      </dl>
    </GlassCard>
  );
}

export function AroPubPage({ onLeave }) {
  const when = useWhen(ARO.pub.start, ARO.pub.end);
  return (
    <GlassCard title="총학생회 주점 운영 안내" seed={109} className="cn-card--wide-title">
      <div className="cn-map--narrow cn-in" style={{ "--d": 1 }}>
        <PinMap src={img("aro-pub-map")} ratio={MAP_RATIO} alt="아로새길 총학생회 구역과 주점부스 위치" zoomable>
          <ZoneBox box={ARO.pub.box} tone="gold" on />
        </PinMap>
      </div>
      <p className={`cn-status cn-status--${when.tone} cn-in`} style={{ "--d": 2 }}>
        <i aria-hidden="true" />
        {when.tone === "soon" ? `10월 7일 오후 4시에 열어요 · ${when.text}` : when.tone === "live" ? "지금 운영 중 · 밤 11시까지" : "주점 운영을 마쳤어요"}
      </p>
      <dl className="cn-duo cn-in" style={{ "--d": 3 }}>
        <div>
          <dt>운영일시</dt>
          <dd>{ARO.pub.when}</dd>
        </div>
        <div>
          <dt>운영장소</dt>
          <dd>{ARO.pub.place}</dd>
        </div>
        <div>
          <dt>행사 내용</dt>
          <dd>{ARO.pub.about}</dd>
        </div>
        <div>
          <dt>안내 사항</dt>
          <dd>{ARO.pub.note}</dd>
        </div>
      </dl>
      <button type="button" className="cn-cta cn-in" style={{ "--d": 4 }} onClick={() => onLeave?.("/booths")}>
        앱에서 주점 자리 · 주문 보기 <CnIcon.arrow />
      </button>
    </GlassCard>
  );
}

export function AroMenuPage({ onLeave }) {
  const [picked, setPicked] = useState(null);
  const [bump, setBump] = useState(0);
  return (
    <GlassCard title="메뉴 안내" seed={113}>
      <div className="cn-dishes">
        {ARO.menu.map((item, index) => {
          const on = picked === index;
          return (
            <button
              key={item.name}
              type="button"
              className={`cn-dish cn-in${on ? " is-on" : ""}`}
              style={{ "--d": index + 1 }}
              aria-pressed={on}
              onClick={() => {
                setPicked(on ? null : index);
                setBump(Date.now());
                vibrate();
              }}
            >
              <span className="cn-dish__img">
                <img key={on ? bump : "still"} src={img(item.img)} alt="" draggable="false" />
              </span>
              <b>{item.name}</b>
              <em>{item.price}</em>
              {on ? <small>{item.detail}</small> : null}
            </button>
          );
        })}
      </div>
      <p className="cn-note cn-in" style={{ "--d": 5 }}>
        {picked === null ? "메뉴를 누르면 구성을 볼 수 있어요" : "주문은 주점 테이블의 QR 로 해요"}
      </p>
      <button type="button" className="cn-cta cn-in" style={{ "--d": 6 }} onClick={() => onLeave?.("/booths")}>
        앱에서 주점 보기 <CnIcon.arrow />
      </button>
    </GlassCard>
  );
}

/* ================= 뛰아주 ================= */
export function RunInfoPage({ onJump }) {
  const when = useWhen(RUN.start, RUN.end);
  const [step, setStep] = useState(0);
  return (
    <GlassCard title="뛰아주 안내" seed={127}>
      <p className={`cn-status cn-status--${when.tone} cn-in`} style={{ "--d": 1 }}>
        <i aria-hidden="true" />
        {when.tone === "soon" ? `10월 7일 오전 10시 30분 · ${when.text}` : when.tone === "live" ? "지금 달리는 중" : "뛰아주가 끝났어요"}
      </p>
      <dl className="cn-blocks cn-blocks--tight">
        <div className="cn-in" style={{ "--d": 2 }}>
          <dt>행사 일시</dt>
          <dd>{RUN.when}</dd>
        </div>
        <div className="cn-in" style={{ "--d": 3 }}>
          <dt>행사 일정</dt>
          <dd className="cn-timeline">
            {RUN.schedule.map((item, index) => (
              <button
                key={item.time}
                type="button"
                className={`cn-tl${index === step ? " is-on" : ""}${index < step ? " is-done" : ""}`}
                aria-pressed={index === step}
                onClick={() => {
                  setStep(index);
                  vibrate();
                }}
              >
                <b>{item.time}</b>
                <span>{item.text}</span>
              </button>
            ))}
          </dd>
        </div>
      </dl>
      <button type="button" className="cn-cta cn-in" style={{ "--d": 4 }} onClick={() => onJump?.("run", "run-course")}>
        런닝코스: 지도 보기 <CnIcon.arrow />
      </button>
      <ul className="cn-perks cn-perks--tight cn-in" style={{ "--d": 5 }}>
        <li>* {RUN.perk}</li>
      </ul>
    </GlassCard>
  );
}

// 런닝 코스는 총학 지도 그림을 그대로 보여 준다. 지도 위에 선을 따라 달리는 애니메이션은 뺐다
// (동선이 바뀔 수 있어 옛 그림에 맞춰 그린 선이 틀릴 수 있음, 2026-10-06). 그림을 누르면 크게 볼 수 있다.
const COURSE_RATIO = 1000 / 1778;

export function RunCoursePage() {
  return (
    <GlassCard title="런닝 코스" seed={131}>
      <div className="cn-course">
        <div className="cn-course__map cn-in" style={{ "--d": 1 }}>
          <PinMap src={img("run-course")} ratio={COURSE_RATIO} alt="뛰아주 런닝 코스 지도" zoomable />
        </div>
        <div className="cn-course__side">
          <ol className="cn-stops cn-in" style={{ "--d": 2 }}>
            <li className="cn-stops--blue">출발: 축구장</li>
            <li className="cn-stops--yellow">반환: 혜령공원</li>
            <li className="cn-stops--green">도착: 선구자상</li>
          </ol>
          <div className="cn-legs cn-in" style={{ "--d": 3 }}>
            {RUN.legs.map((item) => (
              <span key={item.key} className={`cn-leg cn-leg--${item.key}`}>
                <i aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="cn-note cn-in" style={{ "--d": 4 }}>
        지도를 누르면 크게 볼 수 있어요
      </p>
    </GlassCard>
  );
}

export function RunItemsPage() {
  const [got, setGot] = useState([]);
  const all = got.length === RUN.items.length;
  function toggle(index) {
    const next = got.includes(index) ? got.filter((i) => i !== index) : [...got, index];
    setGot(next);
    vibrate(next.length === RUN.items.length ? [10, 40, 10] : 8);
  }
  return (
    <GlassCard title="뛰아주 안내" seed={137}>
      <span className="cn-tag cn-tag--first cn-in" style={{ "--d": 1 }}>
        지급 물품
      </span>
      <div className="cn-kit">
        {RUN.items.map((item, index) => {
          const on = got.includes(index);
          return (
            <button
              key={item.name}
              type="button"
              className={`cn-kititem cn-kititem--${item.img} cn-in${on ? " is-on" : ""}`}
              style={{ "--d": index + 2 }}
              aria-pressed={on}
              onClick={() => toggle(index)}
            >
              <span className="cn-kititem__img">
                <img src={img(item.img)} alt="" draggable="false" />
              </span>
              <b>{item.name}</b>
              {on ? <em>챙김</em> : null}
            </button>
          );
        })}
      </div>
      {all ? (
        <p className="cn-done" role="status">
          다 챙겼어요! 10월 7일 오전 10시 30분에 만나요
        </p>
      ) : (
        <p className="cn-note cn-in" style={{ "--d": 6 }}>
          눌러서 챙겨 보세요 · {got.length} / {RUN.items.length}
        </p>
      )}
    </GlassCard>
  );
}

/* ================= SUCL 결승 ================= */
const SUCL_KEY = "festflow.cardnews.sucl";

export function SuclFinalPage() {
  const when = useWhen(SUCL.start, SUCL.end);
  const [pick, setPick] = useState(() => readSaved(SUCL_KEY));
  const [bump, setBump] = useState(0);

  function choose(key) {
    const value = pick === key ? "" : key;
    setPick(value);
    setBump(Date.now());
    writeSaved(SUCL_KEY, value);
    vibrate(value ? [8, 30, 8] : 6);
  }

  const picked = SUCL.teams.find((team) => team.key === pick);
  return (
    <GlassCard
      title={
        <>
          SUCL2026 with 아주대학교
          <br />
          결승 안내
        </>
      }
      seed={139}
      className="cn-card--wide-title"
    >
      <div className={`cn-match${pick ? " has-pick" : ""} cn-in`} style={{ "--d": 1 }}>
        {SUCL.teams.map((team) => (
          <button key={team.key} type="button" className={`cn-club${pick === team.key ? " is-on" : ""}`} onClick={() => choose(team.key)} aria-pressed={pick === team.key}>
            <span className="cn-club__logo">
              <img key={pick === team.key ? bump : "still"} src={img(team.img)} alt="" draggable="false" />
            </span>
            <b>{team.name}</b>
            {pick === team.key ? <em className="cn-orb__badge">응원 중</em> : null}
          </button>
        ))}
        <b className="cn-vs__mark" aria-hidden="true">
          VS
        </b>
      </div>
      <p className="cn-note cn-in" style={{ "--d": 2 }}>
        {picked ? `${picked.name} 응원 중 · 다시 누르면 취소` : "응원할 팀을 골라 보세요"}
      </p>
      <p className={`cn-status cn-status--${when.tone} cn-in`} style={{ "--d": 3 }}>
        <i aria-hidden="true" />
        {when.tone === "soon" ? `10월 7일 오후 4시 30분 시작 · ${when.text}` : when.tone === "live" ? "지금 대운동장에서 결승 중" : "결승이 끝났어요"}
      </p>
      <dl className="cn-blocks cn-blocks--tight">
        <div className="cn-in" style={{ "--d": 4 }}>
          <dt>일시</dt>
          <dd>{SUCL.when}</dd>
        </div>
        <div className="cn-in" style={{ "--d": 5 }}>
          <dt>장소</dt>
          <dd>{SUCL.place}</dd>
        </div>
      </dl>
    </GlassCard>
  );
}

export function SuclEventPage() {
  const [checked, setChecked] = useState([]);
  const [copied, setCopied] = useState(false);
  const done = checked.length === SUCL.steps.length;

  function toggle(index) {
    const next = checked.includes(index) ? checked.filter((i) => i !== index) : [...checked, index];
    setChecked(next);
    vibrate(next.length === SUCL.steps.length ? [10, 40, 10] : 8);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(SUCL.account);
      setCopied(true);
      vibrate();
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // 복사가 막힌 브라우저에서는 글자를 그대로 보고 적는다.
    }
  }

  return (
    <GlassCard title="결승전 관람 인증 EVENT" seed={149} className="cn-card--wide-title">
      <div className="cn-panel cn-in" style={{ "--d": 1 }}>
        {SUCL.event.map((line) => (
          <p key={line}>
            <Rich text={line} />
          </p>
        ))}
      </div>
      <div className="cn-checkhead cn-in" style={{ "--d": 2 }}>
        <span>참여 순서를 눌러 확인해요</span>
        <b>
          {checked.length} / {SUCL.steps.length}
        </b>
      </div>
      <ol className="cn-checks">
        {SUCL.steps.map((text, index) => (
          <li key={text} className="cn-in" style={{ "--d": index + 3 }}>
            <button type="button" className={`cn-check${checked.includes(index) ? " is-on" : ""}`} onClick={() => toggle(index)} aria-pressed={checked.includes(index)}>
              <span className="cn-check__box" aria-hidden="true">
                {checked.includes(index) ? "✓" : index + 1}
              </span>
              <span className="cn-check__text">{text}</span>
            </button>
          </li>
        ))}
      </ol>
      {done ? (
        <p className="cn-done" role="status">
          참여 준비 끝! 결승전에서 만나요
        </p>
      ) : null}
      <button type="button" className="cn-cta cn-in" style={{ "--d": 6 }} onClick={copy}>
        {copied ? "복사했어요 ✓" : `${SUCL.account} 복사하기`}
      </button>
    </GlassCard>
  );
}

/* ================= 스페셜 아티스트 ================= */
export function ArtistInfoPage({ onJump }) {
  const when = useWhen(STAGE.entryAt);
  const [shine, setShine] = useState(0);
  return (
    <GlassCard eyebrow={`${ARTIST.date} 공연무대`} title={ARTIST.label} seed={163}>
      <button
        type="button"
        className="cn-poster cn-in"
        style={{ "--d": 1 }}
        aria-label={`${ARTIST.name} 포스터`}
        onClick={() => {
          setShine(Date.now());
          vibrate(8);
        }}
      >
        <img src={img(ARTIST.poster)} alt="" draggable="false" />
        {shine ? <span key={shine} className="cn-poster__shine" aria-hidden="true" /> : null}
      </button>
      <p className="cn-artistname cn-in" style={{ "--d": 2 }}>
        {ARTIST.name}
      </p>
      <InfoRows rows={[["공연 장소", STAGE.place], ["입장 시간", `${STAGE.entry}부터`]]} />
      <p className={`cn-status cn-status--${when.tone} cn-in`} style={{ "--d": 3 }}>
        <i aria-hidden="true" />
        {when.tone === "soon" ? `10월 8일 입장까지 ${when.text}` : when.tone === "live" ? "입장이 시작됐어요" : "공연이 끝났어요"}
      </p>
      <p className="cn-note cn-in" style={{ "--d": 4 }}>
        {ARTIST.entryRule}
      </p>
      <div className="cn-duo cn-in" style={{ "--d": 5 }}>
        <button type="button" className="cn-cta" onClick={() => onJump?.("stage", "stage-entry")}>
          입장 안내 <CnIcon.arrow />
        </button>
        <button type="button" className="cn-cta" onClick={() => onJump?.("cheer", "cover")}>
          응원대제전 <CnIcon.arrow />
        </button>
      </div>
    </GlassCard>
  );
}

/* ================= 응원대제전 ================= */
function youtubeEmbed(video) {
  const params = new URLSearchParams({ autoplay: "1", playsinline: "1", rel: "0" });
  if (video.start) params.set("start", String(video.start));
  if (video.end) params.set("end", String(video.end));
  return `https://www.youtube-nocookie.com/embed/${video.id}?${params}`;
}

function youtubeWatch(video) {
  return `https://www.youtube.com/watch?v=${video.id}${video.start ? `&t=${video.start}s` : ""}`;
}

export function CheerPlaylistPage({ active }) {
  const [playing, setPlaying] = useState(null);
  const name = playing === null ? null : CHEER.playlist[playing];
  const video = name ? CHEER.videos[name] : null;

  // 다른 장으로 넘기면 소리가 계속 나지 않게 끈다.
  useEffect(() => {
    if (!active) setPlaying(null);
  }, [active]);

  return (
    <GlassCard eyebrow="2026 아주대학교 응원단" title="CENTAUR" seed={151}>
      <span className="cn-tag cn-tag--first cn-in" style={{ "--d": 1 }}>
        CENTAUR PLAYLIST
      </span>
      <ol className="cn-playlist">
        {CHEER.playlist.map((song, index) => {
          const on = playing === index;
          return (
            <li key={song} className="cn-in" style={{ "--d": Math.min(index + 2, 8) }}>
              <button
                type="button"
                className={`cn-song${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => {
                  setPlaying(on ? null : index);
                  vibrate(on ? 6 : [6, 20, 6]);
                }}
              >
                <span className="cn-song__no">{index + 1}.</span>
                <span className="cn-song__name">{song}</span>
                {on ? (
                  <span className="cn-song__eq" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      {video ? (
        <div className="cn-player">
          <div className="cn-player__frame">
            <iframe
              key={video.id}
              src={youtubeEmbed(video)}
              title={`${name} · 아주대학교 응원단 CENTAUR`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <p className="cn-player__cap">
            <b>{name}</b>
            <span>{video.from} · 응원단 센토</span>
            <a href={youtubeWatch(video)} target="_blank" rel="noreferrer">
              YouTube에서 보기
            </a>
          </p>
        </div>
      ) : (
        <>
          <p className="cn-note cn-in" style={{ "--d": 9 }}>
            {name ? `${name} · ${CHEER.noVideo}` : "곡 이름을 누르면 센토의 무대 영상이 나와요"}
          </p>
          <span className="cn-tag cn-in" style={{ "--d": 10 }}>
            상품 안내
          </span>
          {CHEER.intro.map((line, index) => (
            <p key={line} className="cn-copy cn-in" style={{ "--d": 11 + index }}>
              {line}
            </p>
          ))}
        </>
      )}
    </GlassCard>
  );
}

export function CheerOtPage() {
  const [level, setLevel] = useState(0);
  const max = CHEER.levels.length;
  function shout() {
    const next = level >= max ? 1 : level + 1;
    setLevel(next);
    vibrate(next === max ? [14, 40, 14, 40, 30] : 6 + next * 3);
  }
  return (
    <GlassCard title="2026 응원 오리엔테이션" seed={157} className="cn-card--wide-title">
      <span className="cn-tag cn-tag--first cn-in" style={{ "--d": 1 }}>
        Crescentaur : 점점 더, 아주 크게
      </span>
      <button type="button" className={`cn-cresc cn-cresc--${level} cn-in`} style={{ "--d": 2 }} onClick={shout} aria-label="함성 보내기">
        <span className="cn-cresc__bars" aria-hidden="true">
          {CHEER.levels.map((name, index) => (
            <i key={name} className={index < level ? "is-on" : ""} style={{ "--h": `${30 + index * 14}%` }} />
          ))}
        </span>
        <span className="cn-cresc__text" key={level}>
          {level ? CHEER.levels[level - 1] : "눌러서 함성 보내기"}
        </span>
      </button>
      {CHEER.ot.map((line, index) => (
        <p key={line} className="cn-copy cn-in" style={{ "--d": Math.min(index + 3, 9) }}>
          {line}
        </p>
      ))}
    </GlassCard>
  );
}

function Torch({ level, max }) {
  const lit = level > 0;
  return (
    <svg className={`cn-torch cn-torch--${level}${level === max ? " is-full" : ""}`} viewBox="0 0 48 72" aria-hidden="true">
      <g className="cn-torch__flame" style={{ opacity: lit ? 1 : 0.25 }}>
        <path d="M24 3c2 9 13 13 13 25a13 13 0 0 1-26 0c0-7 4-10 6-15 2 4 3 6 5 6 0-6 0-11 2-16z" fill="#bfe3ff" />
        <path d="M24 20c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 2 3-4z" fill="#fff" />
      </g>
      <path d="M15 42h18l-3 8H18z" fill="#fff" opacity="0.92" />
      <path d="M19 50h10l-2.5 19h-5z" fill="#fff" opacity="0.75" />
    </svg>
  );
}

export function CheerTorchPage() {
  const [checked, setChecked] = useState([]);
  const steps = CHEER.torch.steps;
  const done = checked.length === steps.length;
  function toggle(index) {
    const next = checked.includes(index) ? checked.filter((i) => i !== index) : [...checked, index];
    setChecked(next);
    vibrate(next.length === steps.length ? [10, 40, 10] : 8);
  }
  return (
    <GlassCard title="푸른 횃불 챌린지 EVENT" seed={163} className="cn-card--wide-title">
      <p className="cn-copy cn-in" style={{ "--d": 1 }}>
        {CHEER.torch.lead}
      </p>
      <div className="cn-panel cn-panel--box cn-in" style={{ "--d": 2 }}>
        <div className="cn-torchrow">
          <span className="cn-tag cn-tag--first">참여 방법</span>
          <Torch level={checked.length} max={steps.length} />
        </div>
        <ol className="cn-checks cn-checks--tight">
          {steps.map((text, index) => (
            <li key={text}>
              <button type="button" className={`cn-check${checked.includes(index) ? " is-on" : ""}`} onClick={() => toggle(index)} aria-pressed={checked.includes(index)}>
                <span className="cn-check__box" aria-hidden="true">
                  {checked.includes(index) ? "✓" : index + 1}
                </span>
                <span className="cn-check__text">{text}</span>
              </button>
            </li>
          ))}
        </ol>
        <span className="cn-tag">경품 안내</span>
        <ul className="cn-ranks">
          {CHEER.torch.prizes.map((prize) => (
            <li key={prize.rank}>
              <b>{prize.rank}</b>
              {prize.name} ({prize.count})
            </li>
          ))}
        </ul>
      </div>
      <p className={done ? "cn-done" : "cn-copy cn-in"} style={{ "--d": 3 }} role={done ? "status" : undefined}>
        {done ? "횃불이 켜졌어요! 무대에서 만나요" : CHEER.torch.close}
      </p>
    </GlassCard>
  );
}

export function CheerSloganPage() {
  const [wave, setWave] = useState(0);
  return (
    <GlassCard title="슬로건 증정 EVENT" seed={167}>
      <span className="cn-tag cn-tag--first cn-in" style={{ "--d": 1 }}>
        증정 안내
      </span>
      <p className="cn-copy cn-copy--lg cn-in" style={{ "--d": 2 }}>
        {CHEER.slogan.when}
        <br />
        {CHEER.slogan.how}
      </p>
      <p className="cn-copy cn-in" style={{ "--d": 3 }}>
        <Rich text={CHEER.slogan.body} />
      </p>
      <button
        type="button"
        className="cn-slogan cn-in"
        style={{ "--d": 4 }}
        aria-label="응원 슬로건 흔들어 보기"
        onClick={() => {
          setWave(Date.now());
          vibrate([8, 30, 8, 30, 8]);
        }}
      >
        <img key={wave || "still"} className={wave ? "is-wave" : ""} src={img("cheer-slogan")} alt="2026 CENTAUR 응원 슬로건 두 장" draggable="false" />
      </button>
      <p className="cn-note cn-in" style={{ "--d": 5 }}>
        {wave ? "그대는 선구자가 되어 나아가라, 그 길은 푸른 횃불이 비추리" : "슬로건을 눌러 흔들어 보세요"}
      </p>
      <p className="cn-copy cn-in" style={{ "--d": 6 }}>
        <b>{CHEER.slogan.close}</b>
        <br />
        <small>※ {CHEER.slogan.note}</small>
      </p>
    </GlassCard>
  );
}
