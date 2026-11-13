import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createCongestionStream, fetchStageCrowd } from "../api";
import { IconArrowLeft, IconCalendar, IconChart, IconMapPin, IconRefresh, IconUsers } from "../components/UxIcons";

const WINDOW_OPTIONS = [5, 10, 15, 30];
const FALLBACK_ZONE = {
  zoneKey: "open-air-theater",
  zoneName: "아주대 노천극장",
  radiusMeters: 55,
  crowdCount: 0,
  capacityHint: 4000,
  level: "여유",
};

function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}

function zonePercent(zone) {
  if (!zone?.capacityHint) return 0;
  return clampPercent((Number(zone.crowdCount || 0) / Number(zone.capacityHint)) * 100);
}

function levelMeta(level, percent) {
  const text = `${level || ""}`;
  const value = clampPercent(percent);
  if (text.includes("매우") || value >= 90) return { label: "매우 혼잡", tone: "packed", guide: "입구 분산과 동선 통제가 필요해요." };
  if (text.includes("혼잡") || value >= 65) return { label: "혼잡", tone: "busy", guide: "잠시 후 입장하거나 가장자리 동선을 이용하세요." };
  if (text.includes("보통") || value >= 35) return { label: "보통", tone: "normal", guide: "입장은 가능하지만 이동 여유를 두는 게 좋아요." };
  return { label: "여유", tone: "calm", guide: "지금은 비교적 편하게 입장할 수 있어요." };
}

