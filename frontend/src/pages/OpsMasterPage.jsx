import { useEffect, useMemo, useState } from "react";
import {
  createOpsMasterBooth,
  createOpsMasterEvent,
  createOpsMasterNotice,
  createOpsMasterAiNoticeDraft,
  deleteOpsMasterBooth,
  deleteOpsMasterEvent,
  deleteOpsMasterNotice,
  fetchOpsMasterAiBriefing,
  fetchOpsMasterBootstrap,
  reorderOpsMasterBooths,
  triggerOpsMasterCongestionReliefNotice,
  triggerOpsMasterEventStartNotice,
  updateOpsMasterBooth,
  updateOpsMasterBoothLiveStatus,
  updateOpsMasterEvent,
  updateOpsMasterNotice,
  bulkUpdateOpsMasterEventStatus,
} from "../api";
import {
  IconAlert,
  IconCalendar,
  IconClipboard,
  IconMapPin,
  IconSettings,
  IconShield,
} from "../components/UxIcons";

const MASTER_KEY_STORAGE_KEY = "festflow_ops_master_key";
const NOTICE_CATEGORIES = ["긴급", "분실물", "안내", "일반"];
const BOOTH_CATEGORIES = ["주점", "음식", "체험", "이벤트", "굿즈", "안내", "응급", "포토존", "플리마켓", "기타"];
const BOOTH_DAY_PARTS = ["상시", "주간", "야간"];
const EVENT_STATUS_OPTIONS = ["예정", "대기중", "곧 시작", "지연", "진행중", "종료", "취소"];
const EVENT_QUICK_STATUS_OPTIONS = ["곧 시작", "지연", "진행중", "종료"];
const EVENT_STATUS_STYLES = {
  예정: "border-sky-200 bg-sky-50 text-sky-700",
  대기중: "border-amber-200 bg-amber-50 text-amber-700",
  "곧 시작": "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  지연: "border-rose-200 bg-rose-50 text-rose-700",
  진행중: "border-cyan-200 bg-cyan-50 text-cyan-700",
  종료: "border-slate-200 bg-slate-100 text-slate-600",
  취소: "border-zinc-300 bg-zinc-100 text-zinc-700",
};

const initialNotice = {
  title: "",
  content: "",
  category: "안내",
  active: true,
};
const initialEvent = {
  title: "",
  startTime: "",
  endTime: "",
  imageUrl: "",
  imageCredit: "",
  imageFocus: "",
  statusOverride: "",
  liveMessage: "",
  delayMinutes: "",
};
const initialBooth = {
  name: "",
  latitude: "",
  longitude: "",
  description: "",
  imageUrl: "",
  category: "주점",
  dayPart: "야간",
  openTime: "",
  closeTime: "",
  tags: "",
  contentJson: "",
  reservationEnabled: true,
  estimatedWaitMinutes: "",
  remainingStock: "",
  liveStatusMessage: "",
};

function toApiDateTime(value) {
  return value.length === 16 ? `${value}:00` : value;
}

function toInputDateTime(value) {
  return value ? value.slice(0, 16) : "";
}

function confirmAction(message) {
  return window.confirm(`정말 실행할까요?\n\n${message}`);
}

function formatEventTime(value) {
  return value?.replace("T", " ").slice(5, 16) || "-";
}

