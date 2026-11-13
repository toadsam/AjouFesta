// 명식(命式) 차트. 사주 네 기둥을 실제 사주 앱처럼 천간·지지 두 줄, 오행 색 칸, 한자로 그린다.
// 한 사람(내 사주·상대 사주)도, 두 사람(궁합)도 같은 표를 쓴다. 기둥(세로 줄)을 누르면 그 자리 풀이가 열린다.
// 관계(합·충·상생·상극)는 서버 점수 규칙(SajuCompatibility)과 같은 규칙으로 여기서 다시 계산해 보여 준다.
// 스타일은 styles/saju-chart.css 의 sc-*.

import { useEffect, useRef, useState } from "react";
import "../styles/saju-chart.css";

export const ELEMENTS = ["목", "화", "토", "금", "수"];
export const ELEMENT_HANJA = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };
export const ELEMENT_WORD = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" };

const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const STEM_HANJA = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const STEM_ELEMENT = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
const BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const BRANCH_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const BRANCH_ELEMENT = ["수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수"];
const BRANCH_ANIMAL = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
// 삼합: 신자진 수국, 해묘미 목국, 인오술 화국, 사유축 금국
const TRIADS = [
  [8, 0, 4],
  [11, 3, 7],
  [2, 6, 10],
  [5, 9, 1],
];

/** 표의 세로 줄. 전통 명식은 왼쪽부터 시·일·월·년 순서다. */
export const COLUMNS = [
  { key: "hour", label: "시주", hanja: "時", place: "열매 자리", copy: "자녀와 말년, 둘이 함께 갈 방향" },
  { key: "day", label: "일주", hanja: "日", place: "꽃 자리", copy: "나 자신과 배우자 자리. 궁합의 핵심" },
  { key: "month", label: "월주", hanja: "月", place: "줄기 자리", copy: "부모와 사회생활, 세상에서 굴러가는 방식" },
  { key: "year", label: "년주", hanja: "年", place: "뿌리 자리", copy: "조상과 어린 시절, 자란 배경" },
];

export function pillarOf(saju, key) {
  if (!saju) return "";
  if (key === "hour") return saju.hourKnown ? saju.hourPillar : "";
  if (key === "day") return saju.dayPillar;
  if (key === "month") return saju.monthPillar;
  return saju.yearPillar;
}

export function stemHanja(char) {
  const index = STEMS.indexOf(char);
  return index >= 0 ? STEM_HANJA[index] : char || "";
}

/** "임오" → 천간·지지 각각의 한자·오행·음양·띠. */
export function splitPillar(value) {
  if (!value || value.length < 2) return null;
  const si = STEMS.indexOf(value[0]);
  const bi = BRANCHES.indexOf(value[1]);
  if (si < 0 || bi < 0) return null;
  return {
    stem: { char: STEMS[si], hanja: STEM_HANJA[si], element: STEM_ELEMENT[si], yang: si % 2 === 0 },
    branch: { char: BRANCHES[bi], hanja: BRANCH_HANJA[bi], element: BRANCH_ELEMENT[bi], yang: bi % 2 === 0, animal: BRANCH_ANIMAL[bi] },
  };
}

/** 오행 관계. 목→화→토→금→수→목 은 상생, 두 칸 건너는 상극. */
export function elementRelation(mine, theirs) {
  const a = ELEMENTS.indexOf(mine);
  const b = ELEMENTS.indexOf(theirs);
  if (a < 0 || b < 0) return null;
  if (a === b) return { key: "same", hanja: "同", label: "같은 기운", copy: `둘 다 ${ELEMENT_WORD[mine]} 기운이라 말이 잘 통해요.` };
  if ((a + 1) % 5 === b) return { key: "give", hanja: "生", label: "내가 살려요", copy: `내 ${ELEMENT_WORD[mine]}이 상대의 ${ELEMENT_WORD[theirs]}을 키워 줘요.` };
  if ((b + 1) % 5 === a) return { key: "take", hanja: "生", label: "상대가 살려요", copy: `상대의 ${ELEMENT_WORD[theirs]}이 내 ${ELEMENT_WORD[mine]}을 키워 줘요.` };
  if ((a + 2) % 5 === b) return { key: "clash", hanja: "剋", label: "내가 눌러요", copy: `내 ${ELEMENT_WORD[mine]}이 상대의 ${ELEMENT_WORD[theirs]}을 누르는 자리예요. 속도를 맞춰 주세요.` };
  return { key: "clash", hanja: "剋", label: "상대가 눌러요", copy: `상대의 ${ELEMENT_WORD[theirs]}이 내 ${ELEMENT_WORD[mine]}을 누르는 자리예요. 내 얘기를 먼저 꺼내 보세요.` };
}

