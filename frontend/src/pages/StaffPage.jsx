import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  createLostItem,
  createLostItemStream,
  createStaffAiLostItemAssist,
  fetchStaffAiFieldChecklist,
  createStaffStream,
  fetchLostItems,
  fetchStaffAiZoneSummary,
  fetchStaffBootstrap,
  loginStaff,
  logoutStaff,
  translateText as requestTranslation,
  deleteLostItem,
  updateLostItem,
  updateLostItemStatus,
  updateMyStaffStatus,
} from "../api";
import {
  IconAlert,
  IconBox,
  IconChat,
  IconEye,
  IconEyeOff,
  IconMapPin,
  IconMic,
  IconRefresh,
  IconShield,
  IconUsers,
} from "../components/UxIcons";
import { AJOU_CENTER } from "../utils/location";

const STAFF_TOKEN_KEY = "festflow_staff_token_v2";
const STAFF_DEMO_LOGIN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_STAFF_DEMO_LOGIN === "true";

const STATUS_META = {
  ON_DUTY: { label: "업무중", tone: "green" },
  MOVING: { label: "이동중", tone: "amber" },
  STANDBY: { label: "대기중", tone: "blue" },
  URGENT: { label: "긴급", tone: "red" },
};

const EMPTY_LOST_FORM = {
  title: "",
  description: "",
  category: "기타",
  foundLocation: "",
  finderContact: "",
};

const LOST_STATUS_OPTIONS = [
  { value: "REGISTERED", label: "보관중" },
  { value: "OWNER_CLAIMED", label: "소유자 확인중" },
  { value: "RETURNED", label: "반환완료" },
];

const RESPONSE_TOOL_TABS = [
  { id: "translate", label: "통역" },
  { id: "ai", label: "AI 응대" },
  { id: "lost", label: "분실물" },
];

const TRANSLATE_LANGUAGES = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh-CN", label: "中文" },
];

const EMPTY_TRANSLATE_FORM = {
  text: "",
  sourceLang: "ko",
  targetLang: "en",
};

const AI_LOST_MATCH_PREFIX = "lost-item:";

const SPEECH_LANGUAGE_BY_TRANSLATE_LANGUAGE = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
  "zh-CN": "zh-CN",
};

const FALLBACK_STAFF_OFFSETS = [
  [-0.0007, -0.0007],
  [-0.00045, 0.0005],
  [0.00035, -0.00055],
  [0.00015, 0.00025],
  [0.00065, 0.00065],
  [-0.00085, 0.00015],
  [0.00082, -0.00008],
  [-0.0002, 0.00085],
];

function getSavedToken() {
  return localStorage.getItem(STAFF_TOKEN_KEY) || "";
}

function setSavedToken(token) {
  if (token) localStorage.setItem(STAFF_TOKEN_KEY, token);
  else localStorage.removeItem(STAFF_TOKEN_KEY);
}

function normalizeStaffStatus(status, label) {
  const raw = String(status || label || "").trim().toUpperCase();
  const rawLabel = String(label || status || "").trim();
  if (raw === "ON_DUTY" || raw === "WORKING" || rawLabel.includes("업무")) return "ON_DUTY";
  if (raw === "MOVING" || rawLabel.includes("이동")) return "MOVING";
  if (raw === "URGENT" || rawLabel.includes("긴급")) return "URGENT";
  if (raw === "STANDBY" || rawLabel.includes("대기")) return "STANDBY";
  return "STANDBY";
}

function statusLabel(status, label) {
  return STATUS_META[normalizeStaffStatus(status, label)]?.label || label || status || "대기중";
}

function statusTone(status, label) {
  return STATUS_META[normalizeStaffStatus(status, label)]?.tone || "blue";
}

function summarizeStaff(list = []) {
  const summary = { ON_DUTY: 0, MOVING: 0, STANDBY: 0, URGENT: 0, total: list.length };
  list.forEach((staff) => {
    const normalized = normalizeStaffStatus(staff.status, staff.statusLabel);
    if (summary[normalized] != null) summary[normalized] += 1;
  });
  return summary;
}