export default function OpsMasterPage({ embedded = false }) {
  const isLocalRuntime =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const localDefaultKey = embedded && isLocalRuntime ? "0000" : "";
  const initialKey = sessionStorage.getItem(MASTER_KEY_STORAGE_KEY) || localDefaultKey;

  const [tab, setTab] = useState("notice");
  const [keyInput, setKeyInput] = useState(initialKey);
  const [key, setKey] = useState(initialKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [data, setData] = useState(null);
  const [boothLiveDrafts, setBoothLiveDrafts] = useState({});
  const [eventLiveDrafts, setEventLiveDrafts] = useState({});

  const [noticeForm, setNoticeForm] = useState(initialNotice);
  const [eventForm, setEventForm] = useState(initialEvent);
  const [boothForm, setBoothForm] = useState(initialBooth);
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [bulk, setBulk] = useState({ day: "", place: "", statusOverride: "지연", delayMinutes: "30", liveMessage: "" });
  const [bulkBusy, setBulkBusy] = useState(false);
  const [expandedEventIds, setExpandedEventIds] = useState(() => new Set());

  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [editingBoothId, setEditingBoothId] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPanel, setAiPanel] = useState(null);
  const [aiDraftType, setAiDraftType] = useState("congestion");

  const booths = useMemo(
    () =>
      (data?.booths || [])
        .slice()
        .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999)),
    [data],
  );

  async function load() {
    if (!key) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      const next = await fetchOpsMasterBootstrap(key);
      setData(next);

      const nextLiveDrafts = {};
      next.booths.forEach((booth) => {
        nextLiveDrafts[booth.id] = {
          estimatedWaitMinutes: booth.estimatedWaitMinutes ?? "",
          remainingStock: booth.remainingStock ?? "",
          liveStatusMessage: booth.liveStatusMessage ?? "",
        };
      });
      setBoothLiveDrafts(nextLiveDrafts);

      const nextEventDrafts = {};
      next.events.forEach((event) => {
        nextEventDrafts[event.id] = {
          liveMessage: event.liveMessage || "",
          delayMinutes: event.delayMinutes ?? "",
        };
      });
      setEventLiveDrafts(nextEventDrafts);

      setError("");
    } catch (e) {
      setData(null);
      setBoothLiveDrafts({});
      setEventLiveDrafts({});
      setError(
        e.message === "Failed to fetch"
          ? "서버 연결에 실패했습니다. 백엔드 실행 상태를 확인해 주세요."
          : e.message,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [key]);

  function submitKey(e) {
    e.preventDefault();
    const next = keyInput.trim();
    sessionStorage.setItem(MASTER_KEY_STORAGE_KEY, next);
    setKey(next);
    setLoading(true);
    setError("");
    setMessage("");
  }

  function clearKey() {
    sessionStorage.removeItem(MASTER_KEY_STORAGE_KEY);
    setKeyInput("");
    setKey("");
    setData(null);
    setError("");
    setMessage("");
    setLoading(false);
  }

  async function handleQuickCongestionNotice() {
    if (!confirmAction("혼잡 완화 공지를 즉시 발행합니다.")) return;
    try {
      await triggerOpsMasterCongestionReliefNotice(key);
      setMessage("혼잡 완화 공지를 발행했습니다.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleQuickEventStartNotice(eventId) {
    if (!confirmAction("공연 시작 공지를 즉시 발행합니다.")) return;
    try {
      await triggerOpsMasterEventStartNotice(eventId, key);
      setMessage("공연 시작 공지를 발행했습니다.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleNoticeSubmit(e) {
    e.preventDefault();
    if (
      !confirmAction(
        editingNoticeId
          ? "공지 수정 내용을 저장합니다."
          : "새 공지를 등록합니다.",
      )
    )
      return;
    try {
      if (editingNoticeId) {
        await updateOpsMasterNotice(editingNoticeId, noticeForm, key);
        setMessage("공지 수정이 완료되었습니다.");
      } else {
        await createOpsMasterNotice(noticeForm, key);
        setMessage("공지 등록이 완료되었습니다.");
      }
      setNoticeForm(initialNotice);
      setEditingNoticeId(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeleteNotice(id) {
    if (!confirmAction("이 공지를 삭제합니다.")) return;
    try {
      await deleteOpsMasterNotice(id, key);
      setMessage("공지 삭제가 완료되었습니다.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleEventSubmit(e) {
    e.preventDefault();
    if (
      !confirmAction(
        editingEventId
          ? "공연 수정 내용을 저장합니다."
          : "새 공연을 등록합니다.",
      )
    )
      return;
    try {
      const payload = {
        title: eventForm.title,
        startTime: toApiDateTime(eventForm.startTime),
        endTime: toApiDateTime(eventForm.endTime),
        imageUrl: eventForm.imageUrl,
        imageCredit: eventForm.imageCredit,
        imageFocus: eventForm.imageFocus,
        statusOverride: eventForm.statusOverride,
        liveMessage: eventForm.liveMessage,
        delayMinutes:
          eventForm.delayMinutes === "" ? null : Number(eventForm.delayMinutes),
      };

      if (editingEventId) {
        await updateOpsMasterEvent(editingEventId, payload, key);
        setMessage("공연 수정이 완료되었습니다.");
      } else {
        await createOpsMasterEvent(payload, key);
        setMessage("공연 등록이 완료되었습니다.");
      }

      setEventForm(initialEvent);
      setEditingEventId(null);
      setEventEditorOpen(false);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeleteEvent(id) {
    if (!confirmAction("이 공연을 삭제합니다.")) return;
    try {
      await deleteOpsMasterEvent(id, key);
      setMessage("공연 삭제가 완료되었습니다.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleAiBriefing() {
    setAiBusy(true);
    setError("");
    try {
      const result = await fetchOpsMasterAiBriefing(key);
      setAiPanel(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function handleAiNoticeDraft(type = aiDraftType) {
    setAiBusy(true);
    setError("");
    try {
      const result = await createOpsMasterAiNoticeDraft(type, "", key);
      setAiPanel(result);
      setNoticeForm((prev) => ({
        ...prev,
        title: result.draftTitle || prev.title,
        content: result.draftContent || prev.content,
        category: result.draftCategory || prev.category,
        active: true,
      }));
      setTab("notice");
      setMessage("AI 공지 초안을 공지 입력칸에 반영했습니다. 확인 후 등록해 주세요.");
    } catch (e) {
      setError(e.message);
    } finally {
      setAiBusy(false);
    }
  }

  function eventPayload(event, overrides = {}) {
    return {
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      imageUrl: event.imageUrl || "",
      imageCredit: event.imageCredit || "",
      imageFocus: event.imageFocus || "",
      statusOverride: event.statusOverride || "",
      liveMessage: event.liveMessage || "",
      delayMinutes: event.delayMinutes ?? null,
      ...overrides,
    };
  }

  const bulkTargets = (data?.events || []).filter((event) => {
    if (bulk.day && !`${event.startTime || ""}`.startsWith(bulk.day)) return false;
    if (bulk.place && !`${event.liveMessage || ""}${event.title || ""}`.includes(bulk.place)) return false;
    return true;
  });

  async function handleBulkStatus(clear = false) {
    if (!bulkTargets.length) return;
    const label = clear ? "자동 상태로 되돌리기" : `${bulk.statusOverride}${bulk.statusOverride === "지연" && bulk.delayMinutes ? ` ${bulk.delayMinutes}분` : ""}`;
    if (!window.confirm(`${bulkTargets.length}개 공연을 "${label}"(으)로 바꿀까요?`)) return;
    setBulkBusy(true);
    try {
      if (clear) {
        // 되돌릴 때는 일괄 변경으로 적어 둔 '손님에게 보일 한 줄'도 같이 지운다. "장소: ..." 메모는 그대로 둔다.
        // (서버는 liveMessage 가 null 이면 그대로 두고, 빈 글자면 지운다.)
        const keepsMemo = (event) => !`${event.liveMessage || ""}`.trim() || `${event.liveMessage}`.trim().startsWith("장소");
        const groups = [
          [bulkTargets.filter(keepsMemo), null],
          [bulkTargets.filter((event) => !keepsMemo(event)), ""],
        ];
        for (const [targets, liveMessage] of groups) {
          if (!targets.length) continue;
          await bulkUpdateOpsMasterEventStatus(
            { eventIds: targets.map((event) => event.id), statusOverride: "", delayMinutes: 0, liveMessage },
            key,
          );
        }
      } else {
        await bulkUpdateOpsMasterEventStatus(
          {
            eventIds: bulkTargets.map((event) => event.id),
            statusOverride: bulk.statusOverride,
            delayMinutes: bulk.statusOverride === "지연" ? Number(bulk.delayMinutes) || 0 : null,
            liveMessage: bulk.liveMessage || null,
          },
          key,
        );
      }
      setMessage(`${bulkTargets.length}개 공연을 ${label}(으)로 바꿨습니다.`);
      await load();
    } catch (error) {
      setError(error.message);
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleQuickEventStatus(event, statusOverride) {
    try {
      const draft = eventLiveDrafts[event.id] || {};
      await updateOpsMasterEvent(
        event.id,
        eventPayload(event, {
          statusOverride,
          liveMessage: draft.liveMessage || "",
          delayMinutes:
            draft.delayMinutes === "" || draft.delayMinutes == null
              ? null
              : Number(draft.delayMinutes),
        }),
        key,
      );
      setMessage(statusOverride ? `${event.title} 상태를 ${statusOverride}(으)로 변경했습니다.` : `${event.title} 상태를 자동 계산으로 변경했습니다.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleQuickEventMessage(event) {
    try {
      const draft = eventLiveDrafts[event.id] || {};
      await updateOpsMasterEvent(
        event.id,
        eventPayload(event, {
          liveMessage: draft.liveMessage || "",
          delayMinutes:
            draft.delayMinutes === "" || draft.delayMinutes == null
              ? null
              : Number(draft.delayMinutes),
        }),
        key,
      );
      setMessage(`${event.title} 현장 안내를 저장했습니다.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function toggleEventExpanded(eventId) {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  async function handleBoothSubmit(e) {
    e.preventDefault();
    if (
      !confirmAction(
        editingBoothId
          ? "부스 수정 내용을 저장합니다."
          : "새 부스를 등록합니다.",
      )
    )
      return;
    try {
      const payload = {
        ...boothForm,
        latitude: Number(boothForm.latitude),
        longitude: Number(boothForm.longitude),
        openTime: boothForm.openTime || null,
        closeTime: boothForm.closeTime || null,
        estimatedWaitMinutes:
          boothForm.estimatedWaitMinutes === ""
            ? null
            : Number(boothForm.estimatedWaitMinutes),
        remainingStock:
          boothForm.remainingStock === ""
            ? null
            : Number(boothForm.remainingStock),
      };

      if (editingBoothId) {
        await updateOpsMasterBooth(editingBoothId, payload, key);
        setMessage("부스 수정이 완료되었습니다.");
      } else {
        await createOpsMasterBooth(payload, key);
        setMessage("부스 등록이 완료되었습니다.");
      }

      setBoothForm(initialBooth);
      setEditingBoothId(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeleteBooth(id) {
    if (!confirmAction("이 부스를 삭제합니다.")) return;
    try {
      await deleteOpsMasterBooth(id, key);
      setMessage("부스 삭제가 완료되었습니다.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSaveLiveStatus(boothId) {
    if (!confirmAction("해당 부스의 실시간 운영 상태를 저장합니다.")) return;
    try {
      const draft = boothLiveDrafts[boothId] || {};
      await updateOpsMasterBoothLiveStatus(
        boothId,
        {
          estimatedWaitMinutes:
            draft.estimatedWaitMinutes === ""
              ? null
              : Number(draft.estimatedWaitMinutes),
          remainingStock:
            draft.remainingStock === "" ? null : Number(draft.remainingStock),
          liveStatusMessage: draft.liveStatusMessage || null,
        },
        key,
      );
      setMessage("실시간 운영 상태를 저장했습니다.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function moveBooth(boothId, direction) {
    const index = booths.findIndex((item) => item.id === boothId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= booths.length) {
      return;
    }

    const next = [...booths];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);

    if (!confirmAction("부스 노출 순서를 변경합니다.")) return;
    try {
      await reorderOpsMasterBooths(
        next.map((booth) => booth.id),
        key,
      );
      setMessage("부스 순서를 변경했습니다.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className={`cyber-page pt-4 space-y-3 ${embedded ? "ops-master-embedded" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-role-ops inline-flex items-center gap-1.5">
          <IconShield className="h-5 w-5 icon-role-ops" />
          통합 운영 콘솔
        </h2>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          새로고침
        </button>
      </div>

      <form
        onSubmit={submitKey}
        className="rounded-xl border border-slate-200 bg-white p-3 space-y-2"
      >
        <p className="text-sm font-semibold text-role-ops inline-flex items-center gap-1.5">
          <IconSettings className="h-4 w-4 icon-role-ops" />
          운영 키 입력
        </p>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <input
            className="border rounded px-2 py-2 text-sm"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="0000"
          />
          <button
            type="submit"
            className="rounded border px-3 py-2 text-sm font-semibold"
          >
            적용
          </button>
          <button
            type="button"
            onClick={clearKey}
            className="rounded border px-3 py-2 text-sm"
          >
            초기화
          </button>
        </div>
      </form>

      {!key && (
        <p className="text-sm text-rose-600">
          운영 키를 입력해 주세요.
        </p>
      )}
      {loading && <p className="text-sm text-slate-600">불러오는 중...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-teal-700">{message}</p>}

      {data && (
        <>
          <article className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <h3 className="font-semibold text-role-log inline-flex items-center gap-1.5">
              <IconClipboard className="h-4 w-4 icon-role-log" />
              상황 요약
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-teal-50 p-2">
                <p className="text-[10px] text-teal-700">오늘 총 방문</p>
                <p className="font-bold text-teal-800">
                  {data.kpi?.todayVisitorCount ?? 0}
                </p>
              </div>
              <div className="rounded bg-amber-50 p-2">
                <p className="text-[10px] text-amber-700">최대 혼잡</p>
                <p className="text-xs font-bold text-amber-800 line-clamp-1">
                  {data.kpi?.mostCongestedBooth?.boothName || "-"}
                </p>
              </div>
              <div className="rounded bg-indigo-50 p-2">
                <p className="text-[10px] text-indigo-700">30분 내 공연</p>
                <p className="text-xs font-bold text-indigo-800 line-clamp-1">
                  {data.kpi?.upcomingWithin30Minutes?.title || "-"}
                </p>
              </div>
            </div>

            {data.aiMatch ? (
              <a href="/ai-match/admin" className="block rounded-xl border border-violet-200 bg-violet-50 p-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-violet-950">사주 소개팅</p>
                  <span className="text-[11px] font-bold text-violet-700">관리자 열기 →</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  <div><p className="text-[10px] text-violet-700">활성</p><p className="font-bold text-violet-900">{data.aiMatch.activeProfileCount}</p></div>
                  <div><p className="text-[10px] text-violet-700">성사</p><p className="font-bold text-violet-900">{data.aiMatch.matchedCount}</p></div>
                  <div><p className="text-[10px] text-violet-700">대기 신청</p><p className="font-bold text-violet-900">{data.aiMatch.pendingRequestCount}</p></div>
                  <div><p className="text-[10px] text-rose-700">신고·검수</p><p className="font-bold text-rose-800">{data.aiMatch.openReportCount + data.aiMatch.pendingPhotoReviewCount}</p></div>
                </div>
                <p className="mt-2 text-xs text-violet-800">
                  {data.aiMatch.nextMeetupAt
                    ? `다음 부스 약속 ${data.aiMatch.nextMeetupAt.replace("T", " ").slice(5, 16)} · ${data.aiMatch.nextMeetupPair} · 오늘 ${data.aiMatch.meetupsToday}쌍`
                    : "잡힌 부스 약속이 없어요"}
                </p>
              </a>
            ) : null}

            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-cyan-950">AI 운영 코파일럿</p>
                  <p className="mt-0.5 text-xs text-cyan-800">
                    현재 데이터로 위험 요소를 요약하고 공지 초안을 준비합니다.
                  </p>
                </div>
                <span className="rounded-full border border-cyan-300 bg-white px-2 py-0.5 text-[10px] font-bold text-cyan-800">
                  검토 후 실행
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleAiBriefing}
                  disabled={aiBusy}
                  className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {aiBusy ? "분석 중..." : "현재 상황 AI 요약"}
                </button>
                <div className="grid grid-cols-[1fr_auto] gap-1.5">
                  <select
                    value={aiDraftType}
                    onChange={(e) => setAiDraftType(e.target.value)}
                    className="rounded-lg border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-900"
                  >
                    <option value="congestion">혼잡 공지</option>
                    <option value="event">공연 공지</option>
                    <option value="lost">분실물 공지</option>
                    <option value="booth">부스 공지</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAiNoticeDraft()}
                    disabled={aiBusy}
                    className="rounded-lg border border-cyan-300 bg-white px-2 py-2 text-xs font-bold text-cyan-800 disabled:opacity-60"
                  >
                    초안
                  </button>
                </div>
              </div>
              {aiPanel && (
                <div className="mt-2 rounded-lg border border-cyan-200 bg-white p-2">
                  <p className="text-xs font-extrabold text-cyan-900">{aiPanel.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {aiPanel.summary}
                  </p>
                  {aiPanel.highlights?.length > 0 && (
                    <div className="mt-2 grid gap-1">
                      {aiPanel.highlights.slice(0, 4).map((item) => (
                        <p key={item} className="rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                          {item}
                        </p>
                      ))}
                    </div>
                  )}
                  {aiPanel.recommendedActions?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {aiPanel.recommendedActions.slice(0, 3).map((item) => (
                        <div key={item} className="rounded-lg border border-cyan-100 bg-cyan-50 px-2 py-1.5">
                          <p className="text-[11px] font-semibold text-cyan-900">
                            조치: {item}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => handleAiNoticeDraft("congestion")}
                              disabled={aiBusy}
                              className="rounded-md bg-cyan-700 px-2 py-1 text-[10px] font-extrabold text-white disabled:opacity-60"
                            >
                              공지 초안
                            </button>
                            <button
                              type="button"
                              onClick={() => setAiPanel((prev) => ({
                                ...prev,
                                summary: `${prev?.summary || ""}\n\n검토 메모: ${item}`,
                              }))}
                              className="rounded-md border border-cyan-200 bg-white px-2 py-1 text-[10px] font-extrabold text-cyan-800"
                            >
                              검토 메모
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleQuickCongestionNotice}
                className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white"
              >
                혼잡 완화 공지 즉시 발행
              </button>
              <div className="grid grid-cols-2 gap-2">
                {data.events.slice(0, 4).map((event) => (
                  <button
                    key={`quick-${event.id}`}
                    type="button"
                    onClick={() => handleQuickEventStartNotice(event.id)}
                    className="rounded border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-semibold text-rose-700"
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            </div>
          </article>

          <div className="grid grid-cols-4 gap-2 rounded-xl border border-slate-200 bg-white p-2">
            <button
              type="button"
              onClick={() => setTab("notice")}
              className={`rounded py-2 text-xs font-semibold ${tab === "notice" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              공지
            </button>
            <button
              type="button"
              onClick={() => setTab("event")}
              className={`rounded py-2 text-xs font-semibold ${tab === "event" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              공연
            </button>
            <button
              type="button"
              onClick={() => setTab("booth")}
              className={`rounded py-2 text-xs font-semibold ${tab === "booth" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              부스
            </button>
            <button
              type="button"
              onClick={() => setTab("log")}
              className={`rounded py-2 text-xs font-semibold ${tab === "log" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              로그
            </button>
          </div>

          {tab === "notice" && (
            <article className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
              <h3 className="font-semibold text-role-alert inline-flex items-center gap-1.5">
                <IconAlert className="h-4 w-4 icon-role-alert" />
                실시간 공지 관리
              </h3>
              <form className="space-y-2" onSubmit={handleNoticeSubmit}>
                <input
                  className="w-full rounded border px-2 py-2 text-sm"
                  placeholder="공지 제목"
                  value={noticeForm.title}
                  onChange={(e) =>
                    setNoticeForm((p) => ({ ...p, title: e.target.value }))
                  }
                  required
                />
                <textarea
                  className="w-full rounded border px-2 py-2 text-sm"
                  rows={3}
                  placeholder="공지 내용"
                  value={noticeForm.content}
                  onChange={(e) =>
                    setNoticeForm((p) => ({ ...p, content: e.target.value }))
                  }
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="rounded border px-2 py-2 text-sm"
                    value={noticeForm.category}
                    onChange={(e) =>
                      setNoticeForm((p) => ({ ...p, category: e.target.value }))
                    }
                  >
                    {NOTICE_CATEGORIES.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 rounded border px-2 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={noticeForm.active}
                      onChange={(e) =>
                        setNoticeForm((p) => ({
                          ...p,
                          active: e.target.checked,
                        }))
                      }
                    />
                    사용자 노출
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full rounded bg-teal-700 py-2 text-sm font-semibold text-white"
                >
                  {editingNoticeId ? "공지 수정" : "공지 등록"}
                </button>
              </form>

              <div className="space-y-2">
                {data.notices.map((notice) => (
                  <div
                    key={notice.id}
                    className="rounded border border-slate-200 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        [{notice.category}] {notice.title}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${notice.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {notice.active ? "노출중" : "숨김"}
                      </span>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700" title="펼쳐 본 기기 수">
                        조회 {notice.viewCount ?? 0}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {notice.content}
                    </p>
                    <div className="mt-2 flex gap-2 justify-end">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => {
                          setEditingNoticeId(notice.id);
                          setNoticeForm({
                            title: notice.title,
                            content: notice.content,
                            category: notice.category,
                            active: notice.active,
                          });
                        }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700"
                        onClick={() => handleDeleteNotice(notice.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}

          {tab === "event" && (
            <section className="space-y-3">
              <article className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-role-schedule inline-flex items-center gap-1.5">
                      <IconCalendar className="h-4 w-4 icon-role-schedule" />
                      공연 라이브 컨트롤
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      현장 상태, 안내 문구, 지연 시간을 공연 카드에서 바로 반영합니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white"
                    onClick={() => {
                      setEditingEventId(null);
                      setEventForm(initialEvent);
                      setEventEditorOpen((open) => !open);
                    }}
                  >
                    {eventEditorOpen ? "편집 닫기" : "공연 추가"}
                  </button>
                </div>

                {eventEditorOpen && (
                  <form className="mt-3 space-y-2 rounded-lg border border-cyan-100 bg-cyan-50/40 p-3" onSubmit={handleEventSubmit}>
                    <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px]">
                      <input
                        className="w-full rounded border px-2 py-2 text-sm"
                        placeholder="공연명"
                        value={eventForm.title}
                        onChange={(e) =>
                          setEventForm((p) => ({ ...p, title: e.target.value }))
                        }
                        required
                      />
                      <input
                        type="datetime-local"
                        className="rounded border px-2 py-2 text-sm"
                        value={eventForm.startTime}
                        onChange={(e) =>
                          setEventForm((p) => ({ ...p, startTime: e.target.value }))
                        }
                        required
                      />
                      <input
                        type="datetime-local"
                        className="rounded border px-2 py-2 text-sm"
                        value={eventForm.endTime}
                        onChange={(e) =>
                          setEventForm((p) => ({ ...p, endTime: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                      <input
                        className="rounded border px-2 py-2 text-sm"
                        placeholder="사용자에게 보여줄 현장 안내"
                        value={eventForm.liveMessage}
                        onChange={(e) =>
                          setEventForm((p) => ({ ...p, liveMessage: e.target.value }))
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        className="rounded border px-2 py-2 text-sm"
                        placeholder="지연분"
                        value={eventForm.delayMinutes}
                        onChange={(e) =>
                          setEventForm((p) => ({ ...p, delayMinutes: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_180px]">
                      <input
                        className="rounded border px-2 py-2 text-sm"
                        placeholder="라인업 이미지 URL"
                        value={eventForm.imageUrl}
                        onChange={(e) =>
                          setEventForm((p) => ({ ...p, imageUrl: e.target.value }))
                        }
                      />
                      <input
                        className="rounded border px-2 py-2 text-sm"
                        placeholder="이미지 출처"
                        value={eventForm.imageCredit}
                        onChange={(e) =>
                          setEventForm((p) => ({ ...p, imageCredit: e.target.value }))
                        }
                      />
                      <input
                        className="rounded border px-2 py-2 text-sm"
                        placeholder="초점 예: 57% 42%"
                        value={eventForm.imageFocus}
                        onChange={(e) =>
                          setEventForm((p) => ({ ...p, imageFocus: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_140px_100px]">
                      <select
                        className="rounded border px-2 py-2 text-sm"
                        value={eventForm.statusOverride}
                        onChange={(e) =>
                          setEventForm((p) => ({ ...p, statusOverride: e.target.value }))
                        }
                      >
                        <option value="">상태 자동 계산</option>
                        {EVENT_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status} 고정
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white py-2 text-sm"
                        onClick={() => {
                          setEditingEventId(null);
                          setEventForm(initialEvent);
                          setEventEditorOpen(false);
                        }}
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="rounded bg-cyan-700 py-2 text-sm font-semibold text-white"
                      >
                        {editingEventId ? "수정 저장" : "등록"}
                      </button>
                    </div>
                  </form>
                )}
              </article>

              <article className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-rose-900">여러 공연 한 번에 바꾸기</p>
                    <p className="text-xs text-rose-800/80">비가 오거나 무대가 밀리면 날짜·장소로 골라서 한 번에 지연·취소해요.</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-rose-700">{bulkTargets.length}개 대상</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <select className="rounded border px-2 py-2 text-sm" value={bulk.day} onChange={(e) => setBulk((p) => ({ ...p, day: e.target.value }))}>
                    <option value="">모든 날짜</option>
                    {[...new Set((data.events || []).map((event) => `${event.startTime || ""}`.slice(0, 10)).filter(Boolean))].sort().map((day) => (
                      <option key={day} value={day}>{day.slice(5).replace("-", ".")}</option>
                    ))}
                  </select>
                  <input className="rounded border px-2 py-2 text-sm" placeholder="장소·제목 포함 글자 (예: 노천극장)" value={bulk.place} onChange={(e) => setBulk((p) => ({ ...p, place: e.target.value }))} />
                  <select className="rounded border px-2 py-2 text-sm" value={bulk.statusOverride} onChange={(e) => setBulk((p) => ({ ...p, statusOverride: e.target.value }))}>
                    {EVENT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <input className="rounded border px-2 py-2 text-sm" inputMode="numeric" placeholder="지연 분" value={bulk.delayMinutes} disabled={bulk.statusOverride !== "지연"} onChange={(e) => setBulk((p) => ({ ...p, delayMinutes: e.target.value }))} />
                </div>
                <input className="w-full rounded border px-2 py-2 text-sm" placeholder="손님에게 보일 한 줄 (선택) 예: 우천으로 30분 늦게 시작해요" value={bulk.liveMessage} onChange={(e) => setBulk((p) => ({ ...p, liveMessage: e.target.value }))} />
                <div className="flex flex-wrap gap-2 justify-end">
                  <button type="button" className="rounded border px-3 py-2 text-xs font-semibold" disabled={bulkBusy || !bulkTargets.length} onClick={() => handleBulkStatus(true)}>자동 상태로 되돌리기</button>
                  <button type="button" className="rounded bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={bulkBusy || !bulkTargets.length} onClick={() => handleBulkStatus(false)}>
                    {bulkBusy ? "적용 중…" : `${bulkTargets.length}개 적용`}
                  </button>
                </div>
              </article>

              <div className="space-y-3">
                {data.events.map((event) => {
                  const draft = eventLiveDrafts[event.id] || {};
                  const isManual = Boolean(event.statusOverride);
                  const expanded = expandedEventIds.has(event.id);
                  return (
                    <article
                      key={event.id}
                      className="rounded-xl border border-cyan-300/25 bg-slate-950/55 p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/70">
                            공연명
                          </p>
                          <h4 className="mt-0.5 break-words text-lg font-extrabold leading-tight text-cyan-50">
                            {event.title}
                          </h4>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${EVENT_STATUS_STYLES[event.status] || "border-slate-200 bg-slate-100 text-slate-600"}`}>
                              {event.status}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${isManual ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-500"}`}>
                              {isManual ? "수동" : "자동"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-cyan-100/75">
                            {formatEventTime(event.startTime)} ~ {formatEventTime(event.endTime)}
                            {event.delayMinutes ? ` · ${event.delayMinutes}분 지연` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            onClick={() => toggleEventExpanded(event.id)}
                          >
                            {expanded ? "접기" : "관리"}
                          </button>
                        </div>
                      </div>

                      {event.liveMessage && (
                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                          {event.liveMessage}
                        </p>
                      )}

                      <div className="mt-3 grid grid-cols-5 gap-1.5">
                        <button
                          type="button"
                          className={`rounded-lg border px-2 py-2 text-xs font-semibold ${!isManual ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}
                          onClick={() => handleQuickEventStatus(event, "")}
                        >
                          자동
                        </button>
                        {EVENT_QUICK_STATUS_OPTIONS.map((status) => (
                          <button
                            key={`${event.id}-${status}`}
                            type="button"
                            className={`rounded-lg border px-2 py-2 text-xs font-semibold ${event.status === status && isManual ? "border-cyan-600 bg-cyan-600 text-white" : EVENT_STATUS_STYLES[status]}`}
                            onClick={() => handleQuickEventStatus(event, status)}
                          >
                            {status}
                          </button>
                        ))}
                      </div>

                      {expanded && (
                        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <div className="grid grid-cols-4 gap-1.5">
                            {["예정", "대기중", "취소"].map((status) => (
                              <button
                                key={`${event.id}-extra-${status}`}
                                type="button"
                                className={`rounded-lg border px-2 py-2 text-xs font-semibold ${event.status === status && isManual ? "border-cyan-600 bg-cyan-600 text-white" : EVENT_STATUS_STYLES[status]}`}
                                onClick={() => handleQuickEventStatus(event, status)}
                              >
                                {status}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-semibold text-rose-700"
                              onClick={() => handleQuickEventStartNotice(event.id)}
                            >
                              시작 공지
                            </button>
                          </div>

                          <div className="grid grid-cols-[1fr_76px_68px] gap-2">
                            <input
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                              placeholder="사용자에게 보여줄 현장 안내 문구"
                              value={draft.liveMessage || ""}
                              onChange={(e) =>
                                setEventLiveDrafts((prev) => ({
                                  ...prev,
                                  [event.id]: {
                                    ...(prev[event.id] || {}),
                                    liveMessage: e.target.value,
                                  },
                                }))
                              }
                            />
                            <input
                              type="number"
                              min="0"
                              className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                              placeholder="지연"
                              value={draft.delayMinutes ?? ""}
                              onChange={(e) =>
                                setEventLiveDrafts((prev) => ({
                                  ...prev,
                                  [event.id]: {
                                    ...(prev[event.id] || {}),
                                    delayMinutes: e.target.value,
                                  },
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="rounded-lg bg-slate-900 px-2 py-2 text-xs font-semibold text-white"
                              onClick={() => handleQuickEventMessage(event)}
                            >
                              반영
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                              onClick={() => {
                                setEditingEventId(event.id);
                                setEventEditorOpen(true);
                                setEventForm({
                                  title: event.title,
                                  startTime: toInputDateTime(event.startTime),
                                  endTime: toInputDateTime(event.endTime),
                                  imageUrl: event.imageUrl || "",
                                  imageCredit: event.imageCredit || "",
                                  imageFocus: event.imageFocus || "",
                                  statusOverride: event.statusOverride || "",
                                  liveMessage: event.liveMessage || "",
                                  delayMinutes: event.delayMinutes ?? "",
                                });
                              }}
                            >
                              상세 수정
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600"
                              onClick={() => handleDeleteEvent(event.id)}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "booth" && (
            <article className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
              <h3 className="font-semibold text-role-map inline-flex items-center gap-1.5">
                <IconMapPin className="h-4 w-4 icon-role-map" />
                부스 운영 관리
              </h3>

              <form className="space-y-2" onSubmit={handleBoothSubmit}>
                <input
                  className="w-full rounded border px-2 py-2 text-sm"
                  placeholder="부스 이름"
                  value={boothForm.name}
                  onChange={(e) =>
                    setBoothForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded border px-2 py-2 text-sm"
                    placeholder="위도"
                    value={boothForm.latitude}
                    onChange={(e) =>
                      setBoothForm((p) => ({ ...p, latitude: e.target.value }))
                    }
                    required
                  />
                  <input
                    className="rounded border px-2 py-2 text-sm"
                    placeholder="경도"
                    value={boothForm.longitude}
                    onChange={(e) =>
                      setBoothForm((p) => ({ ...p, longitude: e.target.value }))
                    }
                    required
                  />
                </div>
                <textarea
                  className="w-full rounded border px-2 py-2 text-sm"
                  placeholder="설명"
                  value={boothForm.description}
                  onChange={(e) =>
                    setBoothForm((p) => ({ ...p, description: e.target.value }))
                  }
                  required
                />
                <input
                  className="w-full rounded border px-2 py-2 text-sm"
                  placeholder="이미지 URL (선택)"
                  value={boothForm.imageUrl}
                  onChange={(e) =>
                    setBoothForm((p) => ({ ...p, imageUrl: e.target.value }))
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="rounded border px-2 py-2 text-sm"
                    value={boothForm.category}
                    onChange={(e) =>
                      setBoothForm((p) => ({ ...p, category: e.target.value }))
                    }
                  >
                    {BOOTH_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded border px-2 py-2 text-sm"
                    value={boothForm.dayPart}
                    onChange={(e) =>
                      setBoothForm((p) => ({ ...p, dayPart: e.target.value }))
                    }
                  >
                    {BOOTH_DAY_PARTS.map((part) => (
                      <option key={part} value={part}>
                        {part}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    className="rounded border px-2 py-2 text-sm"
                    value={boothForm.openTime}
                    onChange={(e) =>
                      setBoothForm((p) => ({ ...p, openTime: e.target.value }))
                    }
                  />
                  <input
                    type="time"
                    className="rounded border px-2 py-2 text-sm"
                    value={boothForm.closeTime}
                    onChange={(e) =>
                      setBoothForm((p) => ({ ...p, closeTime: e.target.value }))
                    }
                  />
                </div>
                <input
                  className="w-full rounded border px-2 py-2 text-sm"
                  placeholder="태그 (예: 예약필요, 무료, 실내)"
                  value={boothForm.tags}
                  onChange={(e) =>
                    setBoothForm((p) => ({ ...p, tags: e.target.value }))
                  }
                />
                <textarea
                  className="w-full rounded border px-2 py-2 text-sm"
                  placeholder="부스 유형별 추가 정보(JSON 또는 메모)"
                  value={boothForm.contentJson}
                  onChange={(e) =>
                    setBoothForm((p) => ({ ...p, contentJson: e.target.value }))
                  }
                />
                <label className="flex items-center gap-2 rounded border px-2 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={boothForm.reservationEnabled}
                    onChange={(e) =>
                      setBoothForm((p) => ({
                        ...p,
                        reservationEnabled: e.target.checked,
                      }))
                    }
                  />
                  예약/웨이팅 기능 사용
                </label>
                <button
                  type="submit"
                  className="w-full rounded bg-teal-700 py-2 text-sm font-semibold text-white"
                >
                  {editingBoothId ? "부스 수정" : "부스 등록"}
                </button>
              </form>

              <div className="space-y-2">
                {booths.map((booth, index) => (
                  <div
                    key={booth.id}
                    className="rounded border border-slate-200 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        #{booth.displayOrder} {booth.name}
                      </p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() => moveBooth(booth.id, -1)}
                          disabled={index === 0}
                        >
                          위
                        </button>
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() => moveBooth(booth.id, 1)}
                          disabled={index === booths.length - 1}
                        >
                          아래
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {booth.category || "주점"} · {booth.dayPart || "야간"}
                      {booth.openTime || booth.closeTime
                        ? ` · ${booth.openTime || "--:--"}~${booth.closeTime || "--:--"}`
                        : ""}
                      {booth.reservationEnabled === false ? " · 예약 없음" : ""}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <input
                        className="rounded border px-2 py-2 text-xs"
                        placeholder="대기 분"
                        value={
                          boothLiveDrafts[booth.id]?.estimatedWaitMinutes ?? ""
                        }
                        onChange={(e) =>
                          setBoothLiveDrafts((p) => ({
                            ...p,
                            [booth.id]: {
                              ...p[booth.id],
                              estimatedWaitMinutes: e.target.value,
                            },
                          }))
                        }
                      />
                      <input
                        className="rounded border px-2 py-2 text-xs"
                        placeholder="잔여 수량"
                        value={boothLiveDrafts[booth.id]?.remainingStock ?? ""}
                        onChange={(e) =>
                          setBoothLiveDrafts((p) => ({
                            ...p,
                            [booth.id]: {
                              ...p[booth.id],
                              remainingStock: e.target.value,
                            },
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="rounded border px-2 py-2 text-xs font-semibold"
                        onClick={() => handleSaveLiveStatus(booth.id)}
                      >
                        실시간 저장
                      </button>
                    </div>
                    <input
                      className="mt-2 w-full rounded border px-2 py-2 text-xs"
                      placeholder="운영 메모"
                      value={boothLiveDrafts[booth.id]?.liveStatusMessage ?? ""}
                      onChange={(e) =>
                        setBoothLiveDrafts((p) => ({
                          ...p,
                          [booth.id]: {
                            ...p[booth.id],
                            liveStatusMessage: e.target.value,
                          },
                        }))
                      }
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => {
                          setEditingBoothId(booth.id);
                          setBoothForm({
                            name: booth.name,
                            latitude: String(booth.latitude),
                            longitude: String(booth.longitude),
                            description: booth.description,
                        imageUrl: booth.imageUrl || "",
                        category: booth.category || "주점",
                        dayPart: booth.dayPart || "야간",
                        openTime: booth.openTime || "",
                        closeTime: booth.closeTime || "",
                        tags: booth.tags || "",
                        contentJson: booth.contentJson || "",
                        reservationEnabled: booth.reservationEnabled ?? true,
                        estimatedWaitMinutes:
                          booth.estimatedWaitMinutes ?? "",
                            remainingStock: booth.remainingStock ?? "",
                            liveStatusMessage: booth.liveStatusMessage || "",
                          });
                        }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700"
                        onClick={() => handleDeleteBooth(booth.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}

          {tab === "log" && (
            <article className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="font-semibold text-role-log inline-flex items-center gap-1.5">
                <IconClipboard className="h-4 w-4 icon-role-log" />
                최근 운영 로그
              </h3>
              <div className="mt-2 max-h-[420px] space-y-2 overflow-auto pr-1">
                {data.auditLogs?.length === 0 && (
                  <p className="text-sm text-slate-500">
                    아직 기록이 없습니다.
                  </p>
                )}
                {data.auditLogs?.map((log) => (
                  <div
                    key={log.id}
                    className="rounded border border-slate-200 bg-slate-50 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {log.adminUsername} / {log.action} / {log.targetType}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {log.createdAt?.replace("T", " ").slice(5, 16)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{log.details}</p>
                  </div>
                ))}
              </div>
            </article>
          )}
        </>
      )}
    </section>
  );
}


