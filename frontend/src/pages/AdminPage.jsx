import { useEffect, useMemo, useState } from "react";
import {
  createAdminAiNoticeDraft,
  createBooth,
  createEvent,
  createNotice,
  deleteBooth,
  deleteEvent,
  deleteNotice,
  fetchAdminAiBriefing,
  fetchAdminAiMatchSummary,
  bulkUpdateAdminEventStatus,
  fetchAdminDashboardKpis,
  fetchAdminNotices,
  fetchAdminStaff,
  fetchAuditLogs,
  fetchBooths,
  fetchEvents,
  importBoothCsv,
  importEventCsv,
  loginAdmin,
  reorderBooths,
  triggerCongestionReliefNotice,
  triggerEventStartNotice,
  updateAdminStaff,
  updateBooth,
  updateBoothLiveStatus,
  updateEvent,
  updateNotice,
  uploadBoothImage,
} from "../api";
import AdminLostItems from "../components/admin/AdminLostItems";
import {
  IconAlert,
  IconBell,
  IconBox,
  IconCalendar,
  IconChart,
  IconClipboard,
  IconEye,
  IconEyeOff,
  IconClock,
  IconHome,
  IconRefresh,
  IconSettings,
  IconShield,
  IconUsers,
} from "../components/UxIcons";
import OpsMasterPage from "./OpsMasterPage";
import { FESTIVAL, findMainBooth } from "../config/festival";
import "../styles/admin-home.css";
import { clearLogin, getAdminName, isLoggedIn, saveLogin } from "../utils/auth";

const NOTICE_CATEGORIES = ["긴급", "분실물", "우천", "일반"];