function relativeTime(value) {
  const time = value ? new Date(value).getTime() : Date.now();
  if (Number.isNaN(time)) return "방금 전";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.round(minutes / 60)}시간 전`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lostStatusLabel(status, fallback) {
  return LOST_STATUS_OPTIONS.find((option) => option.value === status)?.label || fallback || status || "보관중";
}

function lostStatusTone(status) {
  if (status === "RETURNED") return "green";
  if (status === "OWNER_CLAIMED") return "amber";
  return "blue";
}

function createLostEditForm(item) {
  return {
    title: item?.title || "",
    description: item?.description || "",
    category: item?.category || "기타",
    foundLocation: item?.foundLocation || "",
    finderContact: item?.finderContact || "",
    imageUrl: item?.imageUrl || "",
    status: item?.status || "REGISTERED",
    resolveNote: item?.resolveNote || "",
  };
}

function normalizeAiAssist(result) {
  if (!result) return null;
  return {
    title: result.title || "AI 응답",
    summary: result.summary || result.answer || result.content || result.message || "",
    highlights: Array.isArray(result.highlights) ? result.highlights : [],
    actions: Array.isArray(result.recommendedActions) ? result.recommendedActions : [],
    confidence: result.confidence || "",
  };
}

function parseAiLostMatchHighlight(value) {
  const text = String(value || "");
  if (!text.startsWith(AI_LOST_MATCH_PREFIX)) return { id: "", text };
  const separatorIndex = text.indexOf("|");
  if (separatorIndex < 0) return { id: "", text };
  return {
    id: text.slice(AI_LOST_MATCH_PREFIX.length, separatorIndex),
    text: text.slice(separatorIndex + 1),
  };
}

function initialOf(name) {
  return String(name || "?").trim().slice(0, 1);
}

function boothById(booths, id) {
  return booths.find((booth) => String(booth.id) === String(id));
}

function validCoord(latitude, longitude) {
  if (latitude == null || longitude == null || latitude === "" || longitude === "") return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function getStaffPoint(staff, index, booths) {
  if (
    Boolean(staff.locationSharingEnabled) &&
    validCoord(staff.latitude, staff.longitude)
  ) {
    return {
      latitude: Number(staff.latitude),
      longitude: Number(staff.longitude),
      source: "실시간 위치",
    };
  }

  const booth = boothById(booths, staff.assignedBoothId);
  if (booth && validCoord(booth.latitude, booth.longitude)) {
    const spread = (index % 5) * 0.000035;
    return {
      latitude: Number(booth.latitude) + spread,
      longitude: Number(booth.longitude) - spread,
      source: booth.name || "담당 구역",
    };
  }

  const [latOffset, lngOffset] = FALLBACK_STAFF_OFFSETS[index % FALLBACK_STAFF_OFFSETS.length];
  return {
    latitude: AJOU_CENTER.latitude + latOffset,
    longitude: AJOU_CENTER.longitude + lngOffset,
    source: "캠퍼스 기준 위치",
  };
}

function staffMarkerIcon(staff) {
  const tone = statusTone(staff.status, staff.statusLabel);
  const initial = initialOf(staff.name || staff.staffNo);
  return L.divIcon({
    className: `staff-live-marker staff-live-marker--${tone}`,
    html: `<span>${initial}</span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 36],
    popupAnchor: [0, -32],
  });
}

function StaffMapViewport({ points, focusPoint }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (focusPoint) {
      map.setView([focusPoint.latitude, focusPoint.longitude], 18, { animate: true });
      return;
    }

    if (points.length > 1) {
      map.fitBounds(points.map((point) => [point.latitude, point.longitude]), {
        padding: [26, 26],
        maxZoom: 18,
      });
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 18);
    }
  }, [focusPoint, map, points]);

  return null;
}

