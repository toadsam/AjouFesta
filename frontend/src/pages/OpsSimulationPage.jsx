import { useEffect, useMemo, useState } from "react";
import {
  applyOpsSimulationScenario,
  fetchOpsSimulationStatus,
  resetOpsSimulation,
  startOpsSimulation,
  stopOpsSimulation,
  updateOpsSimulation,
} from "../api";
import {
  IconAlert,
  IconChart,
  IconMapPin,
  IconMusic,
  IconRefresh,
  IconSettings,
  IconUsers,
} from "../components/UxIcons";

const MASTER_KEY_STORAGE_KEY = "festflow_ops_master_key";

const SCENARIOS = [
  { id: "calm", label: "전체 한산", description: "대부분 부스를 여유 상태로 초기화" },
  { id: "lunch-peak", label: "식사 피크", description: "주점/음식 부스 유입 집중" },
  { id: "show-end", label: "공연 종료 직후", description: "무대 관객이 주점으로 이동" },
  { id: "single-booth-surge", label: "특정 부스 몰림", description: "한 부스에 강한 쏠림 생성" },
  { id: "emergency-flow", label: "응급/안내 집중", description: "지원 부스 주변 인원 증가" },
];

function toDrafts(status) {
  const result = {};
  (status?.booths || []).forEach((booth) => {
    result[booth.boothId] = {
      currentPeople: booth.currentPeople,
      incomingPerMinute: booth.incomingPerMinute,
      outgoingPerMinute: booth.outgoingPerMinute,
      servicePerMinute: booth.servicePerMinute,
    };
  });
  return result;
}

function toStageDraft(status) {
  const stage = status?.stage || {};
  return {
    currentPeople: stage.currentPeople ?? 0,
    incomingPerMinute: stage.incomingPerMinute ?? 0,
    outgoingPerMinute: stage.outgoingPerMinute ?? 0,
  };
}

function toneForLevel(level) {
  if (level?.includes("매우")) return "packed";
  if (level?.includes("혼잡")) return "busy";
  if (level?.includes("보통")) return "normal";
  return "calm";
}

function clampNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.round(number));
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export default function OpsSimulationPage() {
  const initialKey = sessionStorage.getItem(MASTER_KEY_STORAGE_KEY) || "";
  const [keyInput, setKeyInput] = useState(initialKey);
  const [key, setKey] = useState(initialKey);
  const [status, setStatus] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [stageDraft, setStageDraft] = useState(toStageDraft(null));
  const [tickSeconds, setTickSeconds] = useState(3);
  const [jitterPercent, setJitterPercent] = useState(12);
  const [loading, setLoading] = useState(Boolean(initialKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const booths = status?.booths || [];
  const stage = status?.stage || null;
  const flowEvents = status?.flowEvents || [];
  const topBooth = useMemo(
    () => booths.slice().sort((a, b) => b.currentPeople - a.currentPeople)[0],
    [booths],
  );
  const averageWait = useMemo(() => {
    if (!booths.length) return 0;
    return Math.round(booths.reduce((sum, booth) => sum + booth.estimatedWaitMinutes, 0) / booths.length);
  }, [booths]);
  const stageDelta = stage ? stage.currentPeople - stage.previousPeople : 0;

  async function load({ silent = false } = {}) {
    if (!key) {
      setStatus(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const next = await fetchOpsSimulationStatus(key);
      setStatus(next);
      setDrafts(toDrafts(next));
      setStageDraft(toStageDraft(next));
      setTickSeconds(next.tickSeconds ?? 3);
      setJitterPercent(next.jitterPercent ?? 12);
      setError("");
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "서버 연결에 실패했습니다. 백엔드 실행 상태를 확인해 주세요." : e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [key]);

  useEffect(() => {
    if (!key || !status?.running) return undefined;
    const timer = window.setInterval(() => load({ silent: true }), Math.max(1000, (status.tickSeconds || 3) * 1000));
    return () => window.clearInterval(timer);
  }, [key, status?.running, status?.tickSeconds]);

  function submitKey(e) {
    e.preventDefault();
    const next = keyInput.trim();
    sessionStorage.setItem(MASTER_KEY_STORAGE_KEY, next);
    setKey(next);
    setMessage("");
    setError("");
    setLoading(Boolean(next));
  }

  function clearKey() {
    sessionStorage.removeItem(MASTER_KEY_STORAGE_KEY);
    setKeyInput("");
    setKey("");
    setStatus(null);
    setDrafts({});
    setStageDraft(toStageDraft(null));
    setMessage("");
    setError("");
    setLoading(false);
  }

  function updateDraft(boothId, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [boothId]: {
        ...(prev[boothId] || {}),
        [field]: clampNumber(value),
      },
    }));
  }

  function updateStageDraft(field, value) {
    setStageDraft((prev) => ({
      ...prev,
      [field]: clampNumber(value),
    }));
  }

  function payloadFromDrafts() {
    return {
      tickSeconds: clampNumber(tickSeconds, 3),
      jitterPercent: clampNumber(jitterPercent, 12),
      stage: {
        currentPeople: clampNumber(stageDraft.currentPeople, stage?.currentPeople ?? 0),
        incomingPerMinute: clampNumber(stageDraft.incomingPerMinute, stage?.incomingPerMinute ?? 0),
        outgoingPerMinute: clampNumber(stageDraft.outgoingPerMinute, stage?.outgoingPerMinute ?? 0),
      },
      booths: booths.map((booth) => ({
        boothId: booth.boothId,
        currentPeople: clampNumber(drafts[booth.boothId]?.currentPeople, booth.currentPeople),
        incomingPerMinute: clampNumber(drafts[booth.boothId]?.incomingPerMinute, booth.incomingPerMinute),
        outgoingPerMinute: clampNumber(drafts[booth.boothId]?.outgoingPerMinute, booth.outgoingPerMinute),
        servicePerMinute: Math.max(1, clampNumber(drafts[booth.boothId]?.servicePerMinute, booth.servicePerMinute)),
      })),
    };
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    try {
      const next = await updateOpsSimulation(payloadFromDrafts(), key);
      setStatus(next);
      setDrafts(toDrafts(next));
      setStageDraft(toStageDraft(next));
      setMessage("시뮬레이션 설정을 저장했습니다.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function start() {
    setSaving(true);
    setError("");
    try {
      await updateOpsSimulation(payloadFromDrafts(), key);
      const next = await startOpsSimulation(key);
      setStatus(next);
      setDrafts(toDrafts(next));
      setStageDraft(toStageDraft(next));
      setMessage("시뮬레이션을 시작했습니다. 지도/상세/혼잡도 화면이 실시간으로 바뀝니다.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function stop() {
    setSaving(true);
    setError("");
    try {
      const next = await stopOpsSimulation(key);
      setStatus(next);
      setDrafts(toDrafts(next));
      setStageDraft(toStageDraft(next));
      setMessage("시뮬레이션을 일시정지했습니다.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!window.confirm("시뮬레이션 시작 전 부스 대기시간/상태로 되돌릴까요?")) return;
    setSaving(true);
    setError("");
    try {
      const next = await resetOpsSimulation(key);
      setStatus(next);
      setDrafts(toDrafts(next));
      setStageDraft(toStageDraft(next));
      setTickSeconds(next.tickSeconds ?? 3);
      setJitterPercent(next.jitterPercent ?? 12);
      setMessage("시뮬레이션을 리셋하고 원래 부스 상태를 복구했습니다.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function applyScenario(scenario) {
    setSaving(true);
    setError("");
    try {
      const next = await applyOpsSimulationScenario(scenario, key);
      setStatus(next);
      setDrafts(toDrafts(next));
      setStageDraft(toStageDraft(next));
      setMessage("시나리오를 적용했습니다. 시작 버튼을 누르면 실시간 변화가 시작됩니다.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cyber-page ops-simulation-page pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-role-ops inline-flex items-center gap-1.5">
          <IconUsers className="h-5 w-5 icon-role-ops" />
          운영 시뮬레이션
        </h2>
        <button type="button" onClick={() => load()} className="rounded-lg border px-3 py-2 text-sm" disabled={!key || loading}>
          새로고침
        </button>
      </div>

      <form onSubmit={submitKey} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <p className="text-sm font-semibold text-role-ops inline-flex items-center gap-1.5">
          <IconSettings className="h-4 w-4 icon-role-ops" />
          운영 키 입력
        </p>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <input className="border rounded px-2 py-2 text-sm" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="0000" />
          <button type="submit" className="rounded border px-3 py-2 text-sm font-semibold">적용</button>
          <button type="button" onClick={clearKey} className="rounded border px-3 py-2 text-sm">초기화</button>
        </div>
      </form>

      {!key && <p className="text-sm text-rose-600">운영 키를 입력해 주세요.</p>}
      {loading && <p className="text-sm text-slate-600">불러오는 중...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-teal-700">{message}</p>}

      {status && (
        <>
          {!status.enabled && (
            <article className="ops-simulation-alert">
              <IconAlert className="h-4 w-4" />
              <p>서버에서 시뮬레이션 모드가 꺼져 있습니다. `APP_SIMULATION_ENABLED=true`로 실행해야 합니다.</p>
            </article>
          )}

          <article className="ops-simulation-hero">
            <div>
              <span className={`ops-simulation-state ops-simulation-state--${status.running ? "running" : "stopped"}`}>
                {status.running ? "실행 중" : "정지됨"}
              </span>
              <h3>실시간 혼잡도 테스트 패널</h3>
              <p>현재 인원과 유입/이탈 값을 조절하면 부스 대기시간, 혼잡도, 지도 AI 추천이 같이 갱신됩니다.</p>
            </div>
            <div className="ops-simulation-actions">
              <button type="button" onClick={start} disabled={saving || !status.enabled}>
                시작
              </button>
              <button type="button" onClick={stop} disabled={saving || !status.enabled || !status.running}>
                정지
              </button>
              <button type="button" onClick={reset} disabled={saving || !status.enabled}>
                리셋
              </button>
            </div>
          </article>

          <section className="ops-simulation-kpis" aria-label="시뮬레이션 요약">
            <div>
              <span>부스+무대</span>
              <strong>{status.totalPeople}명</strong>
            </div>
            <div>
              <span>최다 혼잡</span>
              <strong>{topBooth?.boothName || "-"}</strong>
            </div>
            <div>
              <span>평균 대기</span>
              <strong>{averageWait}분</strong>
            </div>
            <div>
              <span>마지막 갱신</span>
              <strong>{formatTime(status.updatedAt)}</strong>
            </div>
          </section>

          {stage && (
            <section className="ops-simulation-panel ops-simulation-stage-panel">
              <div className="ops-simulation-panel-head">
                <div>
                  <h3>
                    <IconMusic className="h-4 w-4" />
                    무대 관객 흐름
                  </h3>
                  <p>무대 인원이 늘고 줄면서 주변 부스와 주점으로 이동합니다.</p>
                </div>
                <span className={`ops-simulation-level ops-simulation-level--${toneForLevel(stage.congestionLevel)}`}>
                  {stage.congestionLevel}
                </span>
              </div>
              <div className="ops-simulation-stage-grid">
                <label className="ops-simulation-slider">
                  <span>무대 인원</span>
                  <input
                    type="range"
                    min="0"
                    max="4000"
                    value={stageDraft.currentPeople}
                    onChange={(e) => updateStageDraft("currentPeople", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="4000"
                    value={stageDraft.currentPeople}
                    onChange={(e) => updateStageDraft("currentPeople", e.target.value)}
                  />
                </label>
                <div className="ops-simulation-rate-grid">
                  <label>
                    <span>무대 유입/분</span>
                    <input
                      type="number"
                      min="0"
                      max="800"
                      value={stageDraft.incomingPerMinute}
                      onChange={(e) => updateStageDraft("incomingPerMinute", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>무대 이탈/분</span>
                    <input
                      type="number"
                      min="0"
                      max="800"
                      value={stageDraft.outgoingPerMinute}
                      onChange={(e) => updateStageDraft("outgoingPerMinute", e.target.value)}
                    />
                  </label>
                  <div className="ops-simulation-stage-counter">
                    <span>현재 변화</span>
                    <strong>{stage.currentPeople}명 · {stageDelta >= 0 ? "+" : ""}{stageDelta}</strong>
                  </div>
                </div>
              </div>
              <div className="ops-simulation-flow-list" aria-label="최근 이동 흐름">
                {flowEvents.length === 0 && <p>시작 후 이동 이벤트가 여기에 표시됩니다.</p>}
                {flowEvents.map((event, index) => (
                  <article key={`${event.from}-${event.to}-${index}`}>
                    <strong>{event.from} → {event.to}</strong>
                    <span>{event.people}명 · {event.reason}</span>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="ops-simulation-panel">
            <div className="ops-simulation-panel-head">
              <div>
                <h3>시나리오</h3>
                <p>운영 상황을 빠르게 만든 뒤 세부 수치를 조절하세요.</p>
              </div>
              <a href="/stage-map" target="_blank" rel="noreferrer">
                <IconMapPin className="h-4 w-4" />
                지도 확인
              </a>
            </div>
            <div className="ops-simulation-scenarios">
              {SCENARIOS.map((scenario) => (
                <button key={scenario.id} type="button" onClick={() => applyScenario(scenario.id)} disabled={saving || !status.enabled}>
                  <strong>{scenario.label}</strong>
                  <span>{scenario.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="ops-simulation-panel">
            <div className="ops-simulation-panel-head">
              <div>
                <h3>전체 설정</h3>
                <p>갱신 주기와 랜덤 변동폭을 조절합니다.</p>
              </div>
              <button type="button" onClick={saveSettings} disabled={saving || !status.enabled}>
                설정 저장
              </button>
            </div>
            <div className="ops-simulation-settings">
              <label>
                <span>갱신 주기</span>
                <input type="number" min="1" max="30" value={tickSeconds} onChange={(e) => setTickSeconds(e.target.value)} />
                <small>초</small>
              </label>
              <label>
                <span>랜덤 변동</span>
                <input type="number" min="0" max="50" value={jitterPercent} onChange={(e) => setJitterPercent(e.target.value)} />
                <small>%</small>
              </label>
              <div>
                <span>현재 시나리오</span>
                <strong>{SCENARIOS.find((item) => item.id === status.scenario)?.label || "수동 설정"}</strong>
              </div>
            </div>
          </section>

          <section className="ops-simulation-booths">
            <div className="ops-simulation-panel-head">
              <div>
                <h3>부스별 인원 조절</h3>
                <p>유입/이탈/처리량은 분당 기준입니다. 처리량이 낮고 현재 인원이 높을수록 대기시간이 길어집니다.</p>
              </div>
              <IconChart className="h-5 w-5" />
            </div>

            <div className="ops-simulation-booth-list">
              {booths.map((booth) => {
                const draft = drafts[booth.boothId] || {};
                const tone = toneForLevel(booth.congestionLevel);
                const delta = booth.currentPeople - booth.previousPeople;
                return (
                  <article key={booth.boothId} className={`ops-simulation-booth ops-simulation-booth--${tone}`}>
                    <div className="ops-simulation-booth-main">
                      <div>
                        <span className={`ops-simulation-level ops-simulation-level--${tone}`}>{booth.congestionLevel}</span>
                        <h4>{booth.boothName}</h4>
                        <p>
                          현재 {booth.currentPeople}명 · 대기 {booth.estimatedWaitMinutes}분 · {delta >= 0 ? "+" : ""}
                          {delta}명
                        </p>
                      </div>
                      <strong>{booth.currentPeople}</strong>
                    </div>

                    <label className="ops-simulation-slider">
                      <span>현재 인원</span>
                      <input
                        type="range"
                        min="0"
                        max="180"
                        value={draft.currentPeople ?? booth.currentPeople}
                        onChange={(e) => updateDraft(booth.boothId, "currentPeople", e.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        max="250"
                        value={draft.currentPeople ?? booth.currentPeople}
                        onChange={(e) => updateDraft(booth.boothId, "currentPeople", e.target.value)}
                      />
                    </label>

                    <div className="ops-simulation-rate-grid">
                      <label>
                        <span>유입/분</span>
                        <input
                          type="number"
                          min="0"
                          max="120"
                          value={draft.incomingPerMinute ?? booth.incomingPerMinute}
                          onChange={(e) => updateDraft(booth.boothId, "incomingPerMinute", e.target.value)}
                        />
                      </label>
                      <label>
                        <span>이탈/분</span>
                        <input
                          type="number"
                          min="0"
                          max="120"
                          value={draft.outgoingPerMinute ?? booth.outgoingPerMinute}
                          onChange={(e) => updateDraft(booth.boothId, "outgoingPerMinute", e.target.value)}
                        />
                      </label>
                      <label>
                        <span>처리/분</span>
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={draft.servicePerMinute ?? booth.servicePerMinute}
                          onChange={(e) => updateDraft(booth.boothId, "servicePerMinute", e.target.value)}
                        />
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <article className="ops-simulation-note">
            <IconRefresh className="h-4 w-4" />
            <p>리셋을 누르면 시뮬레이션 시작 전 저장되어 있던 부스 대기시간과 상태 메시지로 되돌립니다.</p>
          </article>
        </>
      )}
    </section>
  );
}