const initialBooth = {
  name: "",
  latitude: "",
  longitude: "",
  description: "",
  imageUrl: "",
  estimatedWaitMinutes: "",
  remainingStock: "",
  liveStatusMessage: "",
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

const initialNotice = {
  title: "",
  content: "",
  category: "긴급",
  active: true,
};

function adminErrorMessage(error) {
  if (error?.status === 401 || error?.status === 403) {
    return "권한이 만료되었거나 로그인이 필요합니다. 다시 로그인해 주세요.";
  }
  if (typeof error?.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }
  return "요청을 처리하지 못했습니다.";
}

function isUnauthorizedLike(error) {
  return error?.status === 401 || error?.status === 403;
}

function parseNumber(value, label, { required = false } = {}) {
  const raw = value == null ? "" : String(value).trim();
  if (raw === "") {
    if (required) {
      throw new Error(`${label}은(는) 필수 값입니다.`);
    }
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label}은(는) 숫자 형식이어야 합니다.`);
  }
  return parsed;
}

function toApiDateTime(value) {
  return value && value.length === 16 ? `${value}:00` : value;
}

function normalizeNoticeCategory(category) {
  if (NOTICE_CATEGORIES.includes(category)) return category;
  if (category === "분실물") return "분실물";
  if (category === "긴급") return "긴급";
  return "일반";
}

const LOG_TARGETS = { BOOTH: "부스", EVENT: "공연", NOTICE: "공지", STAFF: "스태프", SIMULATION: "시뮬레이션" };
const LOG_ACTIONS = {
  CREATE: "등록",
  UPDATE: "수정",
  DELETE: "삭제",
  LIVE_STATUS: "현장 상태 변경",
  REORDER: "순서 변경",
  UPLOAD_IMAGE: "사진 등록",
  MENU_IMAGE: "메뉴판 등록",
  MENU_ITEM_IMAGE: "메뉴 사진 등록",
  BULK_STATUS: "상태 일괄 변경",
  IMPORT: "CSV 가져오기",
  ACTION: "자동 공지 발행",
  QUICK_ACTION: "자동 공지 발행",
  ORDER_STATUS: "주문 상태 변경",
  ORDER_CONFIG: "주문 설정 변경",
  RESERVATION_CONFIG: "테이블 설정 변경",
  RESERVATION_TABLE_OCCUPY: "테이블 사용 처리",
  RESERVATION_TABLE_RELEASE: "테이블 비움 처리",
  RESERVATION_CHECKIN: "예약 입장 처리",
  RESERVATION_COMPLETE: "예약 완료 처리",
  START: "시작",
  STOP: "중지",
  RESET: "초기화",
  SCENARIO: "시나리오 변경",
};

// 운영 로그 한 줄을 사람이 읽는 말로. 서버 action 코드(OPS_MASTER_UPDATE 등)에서 접두사를 떼고 뜻을 붙인다.
function describeAuditLog(log) {
  const code = `${log?.action || ""}`.replace(/^OPS_(MASTER|BOOTH|SIMULATION)_/, "");
  const target = LOG_TARGETS[log?.targetType] || "";
  const action = LOG_ACTIONS[code] || code.toLowerCase();
  const details = `${log?.details || ""}`.trim();
  const title = [target, action].filter(Boolean).join(" ");
  const readableDetail = /[가-힣]/.test(details) && details !== title ? details : "";
  return readableDetail ? `${title} · ${readableDetail}` : title;
}

function moveItem(list, fromId, toId) {
  const fromIndex = list.findIndex((item) => item.id === fromId);
  const toIndex = list.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;

  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [adminName, setAdminName] = useState(getAdminName());
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const [kpi, setKpi] = useState(null);
  const [aiMatchSummary, setAiMatchSummary] = useState(null);
  const [bulk, setBulk] = useState({ day: "", place: "", statusOverride: "지연", delayMinutes: "30", liveMessage: "" });
  const [bulkBusy, setBulkBusy] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [booths, setBooths] = useState([]);
  const [events, setEvents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [aiBriefing, setAiBriefing] = useState(null);
  const [aiNoticeDraft, setAiNoticeDraft] = useState(null);
  const [aiDraftType, setAiDraftType] = useState("congestion");
  const [aiPrompt, setAiPrompt] = useState("");

  const [boothForm, setBoothForm] = useState(initialBooth);
  const [eventForm, setEventForm] = useState(initialEvent);
  const [noticeForm, setNoticeForm] = useState(initialNotice);
  const [editingBoothId, setEditingBoothId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [editingNoticeId, setEditingNoticeId] = useState(null);

  const [importFiles, setImportFiles] = useState({ booths: null, events: null });
  const [uploadFiles, setUploadFiles] = useState({});
  const [draggingBoothId, setDraggingBoothId] = useState(null);
  const [boothLiveDrafts, setBoothLiveDrafts] = useState({});
  const [staffDrafts, setStaffDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState({});
  const [activeAdminView, setActiveAdminView] = useState("dashboard");

  const sortedBooths = useMemo(
    () => [...booths].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999)),
    [booths],
  );
  const isBusy = isLoading || Object.keys(actionBusy).length > 0;
  const isLoginPending = isActionBusy("admin-login");

  function isActionBusy(actionKey) {
    return Boolean(actionBusy[actionKey]);
  }

  async function runAdminAction(actionKey, progressMessage, action, successMessage = "") {
    if (isActionBusy(actionKey)) return;
    setActionBusy((prev) => ({ ...prev, [actionKey]: true }));
    setMessage(progressMessage);
    try {
      await action();
      if (successMessage) setMessage(successMessage);
    } catch (error) {
      if (isUnauthorizedLike(error)) {
        clearLogin();
        setLoggedIn(false);
        setAdminName("");
      }
      throw error;
    } finally {
      setActionBusy((prev) => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
    }
  }

  const bulkTargets = events.filter((event) => {
    if (bulk.day && !`${event.startTime || ""}`.startsWith(bulk.day)) return false;
    if (bulk.place && !`${event.liveMessage || ""}${event.title || ""}`.includes(bulk.place)) return false;
    return true;
  });

  async function handleBulkEventStatus(clear = false) {
    if (!bulkTargets.length) return;
    const label = clear ? "자동 상태" : `${bulk.statusOverride}${bulk.statusOverride === "지연" && bulk.delayMinutes ? ` ${bulk.delayMinutes}분` : ""}`;
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
          await bulkUpdateAdminEventStatus({ eventIds: targets.map((event) => event.id), statusOverride: "", delayMinutes: 0, liveMessage });
        }
      } else {
        await bulkUpdateAdminEventStatus({
          eventIds: bulkTargets.map((event) => event.id),
          statusOverride: bulk.statusOverride,
          delayMinutes: bulk.statusOverride === "지연" ? Number(bulk.delayMinutes) || 0 : null,
          liveMessage: bulk.liveMessage || null,
        });
      }
      setMessage(`${bulkTargets.length}개 공연을 ${label}(으)로 바꿨습니다.`);
      await loadAll({ keepMessage: true });
    } catch (error) {
      setMessage(adminErrorMessage(error));
    } finally {
      setBulkBusy(false);
    }
  }

  // keepMessage: 저장 · 삭제 뒤에 부를 때. 방금 띄운 확인 문구("공지를 등록했습니다" 등)를 지우지 않는다.
  async function loadAll({ keepMessage = false } = {}) {
    setIsLoading(true);
    if (!keepMessage) setMessage("관리자 대시보드 동기화 중...");

    try {
      // AI 브리핑은 수십 초 걸릴 수 있어 여기서 기다리지 않는다. 혼잡도 모니터링 화면을 열 때 따로 부른다.
      const [boothResult, eventResult, noticeResult, kpiResult, logResult, staffResult, aiMatchResult] = await Promise.allSettled([
        fetchBooths(),
        fetchEvents(),
        fetchAdminNotices(),
        fetchAdminDashboardKpis(),
        fetchAuditLogs(),
        fetchAdminStaff(),
        fetchAdminAiMatchSummary(),
      ]);

      const boothData = boothResult.status === "fulfilled" && Array.isArray(boothResult.value) ? boothResult.value : [];
      const eventData = eventResult.status === "fulfilled" && Array.isArray(eventResult.value) ? eventResult.value : [];
      const noticeData = noticeResult.status === "fulfilled" && Array.isArray(noticeResult.value) ? noticeResult.value : [];
      const logData = logResult.status === "fulfilled" && Array.isArray(logResult.value) ? logResult.value : [];
      const staffData = staffResult.status === "fulfilled" && Array.isArray(staffResult.value) ? staffResult.value : [];
      const kpiData = kpiResult.status === "fulfilled" ? kpiResult.value : null;
      setAiMatchSummary(aiMatchResult.status === "fulfilled" ? aiMatchResult.value : null);

      setBooths(boothData);
      setEvents(eventData);
      setNotices(noticeData);
      setKpi(kpiData);
      setAuditLogs(logData);
      setStaffMembers(staffData);

      if (boothResult.status === "fulfilled") {
        setBoothLiveDrafts(
          Object.fromEntries(
            boothData.map((booth) => [
              booth.id,
              {
                estimatedWaitMinutes: booth.estimatedWaitMinutes ?? "",
                remainingStock: booth.remainingStock ?? "",
                liveStatusMessage: booth.liveStatusMessage ?? "",
              },
            ]),
          ),
        );
      } else {
        setBoothLiveDrafts({});
      }

      if (staffResult.status === "fulfilled") {
        setStaffDrafts(
          Object.fromEntries(
            staffData.map((staff) => [
              staff.id,
              {
                team: staff.team ?? "",
                status: staff.status ?? "STANDBY",
                currentTask: staff.currentTask ?? "",
                currentNote: staff.currentNote ?? "",
                assignedBoothId: staff.assignedBoothId ?? "",
              },
            ]),
          ),
        );
      } else {
        setStaffDrafts({});
      }

      const anyUnauthorized = [noticeResult, kpiResult, logResult, staffResult].some(
        (result) => result.status === "rejected" && isUnauthorizedLike(result.reason),
      );
      if (anyUnauthorized) {
        clearLogin();
        setLoggedIn(false);
        setAdminName("");
        setBooths([]);
        setEvents([]);
        setNotices([]);
        setKpi(null);
        setAuditLogs([]);
        setStaffMembers([]);
        setAiBriefing(null);
        setAiNoticeDraft(null);
        setBoothLiveDrafts({});
        setStaffDrafts({});
        setMessage("권한이 만료되었거나 로그인이 필요합니다. 다시 로그인해 주세요.");
        return;
      }

      if (eventResult.status === "rejected") {
        setMessage(adminErrorMessage(eventResult.reason));
      }
      if (noticeResult.status === "rejected") {
        setMessage(adminErrorMessage(noticeResult.reason));
      }
      if (kpiResult.status === "rejected") {
        setMessage(adminErrorMessage(kpiResult.reason));
      }
      if (logResult.status === "rejected") {
        setMessage(adminErrorMessage(logResult.reason));
      }
      if (staffResult.status === "rejected") {
        setMessage(adminErrorMessage(staffResult.reason));
      }
      if (boothResult.status === "rejected") {
        setMessage(adminErrorMessage(boothResult.reason));
      }
      const anyRejected = [boothResult, eventResult, noticeResult, kpiResult, logResult, staffResult].some(
        (result) => result.status === "rejected",
      );
      if (!anyRejected && !keepMessage) {
        setMessage("");
      }
    } catch (error) {
      setMessage(adminErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshAiBriefing({ silent = false } = {}) {
    try {
      const next = await fetchAdminAiBriefing();
      setAiBriefing(next);
      if (!silent) {
        setMessage("AI 운영 브리핑을 갱신했습니다.");
      }
    } catch (error) {
      if (isUnauthorizedLike(error)) {
        clearLogin();
        setLoggedIn(false);
        setAdminName("");
        return;
      }
      if (!silent) {
        setMessage(adminErrorMessage(error));
      }
    }
  }

  function resetBoothForm() {
    setBoothForm(initialBooth);
    setEditingBoothId(null);
  }

  function resetEventForm() {
    setEventForm(initialEvent);
    setEditingEventId(null);
  }

  function resetNoticeForm() {
    setNoticeForm(initialNotice);
    setEditingNoticeId(null);
  }

  function beginEditBooth(booth) {
    setEditingBoothId(booth.id);
    setBoothForm({
      name: booth.name || "",
      latitude: String(booth.latitude ?? ""),
      longitude: String(booth.longitude ?? ""),
      description: booth.description || "",
      imageUrl: booth.imageUrl || "",
      estimatedWaitMinutes: booth.estimatedWaitMinutes ?? "",
      remainingStock: booth.remainingStock ?? "",
      liveStatusMessage: booth.liveStatusMessage || "",
    });
  }

  function beginEditEvent(event) {
    setEditingEventId(event.id);
    setEventForm({
      title: event.title || "",
      startTime: event.startTime?.slice(0, 16) || "",
      endTime: event.endTime?.slice(0, 16) || "",
      imageUrl: event.imageUrl || "",
      imageCredit: event.imageCredit || "",
      imageFocus: event.imageFocus || "",
      statusOverride: event.statusOverride || "",
      liveMessage: event.liveMessage || "",
      delayMinutes: event.delayMinutes ?? "",
    });
  }

  function beginEditNotice(notice) {
    setEditingNoticeId(notice.id);
    setNoticeForm({
      title: notice.title || "",
      content: notice.content || "",
      category: notice.category || "긴급",
      active: Boolean(notice.active),
    });
  }

  useEffect(() => {
    if (loggedIn) {
      loadAll();
    }
  }, [loggedIn]);

  // AI 브리핑은 혼잡도 모니터링 화면을 보고 있을 때만 부르고 갱신한다(다른 화면에선 호출하지 않는다).
  useEffect(() => {
    if (!loggedIn || activeAdminView !== "ai") return undefined;
    refreshAiBriefing({ silent: true });
    const timer = window.setInterval(() => {
      refreshAiBriefing({ silent: true });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loggedIn, activeAdminView]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!loginForm.username.trim() || !loginForm.password) {
      setMessage("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      await runAdminAction("admin-login", "로그인 처리 중...", async () => {
        const data = await loginAdmin(loginForm.username.trim(), loginForm.password);
        saveLogin(data.token, data.username);
        setAdminName(data.username);
        setLoggedIn(true);
        setMessage("관리자 로그인이 완료되었습니다.");
        setLoginForm({ username: "", password: "" });
        setShowPassword(false);
      });
    } catch (error) {
      setMessage(adminErrorMessage(error));
    }
  }

  function handleLogout() {
    clearLogin();
    setLoggedIn(false);
    setAdminName("");
    setAiBriefing(null);
    setAiNoticeDraft(null);
    setMessage("로그아웃되었습니다.");
  }

  async function handleQuickCongestionNotice() {
    if (!window.confirm("혼잡 완화 공지를 즉시 발행할까요?")) return;
    await runAdminAction("quick-congestion-notice", "혼잡 완화 공지를 발행 중입니다.", async () => {
      await triggerCongestionReliefNotice();
      setMessage("혼잡 완화 공지를 발행했습니다.");
      await loadAll({ keepMessage: true });
    });
  }

  async function handleQuickEventStartNotice(eventId) {
    if (!window.confirm("공연 시작 공지를 발행할까요?")) return;
    await runAdminAction(`quick-event-notice-${eventId}`, "공연 시작 공지를 발행 중입니다.", async () => {
      await triggerEventStartNotice(eventId);
      setMessage("공연 시작 공지를 발행했습니다.");
      await loadAll({ keepMessage: true });
    });
  }

  async function handleAiNoticeDraft() {
    await runAdminAction("admin-ai-notice-draft", "AI가 현재 혼잡 상황과 공지 문구를 분석 중입니다.", async () => {
      const draft = await createAdminAiNoticeDraft(aiDraftType, aiPrompt);
      setAiNoticeDraft(draft);
      setNoticeForm({
        title: draft.draftTitle || "축제 운영 안내",
        content: draft.draftContent || draft.summary || "현장 상황에 따라 안내를 확인해 주세요.",
        category: normalizeNoticeCategory(draft.draftCategory),
        active: true,
      });
      setEditingNoticeId(null);
      setMessage("AI 공지 추천을 공지 입력칸에 반영했습니다. 확인 후 등록하세요.");
      scrollToAdminSection("admin-notices");
    });
  }

  async function handleSaveBoothLiveStatus(boothId) {
    await runAdminAction(`booth-live-save-${boothId}`, "부스 실시간 정보를 저장 중입니다.", async () => {
      const draft = boothLiveDrafts[boothId] || {};
      const estimatedWaitMinutes = parseNumber(draft.estimatedWaitMinutes, "대기 분", { required: false });
      const remainingStock = parseNumber(draft.remainingStock, "잔여 수량", { required: false });

      await updateBoothLiveStatus(boothId, {
        estimatedWaitMinutes,
        remainingStock,
        liveStatusMessage: draft.liveStatusMessage || null,
      });
      setMessage("부스 실시간 운영 정보를 저장했습니다.");
      await loadAll({ keepMessage: true });
    });
  }

  async function handleSaveStaff(staffId) {
    await runAdminAction(`staff-save-${staffId}`, "스태프 정보를 저장 중입니다.", async () => {
      const draft = staffDrafts[staffId] || {};
      await updateAdminStaff(staffId, {
        team: draft.team || null,
        status: draft.status || "STANDBY",
        currentTask: draft.currentTask || null,
        currentNote: draft.currentNote || null,
        assignedBoothId: draft.assignedBoothId === "" || draft.assignedBoothId == null ? null : Number(draft.assignedBoothId),
      });
      setMessage("스태프 정보를 저장했습니다.");
      await loadAll({ keepMessage: true });
    });
  }

  async function handleBoothSubmit(e) {
    e.preventDefault();
    const parsedLatitude = parseNumber(boothForm.latitude, "위도", { required: true });
    const parsedLongitude = parseNumber(boothForm.longitude, "경도", { required: true });
    const estimatedWaitMinutes = parseNumber(boothForm.estimatedWaitMinutes, "대기 분", { required: false });
    const remainingStock = parseNumber(boothForm.remainingStock, "잔여 수량", { required: false });

    await runAdminAction(editingBoothId ? `booth-update-${editingBoothId}` : "booth-create", "부스를 저장 중입니다.", async () => {
      const payload = {
        name: boothForm.name.trim(),
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        description: boothForm.description.trim(),
        imageUrl: boothForm.imageUrl.trim(),
        estimatedWaitMinutes,
        remainingStock,
        liveStatusMessage: boothForm.liveStatusMessage.trim(),
      };

      if (editingBoothId) {
        await updateBooth(editingBoothId, payload);
        setMessage("부스를 수정했습니다.");
      } else {
        await createBooth(payload);
        setMessage("부스를 등록했습니다.");
      }

      resetBoothForm();
      await loadAll({ keepMessage: true });
    });
  }

  async function handleEventSubmit(e) {
    e.preventDefault();
    const startTime = toApiDateTime(eventForm.startTime);
    const endTime = toApiDateTime(eventForm.endTime);

    if (!startTime || !endTime) {
      setMessage("공연 시작/종료 시간을 입력해 주세요.");
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() >= end.getTime()) {
      setMessage("공연 시작 시간은 종료 시간보다 빨라야 합니다.");
      return;
    }

    const delayMinutes = parseNumber(eventForm.delayMinutes, "지연 시간", { required: false });

    await runAdminAction(editingEventId ? `event-update-${editingEventId}` : "event-create", "공연을 저장 중입니다.", async () => {
      const payload = {
        title: eventForm.title.trim(),
        startTime,
        endTime,
        imageUrl: eventForm.imageUrl.trim(),
        imageCredit: eventForm.imageCredit.trim(),
        imageFocus: eventForm.imageFocus.trim(),
        statusOverride: eventForm.statusOverride.trim(),
        liveMessage: eventForm.liveMessage.trim(),
        delayMinutes,
      };

      if (editingEventId) {
        await updateEvent(editingEventId, payload);
        setMessage("공연을 수정했습니다.");
      } else {
        await createEvent(payload);
        setMessage("공연을 등록했습니다.");
      }
      resetEventForm();
      await loadAll({ keepMessage: true });
    });
  }

  async function handleNoticeSubmit(e) {
    e.preventDefault();

    await runAdminAction(editingNoticeId ? `notice-update-${editingNoticeId}` : "notice-create", "공지사항을 저장 중입니다.", async () => {
      if (editingNoticeId) {
        await updateNotice(editingNoticeId, noticeForm);
        setMessage("공지를 수정했습니다.");
      } else {
        await createNotice(noticeForm);
        setMessage("공지를 등록했습니다.");
      }
      resetNoticeForm();
      await loadAll({ keepMessage: true });
    });
  }

  async function handleDeleteNotice(id) {
    if (!window.confirm("선택한 공지를 삭제할까요?")) return;
    await runAdminAction(`notice-delete-${id}`, "공지 삭제 중입니다.", async () => {
      await deleteNotice(id);
      setMessage("공지 삭제가 완료되었습니다.");
      await loadAll({ keepMessage: true });
    });
  }

  async function handleDeleteBooth(id) {
    if (!window.confirm("선택한 부스를 삭제할까요?\n이 부스의 테이블·주문 기록도 같이 지워집니다.")) return;
    await runAdminAction(`booth-delete-${id}`, "부스 삭제 중입니다.", async () => {
      await deleteBooth(id);
      setMessage("부스 삭제가 완료되었습니다.");
      await loadAll({ keepMessage: true });
    });
  }

  // 이번 축제는 총학 주점 하나만 운영한다. 나머지 부스(테이블·주문 포함)를 한 번에 지운다.
  async function handleKeepOnlyMainBooth() {
    if (!mainBooth) return;
    const targets = sortedBooths.filter((booth) => booth.id !== mainBooth.id);
    if (!targets.length) return;
    const ok = window.confirm(
      `‘${mainBooth.name}’만 남기고 부스 ${targets.length}개를 삭제할까요?\n`
      + "지운 부스의 테이블·주문 기록도 같이 지워지고 되돌릴 수 없습니다.",
    );
    if (!ok) return;
    await runAdminAction("booth-keep-main", `부스 ${targets.length}개 삭제 중…`, async () => {
      let failed = 0;
      for (const booth of targets) {
        try {
          await deleteBooth(booth.id);
        } catch (error) {
          if (isUnauthorizedLike(error)) throw error;
          failed += 1;
        }
      }
      await loadAll({ keepMessage: true });
      setMessage(
        failed
          ? `부스 ${targets.length - failed}개를 지웠고 ${failed}개는 실패했습니다. 다시 눌러 주세요.`
          : `부스 ${targets.length}개를 지웠습니다. 이제 ‘${mainBooth.name}’만 남았습니다.`,
      );
    });
  }

  async function handleDeleteEvent(id) {
    if (!window.confirm("선택한 공연을 삭제할까요?")) return;
    await runAdminAction(`event-delete-${id}`, "공연 삭제 중입니다.", async () => {
      await deleteEvent(id);
      setMessage("공연 삭제가 완료되었습니다.");
      await loadAll({ keepMessage: true });
    });
  }

  async function handleImport(type) {
    const file = importFiles[type];
    if (!file) {
      setMessage("업로드할 CSV 파일을 선택해 주세요.");
      return;
    }

    if (file.size <= 0) {
      setMessage("빈 파일은 업로드할 수 없습니다.");
      return;
    }

    const key = type === "booths" ? "booth-import-csv" : "event-import-csv";
    await runAdminAction(key, "CSV 업로드 중입니다.", async () => {
      const result = type === "booths" ? await importBoothCsv(file) : await importEventCsv(file);
      const count = result?.imported ?? 0;
      setMessage(`${type === "booths" ? "부스" : "공연"} CSV ${count}건 반영 완료`);
      setImportFiles((prev) => ({ ...prev, [type]: null }));
      await loadAll({ keepMessage: true });
    });
  }

  async function handleImageUpload(boothId) {
    const file = uploadFiles[boothId];
    if (!file) {
      setMessage("업로드할 이미지를 먼저 선택해 주세요.");
      return;
    }

    await runAdminAction(`booth-image-${boothId}`, "부스 이미지를 업로드 중입니다.", async () => {
      await uploadBoothImage(boothId, file);
      setMessage("부스 이미지를 업로드했습니다.");
      await loadAll({ keepMessage: true });
      setUploadFiles((prev) => ({ ...prev, [boothId]: null }));
    });
  }

  async function handleDropBooth(targetBoothId) {
    if (!draggingBoothId || draggingBoothId === targetBoothId) {
      setDraggingBoothId(null);
      return;
    }

    const reordered = moveItem(sortedBooths, draggingBoothId, targetBoothId);
    setBooths(reordered);

    await runAdminAction("booth-reorder", "부스 순서를 저장 중입니다.", async () => {
      await reorderBooths(reordered.map((item) => item.id));
      setMessage("부스 순서를 저장했습니다.");
      await loadAll({ keepMessage: true });
    }).finally(() => {
      setDraggingBoothId(null);
    });
  }

  const activeNoticeCount = notices.filter((notice) => notice.active).length;
  const isDashboardPending =
    isLoading
    && !kpi
    && booths.length === 0
    && events.length === 0
    && notices.length === 0
    && staffMembers.length === 0
    && auditLogs.length === 0;
  const adminNavItems = [
    { id: "dashboard", label: "대시보드", icon: IconHome },
    { id: "booths", label: "부스 관리", icon: IconBox },
    { id: "events", label: "공연 관리", icon: IconCalendar },
    { id: "notices", label: "긴급 공지", icon: IconAlert },
    { id: "lost", label: "분실물 관리", icon: IconBox },
    { id: "ai", label: "혼잡도 모니터링", icon: IconChart },
    { id: "master", label: "통합 운영", icon: IconSettings },
    { id: "staff", label: "사용자 관리", icon: IconUsers },
    { id: "logs", label: "운영 로그", icon: IconClipboard },
  ];
  // 새 대시보드(홈)용 값. 이번 축제는 총학 주점 하나만 운영하므로 부스 수·혼잡도 대신 주점 한 곳의 상태를 보여 준다.
  const mainBooth = findMainBooth(sortedBooths);
  const extraBoothCount = mainBooth ? sortedBooths.length - 1 : sortedBooths.length;
  const activeViewLabel = adminNavItems.find((item) => item.id === activeAdminView)?.label || "대시보드";
  const nowMs = Date.now();
  const timedEvents = events
    .map((event) => ({ ...event, startMs: new Date(event.startTime || "").getTime(), endMs: new Date(event.endTime || "").getTime() }))
    .filter((event) => Number.isFinite(event.startMs))
    .sort((a, b) => a.startMs - b.startMs);
  const liveEvent = timedEvents.find((event) => event.startMs <= nowMs && Number.isFinite(event.endMs) && nowMs <= event.endMs) || null;
  const nextEvent = timedEvents.find((event) => event.startMs > nowMs) || null;
  const urgentNoticeCount = notices.filter((notice) => notice.active && notice.category === "긴급").length;
  const latestActiveNotice = notices.find((notice) => notice.active) || null;
  const recentLogs = auditLogs.slice(0, 5);
  const festivalBadge = (() => {
    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const [sy, sm, sd] = FESTIVAL.startDate.split("-").map(Number);
    const [ey, em, ed] = FESTIVAL.endDate.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd).getTime();
    const end = new Date(ey, em - 1, ed).getTime();
    if (todayStart < start) return `축제 D-${Math.round((start - todayStart) / dayMs)}`;
    if (todayStart <= end) return `축제 ${Math.round((todayStart - start) / dayMs) + 1}일차`;
    return "축제 종료";
  })();
  const festivalRange = `${FESTIVAL.startDate.slice(5).replace("-", ".")} – ${FESTIVAL.endDate.slice(5).replace("-", ".")}`;
  const shortTime = (value) => (value ? value.replace("T", " ").slice(5, 16).replace("-", ".") : "");
  const homeLinks = [
    { id: "booths", label: "부스 관리", icon: IconBox },
    { id: "events", label: "공연 관리", icon: IconCalendar },
    { id: "notices", label: "긴급 공지", icon: IconAlert },
    { id: "lost", label: "분실물", icon: IconClipboard },
    { id: "staff", label: "사용자 관리", icon: IconUsers },
    { id: "logs", label: "운영 로그", icon: IconClock },
  ];

  function scrollToAdminSection(id) {
    const sectionMap = {
      "admin-booths": "booths",
      "admin-events": "events",
      "admin-notices": "notices",
      "admin-ai-ops": "ai",
      "admin-master": "master",
      "admin-staff": "staff",
      "admin-csv": "logs",
      "admin-audit": "logs",
    };
    setActiveAdminView(sectionMap[id] || id || "dashboard");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  }

  if (!loggedIn) {
    return (
      <section className="auth-entry-screen" data-i18n-skip>
        <div className="auth-entry-orb auth-entry-orb--violet" aria-hidden="true" />
        <div className="auth-entry-orb auth-entry-orb--cyan" aria-hidden="true" />
        <form className="auth-entry-card" onSubmit={handleLogin}>
          <img className="auth-entry-mascot" src="/images/chito-wave.png" alt="" onError={(e) => { e.currentTarget.src = "/images/chito.png"; }} />
          <p className="auth-entry-brand">FestFlow · 운영진</p>
          <div className="auth-entry-copy">
            <h1>관리자 로그인</h1>
            <p>축제 운영진만 들어올 수 있어요.</p>
          </div>
          <div className="auth-entry-field">
            <input
              className="auth-entry-input"
              placeholder="아이디"
              value={loginForm.username}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
              autoComplete="username"
              required
            />
          </div>
          <div className="auth-entry-field auth-entry-field--password">
            <input
              type={showPassword ? "text" : "password"}
              className="auth-entry-input"
              placeholder="비밀번호"
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="auth-entry-visibility"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
            </button>
          </div>
          <button
            className="auth-entry-submit"
            type="submit"
            disabled={isLoginPending || isBusy}
          >
            {isLoginPending || isBusy ? "로그인 중" : "로그인"}
          </button>
          {message && !isLoginPending && <p className="auth-entry-message">{message}</p>}
          <p className="auth-entry-helper">
            계정은 <strong>총학생회 운영진</strong>에게 받아요.
          </p>
        </form>
      </section>
    );
  }

  return (
    <section className="cyber-page admin-console-page" data-i18n-skip>
      <aside className="admin-console-sidebar" aria-label="관리자 메뉴">
        <strong>바람 관리자</strong>
        <nav>
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={activeAdminView === item.id ? "is-active" : ""}
                onClick={() => setActiveAdminView(item.id)}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="admin-console-sidebar__actions">
          <button
            type="button"
            onClick={() => loadAll().catch((error) => setMessage(adminErrorMessage(error)))}
            disabled={isBusy}
          >
            <IconRefresh className="h-4 w-4" />
            <span>새로고침</span>
          </button>
          <button type="button" onClick={handleLogout}>로그아웃</button>
        </div>
      </aside>

      <main className="admin-console-main">
        <header className="ahome-top">
          <div className="ahome-top__title">
            <span>총학생회 운영 관리</span>
            <h1>{activeViewLabel}</h1>
          </div>
          <div className="ahome-top__actions">
            <button
              type="button"
              className="ahome-top__icon"
              aria-label="새로고침"
              onClick={() => loadAll().catch((error) => setMessage(adminErrorMessage(error)))}
              disabled={isBusy}
            >
              <IconRefresh className={`h-4 w-4${isLoading ? " is-spin" : ""}`} />
            </button>
            <span className="ahome-top__who">
              <i aria-hidden="true">{(adminName || "관").slice(0, 1)}</i>
              <span>{adminName}</span>
            </span>
            <button type="button" className="ahome-top__logout" onClick={handleLogout}>로그아웃</button>
          </div>
        </header>

        {(message || isLoading) && (
          <p className="ahome-status" role="status">
            <IconRefresh className={`h-4 w-4${isLoading ? " is-spin" : ""}`} />
            <span>{isLoading ? "최신 정보를 불러오는 중…" : message}</span>
          </p>
        )}

        <section className="admin-console-mobile-tabs" aria-label="관리자 빠른 메뉴">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={`mobile-${item.id}`}
                type="button"
                className={activeAdminView === item.id ? "is-active" : ""}
                onClick={() => setActiveAdminView(item.id)}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </section>

        {activeAdminView === "dashboard" && (
          <div className="ahome">
            <section className="ahome-hello">
              <div>
                <span className="ahome-hello__badge">{festivalBadge}</span>
                <h2>{FESTIVAL.title}</h2>
                <p>{festivalRange} · {FESTIVAL.place}</p>
              </div>
              <a className="ahome-hello__link" href="/guide/" target="_blank" rel="noreferrer">운영 매뉴얼 ↗</a>
            </section>

            <div className="ahome-grid">
              <article className="ahome-card ahome-booth">
                <div className="ahome-card__head">
                  <span className="ahome-card__label">주점</span>
                  {mainBooth?.liveStatusUpdatedAt ? (
                    <small>{shortTime(mainBooth.liveStatusUpdatedAt)} 갱신</small>
                  ) : null}
                </div>
                {mainBooth ? (
                  <>
                    <h3>{mainBooth.name}</h3>
                    <p className="ahome-booth__memo">{mainBooth.liveStatusMessage || "현장 안내 문구가 비어 있어요."}</p>
                    <dl className="ahome-stats">
                      <div>
                        <dt>대기</dt>
                        <dd>{mainBooth.estimatedWaitMinutes != null ? `${mainBooth.estimatedWaitMinutes}분` : "–"}</dd>
                      </div>
                      <div>
                        <dt>테이블 사용</dt>
                        <dd>
                          {mainBooth.reservationTableCount
                            ? `${mainBooth.reservationInUseTables ?? 0}/${mainBooth.reservationTableCount}`
                            : "–"}
                        </dd>
                      </div>
                      <div>
                        <dt>남은 재고</dt>
                        <dd>{mainBooth.remainingStock != null ? mainBooth.remainingStock : "–"}</dd>
                      </div>
                    </dl>
                    <div className="ahome-actions">
                      <a className="ahome-btn ahome-btn--primary" href={`/ops/booth/${mainBooth.id}`}>주문 콘솔 열기</a>
                      <a className="ahome-btn" href={`/ops/booth/${mainBooth.id}/table-qr`}>테이블 QR</a>
                      <button type="button" className="ahome-btn" onClick={() => setActiveAdminView("booths")}>정보 수정</button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>{isDashboardPending ? "불러오는 중" : "총학 주점이 없어요"}</h3>
                    <p className="ahome-booth__memo">
                      {isDashboardPending ? "부스 정보를 확인하고 있어요." : "부스 관리에서 이름에 ‘총학’이 들어간 부스를 만들면 여기에 나와요."}
                    </p>
                    <div className="ahome-actions">
                      <button type="button" className="ahome-btn ahome-btn--primary" onClick={() => setActiveAdminView("booths")}>부스 관리</button>
                    </div>
                  </>
                )}
                {!isDashboardPending && extraBoothCount > 0 ? (
                  <button type="button" className="ahome-booth__extra" onClick={() => setActiveAdminView("booths")}>
                    총학 주점 말고 부스 {extraBoothCount}개가 더 등록돼 있어요 · 부스 관리에서 정리
                  </button>
                ) : null}
              </article>

              <a href="/ai-match/admin" className="ahome-card ahome-match">
                <div className="ahome-card__head">
                  <span className="ahome-card__label">사주 소개팅</span>
                  <small>관리자 열기 →</small>
                </div>
                <dl className="ahome-match__grid">
                  <div><dt>활성</dt><dd>{aiMatchSummary?.activeProfileCount ?? "–"}</dd></div>
                  <div><dt>성사</dt><dd>{aiMatchSummary?.matchedCount ?? "–"}</dd></div>
                  <div><dt>대기 신청</dt><dd>{aiMatchSummary?.pendingRequestCount ?? "–"}</dd></div>
                  <div className={aiMatchSummary && aiMatchSummary.openReportCount + aiMatchSummary.pendingPhotoReviewCount ? "is-alert" : ""}>
                    <dt>신고·검수</dt>
                    <dd>{aiMatchSummary ? aiMatchSummary.openReportCount + aiMatchSummary.pendingPhotoReviewCount : "–"}</dd>
                  </div>
                </dl>
                <p className="ahome-match__foot">
                  {!aiMatchSummary
                    ? "소개팅 현황을 불러오지 못했어요"
                    : aiMatchSummary.nextMeetupAt
                      ? `다음 부스 약속 ${shortTime(aiMatchSummary.nextMeetupAt)} · ${aiMatchSummary.nextMeetupPair} · 오늘 ${aiMatchSummary.meetupsToday}쌍`
                      : "잡힌 부스 약속이 없어요"}
                </p>
              </a>

              <article className="ahome-card ahome-mini">
                <div className="ahome-card__head">
                  <span className="ahome-card__label">공연</span>
                  {liveEvent ? <em className="ahome-live">진행 중</em> : null}
                </div>
                <h3>{liveEvent ? liveEvent.title : nextEvent ? nextEvent.title : "예정 공연 없음"}</h3>
                <p>
                  {liveEvent
                    ? `${shortTime(liveEvent.startTime).slice(6)} – ${shortTime(liveEvent.endTime).slice(6)}`
                    : nextEvent
                      ? `다음 공연 · ${shortTime(nextEvent.startTime)}`
                      : `등록된 공연 ${events.length}개`}
                </p>
                <button type="button" className="ahome-btn" onClick={() => setActiveAdminView("events")}>공연 관리</button>
              </article>

              <article className="ahome-card ahome-mini">
                <div className="ahome-card__head">
                  <span className="ahome-card__label">공지</span>
                  {urgentNoticeCount ? <em className="ahome-urgent">긴급 {urgentNoticeCount}</em> : null}
                </div>
                <h3>{latestActiveNotice ? latestActiveNotice.title : "띄운 공지 없음"}</h3>
                <p>{activeNoticeCount ? `지금 보이는 공지 ${activeNoticeCount}개` : "홈 화면에 나가는 공지가 없어요"}</p>
                <button type="button" className="ahome-btn" onClick={() => setActiveAdminView("notices")}>공지 쓰기</button>
              </article>
            </div>

            <div className="ahome-bottom">
              <section className="ahome-card">
                <div className="ahome-card__head">
                  <span className="ahome-card__label">바로 가기</span>
                </div>
                <div className="ahome-links">
                  {homeLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <button key={link.id} type="button" onClick={() => setActiveAdminView(link.id)}>
                        <i><Icon className="h-5 w-5" /></i>
                        <span>{link.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="ahome-card">
                <div className="ahome-card__head">
                  <span className="ahome-card__label">최근 기록</span>
                  <button type="button" className="ahome-textbtn" onClick={() => setActiveAdminView("logs")}>전체 보기</button>
                </div>
                {recentLogs.length ? (
                  <ul className="ahome-logs">
                    {recentLogs.map((log) => (
                      <li key={log.id}>
                        <span>{describeAuditLog(log)}</span>
                        <small>{log.adminUsername} · {shortTime(log.createdAt)}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ahome-empty">아직 남은 기록이 없어요.</p>
                )}
              </section>
            </div>
          </div>
        )}

        {activeAdminView === "master" && (
      <article id="admin-master" className="admin-console-panel admin-console-panel--master">
        <div className="admin-console-panel__head">
          <div>
            <span>통합 운영자</span>
            <h3>마스터 운영 콘솔</h3>
          </div>
          <strong>부스 · 공연 · 공지 · 로그</strong>
        </div>
        <p className="admin-console-hint">
          기존 /ops/master 기능을 관리자 페이지 안으로 통합했습니다. 로컬에서는 운영 키 0000으로 자동 연결됩니다.
        </p>
        <OpsMasterPage embedded />
      </article>
        )}

        {activeAdminView === "ai" && (
      <article id="admin-ai-ops" className="admin-console-panel admin-console-panel--ai-ops">
        <div className="admin-console-panel__head">
          <div>
            <span>실시간 운영 판단</span>
            <h3>AI 혼잡 분석 / 공지 추천</h3>
          </div>
          <button
            type="button"
            className="admin-console-mini-button"
            onClick={() => refreshAiBriefing().catch((error) => setMessage(adminErrorMessage(error)))}
            disabled={isBusy || isActionBusy("admin-ai-notice-draft")}
          >
            AI 갱신
          </button>
        </div>
        <div className="admin-console-ai-summary">
          <div>
            <span>{aiBriefing?.title || "AI 운영 브리핑"}</span>
            <strong>{aiBriefing?.summary || "현재 현장 데이터를 분석해 혼잡 구역과 운영 조치를 추천합니다."}</strong>
          </div>
          <em>{aiBriefing?.confidence || "대기"}</em>
        </div>
        <div className="admin-console-ai-grid">
          <div>
            <p>감지된 상황</p>
            {(aiBriefing?.highlights?.length ? aiBriefing.highlights : ["혼잡 데이터 수집 대기 중"]).slice(0, 4).map((item, index) => (
              <span key={`ai-highlight-${index}`}>{item}</span>
            ))}
          </div>
          <div>
            <p>추천 조치</p>
            {(aiBriefing?.recommendedActions?.length ? aiBriefing.recommendedActions : ["혼잡 부스와 무대 상태를 확인하세요."]).slice(0, 4).map((item, index) => (
              <span key={`ai-action-${index}`}>{item}</span>
            ))}
          </div>
        </div>
        <div className="admin-console-ai-draft">
          <select
            className="admin-console-input admin-console-input--dense"
            value={aiDraftType}
            onChange={(e) => setAiDraftType(e.target.value)}
          >
            <option value="congestion">혼잡 완화</option>
            <option value="event">공연 안내</option>
            <option value="booth">부스 운영</option>
            <option value="lost">분실물 안내</option>
          </select>
          <input
            className="admin-console-input admin-console-input--dense"
            placeholder="추가 요청 예: 주점 쪽 우회 안내 강조"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <button
            type="button"
            className="admin-console-submit admin-console-submit--violet"
            onClick={() => handleAiNoticeDraft().catch((error) => setMessage(adminErrorMessage(error)))}
            disabled={isBusy || isActionBusy("admin-ai-notice-draft")}
          >
            공지 추천
          </button>
        </div>
        {aiNoticeDraft?.draftTitle && (
          <div className="admin-console-ai-preview">
            <span>{normalizeNoticeCategory(aiNoticeDraft.draftCategory)}</span>
            <strong>{aiNoticeDraft.draftTitle}</strong>
            <p>{aiNoticeDraft.draftContent}</p>
          </div>
        )}
      </article>
        )}

        {activeAdminView === "lost" && <AdminLostItems onMessage={setMessage} />}

        {activeAdminView === "notices" && (
      <article id="admin-notices" className="admin-console-panel admin-console-panel--notice">
        <div className="admin-console-panel__head">
          <div>
            <span>콘텐츠 관리</span>
            <h3>공지 등록 / 수정</h3>
          </div>
          <strong>{activeNoticeCount}개 활성</strong>
        </div>
        <form
          className="admin-console-form"
          onSubmit={(e) => handleNoticeSubmit(e).catch((error) => setMessage(adminErrorMessage(error)))}
        >
          <input
            className="admin-console-input"
            placeholder="공지 제목"
            value={noticeForm.title}
            onChange={(e) => setNoticeForm((p) => ({ ...p, title: e.target.value }))}
            required
          />
          <textarea
            className="admin-console-input admin-console-textarea"
            placeholder="공지 내용"
            rows={3}
            value={noticeForm.content}
            onChange={(e) => setNoticeForm((p) => ({ ...p, content: e.target.value }))}
            required
          />
          <div className="admin-console-inline-grid">
            <select
              className="admin-console-input"
              value={noticeForm.category}
              onChange={(e) => setNoticeForm((p) => ({ ...p, category: e.target.value }))}
            >
              {NOTICE_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <label className="admin-console-checkline">
              <input
                type="checkbox"
                checked={noticeForm.active}
                onChange={(e) => setNoticeForm((p) => ({ ...p, active: e.target.checked }))}
              />
              홈 노출 활성화
            </label>
          </div>
          <button className="admin-console-submit admin-console-submit--rose" disabled={isBusy}>
            {editingNoticeId ? "공지 수정" : "공지 등록"}
          </button>
        </form>
        <div className="admin-console-list">
          {notices.map((notice) => (
            <div key={notice.id} className="admin-console-list-card">
              <div className="admin-console-list-card__head">
                <p>[{notice.category}] {notice.title}</p>
                <span className={notice.active ? "admin-console-badge admin-console-badge--green" : "admin-console-badge"}>
                  {notice.active ? "활성" : "비활성"}
                </span>
                <span className="admin-console-badge admin-console-badge--blue" title="펼쳐 본 기기 수">조회 {notice.viewCount ?? 0}</span>
              </div>
              <small>{notice.content}</small>
              <div className="admin-console-action-row">
                <button type="button" onClick={() => beginEditNotice(notice)} disabled={isBusy}>수정</button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDeleteNotice(notice.id).catch((error) => setMessage(adminErrorMessage(error)))}
                  disabled={isBusy || isActionBusy(`notice-delete-${notice.id}`)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
        )}

        {activeAdminView === "booths" && (
      <article id="admin-booths" className="admin-console-panel">
        <div className="admin-console-panel__head">
          <div>
            <span>현장 관리</span>
            <h3>부스 등록 / 수정</h3>
          </div>
          <strong>{sortedBooths.length}개 운영중</strong>
        </div>
        {mainBooth && extraBoothCount > 0 ? (
          <div className="ahome-cleanup">
            <p>
              이번 축제는 <b>{mainBooth.name}</b> 하나만 운영해요. 나머지 부스 {extraBoothCount}개는 한 번에 지울 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => handleKeepOnlyMainBooth().catch((error) => setMessage(adminErrorMessage(error)))}
              disabled={isBusy}
            >
              {isActionBusy("booth-keep-main") ? "삭제 중…" : `총학 주점만 남기고 ${extraBoothCount}개 삭제`}
            </button>
          </div>
        ) : null}
        <form
          className="admin-console-form"
          onSubmit={(e) => handleBoothSubmit(e).catch((error) => setMessage(adminErrorMessage(error)))}
        >
          <input
            className="admin-console-input"
            placeholder="부스 이름"
            value={boothForm.name}
            onChange={(e) => setBoothForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <div className="admin-console-inline-grid">
            <input
              className="admin-console-input"
              placeholder="위도"
              value={boothForm.latitude}
              onChange={(e) => setBoothForm((p) => ({ ...p, latitude: e.target.value }))}
              required
            />
            <input
              className="admin-console-input"
              placeholder="경도"
              value={boothForm.longitude}
              onChange={(e) => setBoothForm((p) => ({ ...p, longitude: e.target.value }))}
              required
            />
          </div>
          <textarea
            className="admin-console-input admin-console-textarea"
            placeholder="설명"
            value={boothForm.description}
            onChange={(e) => setBoothForm((p) => ({ ...p, description: e.target.value }))}
            required
          />
          <div className="admin-console-inline-grid">
            <input
              className="admin-console-input"
              placeholder="대기 시간(분)"
              value={boothForm.estimatedWaitMinutes}
              onChange={(e) => setBoothForm((p) => ({ ...p, estimatedWaitMinutes: e.target.value }))}
            />
            <input
              className="admin-console-input"
              placeholder="잔여 수량"
              value={boothForm.remainingStock}
              onChange={(e) => setBoothForm((p) => ({ ...p, remainingStock: e.target.value }))}
            />
          </div>
          <input
            className="admin-console-input"
            placeholder="실시간 운영 메모"
            value={boothForm.liveStatusMessage}
            onChange={(e) => setBoothForm((p) => ({ ...p, liveStatusMessage: e.target.value }))}
          />
          <input
            className="admin-console-input"
            placeholder="이미지 URL (선택)"
            value={boothForm.imageUrl}
            onChange={(e) => setBoothForm((p) => ({ ...p, imageUrl: e.target.value }))}
          />
          <button className="admin-console-submit" disabled={isBusy}>
            {editingBoothId ? "부스 수정" : "부스 추가"}
          </button>
        </form>
        <p className="admin-console-hint">드래그로 순서를 바꾸고, 대기/잔여 정보와 이미지를 같은 카드에서 즉시 저장합니다.</p>
        <div className="admin-console-list">
          {sortedBooths.map((booth) => (
            <div
              key={booth.id}
              draggable
              onDragStart={() => setDraggingBoothId(booth.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropBooth(booth.id).catch((error) => setMessage(adminErrorMessage(error)))}
              className={`admin-console-list-card ${draggingBoothId === booth.id ? "is-dragging" : ""}`}
            >
              <div className="admin-console-list-card__head">
                <p>#{booth.displayOrder} {booth.name}</p>
                <div className="admin-console-action-row">
                  <button type="button" onClick={() => beginEditBooth(booth)} disabled={isBusy}>수정</button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDeleteBooth(booth.id).catch((error) => setMessage(adminErrorMessage(error)))}
                    disabled={isBusy || isActionBusy(`booth-delete-${booth.id}`)}
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="admin-console-inline-grid admin-console-inline-grid--triple">
                <input
                  className="admin-console-input admin-console-input--dense"
                  placeholder="대기 분"
                  value={boothLiveDrafts[booth.id]?.estimatedWaitMinutes ?? ""}
                  onChange={(e) =>
                    setBoothLiveDrafts((p) => ({
                      ...p,
                      [booth.id]: { ...p[booth.id], estimatedWaitMinutes: e.target.value },
                    }))
                  }
                />
                <input
                  className="admin-console-input admin-console-input--dense"
                  placeholder="잔여 수량"
                  value={boothLiveDrafts[booth.id]?.remainingStock ?? ""}
                  onChange={(e) =>
                    setBoothLiveDrafts((p) => ({
                      ...p,
                      [booth.id]: { ...p[booth.id], remainingStock: e.target.value },
                    }))
                  }
                />
                <button
                  type="button"
                  className="admin-console-mini-button"
                  onClick={() => handleSaveBoothLiveStatus(booth.id).catch((error) => setMessage(adminErrorMessage(error)))}
                  disabled={isBusy || isActionBusy(`booth-live-save-${booth.id}`)}
                >
                  실시간 저장
                </button>
              </div>
              <input
                className="admin-console-input admin-console-input--dense"
                placeholder="운영 메모"
                value={boothLiveDrafts[booth.id]?.liveStatusMessage ?? ""}
                onChange={(e) =>
                  setBoothLiveDrafts((p) => ({
                    ...p,
                    [booth.id]: { ...p[booth.id], liveStatusMessage: e.target.value },
                  }))
                }
              />
              <div className="admin-console-file-row">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="admin-console-file-input"
                  onChange={(e) =>
                    setUploadFiles((prev) => ({ ...prev, [booth.id]: e.target.files?.[0] || null }))
                  }
                />
                <button
                  type="button"
                  className="admin-console-mini-button"
                  onClick={() => handleImageUpload(booth.id).catch((error) => setMessage(adminErrorMessage(error)))}
                  disabled={isBusy || isActionBusy(`booth-image-${booth.id}`)}
                >
                  이미지 업로드
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
        )}

        {activeAdminView === "events" && (
      <article id="admin-events" className="admin-console-panel">
        <div className="admin-console-panel__head">
          <div>
            <span>콘텐츠 관리</span>
            <h3>공연 등록 / 수정</h3>
          </div>
          <strong>{events.length}개 일정</strong>
        </div>
        <form
          className="admin-console-form"
          onSubmit={(e) => handleEventSubmit(e).catch((error) => setMessage(adminErrorMessage(error)))}
        >
          <input
            className="admin-console-input"
            placeholder="공연 제목"
            value={eventForm.title}
            onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
            required
          />
          <div className="admin-console-inline-grid">
            <input
              type="datetime-local"
              className="admin-console-input"
              value={eventForm.startTime}
              onChange={(e) => setEventForm((p) => ({ ...p, startTime: e.target.value }))}
              required
            />
            <input
              type="datetime-local"
              className="admin-console-input"
              value={eventForm.endTime}
              onChange={(e) => setEventForm((p) => ({ ...p, endTime: e.target.value }))}
              required
            />
          </div>
          <input
            className="admin-console-input"
            placeholder="라인업 이미지 URL"
            value={eventForm.imageUrl}
            onChange={(e) => setEventForm((p) => ({ ...p, imageUrl: e.target.value }))}
          />
          <div className="admin-console-inline-grid">
            <input
              className="admin-console-input"
              placeholder="이미지 출처"
              value={eventForm.imageCredit}
              onChange={(e) => setEventForm((p) => ({ ...p, imageCredit: e.target.value }))}
            />
            <input
              className="admin-console-input"
              placeholder="지연 시간(분)"
              value={eventForm.delayMinutes}
              onChange={(e) => setEventForm((p) => ({ ...p, delayMinutes: e.target.value }))}
            />
          </div>
          <input
            className="admin-console-input"
            placeholder="이미지 초점 위치 예: center 42%"
            value={eventForm.imageFocus}
            onChange={(e) => setEventForm((p) => ({ ...p, imageFocus: e.target.value }))}
          />
          <button className="admin-console-submit admin-console-submit--violet" disabled={isBusy}>
            {editingEventId ? "공연 수정" : "공연 추가"}
          </button>
        </form>
        <div className="admin-console-bulk">
          <div className="admin-console-bulk__head">
            <div>
              <strong>여러 공연 한 번에 바꾸기</strong>
              <small>비가 오거나 무대가 밀리면 날짜·장소로 골라 한 번에 지연·취소해요.</small>
            </div>
            <em>{bulkTargets.length}개 대상</em>
          </div>
          <div className="admin-console-bulk__row">
            <select className="admin-console-input" value={bulk.day} onChange={(e) => setBulk((p) => ({ ...p, day: e.target.value }))}>
              <option value="">모든 날짜</option>
              {[...new Set(events.map((event) => `${event.startTime || ""}`.slice(0, 10)).filter(Boolean))].sort().map((day) => (
                <option key={day} value={day}>{day.slice(5).replace("-", ".")}</option>
              ))}
            </select>
            <input className="admin-console-input" placeholder="장소·제목 포함 글자 (예: 노천극장)" value={bulk.place} onChange={(e) => setBulk((p) => ({ ...p, place: e.target.value }))} />
            <select className="admin-console-input" value={bulk.statusOverride} onChange={(e) => setBulk((p) => ({ ...p, statusOverride: e.target.value }))}>
              {["예정", "곧 시작", "지연", "진행중", "종료", "취소"].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <input className="admin-console-input" inputMode="numeric" placeholder="지연 분" value={bulk.delayMinutes} disabled={bulk.statusOverride !== "지연"} onChange={(e) => setBulk((p) => ({ ...p, delayMinutes: e.target.value }))} />
          </div>
          <input className="admin-console-input" placeholder="손님에게 보일 한 줄 (선택) 예: 우천으로 30분 늦게 시작해요" value={bulk.liveMessage} onChange={(e) => setBulk((p) => ({ ...p, liveMessage: e.target.value }))} />
          <div className="admin-console-action-row">
            <button type="button" disabled={bulkBusy || !bulkTargets.length} onClick={() => handleBulkEventStatus(true)}>자동 상태로 되돌리기</button>
            <button type="button" className="danger" disabled={bulkBusy || !bulkTargets.length} onClick={() => handleBulkEventStatus(false)}>
              {bulkBusy ? "적용 중…" : `${bulkTargets.length}개 적용`}
            </button>
          </div>
        </div>
        <div className="admin-console-list">
          {events.map((event) => (
            <div key={event.id} className="admin-console-list-card">
              <div className="admin-console-list-card__head">
                <p>{event.title}</p>
                <span className="admin-console-badge admin-console-badge--blue">
                  {event.startTime?.slice(11, 16) || "--:--"}
                </span>
              </div>
              <small>{event.startTime?.slice(0, 16).replace("T", " ")} ~ {event.endTime?.slice(11, 16) || "--:--"}</small>
              <div className="admin-console-action-row">
                <button
                  type="button"
                  onClick={() => handleQuickEventStartNotice(event.id).catch((error) => setMessage(adminErrorMessage(error)))}
                  disabled={isBusy || isActionBusy(`quick-event-notice-${event.id}`)}
                >
                  시작 공지
                </button>
                <button type="button" onClick={() => beginEditEvent(event)} disabled={isBusy}>수정</button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDeleteEvent(event.id).catch((error) => setMessage(adminErrorMessage(error)))}
                  disabled={isBusy || isActionBusy(`event-delete-${event.id}`)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
        )}

        {activeAdminView === "staff" && (
      <article id="admin-staff" className="admin-console-panel">
        <div className="admin-console-panel__head">
          <div>
            <span>운영 인력</span>
            <h3>스태프 배치 편집</h3>
          </div>
          <strong>{staffMembers.length}명</strong>
        </div>
        <p className="admin-console-hint">팀, 상태, 담당 구역, 현재 업무를 수정하면 스태프 화면에 실시간 반영됩니다.</p>
        <div className="admin-console-list admin-console-list--compact">
          {staffMembers.map((staff) => (
            <div key={staff.id} className="admin-console-list-card">
              <div className="admin-console-list-card__head">
                <p>{staff.name} ({staff.staffNo})</p>
                <span className="admin-console-badge">{staff.statusLabel}</span>
              </div>
              <div className="admin-console-inline-grid">
                <input
                  className="admin-console-input admin-console-input--dense"
                  placeholder="팀"
                  value={staffDrafts[staff.id]?.team ?? ""}
                  onChange={(e) =>
                    setStaffDrafts((prev) => ({ ...prev, [staff.id]: { ...prev[staff.id], team: e.target.value } }))
                  }
                />
                <select
                  className="admin-console-input admin-console-input--dense"
                  value={staffDrafts[staff.id]?.status ?? "STANDBY"}
                  onChange={(e) =>
                    setStaffDrafts((prev) => ({ ...prev, [staff.id]: { ...prev[staff.id], status: e.target.value } }))
                  }
                >
                  <option value="STANDBY">대기</option>
                  <option value="MOVING">이동</option>
                  <option value="ON_DUTY">업무중</option>
                  <option value="URGENT">긴급</option>
                </select>
              </div>
              <select
                className="admin-console-input admin-console-input--dense"
                value={staffDrafts[staff.id]?.assignedBoothId ?? ""}
                onChange={(e) =>
                  setStaffDrafts((prev) => ({
                    ...prev,
                    [staff.id]: { ...prev[staff.id], assignedBoothId: e.target.value },
                  }))
                }
              >
                <option value="">순환 구역(미지정)</option>
                {sortedBooths.map((booth) => (
                  <option key={`staff-booth-${staff.id}-${booth.id}`} value={booth.id}>
                    #{booth.displayOrder} {booth.name}
                  </option>
                ))}
              </select>
              <input
                className="admin-console-input admin-console-input--dense"
                placeholder="현재 업무"
                value={staffDrafts[staff.id]?.currentTask ?? ""}
                onChange={(e) =>
                  setStaffDrafts((prev) => ({
                    ...prev,
                    [staff.id]: { ...prev[staff.id], currentTask: e.target.value },
                  }))
                }
              />
              <input
                className="admin-console-input admin-console-input--dense"
                placeholder="현장 메모"
                value={staffDrafts[staff.id]?.currentNote ?? ""}
                onChange={(e) =>
                  setStaffDrafts((prev) => ({
                    ...prev,
                    [staff.id]: { ...prev[staff.id], currentNote: e.target.value },
                  }))
                }
              />
              <button
                type="button"
                className="admin-console-submit admin-console-submit--sky"
                onClick={() => handleSaveStaff(staff.id).catch((error) => setMessage(adminErrorMessage(error)))}
                disabled={isBusy || isActionBusy(`staff-save-${staff.id}`)}
              >
                스태프 저장
              </button>
            </div>
          ))}
        </div>
      </article>
        )}

        {activeAdminView === "logs" && (
          <>
      <article id="admin-csv" className="admin-console-panel">
        <div className="admin-console-panel__head">
          <div>
            <span>대량 작업</span>
            <h3>CSV 일괄 업로드</h3>
          </div>
          <strong>부스 / 공연</strong>
        </div>
        <div className="admin-console-upload-grid">
          <div className="admin-console-upload-card">
            <p>부스 CSV</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFiles((prev) => ({ ...prev, booths: e.target.files?.[0] || null }))}
              className="admin-console-file-input"
            />
            <button
              type="button"
              className="admin-console-submit"
              onClick={() => handleImport("booths").catch((error) => setMessage(adminErrorMessage(error)))}
              disabled={isBusy}
            >
              부스 업로드
            </button>
          </div>
          <div className="admin-console-upload-card">
            <p>공연 CSV</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFiles((prev) => ({ ...prev, events: e.target.files?.[0] || null }))}
              className="admin-console-file-input"
            />
            <button
              type="button"
              className="admin-console-submit admin-console-submit--violet"
              onClick={() => handleImport("events").catch((error) => setMessage(adminErrorMessage(error)))}
              disabled={isBusy}
            >
              공연 업로드
            </button>
          </div>
        </div>
      </article>

      <article id="admin-audit" className="admin-console-panel">
        <div className="admin-console-panel__head">
          <div>
            <span>최근 기록</span>
            <h3>관리자 작업 이력</h3>
          </div>
          <strong>{auditLogs.length}건</strong>
        </div>
        <div className="admin-console-list admin-console-list--compact">
          {auditLogs.length === 0 && <p className="admin-console-hint">아직 기록이 없습니다.</p>}
          {auditLogs.map((log) => (
            <div key={log.id} className="admin-console-list-card">
              <div className="admin-console-list-card__head">
                <p>{log.adminUsername} / {log.action}</p>
                <span className="admin-console-badge">{log.createdAt?.replace("T", " ").slice(5, 16)}</span>
              </div>
              <small>{log.targetType}</small>
              <small>{log.details}</small>
            </div>
          ))}
        </div>
      </article>
          </>
        )}
      </main>
    </section>
  );
}