function formatUpdatedAt(value) {
  if (!value) return "업데이트 대기";
  const text = String(value);
  const timeMatch = text.match(/T(\d{2}):(\d{2}):(\d{2})/);
  if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
  const normalized = text.replace(/(\.\d{3})\d+/, "$1");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "업데이트 대기";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function StageGauge({ percent }) {
  const value = clampPercent(percent);
  const radius = 48;
  const length = Math.PI * radius;
  const offset = length - (length * value) / 100;

  return (
    <svg className="stage-crowd-gauge" viewBox="0 0 140 92" role="img" aria-label={`노천극장 혼잡 게이지 ${value}%`}>
      <defs>
        <linearGradient id="stageCrowdGaugeGradient" x1="20" y1="0" x2="120" y2="0">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="48%" stopColor="#3b82f6" />
          <stop offset="74%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      <path className="stage-crowd-gauge__track" d="M22 72 A48 48 0 0 1 118 72" pathLength={length} />
      <path
        className="stage-crowd-gauge__value"
        d="M22 72 A48 48 0 0 1 118 72"
        pathLength={length}
        style={{ strokeDasharray: length, strokeDashoffset: offset }}
      />
      <text x="70" y="62" textAnchor="middle" className="stage-crowd-gauge__value-text">{value}%</text>
      <text x="70" y="80" textAnchor="middle" className="stage-crowd-gauge__label">혼잡도</text>
    </svg>
  );
}

export default function StageCrowdPage() {
  const [minutes, setMinutes] = useState(10);
  const [stageState, setStageState] = useState({ data: null, loading: true, message: "" });
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, message } = stageState;

  const refresh = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    setStageState((current) => ({ ...current, loading: true }));

    async function loadStageCrowd() {
      try {
        const next = await fetchStageCrowd(minutes);
        setStageState({ data: next, loading: false, message: "" });
      } catch (error) {
        setStageState((current) => ({
          ...current,
          loading: false,
          message: error.message || "노천극장 데이터를 불러오지 못했습니다.",
        }));
      }
    }

    loadStageCrowd();
  }, [minutes, refreshKey]);

  useEffect(() => {
    const requestRefresh = () => refresh();
    const timer = window.setInterval(requestRefresh, 10000);
    let stream = null;
    try {
      stream = createCongestionStream();
      stream.addEventListener("congestion", requestRefresh);
    } catch {
      // Streaming is optional; interval refresh remains available.
    }
    return () => {
      window.clearInterval(timer);
      stream?.close();
    };
  }, []);

  const zones = data?.zones?.length ? data.zones : [FALLBACK_ZONE];
  const mainZone = zones[0] || FALLBACK_ZONE;
  const percent = zonePercent(mainZone);
  const meta = levelMeta(mainZone.level, percent);
  const updatedAt = formatUpdatedAt(data?.updatedAt);
  const totalCrowd = data?.totalCrowdCount ?? mainZone.crowdCount ?? 0;
  const remainingCapacity = Math.max(0, Number(mainZone.capacityHint || 0) - Number(mainZone.crowdCount || 0));
  const densityDots = useMemo(
    () => Array.from({ length: 24 }, (_, index) => index < Math.round((percent / 100) * 24)),
    [percent],
  );

  return (
    <section className="uni-page stage-crowd-page" data-i18n-skip>
      <header className={`stage-crowd-hero stage-crowd-hero--${meta.tone}`}>
        <div className="stage-crowd-hero__nav">
          <Link to="/analytics" aria-label="혼잡도 페이지로 돌아가기">
            <IconArrowLeft className="h-5 w-5" />
          </Link>
          <button type="button" aria-label="노천극장 데이터 새로고침" onClick={refresh} disabled={loading}>
            <IconRefresh className="h-5 w-5" />
          </button>
        </div>
        <div className="stage-crowd-hero__copy">
          <span>노천극장 실시간 인원</span>
          <h1>아주대 노천극장</h1>
          <p>최근 {data?.minutesWindow || minutes}분 기준으로 객석 주변 밀집도를 보여줍니다.</p>
        </div>
        <div className="stage-crowd-hero__status">
          <strong>{meta.label}</strong>
          <span>{updatedAt}</span>
        </div>
      </header>

      {message && <p className="app-inline-note app-inline-note--danger">{message}</p>}

      <section className="stage-crowd-overview" aria-label="노천극장 혼잡 게이지">
        <div className="stage-crowd-overview__copy">
          <span>현재 감지 인원</span>
          <strong>{totalCrowd}명</strong>
          <p>{meta.guide}</p>
          <div className="stage-crowd-window-tabs" aria-label="집계 기준 선택">
            {WINDOW_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={minutes === option ? "active" : ""}
                onClick={() => setMinutes(option)}
              >
                {option}분
              </button>
            ))}
          </div>
        </div>
        <StageGauge percent={percent} />
      </section>

      <section className="stage-crowd-map-card" aria-label="노천극장 객석 밀집도">
        <div className="stage-crowd-map-head">
          <div>
            <h2>객석 밀집도</h2>
            <p>반경 {mainZone.radiusMeters || 55}m 기준 · 수용 기준 {mainZone.capacityHint || 4000}명</p>
          </div>
          <span className={`stage-crowd-level stage-crowd-level--${meta.tone}`}>{meta.label}</span>
        </div>
        <div className="stage-crowd-theater" style={{ "--stage-fill": `${Math.max(8, percent)}%` }}>
          <div className="stage-crowd-stage">STAGE</div>
          <div className="stage-crowd-rings" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="stage-crowd-dots" aria-hidden="true">
            {densityDots.map((active, index) => (
              <i key={index} className={active ? "active" : ""} />
            ))}
          </div>
        </div>
      </section>

      <section className="stage-crowd-kpi-grid" aria-label="노천극장 상세 수치">
        <article>
          <IconUsers className="h-5 w-5" />
          <span>현재 인원</span>
          <strong>{mainZone.crowdCount || 0}명</strong>
        </article>
        <article>
          <IconChart className="h-5 w-5" />
          <span>수용 대비</span>
          <strong>{percent}%</strong>
        </article>
        <article>
          <IconMapPin className="h-5 w-5" />
          <span>잔여 여유</span>
          <strong>{remainingCapacity}명</strong>
        </article>
      </section>

      <section className="stage-crowd-zone-list" aria-label="노천극장 구역 목록">
        <div className="stage-crowd-section-head">
          <h2>구역 데이터</h2>
          <span>{loading ? "갱신 중" : `최근 ${data?.minutesWindow || minutes}분`}</span>
        </div>
        {zones.map((zone) => {
          const zoneRatio = zonePercent(zone);
          const zoneMeta = levelMeta(zone.level, zoneRatio);
          return (
            <article key={zone.zoneKey} className={`stage-crowd-zone stage-crowd-zone--${zoneMeta.tone}`}>
              <div>
                <strong>{zone.zoneName || "아주대 노천극장"}</strong>
                <span>반경 {zone.radiusMeters}m · 기준 {zone.capacityHint}명</span>
              </div>
              <div>
                <b>{zone.crowdCount}명</b>
                <small>{zoneRatio}%</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="stage-crowd-links" aria-label="관련 페이지 이동">
        <Link to="/events">
          <IconCalendar className="h-4 w-4" />
          공연 일정
        </Link>
        <Link to="/stage-map">
          <IconMapPin className="h-4 w-4" />
          지도에서 보기
        </Link>
        <Link to="/admin/simulation">
          <IconSettingsLink />
          시뮬레이션
        </Link>
      </section>
    </section>
  );
}

function IconSettingsLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 17v3" />
      <path d="M4 4v9" />
      <path d="M12 11v9" />
      <path d="M12 4v3" />
      <path d="M20 15v5" />
      <path d="M20 4v7" />
      <circle cx="4" cy="15" r="2" />
      <circle cx="12" cy="9" r="2" />
      <circle cx="20" cy="13" r="2" />
    </svg>
  );
}