export default function StaffPage() {
  const [staffToken, setStaffToken] = useState(getSavedToken());
  const [staffNoInput, setStaffNoInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(Boolean(staffToken));
  const [message, setMessage] = useState("");

  const [me, setMe] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [booths, setBooths] = useState([]);
  const [notices, setNotices] = useState([]);
  const [lostItems, setLostItems] = useState([]);
  const [taskDraft, setTaskDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [locationSharing, setLocationSharing] = useState(false);
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [focusPoint, setFocusPoint] = useState(null);

  const [lostForm, setLostForm] = useState(EMPTY_LOST_FORM);
  const [lostFile, setLostFile] = useState(null);
  const [lostSaving, setLostSaving] = useState(false);
  const [selectedLostId, setSelectedLostId] = useState(null);
  const [lostEditForm, setLostEditForm] = useState(null);
  const [lostActionBusy, setLostActionBusy] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiMode, setAiMode] = useState("");
  const [aiLostQuery, setAiLostQuery] = useState("");
  const [translateForm, setTranslateForm] = useState(EMPTY_TRANSLATE_FORM);
  const [translateBusy, setTranslateBusy] = useState(false);
  const [translateResult, setTranslateResult] = useState(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voicePreview, setVoicePreview] = useState("");
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [responseToolTab, setResponseToolTab] = useState("translate");
  const recognitionRef = useRef(null);

  async function load(token = staffToken) {
    if (!token) return;
    setLoading(true);
    try {
      const [bootstrap, lostData] = await Promise.all([
        fetchStaffBootstrap(token),
        fetchLostItems(token),
      ]);
      const nextStaff = bootstrap.staff || [];
      setMe(bootstrap.me);
      setStaffList(nextStaff);
      setBooths(bootstrap.booths || []);
      setNotices(bootstrap.notices || []);
      setLostItems(lostData || []);
      setTaskDraft(bootstrap.me?.currentTask || "");
      setNoteDraft(bootstrap.me?.currentNote || "");
      setLocationSharing(bootstrap.me?.locationSharingEnabled === true);
      setMessage("");
    } catch (error) {
      setSavedToken("");
      setStaffToken("");
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function enterDemoStaff() {
    if (!STAFF_DEMO_LOGIN_ENABLED) {
      setMessage("데모 입장은 개발 환경에서만 사용할 수 있습니다.");
      return;
    }
    setLoading(true);
    try {
      const data = await loginStaff("1", "1");
      setSavedToken(data.staffToken);
      setStaffToken(data.staffToken);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffToken]);

  useEffect(() => {
    if (!staffToken) return undefined;

    let staffStream = null;
    try {
      staffStream = createStaffStream(staffToken);
      staffStream.addEventListener("staff", (event) => {
        try {
          const next = JSON.parse(event.data);
          if (Array.isArray(next)) {
            setStaffList(next);
            setMe((prev) => next.find((item) => item.staffNo === prev?.staffNo) || prev);
          }
        } catch {
          // Ignore malformed stream payloads.
        }
      });
    } catch {
      // Streaming is optional.
    }

    let lostStream = null;
    try {
      lostStream = createLostItemStream();
      lostStream.addEventListener("lost-items", (event) => {
        try {
          const next = JSON.parse(event.data);
          // 스트림은 손님용으로 신청자 정보를 가린 목록이라, 신호로만 쓰고 토큰으로 다시 읽는다.
          if (Array.isArray(next)) fetchLostItems(staffToken).then((data) => setLostItems(data || [])).catch(() => {});
        } catch {
          // Ignore malformed stream payloads.
        }
      });
    } catch {
      // Streaming is optional.
    }

    return () => {
      staffStream?.close();
      lostStream?.close();
    };
  }, [staffToken]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (lostItems.length === 0) {
      setSelectedLostId(null);
      setLostEditForm(null);
      return;
    }

    if (!selectedLostId || !lostItems.some((item) => String(item.id) === String(selectedLostId))) {
      const first = lostItems[0];
      setSelectedLostId(first.id);
      setLostEditForm(createLostEditForm(first));
    }
  }, [lostItems, selectedLostId]);

  const statusSummary = summarizeStaff(staffList);

  const assignedBooth = useMemo(
    () => boothById(booths, me?.assignedBoothId),
    [booths, me?.assignedBoothId],
  );

  const staffPoints = useMemo(
    () =>
      staffList.map((staff, index) => ({
        staff,
        point: getStaffPoint(staff, index, booths),
      })),
    [booths, staffList],
  );

  const visibleStaff = showAllStaff ? staffList : staffList.slice(0, 3);
  const selectedLostItem = lostItems.find((item) => String(item.id) === String(selectedLostId)) || null;
  const noticesToShow = showAllNotices ? notices : notices.slice(0, 3);
  const visibleLocationCount = staffList.filter(
    (staff) =>
      staff.locationSharingEnabled &&
      validCoord(staff.latitude, staff.longitude),
  ).length;

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await loginStaff(staffNoInput.trim().toUpperCase(), pinInput.trim());
      setSavedToken(data.staffToken);
      setStaffToken(data.staffToken);
      setMessage("스태프 로그인이 완료되었습니다.");
      setShowPin(false);
    } catch (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      if (staffToken) await logoutStaff(staffToken);
    } catch {
      // Logout should still clear the local session.
    }
    setSavedToken("");
    setStaffToken("");
    setMe(null);
    setStaffList([]);
    setBooths([]);
    setNotices([]);
    setLostItems([]);
    setFocusPoint(null);
    setSelectedLostId(null);
    setLostEditForm(null);
    setAiResult(null);
    setAiText("");
  }

  async function saveMyStatus(
    nextStatus = me?.status || "ON_DUTY",
    nextTask = taskDraft,
    coords = null,
    sharingOverride = locationSharing,
  ) {
    if (!staffToken || !me) return;
    try {
      let latitude = coords?.latitude ?? me.latitude ?? assignedBooth?.latitude ?? null;
      let longitude = coords?.longitude ?? me.longitude ?? assignedBooth?.longitude ?? null;

      if (!coords && sharingOverride && navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              maximumAge: 60000,
              timeout: 2500,
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch {
          // Keep previous coordinate when location permission is unavailable.
        }
      }

      const updated = await updateMyStaffStatus(staffToken, {
        status: nextStatus,
        currentTask: nextTask,
        currentNote: noteDraft,
        latitude: sharingOverride ? latitude : null,
        longitude: sharingOverride ? longitude : null,
        locationSharingEnabled: sharingOverride,
      });
      setMe(updated);
      setTaskDraft(updated.currentTask || nextTask || "");
      setStaffList((prev) => {
        const exists = prev.some((item) => item.staffNo === updated.staffNo);
        return exists
          ? prev.map((item) => (item.staffNo === updated.staffNo ? updated : item))
          : [updated, ...prev];
      });
      if (validCoord(updated.latitude, updated.longitude)) {
        setFocusPoint({ latitude: Number(updated.latitude), longitude: Number(updated.longitude) });
      }
      setMessage("스태프 상태를 저장했습니다.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLocateMe() {
    if (!navigator.geolocation) {
      setMessage("현재 브라우저에서 위치 확인을 지원하지 않습니다.");
      return;
    }

    setMessage("현재 위치를 확인하는 중입니다.");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocationSharing(true);
        setFocusPoint(coords);
        await saveMyStatus(me?.status || "ON_DUTY", taskDraft, coords, true);
        setMessage("내 위치를 현장 지도에 반영했습니다.");
      },
      () => setMessage("위치 권한이 꺼져 있어 담당 구역 기준으로 표시합니다."),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 2500 },
    );
  }

  async function handleCreateLostItem(event) {
    event.preventDefault();
    if (!lostForm.title.trim() || !lostForm.foundLocation.trim()) {
      setMessage("분실물명과 발견 위치를 입력해 주세요.");
      return;
    }
    setLostSaving(true);
    try {
      const created = await createLostItem(lostForm, lostFile, staffToken);
      setLostForm(EMPTY_LOST_FORM);
      setLostFile(null);
      setMessage("분실물을 등록했습니다.");
      const next = await fetchLostItems(staffToken);
      setLostItems(next || []);
      setSelectedLostId(created.id);
      setLostEditForm(createLostEditForm(created));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLostSaving(false);
    }
  }

  function selectLostItem(item) {
    setSelectedLostId(item.id);
    setLostEditForm(createLostEditForm(item));
  }

  function openAiMatchedLostItem(itemId) {
    const item = lostItems.find((entry) => String(entry.id) === String(itemId));
    if (!item) {
      setMessage("해당 분실물을 현재 목록에서 찾지 못했습니다. 분실물 목록을 새로고침해 주세요.");
      return;
    }
    selectLostItem(item);
    setResponseToolTab("lost");
    window.setTimeout(() => {
      document.getElementById("staff-lost-detail-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function updateLostItemInState(updated) {
    setLostItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedLostId(updated.id);
    setLostEditForm(createLostEditForm(updated));
  }

  async function handleLostStatusChange(status) {
    if (!selectedLostItem) return;
    setLostActionBusy(`status-${selectedLostItem.id}`);
    try {
      const updated = await updateLostItemStatus(
        selectedLostItem.id,
        { status, resolveNote: lostEditForm?.resolveNote || selectedLostItem.resolveNote || "" },
        staffToken,
      );
      updateLostItemInState(updated);
      setMessage("분실물 상태를 변경했습니다.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLostActionBusy("");
    }
  }

  async function handleUpdateLostItem(event) {
    event.preventDefault();
    if (!selectedLostItem || !lostEditForm) return;
    if (!lostEditForm.title.trim() || !lostEditForm.foundLocation.trim()) {
      setMessage("분실물명과 발견 위치를 입력해 주세요.");
      return;
    }

    setLostActionBusy(`update-${selectedLostItem.id}`);
    try {
      const updated = await updateLostItem(
        selectedLostItem.id,
        {
          title: lostEditForm.title,
          description: lostEditForm.description || "-",
          category: lostEditForm.category || "기타",
          foundLocation: lostEditForm.foundLocation,
          finderContact: lostEditForm.finderContact || "",
          imageUrl: lostEditForm.imageUrl || "",
          status: lostEditForm.status || selectedLostItem.status || "REGISTERED",
          resolveNote: lostEditForm.resolveNote || "",
        },
        staffToken,
      );
      updateLostItemInState(updated);
      setMessage("분실물 정보를 수정했습니다.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLostActionBusy("");
    }
  }

  async function handleDeleteLostItem() {
    if (!selectedLostItem) return;
    const confirmed = window.confirm(`${selectedLostItem.title} 분실물을 삭제할까요?`);
    if (!confirmed) return;

    setLostActionBusy(`delete-${selectedLostItem.id}`);
    try {
      await deleteLostItem(selectedLostItem.id, staffToken);
      setLostItems((prev) => prev.filter((item) => item.id !== selectedLostItem.id));
      setMessage("분실물을 삭제했습니다.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLostActionBusy("");
    }
  }

  async function runAi(type) {
    if (!staffToken) return;
    setAiMode(type);
    setAiBusy(true);
    try {
      const result =
        type === "zone"
          ? await fetchStaffAiZoneSummary(staffToken)
          : type === "lost"
            ? await createStaffAiLostItemAssist(aiLostQuery.trim(), staffToken)
            : await fetchStaffAiFieldChecklist(staffToken);
      const normalized = normalizeAiAssist(result);
      setAiResult(normalized);
      setAiText(normalized?.summary || "AI 응답을 생성했습니다.");
    } catch (error) {
      setAiResult(null);
      setAiText(error.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function handleTranslate(event) {
    event.preventDefault();
    const text = translateForm.text.trim();
    if (!text) {
      setMessage("통역할 문장을 입력해 주세요.");
      return;
    }

    setTranslateBusy(true);
    setTranslateResult(null);
    try {
      const result = await requestTranslation({
        text,
        sourceLang: translateForm.sourceLang,
        targetLang: translateForm.targetLang,
        contextHints: ["아주대학교 축제", "현장 스태프 응대", "분실물, 지도, 공연 안내"],
      });
      setTranslateResult(result);
      setMessage("통역 결과를 생성했습니다.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setTranslateBusy(false);
    }
  }

  function swapTranslateLanguages() {
    setTranslateForm((prev) => ({
      ...prev,
      sourceLang: prev.targetLang,
      targetLang: prev.sourceLang,
    }));
    setTranslateResult(null);
  }

  function handleVoiceInput() {
    if (voiceListening) {
      recognitionRef.current?.stop?.();
      setVoiceListening(false);
      setVoicePreview("");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage("이 브라우저는 마이크 음성 인식을 지원하지 않습니다.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang =
      SPEECH_LANGUAGE_BY_TRANSLATE_LANGUAGE[translateForm.sourceLang] ||
      translateForm.sourceLang ||
      "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceListening(true);
      setVoicePreview("");
      setMessage("마이크로 듣는 중입니다. 안내 문장을 말해 주세요.");
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript?.trim() || "";
        if (!transcript) continue;
        if (event.results[index].isFinal) finalTranscript += `${transcript} `;
        else interimTranscript += `${transcript} `;
      }

      if (interimTranscript.trim()) {
        setVoicePreview(interimTranscript.trim());
      }

      if (finalTranscript.trim()) {
        setTranslateForm((prev) => ({
          ...prev,
          text: [prev.text.trim(), finalTranscript.trim()].filter(Boolean).join(" "),
        }));
        setTranslateResult(null);
        setVoicePreview("");
        setMessage("음성 인식이 완료됐습니다. 통역하기를 누르면 번역됩니다.");
      }
    };

    recognition.onerror = (event) => {
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      setMessage(
        denied
          ? "마이크 권한이 꺼져 있어 음성 인식을 사용할 수 없습니다."
          : "음성 인식에 실패했습니다. 다시 시도해 주세요.",
      );
      setVoiceListening(false);
      setVoicePreview("");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setVoiceListening(false);
      setVoicePreview("");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function focusAssignedBooth() {
    if (!assignedBooth || !validCoord(assignedBooth.latitude, assignedBooth.longitude)) return;
    setFocusPoint({
      latitude: Number(assignedBooth.latitude),
      longitude: Number(assignedBooth.longitude),
    });
  }

  if (!staffToken) {
    return (
      <section className="staff-reference-page staff-reference-login auth-entry-screen" data-i18n-skip>
        <div className="auth-entry-orb auth-entry-orb--violet" aria-hidden="true" />
        <div className="auth-entry-orb auth-entry-orb--cyan" aria-hidden="true" />
        <form className="auth-entry-card" onSubmit={handleLogin}>
          <p className="auth-entry-brand">바람</p>
          <div className="auth-entry-copy">
            <h1>운영진 전용 페이지</h1>
            <p>실시간 현장 운영과 응대를 위한 운영진 시스템입니다.</p>
          </div>
          <div className="auth-entry-field">
            <input
              className="auth-entry-input"
              value={staffNoInput}
              onChange={(event) => setStaffNoInput(event.target.value)}
              placeholder="스태프 번호"
              autoComplete="username"
            />
          </div>
          <div className="auth-entry-field auth-entry-field--password">
            <input
              type={showPin ? "text" : "password"}
              className="auth-entry-input"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value)}
              placeholder="PIN"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="auth-entry-visibility"
              aria-label={showPin ? "PIN 숨기기" : "PIN 보기"}
              onClick={() => setShowPin((prev) => !prev)}
            >
              {showPin ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
            </button>
          </div>
          <button type="submit" className="auth-entry-submit" disabled={loading}>
            {loading ? "로그인 중" : "로그인"}
          </button>
          {message && !loading && <p className="auth-entry-message">{message}</p>}
          <div className="auth-entry-footer">
            <p className="auth-entry-helper">
              운영 계정이 없으신가요? <strong>관리자에게 문의</strong>
            </p>
            {STAFF_DEMO_LOGIN_ENABLED && (
              <button type="button" className="auth-entry-link-button" onClick={enterDemoStaff} disabled={loading}>
                데모로 바로 입장
              </button>
            )}
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="staff-reference-page" data-i18n-skip>
      <header className="staff-reference-topbar">
        <h1>스태프</h1>
        <div>
          <button type="button" aria-label="AI 협업 판단" onClick={() => runAi("zone")} disabled={aiBusy}>
            <IconAlert className="h-5 w-5" />
          </button>
          <button type="button" aria-label="새로고침" onClick={() => load()} disabled={loading}>
            <IconRefresh className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section className="staff-reference-summary">
        <h2>스태프 현황</h2>
        <div className="staff-reference-kpis">
          <article>
            <strong>{statusSummary.ON_DUTY}</strong>
            <span><i className="dot-green" />업무중</span>
          </article>
          <article>
            <strong>{statusSummary.MOVING}</strong>
            <span><i className="dot-amber" />이동중</span>
          </article>
          <article>
            <strong>{statusSummary.STANDBY}</strong>
            <span><i className="dot-blue" />대기중</span>
          </article>
          <article>
            <strong>{statusSummary.total}</strong>
            <span>전체</span>
          </article>
        </div>
        <div className="staff-reference-mode">
          <span>근무 모드</span>
          <select
            value={me?.status || "ON_DUTY"}
            onChange={(event) => saveMyStatus(event.target.value)}
          >
            {Object.entries(STATUS_META).map(([status, meta]) => (
              <option key={status} value={status}>{meta.label}</option>
            ))}
          </select>
          <button type="button" aria-label="현재 상태 저장" onClick={() => saveMyStatus()}>
            <IconRefresh className="h-4 w-4" />
          </button>
        </div>
      </section>

      {message && <p className="staff-reference-note">{message}</p>}

      <section className="staff-reference-map-section">
        <div className="staff-reference-section-head">
          <h2>현장 지도</h2>
          <button type="button" onClick={handleLocateMe}>
            <IconMapPin className="h-4 w-4" />
            내 위치
          </button>
        </div>
        <div className="staff-reference-map staff-reference-real-map" aria-label="스태프 실시간 현장 지도">
          <MapContainer
            center={[AJOU_CENTER.latitude, AJOU_CENTER.longitude]}
            zoom={17}
            minZoom={15}
            maxZoom={20}
            scrollWheelZoom
            className="staff-live-map"
          >
            <StaffMapViewport
              points={staffPoints.map((item) => item.point)}
              focusPoint={focusPoint}
            />
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {staffPoints.map(({ staff, point }) => (
              <Marker
                key={staff.staffNo || staff.id}
                position={[point.latitude, point.longitude]}
                icon={staffMarkerIcon(staff)}
              >
                <Tooltip direction="top" offset={[0, -30]}>
                  <span className="staff-map-tooltip">{staff.name || `스태프 ${staff.staffNo}`}</span>
                </Tooltip>
                <Popup>
                  <div className="staff-map-popup">
                    <strong>{staff.name || `스태프 ${staff.staffNo}`}</strong>
                    <span>{statusLabel(staff.status, staff.statusLabel)} · {point.source}</span>
                    <small>{staff.currentTask || "현장 순찰"}</small>
                  </div>
                </Popup>
              </Marker>
            ))}
            {focusPoint && (
              <CircleMarker
                center={[focusPoint.latitude, focusPoint.longitude]}
                radius={9}
                pathOptions={{
                  color: "#ffffff",
                  weight: 4,
                  fillColor: "#2563eb",
                  fillOpacity: 0.95,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>내 위치</Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
          <div className="staff-map-meta">
            <span>{visibleLocationCount}명 실시간 위치</span>
            <span>{staffPoints.length}명 지도 표시</span>
          </div>
        </div>
      </section>

      <section className="staff-reference-section staff-tool-tabs-section">
        <div className="staff-reference-section-head">
          <h2>응대 도구</h2>
          <span>통역 · AI · 분실물</span>
        </div>
        <div className="staff-tool-tabs" role="toolbar" aria-label="스태프 응대 도구">
          {RESPONSE_TOOL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={responseToolTab === tab.id ? "active" : ""}
              aria-pressed={responseToolTab === tab.id}
              onClick={() => setResponseToolTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className={responseToolTab === "ai" ? "staff-reference-section staff-tool-panel staff-ai-panel" : "staff-reference-section staff-tool-panel staff-ai-panel staff-tool-panel-hidden"}>
        <div className="staff-reference-section-head">
          <h2>AI 운영 도구</h2>
          <span>{aiBusy ? "생성 중" : "즉시 응대"}</span>
        </div>
        <div className="staff-reference-tools">
          <button type="button" onClick={() => runAi("zone")} disabled={aiBusy}>
            <IconMapPin className="h-5 w-5" />
            <strong>AI 협업 판단</strong>
          </button>
          <button
            type="button"
            className={aiMode === "lost" ? "active" : ""}
            onClick={() => {
              setAiMode("lost");
              setAiResult(null);
              setAiText("");
            }}
            disabled={aiBusy}
          >
            <IconBox className="h-5 w-5" />
            <strong>AI 분실물 매칭</strong>
          </button>
          <button type="button" onClick={() => runAi("checklist")} disabled={aiBusy}>
            <IconChat className="h-5 w-5" />
            <strong>현장 체크리스트</strong>
          </button>
        </div>
        {aiMode === "lost" && (
          <form
            className="staff-ai-lost-search"
            onSubmit={(event) => {
              event.preventDefault();
              runAi("lost");
            }}
          >
            <input
              value={aiLostQuery}
              onChange={(event) => setAiLostQuery(event.target.value)}
              placeholder="방문객 설명 입력 예: 검은색 반지갑을 학생회관 근처에서 잃어버렸어요"
              disabled={aiBusy}
            />
            <button type="submit" disabled={aiBusy || !aiLostQuery.trim()}>
              매칭
            </button>
          </form>
        )}
        {aiResult ? (
          <article className={aiResult.title.includes("분실물 매칭") ? "staff-reference-ai-result staff-reference-ai-card staff-reference-ai-card--match" : "staff-reference-ai-result staff-reference-ai-card"}>
            <strong>{aiResult.title}</strong>
            {aiResult.summary && <p>{aiResult.summary}</p>}
            {aiResult.highlights.length > 0 && (
              <div>
                {aiResult.highlights.map((item) => {
                  const match = parseAiLostMatchHighlight(item);
                  if (match.id) {
                    return (
                      <button
                        key={item}
                        type="button"
                        className="staff-ai-match-candidate"
                        onClick={() => openAiMatchedLostItem(match.id)}
                      >
                        {match.text}
                      </button>
                    );
                  }
                  return <span key={item}>{match.text}</span>;
                })}
              </div>
            )}
            {aiResult.actions.length > 0 && (
              <ul>
                {aiResult.actions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </article>
        ) : (
          aiText && <p className="staff-reference-ai-result">{aiText}</p>
        )}
      </section>

      <section className={responseToolTab === "translate" ? "staff-reference-section staff-reference-translate staff-tool-panel" : "staff-reference-section staff-reference-translate staff-tool-panel staff-tool-panel-hidden"}>
        <div className="staff-reference-section-head">
          <h2>실시간 통역</h2>
          <span>{translateBusy ? "번역 중" : "방문객 응대"}</span>
        </div>
        <form onSubmit={handleTranslate}>
          <div className="staff-translate-controls">
            <select
              value={translateForm.sourceLang}
              onChange={(event) => {
                setTranslateForm((prev) => ({ ...prev, sourceLang: event.target.value }));
                setTranslateResult(null);
              }}
              aria-label="원문 언어"
            >
              {TRANSLATE_LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={swapTranslateLanguages} aria-label="번역 방향 전환">
              전환
            </button>
            <select
              value={translateForm.targetLang}
              onChange={(event) => {
                setTranslateForm((prev) => ({ ...prev, targetLang: event.target.value }));
                setTranslateResult(null);
              }}
              aria-label="번역 언어"
            >
              {TRANSLATE_LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>
          <div className="staff-translate-input">
            <textarea
              value={translateForm.text}
              onChange={(event) => {
                setTranslateForm((prev) => ({ ...prev, text: event.target.value }));
                setTranslateResult(null);
              }}
              placeholder="방문객에게 안내할 문장이나 질문을 입력하세요."
              rows={3}
            />
            <button
              type="button"
              className={voiceListening ? "staff-voice-button is-listening" : "staff-voice-button"}
              onClick={handleVoiceInput}
              aria-label="음성 입력"
            >
              <IconMic className="h-4 w-4" />
              {voiceListening ? "듣는 중" : "음성 입력"}
            </button>
          </div>
          {voicePreview && <p className="staff-voice-preview">{voicePreview}</p>}
          <button type="submit" disabled={translateBusy || !translateForm.text.trim()}>
            {translateBusy ? "통역 중..." : "통역하기"}
          </button>
        </form>
        {translateResult && (
          <article className="staff-translate-result">
            <strong>{translateResult.translatedText}</strong>
            <small>
              {translateResult.provider || "translate"} · 신뢰도 {Math.round((translateResult.confidence || 0) * 100)}%
            </small>
          </article>
        )}
      </section>

      <section className="staff-reference-section staff-staff-list-section">
        <div className="staff-reference-section-head">
          <h2>실시간 스태프 목록</h2>
          <button type="button" onClick={() => setShowAllStaff((prev) => !prev)}>
            {showAllStaff ? "접기" : "전체 보기"}
          </button>
        </div>
        <div className="staff-reference-list">
          {visibleStaff.map((staff, index) => {
            const booth = boothById(booths, staff.assignedBoothId);
            const point = getStaffPoint(staff, index, booths);
            return (
              <article key={staff.staffNo || staff.id}>
                <button
                  type="button"
                  className={`staff-reference-face staff-reference-face--${statusTone(staff.status, staff.statusLabel)}`}
                  onClick={() => setFocusPoint(point)}
                  aria-label={`${staff.name || staff.staffNo} 위치 보기`}
                >
                  {initialOf(staff.name)}
                </button>
                <strong>{staff.name || `스태프 ${staff.staffNo}`}</strong>
                <em className={`staff-reference-pill staff-reference-pill--${statusTone(staff.status, staff.statusLabel)}`}>
                  {statusLabel(staff.status, staff.statusLabel)}
                </em>
                <small>{booth?.name || staff.currentTask || point.source}</small>
                <time>{relativeTime(staff.lastUpdatedAt)}</time>
              </article>
            );
          })}
        </div>
      </section>

      <section className="staff-reference-control">
        <div className="staff-reference-section-head">
          <h2>내 근무 정보</h2>
          <button type="button" onClick={() => saveMyStatus()}>저장</button>
        </div>
        <label>
          <span>현장 위치 공유</span>
          <input
            type="checkbox"
            checked={locationSharing}
            onChange={(event) => setLocationSharing(event.target.checked)}
          />
        </label>
        <div className="staff-reference-status-buttons">
          {Object.entries(STATUS_META).map(([status, meta]) => (
            <button
              key={status}
              type="button"
              className={normalizeStaffStatus(me?.status) === status ? "active" : ""}
              onClick={() => saveMyStatus(status)}
            >
              {meta.label}
            </button>
          ))}
        </div>
        <input
          value={taskDraft}
          onChange={(event) => setTaskDraft(event.target.value)}
          placeholder="현재 업무"
        />
        <textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          placeholder="운영 메모"
          rows={2}
        />
      </section>

      <form className={responseToolTab === "lost" ? "staff-reference-lost-form staff-tool-panel" : "staff-reference-lost-form staff-tool-panel staff-tool-panel-hidden"} onSubmit={handleCreateLostItem}>
        <div className="staff-reference-section-head">
          <h2>분실물 등록</h2>
          <span>{lostItems.length}건</span>
        </div>
        <input
          value={lostForm.title}
          onChange={(event) => setLostForm((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="분실물명"
        />
        <div>
          <input
            value={lostForm.category}
            onChange={(event) => setLostForm((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="카테고리"
          />
          <input
            value={lostForm.foundLocation}
            onChange={(event) => setLostForm((prev) => ({ ...prev, foundLocation: event.target.value }))}
            placeholder="발견 위치"
          />
        </div>
        <textarea
          value={lostForm.description}
          onChange={(event) => setLostForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="설명"
          rows={2}
        />
        <input
          value={lostForm.finderContact}
          onChange={(event) => setLostForm((prev) => ({ ...prev, finderContact: event.target.value }))}
          placeholder="연락처"
        />
        <input type="file" accept="image/*" onChange={(event) => setLostFile(event.target.files?.[0] || null)} />
        <button type="submit" disabled={lostSaving}>
          {lostSaving ? "등록 중" : "분실물 등록"}
        </button>
      </form>

      <section id="staff-lost-detail-panel" className={responseToolTab === "lost" ? "staff-reference-section staff-lost-manager staff-tool-panel" : "staff-reference-section staff-lost-manager staff-tool-panel staff-tool-panel-hidden"}>
        <div className="staff-reference-section-head">
          <h2>분실물 센터</h2>
          <span>{lostItems.length}건 관리</span>
        </div>
        <div className="staff-lost-manager-grid">
          <div className="staff-lost-list">
            {lostItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={String(selectedLostItem?.id) === String(item.id) ? "active" : ""}
                onClick={() => selectLostItem(item)}
              >
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <IconBox className="h-5 w-5" />}
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.foundLocation} · {formatDateTime(item.createdAt)}</small>
                </span>
                <em className={`staff-lost-status staff-lost-status--${lostStatusTone(item.status)}`}>
                  {lostStatusLabel(item.status, item.statusLabel)}
                </em>
              </button>
            ))}
            {lostItems.length === 0 && <p>등록된 분실물이 없습니다.</p>}
          </div>

          {selectedLostItem && lostEditForm && (
            <form className="staff-lost-detail" onSubmit={handleUpdateLostItem}>
              <div className="staff-lost-detail-head">
                {selectedLostItem.imageUrl ? (
                  <img src={selectedLostItem.imageUrl} alt="" />
                ) : (
                  <IconBox className="h-6 w-6" />
                )}
                <div>
                  <strong>{selectedLostItem.title}</strong>
                  <small>접수 {formatDateTime(selectedLostItem.createdAt)}</small>
                </div>
              </div>

              <div className="staff-lost-contact-grid">
                <p><span>습득자 연락처</span><strong>{selectedLostItem.finderContact || "미입력"}</strong></p>
                <p><span>소유자 요청</span><strong>{selectedLostItem.claimantName || "없음"}</strong></p>
                <p><span>소유자 연락처</span><strong>{selectedLostItem.claimantContact || "없음"}</strong></p>
                <p><span>요청 메모</span><strong>{selectedLostItem.claimantNote || "없음"}</strong></p>
              </div>

              <div className="staff-lost-status-actions">
                {LOST_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={lostEditForm.status === option.value ? "active" : ""}
                    onClick={() => {
                      setLostEditForm((prev) => ({ ...prev, status: option.value }));
                      handleLostStatusChange(option.value);
                    }}
                    disabled={Boolean(lostActionBusy)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <input
                value={lostEditForm.title}
                onChange={(event) => setLostEditForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="분실물명"
              />
              <div className="staff-lost-edit-row">
                <input
                  value={lostEditForm.category}
                  onChange={(event) => setLostEditForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="카테고리"
                />
                <input
                  value={lostEditForm.foundLocation}
                  onChange={(event) => setLostEditForm((prev) => ({ ...prev, foundLocation: event.target.value }))}
                  placeholder="발견 위치"
                />
              </div>
              <input
                value={lostEditForm.finderContact}
                onChange={(event) => setLostEditForm((prev) => ({ ...prev, finderContact: event.target.value }))}
                placeholder="습득자 연락처"
              />
              <textarea
                value={lostEditForm.description}
                onChange={(event) => setLostEditForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="상세 설명"
                rows={2}
              />
              <textarea
                value={lostEditForm.resolveNote}
                onChange={(event) => setLostEditForm((prev) => ({ ...prev, resolveNote: event.target.value }))}
                placeholder="처리 메모"
                rows={2}
              />
              <div className="staff-lost-detail-actions">
                <button type="submit" disabled={Boolean(lostActionBusy)}>
                  {lostActionBusy.startsWith("update") ? "수정 중" : "정보 수정"}
                </button>
                <button type="button" onClick={handleDeleteLostItem} disabled={Boolean(lostActionBusy)}>
                  {lostActionBusy.startsWith("delete") ? "삭제 중" : "삭제"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="staff-reference-section staff-notice-section">
        <div className="staff-reference-section-head">
          <h2>공지사항</h2>
          <button type="button" onClick={() => setShowAllNotices((prev) => !prev)}>
            {showAllNotices ? "접기" : "전체 보기"}
          </button>
        </div>
        <div className="staff-reference-notices">
          {noticesToShow.map((notice) => (
            <article key={notice.id || notice.title}>
              <IconAlert className="h-4 w-4" />
              <div>
                <strong>{notice.title}</strong>
                {showAllNotices && notice.content && <p>{notice.content}</p>}
              </div>
              <small>{formatDateTime(notice.createdAt)}</small>
            </article>
          ))}
          {notices.length === 0 && <p>현재 활성 공지가 없습니다.</p>}
        </div>
      </section>

      <section className="staff-reference-section staff-reference-assignment">
        <div>
          <IconUsers className="h-5 w-5" />
          <p>담당 구역: {assignedBooth?.name || "순환 구역"}</p>
        </div>
        <button type="button" onClick={focusAssignedBooth} disabled={!assignedBooth}>
          지도에서 보기
        </button>
      </section>

      <button type="button" className="staff-reference-logout" onClick={handleLogout}>
        로그아웃
      </button>
    </section>
  );
}
