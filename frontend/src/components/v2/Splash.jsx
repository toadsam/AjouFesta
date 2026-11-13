// 앱을 처음 열 때 1.8초 동안 뜨는 스플래시. 하늘 + 종이비행기 + 치토(주인공) + 바람.
// 페이지를 새로 열 때마다(새로고침 포함) 보여 준다. 탭 이동은 페이지를 다시 안 여니 안 뜬다.
// 그 사이에 부스·공연 데이터를 미리 받아 둔다.
import { useEffect, useState } from "react";
import { fetchBooths, fetchEvents } from "../../api";
import { FESTIVAL } from "../../config/festival";
import { Reeds } from "../order/SkyReeds";
import { PaperPlane } from "./V2Kit";

const SHOW_MS = 1800;
const FADE_MS = 450;

export function shouldShowSplash() {
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  } catch {
    return false;
  }
}

function dateLabel() {
  const [, m1, d1] = FESTIVAL.startDate.split("-");
  const [, m2, d2] = FESTIVAL.endDate.split("-");
  return `${m1}.${d1} – ${m2}.${d2}`;
}

export default function Splash({ onDone }) {
  const [phase, setPhase] = useState("in");

  useEffect(() => {
    // 화면이 떠 있는 동안 첫 화면 데이터를 미리 데워 둔다. 실패해도 스플래시는 그냥 지나간다.
    fetchBooths().catch(() => {});
    fetchEvents().catch(() => {});

    const fade = window.setTimeout(() => setPhase("out"), SHOW_MS);
    const done = window.setTimeout(() => onDone?.(), SHOW_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div className={`v2-splash v2-splash--${phase}`} role="presentation" aria-hidden="true">
      <div className="v2-splash__sky" />
      <div className="v2-splash__stars" />
      <div className="v2-splash__cloud v2-splash__cloud--a" />
      <div className="v2-splash__cloud v2-splash__cloud--b" />
      <div className="v2-splash__reeds">
        <Reeds height={230} />
      </div>
      <PaperPlane className="v2-splash__plane v2-splash__plane--trail" />
      <PaperPlane className="v2-splash__plane" />

      <div className="v2-splash__center">
        <div className="v2-splash__halo" />
        {/* 치토 축하 포즈. 파일이 없으면 기본형으로 떨어진다. */}
        <img
          className="v2-splash__mascot"
          src="/images/chito-cheer.png"
          alt=""
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/images/chito.png";
          }}
        />
        <span className="v2-splash__eyebrow">{FESTIVAL.title}</span>
        <strong className="v2-splash__title">
          {FESTIVAL.name.split("").map((char, index) => (
            <span key={`${char}-${index}`} style={{ "--i": index }}>
              {char}
            </span>
          ))}
        </strong>
        <small className="v2-splash__tagline">{FESTIVAL.tagline}</small>
        <span className="v2-splash__date">{dateLabel()}</span>
      </div>

      <img className="v2-splash__flame" src="/images/chito-flame.png" alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
      <span className="v2-splash__rec">REC</span>
      <div className="v2-splash__frame">
        <span />
      </div>
    </div>
  );
}