/** 천간끼리. 갑기·을경·병신·정임·무계는 천간합, 아니면 오행 관계로 본다. */
export function stemRelation(a, b) {
  const ia = STEMS.indexOf(a);
  const ib = STEMS.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  if ((ia + 5) % 10 === ib) {
    return { key: "hap", hanja: "合", label: "천간합", copy: `천간 ${a}·${b}가 합이라 서로 끌려요.` };
  }
  const relation = elementRelation(STEM_ELEMENT[ia], STEM_ELEMENT[ib]);
  if (!relation) return null;
  return { ...relation, copy: `천간 ${a}(${STEM_ELEMENT[ia]}) ↔ ${b}(${STEM_ELEMENT[ib]}). ${relation.copy}` };
}

/** 지지끼리. 육합 > 충 > 삼합 > 같음 순으로 본다(서버 점수 규칙과 같은 순서). */
export function branchRelation(a, b) {
  const ia = BRANCHES.indexOf(a);
  const ib = BRANCHES.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  const sum = ia + ib;
  if (sum === 1 || sum === 13) return { key: "hap", hanja: "合", label: "육합", copy: `지지 ${a}·${b}가 육합이라 끌리는 자리예요.` };
  if (Math.abs(ia - ib) === 6) return { key: "chung", hanja: "沖", label: "충", copy: `지지 ${a}·${b}가 충이라 부딪칠 수 있어요. 속도를 맞춰 주세요.` };
  if (ia !== ib && TRIADS.some((triad) => triad.includes(ia) && triad.includes(ib))) {
    return { key: "sam", hanja: "合", label: "삼합", copy: `지지 ${a}·${b}가 삼합이라 힘을 합치기 좋아요.` };
  }
  if (ia === ib) return { key: "same", hanja: "同", label: "같은 지지", copy: `지지가 같은 ${a}(${BRANCH_ANIMAL[ia]})라 결이 닮았어요.` };
  return { key: "none", hanja: "·", label: "무난", copy: `지지 ${a}·${b}는 합도 충도 없이 무난한 자리예요.` };
}

const HANJA_PREF_KEY = "festflow.saju.hanja";

function readHanjaPref() {
  try {
    return window.localStorage.getItem(HANJA_PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

/** 사진 귀퉁이의 일간 도장. 그 사람의 '나'(일간)를 오행 색 한자로. */
export function ElementSeal({ saju, size = "sm" }) {
  if (!saju?.dayMaster) return null;
  const element = saju.dayMasterElement || "";
  return (
    <span className={`sc-seal sc-seal--${element} sc-seal--${size}`} title={`일간 ${saju.dayMaster} · ${element}`} aria-hidden="true">
      {stemHanja(saju.dayMaster)}
    </span>
  );
}

function Cell({ part, col, kind, hanja, active, index }) {
  if (!part) {
    return (
      <div className={`sc__cell sc__cell--none${active ? " is-on" : ""}`} data-col={col} style={{ "--i": index }}>
        <b>?</b>
        <small>{kind === "stem" ? "시간" : "모름"}</small>
      </div>
    );
  }
  return (
    <div className={`sc__cell sc__cell--${part.element}${active ? " is-on" : ""}`} data-col={col} style={{ "--i": index }}>
      <b>{hanja ? part.hanja : part.char}</b>
      <small>{hanja ? part.char : ELEMENT_HANJA[part.element]}</small>
      <i>{part.yang ? "陽" : "陰"}</i>
    </div>
  );
}

function RelationCell({ stem, branch, col, active }) {
  return (
    <div className={`sc__rel${active ? " is-on" : ""}`} data-col={col} title={[stem?.label, branch?.label].filter(Boolean).join(" · ")}>
      <i className={`sc__rel-mark sc__rel-mark--${stem?.key || "none"}`}>{stem?.hanja || "·"}</i>
      <i className={`sc__rel-mark sc__rel-mark--${branch?.key || "none"}`}>{branch?.hanja || "·"}</i>
    </div>
  );
}

function PairNote({ column, mine, theirs, names }) {
  if (!mine || !theirs) {
    const who = !mine && !theirs ? "두 사람 모두" : !mine ? names[0] : names[1];
    return (
      <div className="sc__note">
        <strong>
          {column.hanja} {column.label} · {column.place}
        </strong>
        <span className="sc__note-copy">{who} 태어난 시간을 몰라 이 자리는 못 봐요. 세 기둥으로만 봤어요.</span>
      </div>
    );
  }
  const stem = stemRelation(mine.stem.char, theirs.stem.char);
  const branch = branchRelation(mine.branch.char, theirs.branch.char);
  return (
    <div className="sc__note">
      <strong>
        {column.hanja} {column.label} · {column.place}
      </strong>
      <span className="sc__note-copy">{column.copy}</span>
      <ul>
        {stem ? (
          <li className={`sc__note--${stem.key}`}>
            <i>{stem.hanja}</i>
            <span>{stem.copy}</span>
          </li>
        ) : null}
        {branch ? (
          <li className={`sc__note--${branch.key}`}>
            <i>{branch.hanja}</i>
            <span>{branch.copy}</span>
          </li>
        ) : null}
        {column.key === "day" ? (
          <li className="sc__note--star">
            <i>★</i>
            <span>일주는 배우자 자리라 점수에 가장 크게 들어가요.</span>
          </li>
        ) : null}
        {column.key === "year" ? (
          <li className="sc__note--star">
            <i>띠</i>
            <span>
              년주 지지가 흔히 말하는 띠예요. {mine.branch.animal}띠와 {theirs.branch.animal}띠.
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function SoloNote({ column, part }) {
  if (!part) {
    return (
      <div className="sc__note">
        <strong>
          {column.hanja} {column.label} · {column.place}
        </strong>
        <span className="sc__note-copy">태어난 시간을 몰라 시주 없이 세 기둥으로 봤어요.</span>
      </div>
    );
  }
  return (
    <div className="sc__note">
      <strong>
        {column.hanja} {column.label} · {column.place}
      </strong>
      <span className="sc__note-copy">{column.copy}</span>
      <ul>
        <li>
          <i>干</i>
          <span>
            천간 {part.stem.char}({part.stem.hanja}) · {part.stem.element}({ELEMENT_WORD[part.stem.element]}) · {part.stem.yang ? "양" : "음"}
          </span>
        </li>
        <li>
          <i>支</i>
          <span>
            지지 {part.branch.char}({part.branch.hanja}) · {part.branch.element}({ELEMENT_WORD[part.branch.element]}) · {part.branch.animal}띠
          </span>
        </li>
      </ul>
    </div>
  );
}

/**
 * people: [{ saju, name }] 한 명 또는 두 명. 두 명이면 사이에 관계 줄(천간 관계 · 지지 관계)이 생긴다.
 * title 을 null 로 주면 머리줄에는 한자/한글 토글만 남는다.
 */
export function PillarChart({ people, title = "명식", hint }) {
  const list = (people || []).filter((person) => person && person.saju);
  const pair = list.length >= 2;
  const [hanja, setHanja] = useState(readHanjaPref);
  const [active, setActive] = useState(null);
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setInView(true);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(HANJA_PREF_KEY, hanja ? "1" : "0");
    } catch {
      /* 저장 못 해도 화면은 그대로 */
    }
  }, [hanja]);

  if (!list.length) return null;

  const parts = list.map((person) => Object.fromEntries(COLUMNS.map((column) => [column.key, splitPillar(pillarOf(person.saju, column.key))])));
  const names = list.map((person, index) => person.name || (index === 0 ? "나" : "상대"));
  const activeColumn = COLUMNS.find((column) => column.key === active) || null;

  const toggleColumn = (key) => setActive((current) => (current === key ? null : key));
  const handleBoardClick = (event) => {
    const target = event.target.closest?.("[data-col]");
    if (target && ref.current?.contains(target)) toggleColumn(target.dataset.col);
  };

  return (
    <div ref={ref} className={`sc${inView ? " is-in" : ""}${active ? " has-on" : ""}${pair ? " sc--pair" : ""}`}>
      <div className="sc__top">
        {title ? <strong className="sc__title">{title}</strong> : <span />}
        <button type="button" className="sc__toggle" aria-pressed={hanja} onClick={() => setHanja((value) => !value)}>
          {hanja ? "한글로 보기" : "漢字로 보기"}
        </button>
      </div>

      <div className="sc__board" onClick={handleBoardClick}>
        <span className="sc__axis" aria-hidden="true" />
        {COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            className={`sc__head${active === column.key ? " is-on" : ""}`}
            data-col={column.key}
            aria-pressed={active === column.key}
            aria-label={`${column.label} 풀이 보기`}
          >
            <b>{column.hanja}</b>
            <small>{column.label}</small>
          </button>
        ))}

        {list.map((person, personIndex) => (
          <PersonRows
            key={`${personIndex}-${person.name || ""}`}
            personIndex={personIndex}
            pair={pair}
            name={names[personIndex]}
            parts={parts[personIndex]}
            hanja={hanja}
            active={active}
            relations={
              pair && personIndex === 1
                ? COLUMNS.map((column) => {
                    const mine = parts[0][column.key];
                    const theirs = parts[1][column.key];
                    return {
                      key: column.key,
                      stem: mine && theirs ? stemRelation(mine.stem.char, theirs.stem.char) : null,
                      branch: mine && theirs ? branchRelation(mine.branch.char, theirs.branch.char) : null,
                    };
                  })
                : null
            }
          />
        ))}
      </div>

      {pair ? (
        <ul className="sc__legend" aria-label="기호 설명">
          <li>
            <i className="sc__rel-mark--hap">合</i>합
          </li>
          <li>
            <i className="sc__rel-mark--give">生</i>상생
          </li>
          <li>
            <i className="sc__rel-mark--same">同</i>같음
          </li>
          <li>
            <i className="sc__rel-mark--clash">剋</i>상극
          </li>
          <li>
            <i className="sc__rel-mark--chung">沖</i>충
          </li>
        </ul>
      ) : null}

      {activeColumn ? (
        pair ? (
          <PairNote key={active} column={activeColumn} mine={parts[0][active]} theirs={parts[1][active]} names={names} />
        ) : (
          <SoloNote key={active} column={activeColumn} part={parts[0][active]} />
        )
      ) : (
        <p className="sc__hint">
          {hint ||
            (pair
              ? "기둥(세로 줄)을 누르면 그 자리끼리 어떻게 맞는지 보여요. 日 일주가 배우자 자리라 점수에 가장 크게 들어가요."
              : "기둥(세로 줄)을 누르면 그 자리의 뜻이 보여요. 日 일주의 천간이 곧 '나'예요.")}
        </p>
      )}
    </div>
  );
}

function PersonRows({ personIndex, pair, name, parts, hanja, active, relations }) {
  return (
    <>
      {relations ? (
        <>
          <span className={`sc__axis sc__axis--rel${hanja ? "" : " sc__axis--kr"}`}>{hanja ? "緣" : "관계"}</span>
          {relations.map((relation) => (
            <RelationCell key={relation.key} col={relation.key} stem={relation.stem} branch={relation.branch} active={active === relation.key} />
          ))}
        </>
      ) : null}

      {pair ? (
        <div className={`sc__name${personIndex === 1 ? " sc__name--theirs" : ""}`}>
          <em>{personIndex === 0 ? "나" : "상대"}</em>
          <strong>{name}</strong>
        </div>
      ) : null}

      <span className={`sc__axis${hanja ? "" : " sc__axis--kr"}`}>{hanja ? "干" : "천간"}</span>
      {COLUMNS.map((column, colIndex) => (
        <Cell key={`s-${column.key}`} part={parts[column.key]?.stem} col={column.key} kind="stem" hanja={hanja} active={active === column.key} index={personIndex * 8 + colIndex} />
      ))}

      <span className={`sc__axis${hanja ? "" : " sc__axis--kr"}`}>{hanja ? "支" : "지지"}</span>
      {COLUMNS.map((column, colIndex) => (
        <Cell key={`b-${column.key}`} part={parts[column.key]?.branch} col={column.key} kind="branch" hanja={hanja} active={active === column.key} index={personIndex * 8 + 4 + colIndex} />
      ))}
    </>
  );
}
