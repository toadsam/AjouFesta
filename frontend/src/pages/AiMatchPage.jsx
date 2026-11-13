import { useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconCamera,
  IconChevronRight,
  IconChat,
  IconClipboard,
  IconHeart,
  IconHeartFilled,
  IconHome,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSettings,
  IconShield,
  IconSparkles,
  IconUsers,
  IconX,
} from "../components/UxIcons";
import {
  acceptAiMatchRequest,
  accessAiMatchProfile,
  fetchAiMatchInbox,
  cancelAiMatchRequest,
  checkAiMatchNickname,
  checkAiMatchPhoneNumber,
  previewAiMatchSaju,
  cancelAiMatchMeetup,
  markAiMatchMeetupArrived,
  reportAiMatchProfile,
  confirmAiMatchMeetup,
  consentAiMatchContactShare,
  createAiMatchImagePreview,
  deleteAiMatchProfile,
  fetchAiMatchStatus,
  createAiMatchProfile,
  createAiMatchRequest,
  proposeAiMatchMeetup,
  rejectAiMatchRequest,
  resolveApiAssetUrl,
  toggleAiMatchFavorite,
  updateAiMatchProfile,
} from "../api";
import { SajuPanel } from "../components/SajuCard";
import { ElementSeal } from "../components/SajuChart";
import NightSky from "../components/NightSky";
import SajuSplash, { shouldShowSajuSplash } from "../components/SajuSplash";
import MeetupScheduler, { ORGANIZER_DISCLAIMER } from "../components/MeetupScheduler";
import MeetupChat from "../components/MeetupChat";
import SajuHero from "../components/SajuHero";
import SajuFortune from "../components/SajuFortune";
import { MatchCardBlock, MatchMissingBanner, MatchReport, MatchTop3 } from "../components/SajuMatch";

const MEET_PLACES = ["총학생회 부스"];
const MEET_PLACE_MAP_TARGET = {
  label: "총학생회 부스",
  lat: 37.2828,
  lng: 127.0444,
};
const SCREEN_COPY = {
  intro: "AI 사주 소개팅",
  register: "프로필 등록하기",
  people: "등록된 사람들",
  requests: "데이트 신청 현황",
  my: "MY",
  inquiry: "문의",
};
const NAV_ITEMS = [
  { id: "intro", label: "처음", icon: IconHome },
  { id: "requests", label: "신청함", icon: IconClipboard },
  { id: "my", label: "MY", icon: IconUsers },
  { id: "inquiry", label: "문의", icon: IconChat },
];
const PROFILE_FILTERS = ["전체", "찰떡 궁합", "남자", "여자", "신청 가능", "좋아요"];
const REGISTRATION_TAGS = ["운동", "음악", "영화", "여행", "맛집", "독서", "게임", "보드게임", "사진", "공연", "기타"];
const MBTI_OPTIONS = [
  "ISTJ",
  "ISFJ",
  "INFJ",
  "INTJ",
  "ISTP",
  "ISFP",
  "INFP",
  "INTP",
  "ESTP",
  "ESFP",
  "ENFP",
  "ENTP",
  "ESTJ",
  "ESFJ",
  "ENFJ",
  "ENTJ",
];
// 로그인 전 첫 화면 '소개팅은 이렇게 이어져요'. 가입부터 부스에서 얼굴 보기 선택까지 한눈에.
// 평소엔 제목만 한 줄씩 보이고, 누르면 설명(copy)이 펼쳐진다. tag 는 접힌 상태에서도 꼭 보여야 하는 약속.
const FLOW_GROUPS = [
  {
    label: "지금 · 앱에서",
    items: [
      { number: "01", title: "가입하고 웹툰 얼굴 만들기", copy: "전화번호 확인 → 사진 AI 변환 → 생년월일로 사주. 실명·번호·원본 사진은 공개되지 않아요" },
      { number: "02", title: "궁합 보고 신청하기", copy: "상대와의 사주 궁합 점수를 보고 마음에 드는 사람에게 신청해요" },
      { number: "03", title: "수락되면 시간 정하기", tag: "확정 후 변경 불가", copy: "둘이 부스 시간(20분)을 골라 확정해요. 확정한 뒤에는 바꿀 수 없어요" },
    ],
  },
  {
    label: "축제 당일 · 소개팅 부스에서",
    items: [
      { number: "04", title: "대기 장소로 가기", copy: "30분 전에 문자가 가요. 티켓에 나온 곳(성호관 앞 · 중앙도서관 앞)에서 스태프가 부스로 데려가요" },
      { number: "05", title: "블라인드 채팅 10분", copy: "얼굴은 가린 채 앱 채팅으로만 이야기해요. 어색하지 않게 대화 주제도 추천해 줘요" },
      { number: "06", title: "얼굴 보기 선택", tag: "둘 다 골라야 공개", copy: "둘 다 ‘얼굴 보기’를 골랐을 때만 가림막을 걷어요. 누가 무엇을 골랐는지는 알려지지 않아요" },
    ],
  },
];

// 가입 화면 단계 표시용
const REGISTER_STEPS = ["전화번호", "사진", "계정", "사주", "소개"];

const ACTIVE_FILTER_TAG_STYLE = {
  borderColor: "#d8b4fe",
  background: "linear-gradient(180deg, rgba(253, 244, 255, 0.98), rgba(250, 245, 255, 0.96))",
  color: "#64748b",
  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.92), 0 10px 22px rgba(216, 180, 254, 0.22)",
  filter: "none",
};
const PASSWORD_INPUT_PATTERN = /^\S{0,10}$/;
const PHONE_INPUT_PATTERN = /^[0-9+()\-\s]{0,30}$/;
const REQUEST_STATUS_LABELS = {
  PENDING: "대기중",
  ACCEPTED: "매치 성사",
  PROPOSED: "약속 제안",
  CONFIRMED: "약속 확정",
  REJECTED: "거절",
  CANCELED: "취소됨",
};
const PROFILE_DELETED_STATUS_REASON = "PROFILE_DELETED";
const RECEIVED_NOTICE_STATUSES = new Set(["PENDING", "CANCELED"]);
const SENT_NOTICE_STATUSES = new Set(["ACCEPTED", "REJECTED", "PROPOSED", "CONFIRMED"]);
const ACCESS_SESSION_STORAGE_KEY = "ai-match-access-session";
const RESTORABLE_ACCESS_SCREENS = new Set(["intro", "requests", "my"]);

function cleanTagValue(tag) {
  return `${tag || ""}`.replace(/^#/, "").trim().slice(0, 8);
}

function cleanMbtiValue(mbti) {
  const normalized = `${mbti || ""}`.trim().toUpperCase();
  return MBTI_OPTIONS.includes(normalized) ? normalized : "";
}

function getPhoneNumberKey(phoneNumber) {
  const digits = `${phoneNumber || ""}`.replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length >= 10) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function parseProfileCopy(rawIntro) {
  const source = `${rawIntro || ""}`.trim();
  if (!source) {
    return {
      summary: "따뜻한 분위기의 축제 메이트를 찾고 있어요.",
      tags: [],
      mbti: "",
    };
  }

  const tags = [];
  const summaryParts = [];
  let mbti = "";

  source.split(/\n+/).forEach((line) => {
    const mbtiMatch = line.match(/\bMBTI\s*:\s*([A-Za-z]{4})\b/i);
    if (!mbti && mbtiMatch) {
      mbti = cleanMbtiValue(mbtiMatch[1]);
    }

    const matches = [...line.matchAll(/#([^\s#]+)/g)].map((match) => cleanTagValue(match[1]));
    if (matches.length) {
      tags.push(...matches);
    }

    const cleanedLine = line
      .replace(/\bMBTI\s*:\s*[A-Za-z]{4}\b/gi, "")
      .replace(/#([^\s#]+)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanedLine) {
      summaryParts.push(cleanedLine);
    }
  });

  return {
    summary: summaryParts.join(" ").trim() || "따뜻한 분위기의 축제 메이트를 찾고 있어요.",
    tags: [...new Set(tags)].filter(Boolean).slice(0, 6),
    mbti,
  };
}

function serializeProfileCopy(summary, tags, mbti) {
  const cleanSummary = `${summary || ""}`.trim();
  const cleanTags = [...new Set((tags || []).map(cleanTagValue))].filter(Boolean).slice(0, 6);
  const cleanMbti = cleanMbtiValue(mbti);
  const lines = [cleanSummary];
  if (cleanMbti) {
    lines.push(`MBTI: ${cleanMbti}`);
  }
  if (cleanTags.length) {
    lines.push(cleanTags.map((tag) => `#${tag}`).join(" "));
  }
  return lines.filter(Boolean).join("\n");
}

function getFallbackTags(profile) {
  const byPlace = {
    "중앙무대 앞": ["공연", "산책"],
    "푸드트럭 존": ["맛집", "수다"],
    "종합 안내 데스크": ["첫만남", "안전"],
    "네온 포토 터널": ["사진", "야경"],
  };

  return byPlace[profile.meetPlace] || ["축제", "만남"];
}

function getProfileGenderLabel(gender) {
  if (gender === "남성") return "남자";
  return "여자";
}

function getProfileTone(gender) {
  if (gender === "남성") return "blue";
  return "pink";
}

function getFilterTone(filter) {
  if (filter === "남자") return "blue";
  if (filter === "여자") return "pink";
  if (filter === "신청 가능") return "green";
  if (filter === "좋아요") return "pink";
  return "violet";
}

function getGenderButtonTone(gender) {
  if (gender === "남성") return "blue";
  return "pink";
}

function formatRequestTime(createdAt) {
  if (!createdAt) return "방금";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "방금";

  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function isProfileDeletedRequest(request) {
  return request?.status === "CANCELED" && request?.statusReason === PROFILE_DELETED_STATUS_REASON;
}

function getRequestStatusLabel(status, statusReason = "") {
  if (status === "CANCELED" && statusReason === PROFILE_DELETED_STATUS_REASON) {
    return "상대 계정 삭제";
  }
  return REQUEST_STATUS_LABELS[status] || status || "대기중";
}

function getRequestStatusTone(status, statusReason = "") {
  if (status === "CANCELED" && statusReason === PROFILE_DELETED_STATUS_REASON) return "danger";
  if (status === "ACCEPTED") return "success";
  if (status === "CONFIRMED") return "success";
  if (status === "PROPOSED") return "pending";
  if (status === "REJECTED") return "danger";
  if (status === "CANCELED") return "muted";
  return "pending";
}

function canSendRequest(status) {
  return !status || status === "REJECTED" || status === "CANCELED";
}

// 한 사람이 보낼 수 있는 데이트 신청 수. 서버(AiMatchService.MAX_SENT_REQUESTS_PER_PROFILE)와 같은 값.
const MAX_SENT_REQUESTS = 3;

// 서버가 주는 requestQuota 를 쓰고, 없으면 보낸 신청에서 센다(상대 계정 삭제로 닫힌 건 제외).
function resolveRequestQuota(quota, sentRequests) {
  if (quota && Number.isFinite(Number(quota.limit))) {
    const limit = Number(quota.limit);
    const used = Number(quota.used) || 0;
    return { limit, used, remaining: Math.max(0, limit - used) };
  }
  const used = (sentRequests || []).filter((request) => request.statusReason !== "PROFILE_DELETED").length;
  return { limit: MAX_SENT_REQUESTS, used, remaining: Math.max(0, MAX_SENT_REQUESTS - used) };
}

function RequestQuotaDots({ quota }) {
  return (
    <span className="am-quota__dots" aria-hidden="true">
      {Array.from({ length: quota.limit }, (_, index) => (
        <i key={index} className={index < quota.used ? "is-used" : ""} />
      ))}
    </span>
  );
}

function RequestFaceThumb({ imageUrl, name, onClick }) {
  const resolvedUrl = resolveApiAssetUrl(imageUrl || "", 240);
  const initial = `${name || "?"}`.slice(0, 1);
  const content = resolvedUrl ? <img src={resolvedUrl} alt="" loading="lazy" decoding="async" /> : <em>{initial}</em>;
  if (onClick) {
    return (
      <button
        type="button"
        className="ai-match-request-history-avatar ai-match-request-history-avatar--button"
        aria-label={`${name || "profile"} detail`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }
  return (
    <span className="ai-match-request-history-avatar" aria-label={name || "프로필"}>
      {content}
    </span>
  );
}

function shouldShowPeopleRequestStatus(status) {
  return Boolean(status && status !== "PENDING" && status !== "CANCELED");
}

function isAccessExpiredError(error) {
  return error?.status === 401 || error?.status === 404;
}

function buildLatestSentRequestMap(sentRequests) {
  return (sentRequests || []).reduce((map, request) => {
    if (!map.has(request.profileId)) {
      map.set(request.profileId, request);
    }
    return map;
  }, new Map());
}

function createRequestSnapshot(receivedRequests = [], sentRequests = []) {
  return {
    received: new Map(
      receivedRequests.map((request) => [
        request.id,
        {
          status: request.status,
          statusReason: request.statusReason,
          nickname: request.requesterNickname,
          // 받은 요청에서 상대는 신청한 사람
          partnerConsented: Boolean(request.requesterContactConsentAt),
          contactShared: Boolean(request.requesterContactConsentAt && request.profileContactConsentAt),
        },
      ]),
    ),
    sent: new Map(
      sentRequests.map((request) => [
        request.id,
        {
          status: request.status,
          statusReason: request.statusReason,
          nickname: request.profileNickname,
          // 보낸 요청에서 상대는 신청받은 사람
          partnerConsented: Boolean(request.profileContactConsentAt),
          contactShared: Boolean(request.requesterContactConsentAt && request.profileContactConsentAt),
        },
      ]),
    ),
  };
}

function getRequestNoticeKey(type, request) {
  return `${type}:${request.id}:${request.status || "PENDING"}:${request.statusReason || ""}`;
}

function getSentStatusNotice(request) {
  const name = request.profileNickname || "상대";
  if (isProfileDeletedRequest(request)) return "상대가 계정을 삭제했습니다.";
  if (request.status === "ACCEPTED") return `${name}님이 데이트 신청을 수락했어요.`;
  if (request.status === "REJECTED") return `${name}님이 데이트 신청을 거절했어요.`;
  if (request.status === "PROPOSED") return `${name}님과 만날 시간이 제안됐어요. 신청함에서 확인해 주세요.`;
  if (request.status === "CONFIRMED") return `${name}님과의 약속이 확정됐어요.`;
  if (request.status === "CANCELED") return `${name}님에게 보낸 신청이 취소됐어요.`;
  return `${name}님과의 신청 상태가 ${getRequestStatusLabel(request.status, request.statusReason)}(으)로 바뀌었어요.`;
}

function getReceivedStatusNotice(request) {
  const name = request.requesterNickname || "상대";
  if (isProfileDeletedRequest(request)) return "상대가 계정을 삭제했습니다.";
  if (request.status === "CANCELED") return `${name}님이 데이트 신청을 취소했어요.`;
  return `${name}님의 신청 상태가 ${getRequestStatusLabel(request.status, request.statusReason)}(으)로 바뀌었어요.`;
}

function buildCurrentRequestNotices(nextReceivedRequests, nextSentRequests) {
  return [
    ...nextReceivedRequests
      .filter((request) => RECEIVED_NOTICE_STATUSES.has(request.status || "PENDING"))
      .map((request) => ({
        key: getRequestNoticeKey("received", request),
        tab: "received",
        title: isProfileDeletedRequest(request) ? "상대 계정 삭제" : request.status === "CANCELED" ? "신청 취소됨" : "새 데이트 신청",
        message:
          request.status === "CANCELED"
            ? getReceivedStatusNotice(request)
            : `${request.requesterNickname || "상대"}님이 데이트 신청을 보냈어요.`,
      })),
    ...nextSentRequests
      .filter((request) => SENT_NOTICE_STATUSES.has(request.status))
      .map((request) => ({
        key: getRequestNoticeKey("sent", request),
        tab: "sent",
        title: "신청 응답 도착",
        message: getSentStatusNotice(request),
      })),
  ];
}

/** 상대가 연락처 공유에 동의했거나(ASKED) 둘 다 동의해 번호가 열렸을 때(SHARED) 한 번씩. */
function collectContactNotices(previous, request, tab, partnerName) {
  const name = partnerName || "상대";
  const requester = tab === "received";
  const partnerConsented = Boolean(requester ? request.requesterContactConsentAt : request.profileContactConsentAt);
  const contactShared = Boolean(request.requesterContactConsentAt && request.profileContactConsentAt);
  if (contactShared && !previous.contactShared) {
    return [{ key: `contact:${request.id}:shared`, tab, title: "연락처 공개", message: `두 분 다 동의해서 ${name}님의 번호가 신청함에 보여요.` }];
  }
  if (partnerConsented && !previous.partnerConsented && !contactShared) {
    return [{ key: `contact:${request.id}:asked`, tab, title: "연락처 공유 동의", message: `${name}님이 연락처 공유에 동의했어요. 신청함에서 동의하면 서로 번호가 보여요.` }];
  }
  return [];
}

function collectRequestNotifications(previousSnapshot, nextReceivedRequests, nextSentRequests) {
  if (!previousSnapshot) return [];

  const notices = [];
  nextReceivedRequests.forEach((request) => {
    const previous = previousSnapshot.received.get(request.id);
    if (!previous) {
      notices.push({
        key: getRequestNoticeKey("received", request),
        tab: "received",
        title: "새 데이트 신청",
        message: `${request.requesterNickname || "누군가"}님이 데이트 신청을 보냈어요.`,
      });
      return;
    }
    if (previous.status !== request.status || previous.statusReason !== request.statusReason) {
      notices.push({
        key: getRequestNoticeKey("received", request),
        tab: "received",
        title: isProfileDeletedRequest(request) ? "상대 계정 삭제" : request.status === "CANCELED" ? "신청 취소됨" : "신청 상태 변경",
        message: getReceivedStatusNotice(request),
      });
    }
    notices.push(...collectContactNotices(previous, request, "received", request.requesterNickname));
  });

  nextSentRequests.forEach((request) => {
    const previous = previousSnapshot.sent.get(request.id);
    if (previous && (previous.status !== request.status || previous.statusReason !== request.statusReason)) {
      notices.push({
        key: getRequestNoticeKey("sent", request),
        tab: "sent",
        title: "신청 응답 도착",
        message: getSentStatusNotice(request),
      });
    }
    if (previous) notices.push(...collectContactNotices(previous, request, "sent", request.profileNickname));
  });

  return notices;
}

function collectLoginNotifications(nextReceivedRequests, nextSentRequests) {
  return buildCurrentRequestNotices(nextReceivedRequests, nextSentRequests);
}

function readNoticeKeySet(storageKey, field) {
  if (typeof window === "undefined" || !storageKey) return new Set();
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return new Set(Array.isArray(saved[field]) ? saved[field] : []);
  } catch {
    return new Set();
  }
}

function writeNoticeKeySets(storageKey, shownKeys, seenKeys) {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        shown: [...shownKeys],
        seen: [...seenKeys],
      }),
    );
  } catch {
    // Notification memory is best-effort; app behavior should not fail when storage is blocked.
  }
}

function getRestorableAccessScreen(screen) {
  return RESTORABLE_ACCESS_SCREENS.has(screen) ? screen : "intro";
}

function readAccessSession() {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(ACCESS_SESSION_STORAGE_KEY) || "null");
    if (!saved?.nickname || !saved?.pin) return null;
    return {
      nickname: `${saved.nickname}`.trim(),
      pin: `${saved.pin}`.trim(),
      screen: getRestorableAccessScreen(saved.screen),
    };
  } catch {
    return null;
  }
}

function writeAccessSession(nickname, pin, screen) {
  if (typeof window === "undefined" || !nickname || !pin) return;
  try {
    window.sessionStorage.setItem(
      ACCESS_SESSION_STORAGE_KEY,
      JSON.stringify({
        nickname,
        pin,
        screen: getRestorableAccessScreen(screen),
      }),
    );
  } catch {
    // Session restore is best-effort; blocked storage should not break the app.
  }
}

function clearStoredAccessSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACCESS_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function normalizeDateTimeLocalValue(dateTime) {
  if (!dateTime) return "";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatMeetupDateTime(dateTime) {
  if (!dateTime) return "";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "";
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
}

function buildMeetupTimeOptions() {
  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / 5) * 5;
  now.setMinutes(roundedMinutes, 0, 0);
  const offsets = [10, 20, 30, 45, 60, 90];

  return offsets.map((offset) => {
    const optionDate = new Date(now.getTime() + offset * 60000);
    const hours = `${optionDate.getHours()}`.padStart(2, "0");
    const minutes = `${optionDate.getMinutes()}`.padStart(2, "0");
    return {
      value: normalizeDateTimeLocalValue(optionDate.toISOString()),
      label: `${hours}:${minutes} (${offset}분 뒤)`,
    };
  });
}

function buildDecoratedProfiles(profiles) {
  return profiles.map((profile) => {
    const parsed = parseProfileCopy(profile.intro);
    return {
      ...profile,
      summary: parsed.summary,
      tags: parsed.tags.length ? parsed.tags.slice(0, 4) : getFallbackTags(profile).slice(0, 4),
      mbti: parsed.mbti,
      tone: getProfileTone(profile.gender),
      genderLabel: getProfileGenderLabel(profile.gender),
      isRequestable: Boolean(profile.generatedImageUrl),
    };
  });
}

function matchesProfileFilter(filter, profile) {
  if (filter === "남자") return profile.gender === "남성";
  if (filter === "여자") return profile.gender === "여성";
  if (filter === "신청 가능") return profile.isRequestable;
  // 사주 궁합 80점 이상. 둘 다 생년월일이 있어야 점수가 있다.
  if (filter === "찰떡 궁합") return Number(profile.compatibility?.score) >= 80;
  return true;
}

function matchesDiscoveryFilters(profile, searchQuery, mbtiFilter, tagFilters) {
  const normalizedQuery = `${searchQuery || ""}`.trim().toLowerCase();
  const normalizedMbtiFilter = cleanMbtiValue(mbtiFilter);
  const normalizedTagFilters = Array.isArray(tagFilters)
    ? tagFilters.map((tag) => `${tag || ""}`.trim()).filter(Boolean)
    : [];

  if (normalizedMbtiFilter && profile.mbti !== normalizedMbtiFilter) {
    return false;
  }

  if (normalizedTagFilters.length && !normalizedTagFilters.some((tag) => profile.tags.includes(tag))) {
    return false;
  }

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    profile.nickname,
    profile.summary,
    profile.meetPlace,
    profile.genderLabel,
    profile.mbti,
    ...(profile.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

const CONVERTING_STEPS = ["사진 분석", "웹툰 변환", "품질 정리"];

function getConvertingStatus(seconds) {
  if (seconds >= 45) {
    return {
      stepIndex: 2,
      title: "이미지 품질을 정리하는 중이에요",
      copy: "요청이 많아 조금 더 걸리고 있어요. 새로고침하지 말고 기다려 주세요.",
    };
  }
  if (seconds >= 25) {
    return {
      stepIndex: 2,
      title: "거의 다 됐어요",
      copy: "웹툰 이미지의 선과 색감을 정리하고 있어요.",
    };
  }
  if (seconds >= 10) {
    return {
      stepIndex: 1,
      title: "웹툰 스타일로 변환하고 있어요",
      copy: "보통 20~60초 정도 걸려요. 잠시만 기다려 주세요.",
    };
  }
  return {
    stepIndex: 0,
    title: "사진을 분석하고 있어요",
    copy: "얼굴과 조명을 확인한 뒤 웹툰 스타일로 바꿔요.",
  };
}

function formatImagePreviewError(error) {
  const message = `${error?.message || ""}`;
  const lowerMessage = message.toLowerCase();
  if (message.includes("AI 이미지 변환 가능 횟수")) {
    return "이 전화번호는 AI 이미지 변환 가능 횟수 2회를 모두 사용했어요.";
  }
  if (message.includes("삭제된 프로필의 전화번호")) {
    return "삭제된 프로필의 전화번호로는 다시 가입하거나 AI 변환을 사용할 수 없어요.";
  }
  if (message.includes("전화번호")) {
    return "전화번호를 먼저 정확히 입력한 뒤 사진을 업로드해 주세요.";
  }
  const rejectedPrefix = "AI_MATCH_PHOTO_REJECTED:";
  const rejectedIndex = message.indexOf(rejectedPrefix);
  if (rejectedIndex >= 0) {
    const reason = message.slice(rejectedIndex + rejectedPrefix.length).replace(/\)+$/, "").trim();
    return reason || "정면 얼굴이 잘 보이는 1인 실제 사진을 올려 주세요.";
  }
  if (message.includes("OpenAI 사용량 한도") || message.includes("결제 크레딧") || lowerMessage.includes("quota")) {
    return "OpenAI 사용량 한도 또는 결제 크레딧이 부족해요. OpenAI 결제/Usage 한도를 확인해 주세요.";
  }
  if (message.includes("API 키") || lowerMessage.includes("api key")) {
    return "OpenAI API 키가 올바르지 않거나 서버에 적용되지 않았어요. OPENAI_API_KEY 환경변수를 확인해 주세요.";
  }
  if (message.includes("모델 설정") || lowerMessage.includes("model")) {
    return "OpenAI 모델 설정이 올바르지 않아요. OPENAI_MODEL 또는 OPENAI_IMAGE_MODEL 값을 확인해 주세요.";
  }
  if (message.includes("요청이 일시적으로 제한") || lowerMessage.includes("rate limit")) {
    return "AI 요청이 일시적으로 많아 제한되었어요. 잠시 후 다시 시도해 주세요.";
  }
  if (message.includes("응답 시간이 초과") || lowerMessage.includes("timeout")) {
    return "AI 변환 시간이 길어지고 있어요. 잠시 후 다시 시도해 주세요.";
  }
  return "AI 변환에 실패했어요. 잠시 후 다시 시도해 주세요. 계속 실패하면 다른 사진으로 한 번 더 시도해 주세요.";
}

export default function AiMatchPage() {
  const [activeScreen, setActiveScreen] = useState("intro");
  // 조용한 갱신(15초마다)이 응답을 받을 때 '지금 보고 있는 화면'을 알기 위한 값.
  const activeScreenRef = useRef(activeScreen);
  activeScreenRef.current = activeScreen;
  const [profiles, setProfiles] = useState([]);
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const [accessProfile, setAccessProfile] = useState(null);
  const [accessRequests, setAccessRequests] = useState([]);
  const [accessSentRequests, setAccessSentRequests] = useState([]);
  const [accessRequestQuota, setAccessRequestQuota] = useState(null);
  // 탭에 처음 들어올 때 한 번 뜨는 사주 스플래시
  const [sajuSplash, setSajuSplash] = useState(() => shouldShowSajuSplash());
  // 새 가입 받기 여부(운영진 스위치). 못 읽으면 받는 것으로 본다(서버가 어차피 막는다).
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [registrationClosedMessage, setRegistrationClosedMessage] = useState("");
  const [closedNoticeDismissed, setClosedNoticeDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    const read = () =>
      fetchAiMatchStatus()
        .then((status) => {
          if (!alive || !status) return;
          setRegistrationOpen(status.registrationOpen !== false);
          setRegistrationClosedMessage(status.registrationClosedMessage || "");
        })
        .catch(() => {});
    read();
    const intervalId = window.setInterval(read, 60_000);
    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, []);
  const fortuneRef = useRef(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("OFFENSIVE_MESSAGE");
  // 열려 있는 블라인드 채팅방(신청 id). 신청함이 15초마다 새로 그려져도 닫히지 않게 페이지에서 들고 있는다.
  const [chatRequestId, setChatRequestId] = useState(null);
  const [reportDetail, setReportDetail] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [accessNickname, setAccessNickname] = useState("");
  const [accessPin, setAccessPin] = useState("");
  const [accessPhoneNumber, setAccessPhoneNumber] = useState("");
  const [accessPhoneUsage, setAccessPhoneUsage] = useState(null);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessTargetScreen, setAccessTargetScreen] = useState("requests");
  const [requestTab, setRequestTab] = useState("received");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCheckAttempted, setPhoneCheckAttempted] = useState(false);
  const [phoneChecking, setPhoneChecking] = useState(false);
  const [phoneCheckResult, setPhoneCheckResult] = useState(null);
  const [phoneVerifiedKey, setPhoneVerifiedKey] = useState("");
  const [gender, setGender] = useState("여성");
  // 사주용. 실명과 생년월일은 사주를 뽑는 데만 쓰고 다른 참가자에게 보이지 않는다.
  const [realName, setRealName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [mbti, setMbti] = useState("");
  const [intro, setIntro] = useState("");
  const [place, setPlace] = useState(MEET_PLACES[0]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertSeconds, setConvertSeconds] = useState(0);
  const [consent, setConsent] = useState(false);
  const [requesterNickname, setRequesterNickname] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestPlace, setRequestPlace] = useState(MEET_PLACES[0]);
  const [meetupDrafts, setMeetupDrafts] = useState({});
  const [activeFilter, setActiveFilter] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [peopleTagFilters, setPeopleTagFilters] = useState([]);
  const [peopleFiltersOpen, setPeopleFiltersOpen] = useState(false);
  // 목록 정렬: 궁합 점수 높은 순이 기본. 점수 없는 사람은 뒤로.
  const [peopleSort, setPeopleSort] = useState("match");
  const [peopleMbtiFilter, setPeopleMbtiFilter] = useState("");
  const [favoriteProfileIds, setFavoriteProfileIds] = useState([]);
  const [expandedTagProfileIds, setExpandedTagProfileIds] = useState([]);
  const [liveNotice, setLiveNotice] = useState(null);
  const [unreadRequestCount, setUnreadRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [registerAttempted, setRegisterAttempted] = useState(false);
  // 가입 화면 즉시 검사: 닉네임 중복, 전화번호 자동 확인, 사주 미리보기, 손댄 칸
  const [nicknameCheck, setNicknameCheck] = useState({ status: "idle", message: "" });
  const [sajuPreview, setSajuPreview] = useState(null);
  const [sajuPreviewError, setSajuPreviewError] = useState("");
  const [touched, setTouched] = useState({});
  const nicknameCheckSeq = useRef(0);
  const phoneAutoCheckedKeyRef = useRef("");
  // 첫 화면 '소개팅은 이렇게 이어져요'에서 펼쳐 둔 단계 번호("" = 모두 접힘)
  const [openFlowStep, setOpenFlowStep] = useState("");
  const [accessAttempted, setAccessAttempted] = useState(false);
  // 로그인 시트 안에 보여 줄 오류(틀린 닉네임·비밀번호 등). 시트가 화면을 덮어 위쪽 배너는 안 보인다.
  const [accessError, setAccessError] = useState("");
  const accessSessionSeqRef = useRef(0);
  const accessSessionRestoredRef = useRef(false);
  const accessRefreshInFlightRef = useRef(false);
  const accessRefreshPausedUntilRef = useRef(0);
  const accessRefreshTickRef = useRef(0);
  const requestSnapshotRef = useRef(null);
  const liveNoticeTimeoutRef = useRef(null);
  const selectedProfileRef = useRef(null);
  const accessDialogRef = useRef(null);
  const accessNicknameInputRef = useRef(null);
  const noticeStorageKeyRef = useRef("");
  const shownNoticeKeysRef = useRef(new Set());
  const seenNoticeKeysRef = useRef(new Set());
  const currentNoticeKeysRef = useRef(new Set());

  const isEditingProfile = editingProfileId !== null;
  const normalizedNickname = nickname.trim().toLowerCase();
  const hasDuplicateNickname = Boolean(
    normalizedNickname &&
      profiles.some(
        (profile) =>
          profile.nickname.trim().toLowerCase() === normalizedNickname &&
          profile.id !== editingProfileId,
      ),
  );
  const nicknameInvalid = Boolean(nickname.trim()) && (nickname.trim().length < 2 || /\s/.test(nickname.trim()));
  const nicknameTaken = hasDuplicateNickname || nicknameCheck.status === "taken";
  const pinMismatch = !isEditingProfile && pin.length > 0 && pinConfirm.length > 0 && pin !== pinConfirm;
  const pinInvalid = !isEditingProfile && pin.length > 0 && (pin.length < 4 || pin.length > 10 || /\s/.test(pin));
  const phoneDigits = phoneNumber.replace(/\D/g, "");
  const phoneNumberKey = getPhoneNumberKey(phoneNumber);
  const phoneMissing = !isEditingProfile && !phoneNumber.trim();
  const phoneInvalid = phoneNumber.trim().length > 0 && (phoneDigits.length < 8 || phoneDigits.length > 15);
  const phoneVerifiedForCurrentNumber = Boolean(
    isEditingProfile || (phoneVerifiedKey && phoneNumberKey && phoneVerifiedKey === phoneNumberKey),
  );
  const imageMissing = !generatedImageUrl;
  const nicknameMissing = !nickname.trim();
  const pinMissing = !isEditingProfile && !pin.trim();
  const pinConfirmMissing = !isEditingProfile && !pinConfirm.trim();
  const introMissing = !intro.trim();
  const consentMissing = !consent;
  // 사주는 새로 가입할 때만 필수다. 기존 프로필 수정에서는 비워두면 사주를 그대로 둔다.
  const realNameMissing = !isEditingProfile && !realName.trim();
  const birthDateMissing = !isEditingProfile && !birthDate.trim();
  const birthDateInvalid =
    Boolean(birthDate.trim()) && (Number.isNaN(Date.parse(birthDate)) || new Date(birthDate) > new Date());
  const accessNicknameMissing = !accessNickname.trim();
  const accessPinMissing = !accessPin.trim();
  const accessPinInvalid = accessPin.length > 0 && (accessPin.length < 4 || accessPin.length > 10 || /\s/.test(accessPin));
  const canRegister = Boolean(
    !nicknameMissing &&
      !introMissing &&
      !imageMissing &&
      !consentMissing &&
      !realNameMissing &&
      !birthDateMissing &&
      !birthDateInvalid &&
      !submitting &&
      !converting &&
      !nicknameTaken &&
      !nicknameInvalid &&
      nicknameCheck.status !== "checking" &&
      phoneVerifiedForCurrentNumber &&
      (!phoneMissing && !phoneInvalid) &&
      (isEditingProfile || (pin.length >= 4 && pin.length <= 10 && !/\s/.test(pin) && pin === pinConfirm)),
  );
  // 다 채우지 않아도 눌린다 — 누르면 안 채운 칸으로 화면을 옮겨 준다. 처리 중일 때만 잠근다.
  const registerSubmitDisabled = submitting || converting;
  const bannerText = errorMessage
    ? errorMessage
      : converting
        ? "웹툰 이미지로 변환 중입니다. 보통 20~60초 정도 걸립니다."
        : successMessage;
  const isDetailScreen = Boolean(selectedProfile);
  // 로그인 뒤 목록과 프로필 상세는 밤 풍경 위 유리 카드(밤 모드)
  // 사주 소개팅 탭은 모든 화면이 밤 풍경 위 유리 카드(밤 모드)
  const nightMode = true;
  const decoratedProfiles = buildDecoratedProfiles(profiles);
  const filteredProfiles = decoratedProfiles
    .filter(
      (profile) =>
        matchesProfileFilter(activeFilter, profile) &&
        (activeFilter !== "좋아요" || isFavoriteProfile(profile.id)) &&
        matchesDiscoveryFilters(profile, searchQuery, peopleMbtiFilter, peopleTagFilters),
    )
    .sort((a, b) => {
      if (peopleSort === "match") {
        const sa = Number.isFinite(Number(a.compatibility?.score)) ? Number(a.compatibility.score) : -1;
        const sb = Number.isFinite(Number(b.compatibility?.score)) ? Number(b.compatibility.score) : -1;
        if (sb !== sa) return sb - sa;
      }
      return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
    });
  // 나와 궁합이 가장 좋은 세 명(점수가 있는 사람만).
  const topMatches = decoratedProfiles
    .filter((profile) => profile.compatibility && profile.id !== accessProfile?.id)
    .sort((a, b) => Number(b.compatibility.score) - Number(a.compatibility.score))
    .slice(0, 3);
  const latestSentRequestMap = buildLatestSentRequestMap(accessSentRequests);
  const requestQuota = resolveRequestQuota(accessRequestQuota, accessSentRequests);
  const requestQuotaExhausted = Boolean(accessProfile) && requestQuota.remaining <= 0;
  const selectedDetailProfile = selectedProfile
    ? buildDecoratedProfiles([selectedProfile])[0]
    : null;
  const selectedDetailRequest = selectedProfile ? latestSentRequestMap.get(selectedProfile.id) : null;
  const meetupTimeOptions = buildMeetupTimeOptions();
  const convertingStatus = getConvertingStatus(convertSeconds);
  const activeScreenTitle = activeScreen === "intro" && accessProfile ? SCREEN_COPY.people : SCREEN_COPY[activeScreen];

  // 닉네임: 치는 대로 서버에 물어본다(0.45초 뒤). 수정 중이고 지금 닉네임 그대로면 안 물어본다.
  useEffect(() => {
    if (activeScreen !== "register") return undefined;
    const value = nickname.trim();
    if (!value || value.length < 2 || /\s/.test(value)) {
      setNicknameCheck({ status: "idle", message: "" });
      return undefined;
    }
    if (isEditingProfile && accessProfile && value.toLowerCase() === `${accessProfile.nickname || ""}`.trim().toLowerCase()) {
      setNicknameCheck({ status: "ok", message: "지금 쓰는 닉네임이에요." });
      return undefined;
    }
    const seq = ++nicknameCheckSeq.current;
    setNicknameCheck({ status: "checking", message: "확인 중…" });
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkAiMatchNickname(value, editingProfileId);
        if (seq !== nicknameCheckSeq.current) return;
        setNicknameCheck({ status: result.available ? "ok" : "taken", message: result.message || "" });
      } catch {
        if (seq !== nicknameCheckSeq.current) return;
        setNicknameCheck({ status: "unknown", message: "지금은 중복 확인이 안 돼요. 등록할 때 다시 확인해요." });
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [nickname, activeScreen, isEditingProfile, editingProfileId, accessProfile]);

  // 전화번호: 숫자 10~11자리가 되면 버튼 없이 바로 확인한다(0.6초 뒤). 같은 번호는 한 번만.
  useEffect(() => {
    if (activeScreen !== "register" || isEditingProfile) return undefined;
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11 || phoneInvalid) return undefined;
    if (phoneAutoCheckedKeyRef.current === digits) return undefined;
    const timer = window.setTimeout(() => {
      phoneAutoCheckedKeyRef.current = digits;
      handlePhoneCheck({ silent: true });
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber, activeScreen, isEditingProfile]);

  // 사주: 이름과 생년월일이 들어오면 바로 뽑아 보여 준다(0.5초 뒤). 저장은 등록할 때.
  useEffect(() => {
    if (activeScreen !== "register") return undefined;
    const date = birthDate.trim();
    if (!date || birthDateInvalid) {
      setSajuPreview(null);
      setSajuPreviewError("");
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const preview = await previewAiMatchSaju(date, birthTime.trim(), nickname.trim() || realName.trim());
        setSajuPreview(preview);
        setSajuPreviewError("");
      } catch (error) {
        setSajuPreview(null);
        setSajuPreviewError(error.message || "사주를 미리 볼 수 없어요.");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [birthDate, birthTime, nickname, realName, activeScreen, birthDateInvalid]);

  async function loadData() {
    setLoading(false);
  }

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (accessSessionRestoredRef.current) return;
    accessSessionRestoredRef.current = true;
    const savedSession = readAccessSession();
    if (!savedSession) return;

    setAccessSubmitting(true);
    setErrorMessage("");
    loadAccessProfile(savedSession.nickname, savedSession.pin, savedSession.screen, { closeModal: false })
      .catch(() => {
        clearAccessSession({ resetForm: true });
        setActiveScreen("intro");
      })
      .finally(() => {
        setAccessSubmitting(false);
      });
  }, []);

  useEffect(() => {
    if (!accessProfile || !accessNickname || !accessPin) return;
    writeAccessSession(accessNickname, accessPin, activeScreen);
  }, [accessProfile, accessNickname, accessPin, activeScreen]);

  useEffect(
    () => () => {
      if (liveNoticeTimeoutRef.current) {
        window.clearTimeout(liveNoticeTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!accessModalOpen) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
      accessDialogRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      window.setTimeout(() => {
        accessNicknameInputRef.current?.focus({ preventScroll: true });
      }, 220);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [accessModalOpen]);

  useEffect(() => {
    if (activeScreen === "requests") {
      markRequestNoticesSeen();
    }
  }, [activeScreen]);

  useEffect(() => {
    if (!converting) return undefined;

    const intervalId = window.setInterval(() => {
      setConvertSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [converting]);

  useEffect(() => {
    if (!selectedProfile) return;
    setRequestPlace(MEET_PLACES[0]);
  }, [selectedProfile]);

  // 프로필 수정 화면을 저장하지 않고 떠나면(하단 탭 · 뒤로) '수정 중'을 푼다.
  // 수정하는 동안은 아래 자동 갱신을 멈추는데, 안 풀면 신청함 · 약속 · 부스 안내가 화면에 계속 안 바뀐다.
  useEffect(() => {
    if (activeScreen !== "register" && editingProfileId !== null) setEditingProfileId(null);
  }, [activeScreen, editingProfileId]);

  useEffect(() => {
    if (!accessProfile || !accessNickname || !accessPin || isEditingProfile) return undefined;

    // 신청함 갱신용 조용한 재로그인. 예전엔 2초마다 불러서 서버 레이트리밋(IP당)을 혼자 다 써 버렸다.
    // 15초면 축제 현장에서 충분하고, 탭을 다시 볼 때는 바로 한 번 부른다. 429 를 받으면 1분 쉰다.
    const refreshSilently = () => {
      if (document.visibilityState === "hidden" || accessRefreshInFlightRef.current || submitting || accessSubmitting) {
        return;
      }
      if (accessRefreshPausedUntilRef.current > Date.now()) {
        return;
      }
      accessRefreshInFlightRef.current = true;
      // 신청함은 15초마다, 사람 목록까지는 2분마다 다시 읽는다.
      accessRefreshTickRef.current += 1;
      const light = accessRefreshTickRef.current % 8 !== 0;
      loadAccessProfile(accessNickname, accessPin, activeScreen, { closeModal: false, notify: true, light, keepScreen: true })
        .catch((error) => {
          if (error?.status === 429) {
            accessRefreshPausedUntilRef.current = Date.now() + 60_000;
            return;
          }
          if (isAccessExpiredError(error)) {
            clearAccessSession({ resetForm: true });
            setActiveScreen("intro");
            setErrorMessage("프로필이 삭제되었거나 인증이 만료되었습니다. 닉네임과 비밀번호로 다시 입장해 주세요.");
          }
        })
        .finally(() => {
          accessRefreshInFlightRef.current = false;
        });
    };
    const intervalId = window.setInterval(refreshSilently, 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };
    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accessProfile, accessNickname, accessPin, activeScreen, isEditingProfile, submitting, accessSubmitting]);

  function toggleTag(tag) {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }
      if (current.length >= 6) {
        return current;
      }
      return [...current, tag];
    });
  }

  async function toggleFavorite(profileId) {
    if (!accessProfile || !accessPin) {
      setErrorMessage("좋아요는 로그인 후 사용할 수 있습니다.");
      openAccessModal("intro");
      return;
    }

    const wasFavorite = favoriteProfileIds.includes(profileId);
    setFavoriteProfileIds((current) =>
      current.includes(profileId) ? current.filter((item) => item !== profileId) : [...current, profileId],
    );
    try {
      const response = await toggleAiMatchFavorite(profileId, accessProfile.nickname, accessPin);
      if (Array.isArray(response.favoriteProfileIds)) {
        setFavoriteProfileIds(response.favoriteProfileIds);
      }
    } catch (error) {
      setFavoriteProfileIds((current) => {
        const withoutProfile = current.filter((item) => item !== profileId);
        return wasFavorite ? [...withoutProfile, profileId] : withoutProfile;
      });
      showAuthenticatedActionError(error, "좋아요 처리에 실패했습니다.");
    }
  }

  function toggleExpandedTags(profileId) {
    setExpandedTagProfileIds((current) =>
      current.includes(profileId) ? current.filter((item) => item !== profileId) : [...current, profileId],
    );
  }

  function togglePeopleTagFilter(tag) {
    setPeopleTagFilters((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  function openMeetPlaceMap() {
    const { label, lat, lng } = MEET_PLACE_MAP_TARGET;
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(label)},${lat},${lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function getMeetupDraft(request) {
    const savedDraft = meetupDrafts[request.id];
    return {
      meetupPlace: savedDraft?.meetupPlace || request.meetupPlace || request.meetPlace || MEET_PLACES[0],
      meetupAt: savedDraft?.meetupAt || normalizeDateTimeLocalValue(request.meetupAt) || meetupTimeOptions[0]?.value || "",
    };
  }

  function updateMeetupDraft(requestId, patch) {
    setMeetupDrafts((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] || {}),
        ...patch,
      },
    }));
  }

  function openAccessModal(targetScreen = "requests") {
    setAccessTargetScreen(targetScreen);
    setAccessModalOpen(true);
    setAccessAttempted(false);
    setAccessError("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeAccessModal() {
    setAccessModalOpen(false);
    setAccessSubmitting(false);
    setAccessAttempted(false);
    setAccessError("");
  }

  function clearAccessSession({ resetForm = false } = {}) {
    accessSessionSeqRef.current += 1;
    clearStoredAccessSession();
    setAccessProfile(null);
    setAccessRequests([]);
    setAccessSentRequests([]);
    setAccessRequestQuota(null);
    setProfiles([]);
    setFavoriteProfileIds([]);
    setAccessNickname("");
    setAccessPin("");
    setAccessPhoneNumber("");
    setAccessPhoneUsage(null);
    setRequesterNickname("");
    setActiveSelectedProfile(null);
    setRequestMessage("");
    setRequestPlace(MEET_PLACES[0]);
    setMeetupDrafts({});
    setLiveNotice(null);
    setUnreadRequestCount(0);
    requestSnapshotRef.current = null;
    noticeStorageKeyRef.current = "";
    shownNoticeKeysRef.current = new Set();
    seenNoticeKeysRef.current = new Set();
    currentNoticeKeysRef.current = new Set();
    if (resetForm) {
      resetRegistrationForm();
    }
  }

  function showAuthenticatedActionError(error, fallbackMessage) {
    if (isAccessExpiredError(error)) {
      clearAccessSession({ resetForm: true });
      setActiveScreen("intro");
      setErrorMessage("프로필이 삭제되었거나 인증이 만료되었습니다. 닉네임과 비밀번호로 다시 입장해 주세요.");
      return;
    }
    const rawMessage = error?.message || "";
    const lowerMessage = rawMessage.toLowerCase();
    if (
      lowerMessage.includes("could not execute statement") ||
      lowerMessage.includes("internal server error") ||
      lowerMessage.includes("sql")
    ) {
      setErrorMessage(fallbackMessage);
      return;
    }
    setErrorMessage(rawMessage || fallbackMessage);
  }

  function getNoticeStorageKey(profile, fallbackNickname) {
    const profileKey = profile?.id || `${fallbackNickname || ""}`.trim().toLowerCase();
    return profileKey ? `ai-match-request-notices:${profileKey}` : "";
  }

  function prepareNoticeTracking(profile, fallbackNickname) {
    const storageKey = getNoticeStorageKey(profile, fallbackNickname);
    if (!storageKey || noticeStorageKeyRef.current === storageKey) return;
    noticeStorageKeyRef.current = storageKey;
    shownNoticeKeysRef.current = readNoticeKeySet(storageKey, "shown");
    seenNoticeKeysRef.current = readNoticeKeySet(storageKey, "seen");
    currentNoticeKeysRef.current = new Set();
  }

  function persistNoticeTracking() {
    writeNoticeKeySets(noticeStorageKeyRef.current, shownNoticeKeysRef.current, seenNoticeKeysRef.current);
  }

  function updateUnreadRequestCount(notices, visibleScreen = activeScreen) {
    const currentKeys = new Set(notices.map((notice) => notice.key).filter(Boolean));
    currentNoticeKeysRef.current = currentKeys;
    if (visibleScreen === "requests") {
      currentKeys.forEach((key) => seenNoticeKeysRef.current.add(key));
      persistNoticeTracking();
      setUnreadRequestCount(0);
      return;
    }
    const unreadCount = [...currentKeys].filter((key) => !seenNoticeKeysRef.current.has(key)).length;
    setUnreadRequestCount(Math.min(99, unreadCount));
  }

  function markRequestNoticesSeen() {
    currentNoticeKeysRef.current.forEach((key) => seenNoticeKeysRef.current.add(key));
    persistNoticeTracking();
    setUnreadRequestCount(0);
  }

  function isFavoriteProfile(profileId) {
    return favoriteProfileIds.includes(profileId);
  }

  function dismissLiveNotice() {
    setLiveNotice(null);
  }

  function showLiveNotice(notices) {
    const freshNotices = notices.filter((notice) => {
      const key = notice.key || `${notice.tab}:${notice.message}`;
      return key && !shownNoticeKeysRef.current.has(key);
    });
    if (!freshNotices.length) return;

    freshNotices.forEach((notice) => {
      const key = notice.key || `${notice.tab}:${notice.message}`;
      shownNoticeKeysRef.current.add(key);
    });
    persistNoticeTracking();

    const [firstNotice] = freshNotices;
    const message =
      freshNotices.length > 1
        ? `${firstNotice.message} 외 ${freshNotices.length - 1}건의 새 알림이 있어요.`
        : firstNotice.message;

    setLiveNotice({
      id: `${Date.now()}-${freshNotices.length}`,
      tab: firstNotice.tab,
      title: firstNotice.title || "새 알림 도착",
      message,
    });
    if (liveNoticeTimeoutRef.current) {
      window.clearTimeout(liveNoticeTimeoutRef.current);
    }
    liveNoticeTimeoutRef.current = window.setTimeout(() => {
      setLiveNotice(null);
    }, 12000);
  }

  function openLiveNoticeTarget(tab = "received") {
    setLiveNotice(null);
    markRequestNoticesSeen();
    setActiveSelectedProfile(null);
    setRequestTab(tab === "sent" ? "sent" : "received");
    setActiveScreen("requests");
  }

  function getAccessModalTitle() {
    if (accessTargetScreen === "people" || accessTargetScreen === "intro") return "로그인";
    if (accessTargetScreen === "my") return "MY 잠금 해제";
    return "신청함 잠금 해제";
  }

  function getAccessSubmitLabel() {
    if (accessSubmitting) return "확인 중...";
    if (accessTargetScreen === "people" || accessTargetScreen === "intro") return "로그인";
    if (accessTargetScreen === "my") return "MY 열기";
    return "신청함 열기";
  }

  async function loadAccessProfile(
    nextNickname,
    nextPin,
    nextScreen = "requests",
    { closeModal = true, notify = false, announceSummary = false, light = false, keepScreen = false } = {},
  ) {
    // keepScreen: 조용한 갱신. 요청을 보낸 뒤 응답이 오기 전에 사용자가 다른 화면으로 갔으면 그 화면에 그대로 둔다
    // (예전엔 응답이 오면서 요청을 보낼 때의 화면으로 되돌아갔다).
    const resolveScreen = () => {
      const wanted = keepScreen ? activeScreenRef.current : nextScreen;
      return wanted === "people" ? "intro" : wanted;
    };
    const sessionSeq = accessSessionSeqRef.current;
    // light: 신청함만 다시 읽는다(사람 목록은 그대로 둔다). 목록에 없는 사람이 신청함에 보이면 전체를 다시 읽는다.
    let response = null;
    if (light) {
      try {
        response = await fetchAiMatchInbox(nextNickname, nextPin);
      } catch (error) {
        if (error?.status === 401 || error?.status === 429) throw error;
        response = null;
      }
      if (response) {
        const known = new Set(profilesRef.current.map((profile) => profile.id));
        const stranger = [...(response.receivedRequests || []), ...(response.sentRequests || [])].some(
          (request) =>
            (request.requesterProfileId && request.requesterProfileId !== response.profile?.id && !known.has(request.requesterProfileId)) ||
            (request.profileId && request.profileId !== response.profile?.id && !known.has(request.profileId)),
        );
        if (stranger) response = null;
      }
    }
    if (!response) {
      response = await accessAiMatchProfile(nextNickname, nextPin);
    }
    if (sessionSeq !== accessSessionSeqRef.current) {
      return response;
    }
    const nextProfiles = Array.isArray(response.profiles) ? response.profiles : profilesRef.current;
    const nextReceivedRequests = Array.isArray(response.receivedRequests)
      ? response.receivedRequests
      : Array.isArray(response.requests)
        ? response.requests
        : [];
    const nextSentRequests = Array.isArray(response.sentRequests) ? response.sentRequests : [];
    const nextFavoriteProfileIds = Array.isArray(response.favoriteProfileIds) ? response.favoriteProfileIds : [];
    prepareNoticeTracking(response.profile, nextNickname);
    const currentNotices = buildCurrentRequestNotices(nextReceivedRequests, nextSentRequests);
    const requestNotices = notify
      ? collectRequestNotifications(requestSnapshotRef.current, nextReceivedRequests, nextSentRequests)
      : [];
    const loginNotices = announceSummary ? collectLoginNotifications(nextReceivedRequests, nextSentRequests) : [];
    requestSnapshotRef.current = createRequestSnapshot(nextReceivedRequests, nextSentRequests);
    const resolvedNextScreen = resolveScreen();
    updateUnreadRequestCount(currentNotices, resolvedNextScreen);
    setAccessProfile(response.profile || null);
    setAccessRequests(nextReceivedRequests);
    setAccessSentRequests(nextSentRequests);
    setAccessRequestQuota(response.requestQuota || null);
    setProfiles(nextProfiles);
    setFavoriteProfileIds(nextFavoriteProfileIds);
    setAccessNickname(nextNickname);
    setAccessPin(nextPin);
    setAccessPhoneNumber(response.phoneNumber || "");
    setAccessPhoneUsage(response.phoneUsage || null);
    setRequesterNickname(response.profile?.nickname || nextNickname);
    writeAccessSession(nextNickname, nextPin, resolvedNextScreen);
    const currentSelectedProfile = selectedProfileRef.current;
    if (currentSelectedProfile) {
      setActiveSelectedProfile(nextProfiles.find((profile) => profile.id === currentSelectedProfile.id) || null);
    }
    if (!keepScreen) {
      setActiveScreen(resolvedNextScreen);
    }
    if (closeModal) {
      setAccessModalOpen(false);
    }
    showLiveNotice(loginNotices.length ? loginNotices : requestNotices);
    return response;
  }

  async function handleAccessSubmit(event) {
    event.preventDefault();
    setAccessAttempted(true);
    setAccessError("");
    // 빈 칸·글자 수는 칸 바로 아래에 뜬다.
    if (!accessNickname.trim() || !accessPin.trim() || accessPinInvalid) {
      return;
    }

    setAccessSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await loadAccessProfile(accessNickname.trim(), accessPin.trim(), accessTargetScreen, {
        announceSummary: true,
      });
      setSuccessMessage("신청함 잠금이 해제되었습니다.");
    } catch (error) {
      setAccessError(
        error.status === 401
          ? "닉네임 또는 비밀번호가 맞지 않아요. 다시 확인해 주세요."
          : error.message || "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      );
    } finally {
      setAccessSubmitting(false);
    }
  }

  function openProfile(profile) {
    setActiveSelectedProfile(profile);
    setSuccessMessage("");
    setErrorMessage("");
  }

  function findRequestProfile(request, direction) {
    const targetProfileId = direction === "received" ? request.requesterProfileId : request.profileId;
    return profiles.find((profile) => profile.id === targetProfileId) || null;
  }

  function openRequestProfile(request, direction) {
    const requestProfile = findRequestProfile(request, direction);
    if (!requestProfile) return;
    openProfile(requestProfile);
  }

  async function handleReportSubmit(event) {
    event.preventDefault();
    if (!selectedProfile || !accessNickname || !accessPin) {
      setErrorMessage("신고는 로그인 후 할 수 있어요.");
      return;
    }
    setReportBusy(true);
    try {
      await reportAiMatchProfile(selectedProfile.id, accessNickname, accessPin, reportReason, reportDetail);
      setReportOpen(false);
      setReportDetail("");
      setSuccessMessage("신고가 접수됐어요. 운영진이 확인하고 조치할게요. 상대에게는 알려지지 않아요.");
    } catch (error) {
      setErrorMessage(error.message || "신고를 접수하지 못했어요.");
    } finally {
      setReportBusy(false);
    }
  }

  function closeDetail() {
    setReportOpen(false);
    setActiveSelectedProfile(null);
  }

  function setActiveSelectedProfile(profile) {
    selectedProfileRef.current = profile;
    setSelectedProfile(profile);
  }

  function resetRegistrationForm() {
    setRegisterAttempted(false);
    setNicknameCheck({ status: "idle", message: "" });
    setSajuPreview(null);
    setSajuPreviewError("");
    setTouched({});
    phoneAutoCheckedKeyRef.current = "";
    setEditingProfileId(null);
    setNickname("");
    setPin("");
    setPinConfirm("");
    setPhoneNumber("");
    setPhoneCheckAttempted(false);
    setPhoneChecking(false);
    setPhoneCheckResult(null);
    setPhoneVerifiedKey("");
    setGender("여성");
    setRealName("");
    setBirthDate("");
    setBirthTime("");
    setMbti("");
    setIntro("");
    setPlace(MEET_PLACES[0]);
    setSelectedTags([]);
    setPreviewUrl("");
    setOriginalImageUrl("");
    setGeneratedImageUrl("");
    setConsent(false);
    setConvertSeconds(0);
  }

  function startNewRegistration() {
    if (!registrationOpen) {
      setClosedNoticeDismissed(false);
      return;
    }
    resetRegistrationForm();
    setActiveSelectedProfile(null);
    setErrorMessage("");
    setSuccessMessage("");
    setActiveScreen("register");
  }

  function startEditingProfile() {
    if (!accessProfile) return;
    const parsed = parseProfileCopy(accessProfile.intro);
    setRegisterAttempted(false);
    setEditingProfileId(accessProfile.id);
    const ownPhoneNumber = accessPhoneNumber || accessPhoneUsage?.phoneNumber || "";
    setNickname(accessProfile.nickname || "");
    setPin("");
    setPinConfirm("");
    setPhoneNumber(ownPhoneNumber);
    setPhoneCheckAttempted(false);
    setPhoneChecking(false);
    setPhoneCheckResult(accessPhoneUsage || null);
    setPhoneVerifiedKey(getPhoneNumberKey(ownPhoneNumber));
    setGender(accessProfile.gender === "남성" ? "남성" : "여성");
    // 실명과 생년월일은 서버가 돌려주지 않는다. 사주를 바꾸고 싶을 때만 다시 입력한다.
    setRealName("");
    setBirthDate("");
    setBirthTime("");
    setMbti(parsed.mbti || "");
    setIntro(parsed.summary || "");
    setPlace(MEET_PLACES[0]);
    setSelectedTags(parsed.tags || []);
    setOriginalImageUrl(accessProfile.originalImageUrl || "");
    setGeneratedImageUrl(accessProfile.generatedImageUrl || "");
    setPreviewUrl(resolveApiAssetUrl(accessProfile.generatedImageUrl || ""));
    setConsent(true);
    setConvertSeconds(0);
    setActiveSelectedProfile(null);
    setActiveScreen("register");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handlePhoneNumberInput(nextValue) {
    if (!PHONE_INPUT_PATTERN.test(nextValue)) return;
    setPhoneNumber(nextValue);
    setPhoneVerifiedKey("");
    setPhoneCheckResult(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handlePhoneCheck(options = {}) {
    const silent = Boolean(options.silent);
    setPhoneCheckAttempted(true);
    setPhoneVerifiedKey("");
    setPhoneCheckResult(null);
    if (!silent) {
      setErrorMessage("");
      setSuccessMessage("");
    }

    if (phoneMissing) {
      if (!silent) setErrorMessage("전화번호를 먼저 입력해 주세요.");
      return;
    }
    if (phoneInvalid) {
      if (!silent) setErrorMessage("전화번호 형식이 올바르지 않습니다.");
      return;
    }

    setPhoneChecking(true);
    try {
      const result = await checkAiMatchPhoneNumber(phoneNumber.trim());
      setPhoneCheckResult(result);
      if (result.available) {
        setPhoneVerifiedKey(result.phoneNumber || phoneNumberKey);
        if (!silent) setSuccessMessage(result.message || "전화번호 확인이 완료되었습니다.");
      } else if (!silent) {
        setErrorMessage(result.message || "이 전화번호는 사용할 수 없습니다.");
      }
    } catch (error) {
      if (!silent) setErrorMessage(error.message || "전화번호 확인에 실패했습니다.");
      else setPhoneCheckResult({ available: false, message: "지금은 확인이 안 돼요. 잠시 뒤 다시 시도해 주세요." });
    } finally {
      setPhoneChecking(false);
    }
  }

  async function handleImageChange(event) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    if (phoneMissing) {
      setRegisterAttempted(true);
      setErrorMessage("AI 변환 전에 전화번호를 먼저 입력해 주세요.");
      event.target.value = "";
      return;
    }
    if (phoneInvalid) {
      setRegisterAttempted(true);
      setErrorMessage("전화번호 형식이 올바르지 않습니다. 확인 후 다시 업로드해 주세요.");
      event.target.value = "";
      return;
    }
    if (!phoneVerifiedForCurrentNumber) {
      setPhoneCheckAttempted(true);
      setErrorMessage("전화번호 확인을 먼저 완료해 주세요.");
      event.target.value = "";
      return;
    }
    const remainingBeforeConversion = Number(phoneCheckResult?.remainingImageConversions);
    const hasKnownRemainingBeforeConversion = Number.isFinite(remainingBeforeConversion);
    if (
      (!isEditingProfile || hasKnownRemainingBeforeConversion) &&
      (!hasKnownRemainingBeforeConversion || remainingBeforeConversion <= 0)
    ) {
      setErrorMessage("이 전화번호는 AI 이미지 변환 가능 횟수를 모두 사용했어요.");
      event.target.value = "";
      return;
    }
    const confirmMessage = hasKnownRemainingBeforeConversion
      ? `AI 변환 가능 횟수가 ${remainingBeforeConversion}회 남았습니다.\n이번 변환이 성공하면 1회 차감됩니다.\nAI 변환을 진행할까요?`
      : "AI 변환을 진행할까요?\n성공한 변환만 횟수에서 차감됩니다.";
    const shouldConvert = window.confirm(
      confirmMessage,
    );
    if (!shouldConvert) {
      event.target.value = "";
      return;
    }

    setOriginalImageUrl("");
    setGeneratedImageUrl("");
    setPreviewUrl("");
    setConvertSeconds(0);
    setErrorMessage("");
    setSuccessMessage("");
    setConverting(true);

    try {
      const preview = await createAiMatchImagePreview(nextFile, phoneNumber.trim());
      const nextGeneratedImageUrl = preview.generatedImageUrl || "";
      setOriginalImageUrl(preview.originalImageUrl || "");
      setGeneratedImageUrl(nextGeneratedImageUrl);
      setPreviewUrl(resolveApiAssetUrl(nextGeneratedImageUrl));
      const usedImageConversions = Number(preview.usedImageConversions ?? 0);
      const remainingImageConversions = Number(preview.remainingImageConversions ?? 0);
      const hasConversionCounts =
        preview.usedImageConversions !== undefined &&
        preview.remainingImageConversions !== undefined &&
        Number.isFinite(usedImageConversions) && Number.isFinite(remainingImageConversions);
      if (hasConversionCounts) {
        const nextRemaining = Math.max(0, remainingImageConversions);
        const nextPhoneUsage = {
          ...(phoneCheckResult || {}),
          phoneNumber: phoneCheckResult?.phoneNumber || phoneNumberKey,
          available: nextRemaining > 0,
          usedImageConversions: Math.max(0, usedImageConversions),
          remainingImageConversions: nextRemaining,
          message: preview.message || `AI 변환이 완료되었습니다. ${nextRemaining}회 남았습니다.`,
        };
        setPhoneCheckResult((current) => ({
          ...(current || {}),
          ...nextPhoneUsage,
        }));
        if (isEditingProfile) {
          setAccessPhoneUsage(nextPhoneUsage);
        }
      }
      setSuccessMessage(preview.message || "웹툰 스타일 이미지가 준비되었습니다. 설명을 입력하고 등록하세요.");
    } catch (error) {
      setErrorMessage(formatImagePreviewError(error));
    } finally {
      setConverting(false);
      event.target.value = "";
    }
  }

  // 등록을 눌렀을 때 안 채운 칸으로 화면을 옮기고, 그 칸을 잠깐 강조한다.
  function goToRegisterField(key) {
    // 오류 표시가 화면에 그려진 뒤에 옮긴다(화면이 가려져 있어도 도는 setTimeout 을 쓴다).
    window.setTimeout(() => {
      const target = document.querySelector(`.am-reg [data-reg-field="${key}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.remove("is-flash");
      // 같은 칸에서 다시 눌러도 강조가 처음부터 돌게 한다.
      void target.offsetWidth;
      target.classList.add("is-flash");
      window.setTimeout(() => target.classList.remove("is-flash"), 1900);
      const input = target.querySelector("input:not([type=file]):not([type=checkbox]), textarea");
      if (input) window.setTimeout(() => input.focus({ preventScroll: true }), 380);
    }, 60);
  }

  async function handleRegister(event) {
    event.preventDefault();
    setRegisterAttempted(true);
    // 화면에 놓인 순서(전화번호 → 사진 → 계정 → 사주 → 소개 → 동의)대로 본다.
    const checks = [
      ["phone", phoneMissing, "전화번호를 입력해 주세요."],
      ["phone", phoneInvalid, "전화번호 형식이 올바르지 않습니다."],
      ["phone", !isEditingProfile && !phoneVerifiedForCurrentNumber, "전화번호 확인을 먼저 완료해 주세요."],
      ["photo", imageMissing, "프로필 사진을 먼저 업로드해 주세요."],
      ["nickname", nicknameMissing, "닉네임을 입력해 주세요."],
      ["nickname", nicknameTaken, "이미 사용 중인 닉네임입니다."],
      ["nickname", nicknameInvalid, "닉네임은 2~12자, 띄어쓰기 없이 적어 주세요."],
      ["pin", !isEditingProfile && pinMissing, "비밀번호를 입력해 주세요."],
      ["pin", !isEditingProfile && pinInvalid, "비밀번호는 4~10자여야 합니다."],
      ["pinConfirm", !isEditingProfile && pinConfirmMissing, "비밀번호 확인을 입력해 주세요."],
      ["pinConfirm", !isEditingProfile && pinMismatch, "비밀번호가 서로 일치하지 않습니다."],
      ["realName", realNameMissing, "사주를 뽑으려면 이름이 필요해요."],
      ["birthDate", birthDateMissing, "사주를 뽑으려면 생년월일이 필요해요."],
      ["birthDate", birthDateInvalid, "생년월일을 다시 확인해 주세요."],
      ["intro", introMissing, "자기소개를 입력해 주세요."],
      ["consent", consentMissing, "프로필 공개 동의에 체크해 주세요."],
    ];
    const failed = checks.find(([, bad]) => bad);
    if (failed) {
      if (failed[0] === "phone") setPhoneCheckAttempted(true);
      setErrorMessage(failed[2]);
      goToRegisterField(failed[0]);
      return;
    }
    if (nicknameCheck.status === "checking") {
      setErrorMessage("닉네임을 확인하는 중이에요. 잠시 뒤 다시 눌러 주세요.");
      goToRegisterField("nickname");
      return;
    }
    if (!canRegister) return;

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (isEditingProfile && accessProfile) {
        const updatedProfile = await updateAiMatchProfile(editingProfileId, {
          currentNickname: accessProfile.nickname,
          nickname: nickname.trim(),
          gender,
          intro: serializeProfileCopy(intro, selectedTags, mbti),
          phoneNumber: phoneNumber.trim(),
          meetPlace: place,
          originalImageUrl,
          generatedImageUrl,
          pin: accessPin,
          // 비워두면 서버가 기존 사주를 그대로 둔다.
          realName: realName.trim(),
          birthDate: birthDate.trim(),
          birthTime: birthTime.trim(),
        });
        setProfiles((current) => current.map((item) => (item.id === updatedProfile.id ? updatedProfile : item)));
        setAccessProfile(updatedProfile);
        setAccessNickname(updatedProfile.nickname);
        resetRegistrationForm();
        setActiveScreen("requests");
        setSuccessMessage("내 프로필이 수정되었습니다.");
      } else {
        const createdNickname = nickname.trim();
        const createdPin = pin.trim();
        const nextProfile = await createAiMatchProfile(
          {
            nickname: createdNickname,
            gender,
            intro: serializeProfileCopy(intro, selectedTags, mbti),
            pin: createdPin,
            phoneNumber: phoneNumber.trim(),
            meetPlace: place,
            consent,
            originalImageUrl,
            generatedImageUrl,
            realName: realName.trim(),
            birthDate: birthDate.trim(),
            birthTime: birthTime.trim(),
          },
          null,
        );

        setAccessProfile(nextProfile);
        setAccessNickname(createdNickname);
        setAccessPin(createdPin);
        setRequesterNickname(createdNickname);
        resetRegistrationForm();
        setActiveScreen("intro");
        try {
          await loadAccessProfile(createdNickname, createdPin, "intro");
          setSuccessMessage("AI 프로필이 등록되었습니다. 처음 화면에서 바로 확인해 보세요.");
        } catch (accessError) {
          setSuccessMessage("AI 프로필은 등록되었습니다. 목록 갱신이 늦으면 신청함에서 닉네임과 비밀번호로 다시 입장해 주세요.");
        }
      }
    } catch (error) {
      setErrorMessage(error.message || (isEditingProfile ? "AI 프로필 수정에 실패했습니다." : "AI 프로필 등록에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequest(event) {
    event.preventDefault();
    if (!selectedProfile) return;
    if (!accessProfile) {
      setErrorMessage("등록한 닉네임과 비밀번호로 먼저 입장해 주세요.");
      openAccessModal("intro");
      return;
    }

    if (requestQuotaExhausted) {
      setErrorMessage(`데이트 신청은 한 사람당 ${requestQuota.limit}번까지만 보낼 수 있어요.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createAiMatchRequest(selectedProfile.id, {
        requesterNickname: accessProfile.nickname,
        requesterPin: accessPin,
        meetPlace: requestPlace,
        message: requestMessage.trim() || "축제에서 잠깐 만나고 싶어요.",
      });
      await loadAccessProfile(accessNickname, accessPin, "requests");
      setRequesterNickname(accessProfile.nickname);
      setRequestMessage("");
      setRequestPlace(MEET_PLACES[0]);
      setActiveSelectedProfile(null);
      setRequestTab("sent");
      setSuccessMessage("데이트 신청이 전송되었습니다.");
      window.alert("데이트 신청이 완료되었습니다.");
    } catch (error) {
      showAuthenticatedActionError(error, "데이트 신청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProfile() {
    if (!accessProfile) return;
    const confirmed = window.confirm("내 프로필을 삭제할까요? 삭제 후에는 다시 잠금 해제할 수 없습니다.");
    if (!confirmed) return;

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await deleteAiMatchProfile(accessProfile.id, {
        currentNickname: accessProfile.nickname,
        nickname: accessProfile.nickname,
        pin: accessPin,
      });
      clearAccessSession({ resetForm: true });
      setActiveScreen("intro");
      setSuccessMessage("프로필이 삭제되었습니다.");
    } catch (error) {
      setErrorMessage(error.message || "AI 프로필 삭제에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestsRefresh() {
    if (!accessNickname || !accessPin) return;
    setLoading(true);
    setErrorMessage("");
    try {
      await loadAccessProfile(accessNickname, accessPin, "requests", { notify: true });
    } catch (error) {
      if (isAccessExpiredError(error)) {
        clearAccessSession({ resetForm: true });
        setActiveScreen("intro");
        setErrorMessage("프로필이 삭제되었거나 인증이 만료되었습니다. 닉네임과 비밀번호로 다시 입장해 주세요.");
      } else {
        setErrorMessage(error.message || "신청함을 새로고침하지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptRequest(requestId) {
    if (!accessNickname || !accessPin) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      await acceptAiMatchRequest(requestId, accessNickname, accessPin);
      await loadAccessProfile(accessNickname, accessPin, "requests");
      setRequestTab("received");
      setSuccessMessage("데이트 신청을 수락했습니다.");
    } catch (error) {
      showAuthenticatedActionError(error, "데이트 신청 수락에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectRequest(requestId) {
    if (!accessNickname || !accessPin) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      await rejectAiMatchRequest(requestId, accessNickname, accessPin);
      await loadAccessProfile(accessNickname, accessPin, "requests");
      setRequestTab("received");
      setSuccessMessage("데이트 신청을 거절했습니다.");
    } catch (error) {
      showAuthenticatedActionError(error, "데이트 신청 거절에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelRequest(requestId) {
    if (!accessNickname || !accessPin) return;
    const confirmed = window.confirm("보낸 데이트 신청을 취소할까요?");
    if (!confirmed) return;

    setSubmitting(true);
    setErrorMessage("");
    try {
      await cancelAiMatchRequest(requestId, accessNickname, accessPin);
      await loadAccessProfile(accessNickname, accessPin, activeScreen);
      setRequestTab("sent");
      setSuccessMessage("데이트 신청을 취소했습니다.");
    } catch (error) {
      showAuthenticatedActionError(error, "데이트 신청 취소에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProposeMeetup(request) {
    if (!accessNickname || !accessPin) return;
    const draft = getMeetupDraft(request);
    if (!draft.meetupPlace || !draft.meetupAt) {
      setErrorMessage("만날 장소와 시간을 모두 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      await proposeAiMatchMeetup(request.id, {
        nickname: accessNickname,
        pin: accessPin,
        meetupPlace: draft.meetupPlace,
        meetupAt: draft.meetupAt,
      });
      await loadAccessProfile(accessNickname, accessPin, "requests");
      setSuccessMessage("약속 제안을 보냈습니다.");
    } catch (error) {
      showAuthenticatedActionError(error, "약속 제안에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // 시간표에서 슬롯을 골라 제안. 실패 이유(다른 커플이 먼저 잡음 등)는 시간표 안에 바로 보여 주려고 돌려준다.
  async function handleProposeMeetupSlot(request, slotAt) {
    if (!accessNickname || !accessPin) return { ok: false, message: "다시 로그인해 주세요." };
    setSubmitting(true);
    setErrorMessage("");
    try {
      await proposeAiMatchMeetup(request.id, {
        nickname: accessNickname,
        pin: accessPin,
        meetupPlace: "총학생회 소개팅 부스",
        meetupAt: slotAt,
      });
      await loadAccessProfile(accessNickname, accessPin, "requests");
      setSuccessMessage("시간을 제안했어요. 상대가 30분 안에 확정하면 약속이 잡혀요.");
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message || "시간을 잡지 못했어요." };
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelMeetup(requestId) {
    if (!accessNickname || !accessPin) return;
    if (!window.confirm("이 시간 제안을 취소할까요? 잡아 둔 시간은 다른 커플에게 다시 열리고, 상대에게 문자로 알려요.")) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      await cancelAiMatchMeetup(requestId, accessNickname, accessPin);
      await loadAccessProfile(accessNickname, accessPin, "requests");
      setSuccessMessage("시간 제안을 취소했어요. 시간은 다시 고를 수 있어요.");
    } catch (error) {
      showAuthenticatedActionError(error, "약속 취소에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  /** 부스 시간을 못 잡은 커플의 연락처 주고받기. 둘 다 동의해야 열리고 되돌릴 수 없으니 누르기 전에 분명히 묻는다. */
  async function handleShareContact(request) {
    if (!accessNickname || !accessPin || !accessProfile) return;
    const partner = request.requesterProfileId === accessProfile.id ? request.profileNickname : request.requesterNickname;
    const ok = window.confirm(
      [
        `${partner} 님과 연락처를 주고받을까요?`,
        "",
        `${partner} 님도 동의하면 그때 서로 전화번호가 보여요. 한쪽만 동의한 동안은 아무것도 안 보여요.`,
        "한 번 공개된 번호는 되돌릴 수 없어요.",
        "",
        ORGANIZER_DISCLAIMER,
      ].join("\n"),
    );
    if (!ok) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const updated = await consentAiMatchContactShare(request.id, accessNickname, accessPin);
      await loadAccessProfile(accessNickname, accessPin, "requests");
      setSuccessMessage(
        updated?.sharedPhoneNumber
          ? `두 분 다 동의했어요. ${partner} 님의 번호가 신청함에 보여요.`
          : `동의했어요. ${partner} 님도 동의하면 서로 번호가 보여요.`,
      );
    } catch (error) {
      if (error?.status === 409) {
        await loadAccessProfile(accessNickname, accessPin, "requests").catch(() => {});
      }
      showAuthenticatedActionError(error, "연락처 공유 동의에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderMeetupChat() {
    if (!chatRequestId || !accessNickname || !accessPin) return null;
    return (
      <MeetupChat
        key={chatRequestId}
        requestId={chatRequestId}
        nickname={accessNickname}
        pin={accessPin}
        onClose={() => {
          setChatRequestId(null);
          loadAccessProfile(accessNickname, accessPin, "requests").catch(() => {});
        }}
      />
    );
  }

  async function handleMeetupArrived(requestId) {
    if (!accessNickname || !accessPin) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      await markAiMatchMeetupArrived(requestId, accessNickname, accessPin);
      await loadAccessProfile(accessNickname, accessPin, "requests");
      setSuccessMessage("도착을 알렸어요. 스태프가 곧 데리러 가요.");
    } catch (error) {
      showAuthenticatedActionError(error, "도착을 알리지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmMeetup(requestId) {
    if (!accessNickname || !accessPin) return;

    setSubmitting(true);
    setErrorMessage("");
    try {
      await confirmAiMatchMeetup(requestId, accessNickname, accessPin);
      await loadAccessProfile(accessNickname, accessPin, "requests");
      setSuccessMessage("약속이 확정되었습니다.");
    } catch (error) {
      if (error?.status === 409) {
        await loadAccessProfile(accessNickname, accessPin, "requests").catch(() => {});
      }
      showAuthenticatedActionError(error, "약속 확정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderLiveNotice() {
    if (!liveNotice) return null;
    return (
      <div className="ai-match-live-notice" role="alert" aria-live="assertive">
        <span className="ai-match-live-notice__icon" aria-hidden="true">
          <IconHeartFilled className="h-4 w-4" />
        </span>
        <div className="ai-match-live-notice__body">
          <strong>{liveNotice.title || "새 알림 도착"}</strong>
          <p>{liveNotice.message}</p>
        </div>
        <button type="button" className="ai-match-live-notice__primary" onClick={() => openLiveNoticeTarget(liveNotice.tab)}>
          신청함 보기
        </button>
        <button
          type="button"
          className="ai-match-live-notice__close"
          onClick={dismissLiveNotice}
          aria-label="알림 닫기"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  function renderIntroScreen() {
    if (accessProfile) {
      return renderPeopleScreen();
    }

    return (
      <div className="ai-match-flow">
        <SajuHero onChitoClick={() => fortuneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} />

        <div ref={fortuneRef}>
          <SajuFortune ctaLabel="가입하고 내 궁합 보러 가기" onCta={startNewRegistration} />
        </div>

        {!registrationOpen ? (
          <section className="ai-match-empty-card am-closed-card" role="status">
            <strong>지금은 새로 만들 수 없어요</strong>
            <p>{registrationClosedMessage || "지금 참가자가 너무 많아 새 프로필 등록은 잠시 받지 않아요."}</p>
          </section>
        ) : null}
        <button
          type="button"
          className="ai-match-primary-button ai-match-primary-button--hero"
          onClick={startNewRegistration}
          disabled={!registrationOpen}
          aria-disabled={!registrationOpen}
        >
          <span className="ai-match-primary-button__icon">
            <IconHeart className="h-4 w-4" />
          </span>
          <span className="ai-match-primary-button__label">{registrationOpen ? "회원가입" : "지금은 가입을 받지 않아요"}</span>
        </button>

        <button
          type="button"
          className="ai-match-secondary-button"
          onClick={() => openAccessModal("intro")}
        >
          로그인
        </button>

        <section className="ai-match-step-card am-flow">
          <h3>소개팅은 이렇게 이어져요</h3>
          <p className="am-flow__hint">단계를 누르면 설명이 펼쳐져요.</p>
          {FLOW_GROUPS.map((group) => (
            <div key={group.label} className="am-flow__group">
              <p className="am-flow__label">{group.label}</p>
              <ul className="am-flow__list">
                {group.items.map((item) => {
                  const open = openFlowStep === item.number;
                  return (
                    <li key={item.number} className={`am-flow__item${open ? " is-open" : ""}`}>
                      <button
                        type="button"
                        className="am-flow__row"
                        aria-expanded={open}
                        aria-controls={`am-flow-${item.number}`}
                        onClick={() => setOpenFlowStep(open ? "" : item.number)}
                      >
                        <i className="am-flow__num">{item.number}</i>
                        <span className="am-flow__text">
                          <b className="am-flow__title">{item.title}</b>
                          {item.tag ? <em className="am-flow__tag">{item.tag}</em> : null}
                        </span>
                        <IconChevronRight className="am-flow__chev h-4 w-4" aria-hidden="true" />
                      </button>
                      {open ? (
                        <p id={`am-flow-${item.number}`} className="am-flow__copy">
                          {item.copy}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <p className="ai-match-note">
          <IconShield className="h-4 w-4" />
          개인정보는 안전하게 보호돼요.
        </p>
      </div>
    );
  }

  // 가입·수정 화면. 칸마다 치는 즉시 아래에 결과가 뜬다(닉네임 중복은 서버에 물어본다). 스타일은 v2-aimatch.css 의 am-*.
  function renderRegisterScreen() {
    const mark = (key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    const shown = (key) => registerAttempted || Boolean(touched[key]);
    const Msg = ({ tone, children }) =>
      children ? (
        <small className={`am-msg am-msg--${tone}`} role={tone === "error" ? "alert" : undefined}>
          {tone === "ok" ? <IconCheckSmall /> : null}
          {children}
        </small>
      ) : null;

    const phoneDigits = phoneNumber.replace(/\D/g, "");
    const phoneMsg = (() => {
      if (isEditingProfile) return ["hint", "가입 후에는 바꿀 수 없어요."];
      if (!phoneNumber.trim()) return shown("phone") ? ["error", "전화번호를 입력해 주세요."] : ["hint", "숫자만 넣어도 돼요. 다른 사람에게 보이지 않아요."];
      if (phoneInvalid || phoneDigits.length < 10) return ["error", "숫자 10~11자리로 넣어 주세요."];
      if (phoneChecking) return ["checking", "확인 중…"];
      if (phoneCheckResult && phoneVerifiedForCurrentNumber) return ["ok", phoneCheckResult.message || "사용할 수 있는 번호예요."];
      if (phoneCheckResult && !phoneCheckResult.available) return ["error", phoneCheckResult.message || "이 번호는 쓸 수 없어요."];
      return ["hint", "잠시 뒤 자동으로 확인해요."];
    })();

    const nicknameMsg = (() => {
      const value = nickname.trim();
      if (!value) return shown("nickname") ? ["error", "닉네임을 입력해 주세요."] : ["hint", "2~12자, 띄어쓰기 없이"];
      if (nicknameInvalid) return ["error", value.length < 2 ? "닉네임은 2자 이상이어야 해요." : "닉네임에는 띄어쓰기를 넣을 수 없어요."];
      if (nicknameTaken) return ["error", "이미 사용 중인 닉네임이에요."];
      if (nicknameCheck.status === "checking") return ["checking", "확인 중…"];
      if (nicknameCheck.status === "ok") return ["ok", nicknameCheck.message || "사용할 수 있는 닉네임이에요."];
      if (nicknameCheck.status === "unknown") return ["hint", nicknameCheck.message];
      return ["hint", "2~12자, 띄어쓰기 없이"];
    })();

    const pinMsg = (() => {
      if (!pin) return shown("pin") ? ["error", "비밀번호를 입력해 주세요."] : ["hint", "4~10자, 띄어쓰기 없이. 생일·전화번호는 피해 주세요."];
      if (pinInvalid) return ["error", "비밀번호는 4~10자여야 해요."];
      return ["ok", "좋아요."];
    })();

    const pinConfirmMsg = (() => {
      if (!pinConfirm) return shown("pinConfirm") ? ["error", "비밀번호를 한 번 더 입력해 주세요."] : ["hint", "같은 비밀번호를 한 번 더"];
      if (pinMismatch) return ["error", "비밀번호가 서로 달라요."];
      if (pin && !pinInvalid) return ["ok", "일치해요."];
      return ["hint", ""];
    })();

    const realNameMsg = (() => {
      if (!realName.trim()) return !isEditingProfile && shown("realName") ? ["error", "이름을 입력해 주세요."] : ["hint", isEditingProfile ? "바꿀 때만 입력해요." : "사주를 뽑는 데만 쓰고 공개하지 않아요."];
      return ["ok", "공개되지 않아요."];
    })();

    const birthDateMsg = (() => {
      if (!birthDate.trim()) return !isEditingProfile && shown("birthDate") ? ["error", "생년월일을 입력해 주세요."] : ["hint", "양력으로 넣어 주세요."];
      if (birthDateInvalid) return ["error", "생년월일을 다시 확인해 주세요."];
      return ["ok", sajuPreview ? "아래에 사주가 떴어요." : "사주를 뽑는 중…"];
    })();

    const introMsg = (() => {
      if (!intro.trim()) return shown("intro") ? ["error", "자기소개를 입력해 주세요."] : ["hint", "한두 문장이면 충분해요."];
      return ["ok", `${intro.length}/120`];
    })();

    const stepDone = [
      isEditingProfile || phoneVerifiedForCurrentNumber,
      Boolean(generatedImageUrl),
      Boolean(nickname.trim()) && !nicknameInvalid && !nicknameTaken && (isEditingProfile || (pin.length >= 4 && !pinInvalid && pin === pinConfirm)),
      isEditingProfile || (Boolean(realName.trim()) && Boolean(birthDate.trim()) && !birthDateInvalid),
      Boolean(intro.trim()) && consent,
    ];
    const currentStep = stepDone.findIndex((done) => !done);
    const missing = [];
    if (!isEditingProfile && !phoneVerifiedForCurrentNumber) missing.push("전화번호 확인");
    if (imageMissing) missing.push("사진");
    if (!nickname.trim() || nicknameInvalid || nicknameTaken) missing.push("닉네임");
    if (!isEditingProfile && (pin.length < 4 || pinInvalid || pin !== pinConfirm)) missing.push("비밀번호");
    if (!isEditingProfile && (!realName.trim() || !birthDate.trim() || birthDateInvalid)) missing.push("사주 정보");
    if (!intro.trim()) missing.push("자기소개");
    if (!consent) missing.push("공개 동의");

    const remaining = Math.max(0, Number(phoneCheckResult?.remainingImageConversions ?? 2));

    return (
      <form className="am-reg" onSubmit={handleRegister} noValidate>
        {isEditingProfile ? (
          <section className="am-card am-card--tint">
            <strong>내 프로필 수정</strong>
            <p>{accessProfile?.nickname} · 신청함에서 인증된 비밀번호로 저장돼요.</p>
          </section>
        ) : (
          <div className="am-progress" aria-label="가입 진행">
            {REGISTER_STEPS.map((label, index) => (
              <span
                key={label}
                className={`am-progress__step${stepDone[index] ? " is-done" : ""}${currentStep === index ? " is-current" : ""}`}
              >
                <i>{stepDone[index] ? <IconCheckSmall /> : index + 1}</i>
                {label}
              </span>
            ))}
          </div>
        )}

        {/* 1. 전화번호 */}
        {!isEditingProfile ? (
          <section className="am-card">
            <div className="am-card__head">
              <span className="am-card__num">1</span>
              <div>
                <h2>전화번호</h2>
                <p>중복 가입과 AI 과사용을 막는 용도예요. 매칭이 성사됐을 때 본부에서만 봐요.</p>
              </div>
            </div>
            <label className="am-field" data-reg-field="phone">
              <span className="am-field__label">전화번호</span>
              <div className={`am-input${phoneMsg[0] === "error" ? " is-error" : phoneMsg[0] === "ok" ? " is-ok" : ""}`}>
                <input
                  value={phoneNumber}
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={30}
                  onChange={(event) => handlePhoneNumberInput(event.target.value)}
                  onBlur={() => mark("phone")}
                  placeholder="010-1234-5678"
                />
                {phoneChecking ? <span className="am-spinner" aria-hidden="true" /> : null}
              </div>
              <Msg tone={phoneMsg[0]}>{phoneMsg[1]}</Msg>
            </label>
            {phoneCheckResult && !phoneVerifiedForCurrentNumber && !phoneChecking && phoneDigits.length >= 10 ? (
              <button type="button" className="am-link" onClick={() => handlePhoneCheck()}>
                다시 확인하기
              </button>
            ) : null}
          </section>
        ) : null}

        {/* 2. 사진 */}
        <section className={`am-card${!isEditingProfile && !phoneVerifiedForCurrentNumber ? " am-card--locked" : ""}`} data-reg-field="photo">
          <div className="am-card__head">
            <span className="am-card__num">{isEditingProfile ? 1 : 2}</span>
            <div>
              <h2>사진</h2>
              <p>정면 사진을 올리면 AI가 웹툰 얼굴로 바꿔 줘요. 올린 원본은 목록에 나오지 않아요.</p>
            </div>
            {phoneCheckResult ? <span className={`am-pill${remaining > 0 ? "" : " am-pill--red"}`}>AI 변환 {remaining}회 남음</span> : null}
          </div>

          {!isEditingProfile && !phoneVerifiedForCurrentNumber ? (
            <div className="am-locked">
              <IconShield className="h-5 w-5" />
              <span>전화번호 확인이 끝나면 열려요.</span>
            </div>
          ) : (
            <>
              <div className="am-photos">
                <div className="am-photo">
                  {originalImageUrl ? <img src={resolveApiAssetUrl(originalImageUrl)} alt="" /> : <IconCamera className="h-7 w-7" />}
                  <em>원본</em>
                </div>
                <IconChevronRight className="am-photos__arrow h-5 w-5" aria-hidden="true" />
                <div className={`am-photo am-photo--ai${converting ? " is-busy" : ""}`}>
                  {previewUrl ? <img src={previewUrl} alt="" /> : <IconSparkles className="h-7 w-7" />}
                  <em>{converting ? `변환 중 · ${convertSeconds}초` : "AI 웹툰"}</em>
                  {converting ? <span className="am-spinner am-spinner--big" aria-hidden="true" /> : null}
                </div>
              </div>
              {converting ? (
                <div className="am-converting" role="status" aria-live="polite">
                  <strong>{convertingStatus.title}</strong>
                  <p>{convertingStatus.copy} · 보통 20~60초 걸려요.</p>
                  <div className="am-converting__bar"><span /></div>
                </div>
              ) : null}
              <label className={`am-upload${converting ? " is-disabled" : ""}`}>
                <IconCamera className="h-5 w-5" />
                {converting ? "변환 중…" : generatedImageUrl ? "다른 사진으로 바꾸기" : "사진 올리기"}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} disabled={converting} />
              </label>
              {imageMissing && registerAttempted ? <Msg tone="error">사진을 올려 주세요.</Msg> : null}
              {generatedImageUrl && !converting ? <Msg tone="ok">변환이 끝났어요. 이 얼굴로 등록돼요.</Msg> : null}
            </>
          )}
        </section>

        {/* 3. 계정 */}
        <section className="am-card">
          <div className="am-card__head">
            <span className="am-card__num">{isEditingProfile ? 2 : 3}</span>
            <div>
              <h2>계정</h2>
              <p>닉네임은 다른 참가자에게 보여요. 비밀번호는 신청함에 들어갈 때 써요.</p>
            </div>
          </div>
          <label className="am-field" data-reg-field="nickname">
            <span className="am-field__label">
              닉네임 <small>{nickname.length}/12</small>
            </span>
            <div className={`am-input${nicknameMsg[0] === "error" ? " is-error" : nicknameMsg[0] === "ok" ? " is-ok" : ""}`}>
              <input
                value={nickname}
                maxLength={12}
                autoComplete="off"
                onChange={(event) => setNickname(event.target.value)}
                onBlur={() => mark("nickname")}
                placeholder="예) 공대카리나"
              />
              {nicknameCheck.status === "checking" ? <span className="am-spinner" aria-hidden="true" /> : null}
            </div>
            <Msg tone={nicknameMsg[0]}>{nicknameMsg[1]}</Msg>
          </label>

          {!isEditingProfile ? (
            <div className="am-grid-2">
              <label className="am-field" data-reg-field="pin">
                <span className="am-field__label">비밀번호</span>
                <div className={`am-input${pinMsg[0] === "error" ? " is-error" : pinMsg[0] === "ok" ? " is-ok" : ""}`}>
                  <input
                    type="password"
                    value={pin}
                    maxLength={10}
                    autoComplete="new-password"
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (PASSWORD_INPUT_PATTERN.test(nextValue)) setPin(nextValue);
                    }}
                    onBlur={() => mark("pin")}
                    placeholder="4~10자"
                  />
                </div>
                <Msg tone={pinMsg[0]}>{pinMsg[1]}</Msg>
              </label>
              <label className="am-field" data-reg-field="pinConfirm">
                <span className="am-field__label">비밀번호 확인</span>
                <div className={`am-input${pinConfirmMsg[0] === "error" ? " is-error" : pinConfirmMsg[0] === "ok" ? " is-ok" : ""}`}>
                  <input
                    type="password"
                    value={pinConfirm}
                    maxLength={10}
                    autoComplete="new-password"
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (PASSWORD_INPUT_PATTERN.test(nextValue)) setPinConfirm(nextValue);
                    }}
                    onBlur={() => mark("pinConfirm")}
                    placeholder="한 번 더"
                  />
                </div>
                <Msg tone={pinConfirmMsg[0]}>{pinConfirmMsg[1]}</Msg>
              </label>
            </div>
          ) : (
            <p className="am-note">
              <IconShield className="h-4 w-4" />
              전화번호는 가입 후 바꿀 수 없어요.
            </p>
          )}
        </section>

        {/* 4. 사주 */}
        <section className="am-card am-card--saju">
          <div className="am-card__head">
            <span className="am-card__num">{isEditingProfile ? 3 : 4}</span>
            <div>
              <h2>사주</h2>
              <p>이름과 생년월일은 사주를 세우는 데만 쓰고, 다른 참가자에게는 사주 결과와 궁합 점수만 보여요.</p>
            </div>
          </div>
          <div className="am-grid-2">
            <label className="am-field" data-reg-field="realName">
              <span className="am-field__label">이름</span>
              <div className={`am-input${realNameMsg[0] === "error" ? " is-error" : realNameMsg[0] === "ok" ? " is-ok" : ""}`}>
                <input value={realName} maxLength={40} autoComplete="name" onChange={(event) => setRealName(event.target.value)} onBlur={() => mark("realName")} placeholder="예) 김바람" />
              </div>
              <Msg tone={realNameMsg[0]}>{realNameMsg[1]}</Msg>
            </label>
            <label className="am-field" data-reg-field="birthDate">
              <span className="am-field__label">생년월일 <small>양력</small></span>
              <div className={`am-input${birthDateMsg[0] === "error" ? " is-error" : birthDateMsg[0] === "ok" ? " is-ok" : ""}`}>
                <input type="date" value={birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setBirthDate(event.target.value)} onBlur={() => mark("birthDate")} />
              </div>
              <Msg tone={birthDateMsg[0]}>{birthDateMsg[1]}</Msg>
            </label>
          </div>
          <label className="am-field">
            <span className="am-field__label">태어난 시간 <small>몰라도 돼요</small></span>
            <div className="am-input">
              <input type="time" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} />
            </div>
            <Msg tone="hint">비워 두면 시주 없이 세 기둥으로 봐요.</Msg>
          </label>

          {sajuPreview ? (
            <div className="am-saju-preview">
              <SajuPanel saju={sajuPreview} title="미리 보는 내 사주" subtitle={sajuPreview.hourKnown ? "네 기둥" : "태어난 시간 없이 세 기둥"} />
              <p className="am-note">등록하면 AI가 풀이를 더 길게 써 주고, 다른 사람과의 궁합 점수도 나와요.</p>
            </div>
          ) : sajuPreviewError ? (
            <Msg tone="error">{sajuPreviewError}</Msg>
          ) : null}
        </section>

        {/* 5. 소개 */}
        <section className="am-card">
          <div className="am-card__head">
            <span className="am-card__num">{isEditingProfile ? 4 : 5}</span>
            <div>
              <h2>소개</h2>
              <p>목록 카드에 그대로 보여요.</p>
            </div>
          </div>

          <div className="am-field">
            <span className="am-field__label">성별</span>
            <div className="am-seg">
              {["남성", "여성"].map((item) => (
                <button key={item} type="button" className={`am-seg__btn${gender === item ? " is-on" : ""}`} aria-pressed={gender === item} onClick={() => setGender(item)}>
                  {getProfileGenderLabel(item)}
                </button>
              ))}
            </div>
          </div>

          <label className="am-field">
            <span className="am-field__label">MBTI <small>선택</small></span>
            <div className="am-input">
              <select value={mbti} onChange={(event) => setMbti(cleanMbtiValue(event.target.value))}>
                <option value="">선택 안 함</option>
                {MBTI_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </label>

          <div className="am-field">
            <span className="am-field__label">관심사 <small>{selectedTags.length}/6</small></span>
            <div className="am-chips">
              {REGISTRATION_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button key={tag} type="button" aria-pressed={isSelected} className={`am-chip${isSelected ? " is-on" : ""}`} onClick={() => toggleTag(tag)}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="am-field" data-reg-field="intro">
            <span className="am-field__label">자기소개</span>
            <div className={`am-input${introMsg[0] === "error" ? " is-error" : ""}`}>
              <textarea
                value={intro}
                maxLength={120}
                rows={3}
                onChange={(event) => setIntro(event.target.value)}
                onBlur={() => mark("intro")}
                placeholder="예) 키는 작지만 러닝 뛰는 걸 좋아해요!"
              />
            </div>
            <Msg tone={introMsg[0]}>{introMsg[1]}</Msg>
          </label>

          <label className="am-field">
            <span className="am-field__label">만나고 싶은 곳</span>
            <div className="am-input">
              <select value={place} onChange={(event) => setPlace(event.target.value)}>
                {MEET_PLACES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </label>

          {/* 체크 전후가 확실히 달라 보여야 한다(빈 네모 → 채워진 네모 + 체크, '눌러서 체크' → '동의함'). */}
          <label
            data-reg-field="consent"
            className={`am-consent${consent ? " is-checked" : ""}${consentMissing && registerAttempted ? " is-error" : ""}`}
          >
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span className="am-consent__box" aria-hidden="true"><IconCheckSmall /></span>
            <span className="am-consent__text">
              <b>
                <em>필수</em>프로필 공개 동의
              </b>
              <span>사진과 소개가 공개 목록에 보이는 것에 동의해요.</span>
            </span>
            <span className="am-consent__state" aria-hidden="true">{consent ? "동의함" : "눌러서 체크"}</span>
          </label>
          <p className="am-consent-note">{ORGANIZER_DISCLAIMER}</p>
          {consentMissing && registerAttempted ? <Msg tone="error">위 칸을 눌러 동의에 체크해 주세요.</Msg> : null}
        </section>

        <div className="am-submit">
          {missing.length && !submitting ? (
            <p className="am-submit__todo">남은 것 · {missing.join(" · ")}</p>
          ) : (
            <p className="am-submit__todo is-ready">{isEditingProfile ? "바꾼 내용을 저장할 수 있어요." : "다 채웠어요. 등록하면 바로 목록에 올라가요."}</p>
          )}
          <button type="submit" className="ai-match-primary-button ai-match-primary-button--form" disabled={registerSubmitDisabled}>
            <span className="ai-match-primary-button__icon">
              <IconHeartFilled className="h-4 w-4" />
            </span>
            <span className="ai-match-primary-button__label">
              {submitting ? (isEditingProfile ? "저장 중…" : "등록 중…") : converting ? "AI 변환 중…" : isEditingProfile ? "수정 저장" : "등록하기"}
            </span>
          </button>
        </div>
      </form>
    );
  }

  function IconCheckSmall() {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12l5 5L20 7" />
      </svg>
    );
  }

  function renderPeopleScreen() {
    if (!accessProfile) {
      return (
        <div className="ai-match-flow">
          <section className="ai-match-empty-card">
            <strong>등록된 사람 목록은 닉네임과 비밀번호 인증 후 볼 수 있습니다.</strong>
            <p>프로필을 등록한 닉네임과 비밀번호를 입력하면 다른 참가자 목록과 데이트 신청 화면이 열립니다.</p>
            <button type="button" className="ai-match-secondary-button" onClick={() => openAccessModal("intro")}>
              닉네임 + 비밀번호로 입장
            </button>
          </section>
        </div>
      );
    }

    return (
      <div className="ai-match-flow">
        <header className="nt-head">
          <div className="nt-head__copy">
            <h2>
              좋은 인연이
              <br />
              기다리고 있어요
            </h2>
            <p>오늘도, 좋은 인연이 피어나길</p>
          </div>
          <img
            className="nt-head__chito"
            src="/images/saju/chito-dosa.png"
            alt=""
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = "/images/chito-wave.png";
            }}
          />
        </header>

        <SajuFortune
          compact
          nickname={accessProfile?.nickname}
          myElement={accessProfile?.saju?.dayMasterElement}
          ctaLabel="찰떡 궁합만 모아 보기"
          onCta={() => setActiveFilter("찰떡 궁합")}
        />

        <section className="am-disc">
          <div className="am-disc__top">
            <label className="am-disc__search">
              <IconSearch className="h-4 w-4" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="닉네임, 소개, 장소, MBTI"
              />
              {searchQuery ? (
                <button type="button" className="am-disc__clear" aria-label="검색어 지우기" onClick={() => setSearchQuery("")}>
                  ×
                </button>
              ) : null}
            </label>
            <button
              type="button"
              className={`am-disc__filter${peopleFiltersOpen || peopleTagFilters.length || peopleMbtiFilter ? " is-on" : ""}`}
              aria-expanded={peopleFiltersOpen}
              aria-label="상세 필터"
              onClick={() => setPeopleFiltersOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              {peopleTagFilters.length + (peopleMbtiFilter ? 1 : 0) ? (
                <em>{peopleTagFilters.length + (peopleMbtiFilter ? 1 : 0)}</em>
              ) : null}
            </button>
          </div>

          <div className="am-disc__chips" role="tablist" aria-label="프로필 필터">
            {PROFILE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                role="tab"
                className={`am-chip${activeFilter === filter ? " is-on" : ""}`}
                aria-selected={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          {peopleFiltersOpen ? (
            <div className="am-disc__panel">
              <label className="am-disc__select">
                <span>MBTI</span>
                <select value={peopleMbtiFilter} onChange={(event) => setPeopleMbtiFilter(cleanMbtiValue(event.target.value))}>
                  <option value="">전체</option>
                  {MBTI_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <span className="am-disc__panel-label">관심사</span>
            </div>
          ) : null}

          {peopleFiltersOpen ? (
            <div className="am-chips">
              {REGISTRATION_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`am-chip${peopleTagFilters.includes(tag) ? " is-on" : ""}`}
                  aria-pressed={peopleTagFilters.includes(tag)}
                  onClick={() => togglePeopleTagFilter(tag)}
                >
                  {tag}
                </button>
              ))}
              {peopleTagFilters.length ? (
                <button type="button" className="am-chip am-chip--ghost" onClick={() => setPeopleTagFilters([])}>
                  모두 해제
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        {accessProfile && !accessProfile.saju ? <MatchMissingBanner onEdit={startEditingProfile} /> : null}
        {accessProfile?.saju && topMatches.length ? (
          <MatchTop3 profiles={topMatches} resolveImage={resolveApiAssetUrl} onOpen={openProfile} viewerSaju={accessProfile.saju} />
        ) : null}

        <section className="ai-match-list-meta am-meta">
          <strong>
            {loading ? (
              "불러오는 중..."
            ) : (
              <>
                <b>{filteredProfiles.length}</b>명의 인연이 있어요
              </>
            )}
          </strong>
          <button
            type="button"
            className="am-sort"
            aria-label={peopleSort === "match" ? "궁합순으로 보는 중, 누르면 최신순" : "최신순으로 보는 중, 누르면 궁합순"}
            onClick={() => setPeopleSort((current) => (current === "match" ? "new" : "match"))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4v16m0 0l-3-3m3 3l3-3M17 20V4m0 0l-3 3m3-3l3 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {peopleSort === "match" ? "궁합순" : "최신순"}
          </button>
        </section>

        {filteredProfiles.length ? (
          <div className="ai-match-profile-list">
            {filteredProfiles.map((profile, index) => {
              const isFavorite = isFavoriteProfile(profile.id);
              const isTagsExpanded = expandedTagProfileIds.includes(profile.id);
              const hasExtraTags = profile.tags.length > 3;
              const visibleTags = isTagsExpanded || !hasExtraTags ? profile.tags : profile.tags.slice(0, 2);
              const sentRequest = latestSentRequestMap.get(profile.id);
              const requestStatusLabel = sentRequest ? getRequestStatusLabel(sentRequest.status, sentRequest.statusReason) : "";
              return (
                <article
                  key={profile.id}
                  className={`ai-match-person-card ai-match-person-card--${profile.tone}`}
                  style={{ "--i": Math.min(index, 8) }}
                >
                  <button
                    type="button"
                    className={`ai-match-favorite-button${isFavorite ? " ai-match-favorite-button--active" : ""}`}
                    aria-label={isFavorite ? "관심 목록에서 제거" : "관심 목록에 추가"}
                    aria-pressed={isFavorite}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleFavorite(profile.id);
                    }}
                  >
                    {isFavorite ? <IconHeartFilled className="h-4 w-4" /> : <IconHeart className="h-4 w-4" />}
                  </button>

                  <div className="ai-match-person-main">
                    <button type="button" className="ai-match-person-photo" onClick={() => openProfile(profile)}>
                      <ElementSeal saju={profile.saju} />
                      {profile.generatedImageUrl ? (
                        <img src={resolveApiAssetUrl(profile.generatedImageUrl, 480)} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <IconUsers className="h-8 w-8" />
                      )}
                    </button>

                    <div className="ai-match-person-copy">
                      <button type="button" className="ai-match-person-copy-link" onClick={() => openProfile(profile)}>
                        <em>{profile.mbti ? `${profile.genderLabel} · ${profile.mbti}` : profile.genderLabel}</em>
                        <strong>
                          {profile.nickname}
                          <span />
                        </strong>
                        <small>{profile.meetPlace || "축제 부스 근처"}</small>
                        <p>{profile.summary}</p>
                      </button>
                    </div>
                  </div>

                  <MatchCardBlock
                    compatibility={profile.compatibility}
                    viewerHasSaju={Boolean(accessProfile?.saju)}
                    targetHasSaju={Boolean(profile.saju)}
                    viewerSaju={accessProfile?.saju}
                    targetSaju={profile.saju}
                    onFixMine={startEditingProfile}
                    onOpen={() => openProfile(profile)}
                  />

                  <div className="ai-match-person-footer">
                    <div className="ai-match-inline-tags">
                      {shouldShowPeopleRequestStatus(sentRequest?.status) ? (
                        <span className={`ai-match-request-status ai-match-request-status--${getRequestStatusTone(sentRequest.status, sentRequest.statusReason)}`}>
                          신청 {requestStatusLabel}
                        </span>
                      ) : null}
                      {visibleTags.map((tag) => (
                        <button
                          key={`${profile.id}-${tag}`}
                          type="button"
                          className={`ai-match-inline-tag${peopleTagFilters.includes(tag) ? " is-on" : ""}`}
                          aria-pressed={peopleTagFilters.includes(tag)}
                          title={peopleTagFilters.includes(tag) ? "이 관심사 필터 끄기" : "이 관심사로 모아 보기"}
                          onClick={() => togglePeopleTagFilter(tag)}
                        >
                          #{tag}
                        </button>
                      ))}
                      {hasExtraTags ? (
                        <button
                          type="button"
                          className="ai-match-inline-tags__toggle"
                          onClick={() => toggleExpandedTags(profile.id)}
                        >
                          {isTagsExpanded ? "접기" : `+${profile.tags.length - 2}`}
                        </button>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="ai-match-request-button ai-match-request-button--card"
                      onClick={() => openProfile(profile)}
                    >
                      <span className="ai-match-request-button__icon">
                        <IconHeart className="h-4 w-4" />
                      </span>
                      <span className="ai-match-request-button__label">
                        {sentRequest && sentRequest.status === "PENDING"
                          ? "신청 완료"
                          : sentRequest && sentRequest.status === "REJECTED"
                            ? "다시 신청"
                            : sentRequest && sentRequest.status === "ACCEPTED"
                              ? "수락 상태 보기"
                              : requestQuotaExhausted
                                ? "신청 마감"
                                : "데이트 신청하기"}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="ai-match-empty-card">
            <strong>{loading ? "프로필을 불러오는 중입니다." : activeFilter === "좋아요" ? "좋아요한 프로필이 없습니다." : "아직 등록된 프로필이 없습니다."}</strong>
            <p>{loading ? "잠시만 기다려 주세요." : activeFilter === "좋아요" ? "하트를 누른 프로필만 여기에서 모아볼 수 있어요." : "첫 번째 프로필을 등록하고 처음 화면을 채워보세요."}</p>
            {!loading ? (
              <button type="button" className="ai-match-secondary-button" onClick={startNewRegistration}>
                프로필 등록하러 가기
              </button>
            ) : null}
          </section>
        )}
      </div>
    );
  }

  function renderMeetupPanel(request) {
    if (!accessProfile) return null;
    if (!["ACCEPTED", "PROPOSED", "CONFIRMED"].includes(request.status)) return null;

    return (
      <MeetupScheduler
        request={request}
        myProfileId={accessProfile.id}
        busy={submitting}
        onPropose={handleProposeMeetupSlot}
        onConfirm={handleConfirmMeetup}
        onCancel={handleCancelMeetup}
        onOpenMap={openMeetPlaceMap}
        onArrived={handleMeetupArrived}
        onOpenChat={setChatRequestId}
        onShareContact={handleShareContact}
      />
    );
  }

  function renderMyScreen() {
    if (!accessProfile) {
      return (
        <div className="ai-match-flow">
          <section className="ai-match-empty-card">
            <strong>MY는 비밀번호로 잠금되어 있습니다.</strong>
            <p>프로필을 등록한 닉네임과 비밀번호를 입력하면 내 프로필을 관리할 수 있어요.</p>
            <button type="button" className="ai-match-secondary-button" onClick={() => openAccessModal("my")}>
              닉네임 + 비밀번호로 열기
            </button>
          </section>
        </div>
      );
    }

    const parsed = parseProfileCopy(accessProfile.intro);
    const profileLabel = parsed.mbti
      ? `${getProfileGenderLabel(accessProfile.gender)} · ${parsed.mbti}`
      : getProfileGenderLabel(accessProfile.gender);
    const visibleTags = parsed.tags.length ? parsed.tags : getFallbackTags(accessProfile).slice(0, 3);

    return (
      <div className="ai-match-flow">
        <section className="ai-match-request-summary">
          <strong>{accessProfile.nickname}님의 MY</strong>
          <p>내 프로필, 사진, 로그인 상태를 여기서 관리합니다.</p>
          <span>{profileLabel}</span>
        </section>

        <section className="ai-match-section-card ai-match-my-card">
          <div className="ai-match-my-profile">
            <div className="ai-match-my-photo">
              {accessProfile.generatedImageUrl ? (
                <img src={resolveApiAssetUrl(accessProfile.generatedImageUrl, 480)} alt="" decoding="async" />
              ) : (
                <IconUsers className="h-8 w-8" />
              )}
            </div>
            <div className="ai-match-my-copy">
              <em>{profileLabel}</em>
              <strong>{accessProfile.nickname}</strong>
              <p>{parsed.summary}</p>
              <div className="ai-match-inline-tags">
                {visibleTags.map((tag) => (
                  <span key={`my-${tag}`}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="ai-match-my-stats">
            <span>
              <strong>{accessRequests.length}</strong>
              <small>받은 요청</small>
            </span>
            <span>
              <strong>{accessSentRequests.length}</strong>
              <small>보낸 요청</small>
            </span>
          </div>

          <div className="ai-match-request-actions">
            <button type="button" className="ai-match-secondary-button" onClick={startEditingProfile}>
              프로필 수정
            </button>
            <button type="button" className="ai-match-secondary-button ai-match-secondary-button--danger" onClick={handleDeleteProfile} disabled={submitting}>
              프로필 삭제
            </button>
            <button
              type="button"
              className="ai-match-secondary-button"
              onClick={() => {
                clearAccessSession({ resetForm: true });
                setActiveScreen("intro");
              }}
            >
              로그아웃
            </button>
          </div>
        </section>

        {accessProfile.saju ? (
          <SajuPanel
            saju={accessProfile.saju}
            title="내 사주"
            subtitle={accessProfile.saju.hourKnown ? "네 기둥" : "태어난 시간 없이 세 기둥"}
          />
        ) : (
          <section className="ai-match-empty-card">
            <strong>아직 사주가 없어요.</strong>
            <p>프로필 수정에서 이름과 생년월일을 넣으면 사주와 궁합 점수를 볼 수 있어요.</p>
            <button type="button" className="ai-match-secondary-button" onClick={startEditingProfile}>
              사주 등록하기
            </button>
          </section>
        )}
      </div>
    );
  }

  function renderInquiryScreen() {
    return (
      <div className="ai-match-flow">
        <section className="ai-match-request-summary">
          <strong>문의</strong>
          <p>AI 소개팅 이용 중 오류가 있거나 궁금한 점이 있다면 소통개발국장 정재훈에게 편하게 문의해 주세요. 아직 개발 경험이 많지 않아 부족한 부분이 있을 수 있지만, 확인하는 대로 최대한 빠르게 개선하겠습니다.</p>
          <span>소통개발국장 정재훈 010-0000-0000</span>
        </section>

        <section className="ai-match-section-card">
          <div className="ai-match-section-head">
            <h2>문의 전에 확인해 주세요</h2>
            <span>AI 소개팅</span>
          </div>
          <div className="ai-match-contact-list">
            <article>
              <strong>신청/수락/거절 상태</strong>
              <p>신청함에서 받은 신청과 보낸 신청 상태를 먼저 확인해 주세요.</p>
            </article>
            <article>
              <strong>사진 또는 프로필 문제</strong>
              <p>MY에서 프로필 사진과 소개를 수정할 수 있습니다.</p>
            </article>
            <article>
              <strong>삭제와 개인정보 문의</strong>
              <p>MY의 프로필 삭제를 사용하거나 현장 운영 부스에 닉네임을 알려 주세요.</p>
            </article>
          </div>
        </section>

        <section className="ai-match-safety-card">
          <IconShield className="h-5 w-5" />
          <p>연락처와 원본 사진은 매칭 운영 확인 용도로만 사용되며, 다른 참가자에게 공개되지 않습니다. 성사된 뒤 두 사람이 모두 ‘연락처 주고받기’에 동의한 경우에만 서로의 번호가 보입니다.</p>
        </section>
      </div>
    );
  }

  function renderRequestsScreen() {
    if (!accessProfile) {
      return (
        <div className="ai-match-flow">
          <section className="ai-match-empty-card">
            <strong>신청함은 비밀번호로 잠금되어 있습니다.</strong>
            <p>프로필을 등록한 닉네임과 비밀번호를 입력하면 받은 요청과 보낸 요청을 확인할 수 있어요.</p>
            <button type="button" className="ai-match-secondary-button" onClick={() => openAccessModal("requests")}>
              신청함 잠금 해제
            </button>
          </section>
        </div>
      );
    }

    return (
      <div className="ai-match-flow">
        <section className="ai-match-request-summary">
          <strong>{accessProfile.nickname}님의 신청함</strong>
          <p>받은 요청과 보낸 요청 상태가 실시간으로 반영됩니다.</p>
          <span>{accessRequests.length + accessSentRequests.length}건</span>
        </section>

        <section className={`am-quota${requestQuotaExhausted ? " am-quota--done" : ""}`}>
          <div className="am-quota__text">
            <strong>
              {requestQuotaExhausted
                ? "데이트 신청을 모두 보냈어요"
                : `데이트 신청 ${requestQuota.remaining}번 남았어요`}
            </strong>
            <small>한 사람당 {requestQuota.limit}번까지 보낼 수 있어요. 취소하거나 거절돼도 횟수는 돌아오지 않아요.</small>
          </div>
          <RequestQuotaDots quota={requestQuota} />
        </section>

        <section className="ai-match-filter-bar">
          <button
            type="button"
            className={`ai-match-filter-chip ai-match-filter-chip--violet${requestTab === "received" ? " is-active" : ""}`}
            style={requestTab === "received" ? ACTIVE_FILTER_TAG_STYLE : undefined}
            onClick={() => setRequestTab("received")}
          >
            받은 요청
          </button>
          <button
            type="button"
            className={`ai-match-filter-chip ai-match-filter-chip--violet${requestTab === "sent" ? " is-active" : ""}`}
            style={requestTab === "sent" ? ACTIVE_FILTER_TAG_STYLE : undefined}
            onClick={() => setRequestTab("sent")}
          >
            보낸 요청
          </button>
        </section>

        {requestTab === "received" ? (
          accessRequests.length ? (
            <div className="ai-match-request-history">
              {accessRequests.map((request) => (
                <article key={request.id} className="ai-match-request-history-card">
                  <div className="ai-match-request-history-head">
                    <div className="ai-match-request-history-person">
                      <RequestFaceThumb
                        imageUrl={request.requesterImageUrl || request.requesterOriginalImageUrl}
                        name={request.requesterNickname}
                        onClick={
                          findRequestProfile(request, "received")
                            ? () => openRequestProfile(request, "received")
                            : undefined
                        }
                      />
                      <strong>{request.requesterNickname}</strong>
                    </div>
                    <small>{formatRequestTime(request.createdAt)}</small>
                  </div>
                  <div className="ai-match-request-history-status">
                    <span className={`ai-match-request-status ai-match-request-status--${getRequestStatusTone(request.status, request.statusReason)}`}>
                      {getRequestStatusLabel(request.status, request.statusReason)}
                    </span>
                  </div>
                  <p>{isProfileDeletedRequest(request) ? "상대가 계정을 삭제했습니다." : `${request.requesterNickname}님이 데이트 신청을 보냈어요.`}</p>
                  <span>
                    <IconMapPin className="h-4 w-4" />
                    {["ACCEPTED", "PROPOSED", "CONFIRMED"].includes(request.status) ? MEET_PLACES[0] : request.meetPlace}
                  </span>
                  <em>{request.message}</em>
                  {renderMeetupPanel(request)}
                  {request.status === "PENDING" ? (
                    <div className="ai-match-request-actions">
                      <button
                        type="button"
                        className="ai-match-secondary-button"
                        onClick={() => handleAcceptRequest(request.id)}
                        disabled={submitting}
                      >
                        수락
                      </button>
                      <button
                        type="button"
                        className="ai-match-secondary-button ai-match-secondary-button--danger"
                        onClick={() => handleRejectRequest(request.id)}
                        disabled={submitting}
                      >
                        거절
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <section className="ai-match-empty-card">
              <strong>아직 받은 요청이 없습니다.</strong>
              <p>공개된 내 프로필로 도착한 신청이 생기면 여기에 표시됩니다.</p>
            </section>
          )
        ) : accessSentRequests.length ? (
          <div className="ai-match-request-history">
            {accessSentRequests.map((request) => (
              <article key={request.id} className="ai-match-request-history-card">
                <div className="ai-match-request-history-head">
                  <div className="ai-match-request-history-person">
                    <RequestFaceThumb
                      imageUrl={request.profileImageUrl || request.profileOriginalImageUrl}
                      name={request.profileNickname}
                      onClick={
                        findRequestProfile(request, "sent")
                          ? () => openRequestProfile(request, "sent")
                          : undefined
                      }
                    />
                    <strong>{request.profileNickname}</strong>
                  </div>
                  <small>{formatRequestTime(request.createdAt)}</small>
                </div>
                <div className="ai-match-request-history-status">
                  <span className={`ai-match-request-status ai-match-request-status--${getRequestStatusTone(request.status, request.statusReason)}`}>
                    {getRequestStatusLabel(request.status, request.statusReason)}
                  </span>
                </div>
                <p>{isProfileDeletedRequest(request) ? "상대가 계정을 삭제했습니다." : `${request.profileNickname}님에게 보낸 데이트 신청입니다.`}</p>
                <span>
                  <IconMapPin className="h-4 w-4" />
                  {["ACCEPTED", "PROPOSED", "CONFIRMED"].includes(request.status) ? MEET_PLACES[0] : request.meetPlace}
                </span>
                <em>{request.message}</em>
                {renderMeetupPanel(request)}
                {request.status === "PENDING" ? (
                  <div className="ai-match-request-actions">
                    <button
                      type="button"
                      className="ai-match-secondary-button ai-match-secondary-button--danger"
                      onClick={() => handleCancelRequest(request.id)}
                      disabled={submitting}
                    >
                      신청 취소
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <section className="ai-match-empty-card">
            <strong>아직 보낸 요청이 없습니다.</strong>
            <p>처음 화면에서 마음에 드는 상대에게 먼저 신청해 보세요.</p>
          </section>
        )}
      </div>
    );
  }

  function renderDetailScreen() {
    if (!selectedDetailProfile) return null;
    const detailRequestStatus = selectedDetailRequest?.status || "";

    return (
      <div className="ai-match-flow ai-match-flow--detail">
        <section className="ai-match-detail-hero">
          <span className={`ai-match-detail-badge ai-match-detail-badge--${selectedDetailProfile.tone}`}>
            {selectedDetailProfile.genderLabel}
          </span>
          {selectedDetailProfile.generatedImageUrl ? (
            <img src={resolveApiAssetUrl(selectedDetailProfile.generatedImageUrl, 960)} alt="" decoding="async" />
          ) : (
            <div className="ai-match-detail-placeholder">
              <IconUsers className="h-10 w-10" />
            </div>
          )}
        </section>

        <section className="ai-match-detail-card">
          <strong>
            {selectedDetailProfile.nickname}
            <span />
          </strong>
          {selectedDetailProfile.mbti ? <em>{selectedDetailProfile.mbti}</em> : null}
          <small>{selectedDetailProfile.meetPlace || "축제 부스 주변에서 만나고 싶어요."}</small>
          <p>{selectedDetailProfile.summary}</p>
          <div className="ai-match-inline-tags">
            {shouldShowPeopleRequestStatus(selectedDetailRequest?.status) ? (
              <span className={`ai-match-request-status ai-match-request-status--${getRequestStatusTone(selectedDetailRequest.status, selectedDetailRequest.statusReason)}`}>
                신청 {getRequestStatusLabel(selectedDetailRequest.status, selectedDetailRequest.statusReason)}
              </span>
            ) : null}
            {selectedDetailProfile.tags.map((tag) => (
              <span key={`${selectedDetailProfile.id}-detail-${tag}`}>{tag}</span>
            ))}
          </div>
        </section>

        <MatchReport
          compatibility={selectedDetailProfile.compatibility}
          mine={accessProfile?.saju}
          theirs={selectedDetailProfile.saju}
          myNickname={accessProfile?.nickname}
          nickname={selectedDetailProfile.nickname}
        />

        {selectedDetailProfile.saju && !selectedDetailProfile.compatibility ? (
          <SajuPanel
            saju={selectedDetailProfile.saju}
            title={`${selectedDetailProfile.nickname} 님의 사주`}
            subtitle={selectedDetailProfile.saju.hourKnown ? "네 기둥" : "세 기둥"}
          />
        ) : null}

        {selectedDetailProfile.saju && !selectedDetailProfile.compatibility && accessProfile && !accessProfile.saju ? (
          <p className="ai-match-note">내 사주를 등록하면 궁합 점수도 볼 수 있어요. 내 프로필 수정에서 생년월일을 넣어 주세요.</p>
        ) : null}

        <section className="ai-match-safety-card">
          <IconShield className="h-5 w-5" />
          <p>안전한 만남을 위해 실명 및 연락처는 상호 매칭 후에만 공개됩니다.</p>
          <button type="button" className="am-report__open" onClick={() => setReportOpen((open) => !open)}>
            {reportOpen ? "신고 닫기" : "이 사람 신고"}
          </button>
        </section>

        {reportOpen ? (
          <form className="am-report" onSubmit={handleReportSubmit}>
            <strong>무엇이 문제였나요?</strong>
            <div className="am-report__reasons" role="radiogroup">
              {[
                ["INAPPROPRIATE_PHOTO", "부적절한 사진"],
                ["OFFENSIVE_MESSAGE", "불쾌한 메시지"],
                ["FAKE_PROFILE", "가짜 프로필"],
                ["HARASSMENT", "괴롭힘"],
                ["OTHER", "기타"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={reportReason === value}
                  className={`am-chip${reportReason === value ? " is-on" : ""}`}
                  onClick={() => setReportReason(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={reportDetail}
              onChange={(event) => setReportDetail(event.target.value)}
              placeholder="자세한 내용을 적어 주시면 더 빨리 확인할 수 있어요 (선택)"
              maxLength={500}
              rows={3}
            />
            <div className="am-report__foot">
              <small>신고한 사실은 상대에게 알려지지 않아요.</small>
              <button type="submit" className="ai-match-secondary-button ai-match-secondary-button--danger" disabled={reportBusy}>
                {reportBusy ? "접수 중…" : "신고 보내기"}
              </button>
            </div>
          </form>
        ) : null}

        <form className="ai-match-request-sheet" onSubmit={handleRequest}>
          <div className="ai-match-request-sheet-head">
            <strong>데이트 신청</strong>
            <button type="button" aria-label="닫기" onClick={closeDetail}>
              <IconX className="h-4 w-4" />
            </button>
          </div>

          {accessProfile ? (
            <div className={`am-quota am-quota--sheet${requestQuotaExhausted ? " am-quota--done" : ""}`}>
              <div className="am-quota__text">
                <strong>
                  {requestQuotaExhausted
                    ? "신청 횟수를 모두 썼어요"
                    : canSendRequest(detailRequestStatus)
                      ? `보내면 ${requestQuota.remaining - 1}번 남아요`
                      : `${requestQuota.remaining}번 남았어요`}
                </strong>
                <small>한 사람당 {requestQuota.limit}번까지 · 취소해도 돌아오지 않아요</small>
              </div>
              <RequestQuotaDots quota={requestQuota} />
            </div>
          ) : null}

          <label className="ai-match-field">
            <div className="ai-match-field-head">
              <span>신청자 닉네임</span>
              <small>인증 완료</small>
            </div>
            <input
              value={accessProfile?.nickname || requesterNickname}
              maxLength={12}
              readOnly
              placeholder="예) 같이걷고싶어요"
            />
          </label>

          <label className="ai-match-field">
            <div className="ai-match-field-head">
              <span>장소 선택</span>
            </div>
            <select value={requestPlace} onChange={(event) => setRequestPlace(event.target.value)}>
              {MEET_PLACES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="ai-match-field">
            <div className="ai-match-field-head">
              <span>짧은 메시지</span>
              <small>{requestMessage.length}/100</small>
            </div>
            <textarea
              value={requestMessage}
              maxLength={100}
              onChange={(event) => setRequestMessage(event.target.value)}
              placeholder="예) 같이 산책하면서 이야기 나누고 싶어요 :)"
            />
          </label>

          <button
            type="submit"
            className="ai-match-primary-button ai-match-primary-button--sheet"
            disabled={submitting || !canSendRequest(detailRequestStatus) || requestQuotaExhausted}
          >
            {submitting ? (
              <span className="ai-match-primary-button__icon">
                <IconSend className="h-4 w-4" />
              </span>
            ) : null}
            <span className="ai-match-primary-button__label">
              {submitting
                ? "전송 중..."
                : detailRequestStatus === "PENDING"
                  ? "신청 완료"
                  : detailRequestStatus === "ACCEPTED"
                    ? "수락됨"
                    : requestQuotaExhausted
                      ? "신청 횟수를 모두 썼어요"
                      : selectedDetailRequest && (detailRequestStatus === "REJECTED" || detailRequestStatus === "CANCELED")
                        ? "다시 신청 보내기"
                        : "데이트 신청 보내기"}
            </span>
            {!submitting ? (
              <span className="ai-match-primary-button__accent" aria-hidden="true">
                <IconSparkles className="h-4 w-4" />
              </span>
            ) : null}
          </button>
          {selectedDetailRequest?.status === "PENDING" ? (
            <button
              type="button"
              className="ai-match-secondary-button ai-match-secondary-button--danger"
              onClick={() => handleCancelRequest(selectedDetailRequest.id)}
              disabled={submitting}
            >
              신청 취소
            </button>
          ) : null}
          {["ACCEPTED", "PROPOSED", "CONFIRMED"].includes(detailRequestStatus) ? (
            <p className="ai-match-note">
              <IconShield className="h-4 w-4" />
              매치가 성사되면 관리자가 양쪽 연락처로 시간과 장소를 안내합니다.
            </p>
          ) : null}
        </form>
      </div>
    );
  }

  function handleBottomNavSelect(itemId) {
    setActiveSelectedProfile(null);
    if (itemId === "intro") {
      setActiveScreen("intro");
      return;
    }
    if (itemId === "requests") {
      if (accessProfile) {
        setLiveNotice(null);
        markRequestNoticesSeen();
        setActiveScreen("requests");
      } else {
        openAccessModal("requests");
      }
      return;
    }
    if (itemId === "my") {
      if (accessProfile) {
        setActiveScreen("my");
      } else {
        openAccessModal("my");
      }
      return;
    }
    setActiveScreen(itemId);
  }

  function renderBottomNav() {
    return (
      <nav className="ai-match-bottom-nav" aria-label="AI 소개팅 화면 전환">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`ai-match-bottom-tab${isActive ? " is-active" : ""}`}
              onClick={() => handleBottomNavSelect(item.id)}
            >
              <span className="ai-match-bottom-tab-icon">
                <Icon className="h-5 w-5" />
                {item.id === "requests" && unreadRequestCount > 0 ? (
                  <strong className="ai-match-nav-badge">{unreadRequestCount > 9 ? "9+" : unreadRequestCount}</strong>
                ) : null}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  if (isDetailScreen) {
    return (
      <section className="uni-page ai-match-page ai-match-redesigned ai-match-redesigned--detail ai-match-page--night" data-i18n-skip>
        <NightSky />
        <header className="ai-match-topbar">
          <button type="button" aria-label="사람 목록으로 돌아가기" onClick={closeDetail}>
            <IconArrowLeft className="h-5 w-5" />
          </button>

          <h1>프로필 상세</h1>

          <button
            type="button"
            className={`ai-match-topbar-favorite${isFavoriteProfile(selectedProfile.id) ? " ai-match-topbar-favorite--active" : ""}`}
            aria-label={isFavoriteProfile(selectedProfile.id) ? "관심 목록에서 제거" : "관심 목록에 추가"}
            aria-pressed={isFavoriteProfile(selectedProfile.id)}
            onClick={() => toggleFavorite(selectedProfile.id)}
          >
            {isFavoriteProfile(selectedProfile.id) ? (
              <IconHeartFilled className="h-5 w-5" />
            ) : (
              <IconHeart className="h-5 w-5" />
            )}
          </button>
        </header>

        {bannerText ? (
          <p className={errorMessage ? "ai-match-banner ai-match-banner--error" : "ai-match-banner ai-match-banner--success"} aria-live="polite">
            {bannerText}
          </p>
        ) : null}

        {renderLiveNotice()}
      {renderMeetupChat()}

        {renderDetailScreen()}
      </section>
    );
  }

  return (
    <section
      className={`uni-page ai-match-page ai-match-redesigned ai-match-redesigned--${activeScreen}${accessProfile ? " ai-match-redesigned--signed-in" : ""}${nightMode ? " ai-match-page--night" : ""}`}
      data-i18n-skip
    >
      {nightMode ? <NightSky /> : null}
      {sajuSplash ? <SajuSplash onDone={() => setSajuSplash(false)} /> : null}
      <header className="ai-match-topbar">
        {activeScreen === "intro" ? (
          <span className="ai-match-topbar-spacer" aria-hidden="true" />
        ) : (
          <button type="button" aria-label="처음으로 돌아가기" onClick={() => setActiveScreen("intro")}>
            <IconArrowLeft className="h-5 w-5" />
          </button>
        )}

        <h1>{activeScreenTitle}</h1>

        {activeScreen === "requests" ? (
          <button type="button" aria-label="새로고침" onClick={handleRequestsRefresh} disabled={loading || accessSubmitting}>
            <IconRefresh className="h-5 w-5" />
          </button>
        ) : (
          <span className="ai-match-topbar-spacer" aria-hidden="true" />
        )}
      </header>

      {renderBottomNav()}

      {bannerText ? (
        <p className={errorMessage ? "ai-match-banner ai-match-banner--error" : "ai-match-banner ai-match-banner--success"} aria-live="polite">
          {bannerText}
        </p>
      ) : null}

      {renderLiveNotice()}
      {renderMeetupChat()}

      {activeScreen === "intro" ? renderIntroScreen() : null}
      {activeScreen === "register" ? renderRegisterScreen() : null}
      {activeScreen === "requests" ? renderRequestsScreen() : null}
      {activeScreen === "my" ? renderMyScreen() : null}
      {activeScreen === "inquiry" ? renderInquiryScreen() : null}

      {!registrationOpen && !closedNoticeDismissed && !sajuSplash && !accessProfile && !accessModalOpen ? (
        <div className="ai-match-modal" role="dialog" aria-modal="true" aria-labelledby="ai-match-closed-title">
          <div className="ai-match-dialog am-login am-closed">
            <span className="am-login__handle" aria-hidden="true" />
            <div className="am-login__head">
              <span className="am-login__moon" aria-hidden="true">☾</span>
              <h2 id="ai-match-closed-title">지금은 새로 만들 수 없어요</h2>
              <p>{registrationClosedMessage || "지금 참가자가 너무 많아 새 프로필 등록은 잠시 받지 않아요. 이미 등록한 분은 닉네임과 비밀번호로 그대로 들어갈 수 있어요."}</p>
            </div>
            <button type="button" className="ai-match-primary-button am-closed__ok" onClick={() => setClosedNoticeDismissed(true)}>
              <span className="ai-match-primary-button__label">확인</span>
            </button>
            <button
              type="button"
              className="ai-match-secondary-button"
              onClick={() => {
                setClosedNoticeDismissed(true);
                openAccessModal("intro");
              }}
            >
              이미 가입했어요 · 로그인
            </button>
          </div>
        </div>
      ) : null}

      {accessModalOpen ? (
        <div className="ai-match-modal" role="dialog" aria-modal="true" aria-labelledby="ai-match-access-title">
          <form ref={accessDialogRef} className={`ai-match-dialog am-login${accessError ? " is-wrong" : ""}`} onSubmit={handleAccessSubmit}>
            <span className="am-login__handle" aria-hidden="true" />
            <button type="button" className="ai-match-close am-login__close" aria-label="닫기" onClick={closeAccessModal}>
              <IconX className="h-4 w-4" />
            </button>
            <div className="am-login__head">
              <span className="am-login__moon" aria-hidden="true">☾</span>
              <h2 id="ai-match-access-title">{getAccessModalTitle()}</h2>
              <p>가입할 때 정한 닉네임과 비밀번호로 들어가요.</p>
            </div>
            <label className="ai-match-field">
              <div className="ai-match-field-head">
                <span>닉네임</span>
              </div>
              <input
                ref={accessNicknameInputRef}
                value={accessNickname}
                maxLength={12}
                onChange={(event) => {
                  setAccessNickname(event.target.value);
                  setAccessError("");
                }}
                placeholder="등록한 닉네임"
              />
              {accessAttempted && accessNicknameMissing ? <small className="ai-match-field-error">닉네임을 입력해 주세요.</small> : null}
            </label>
            <label className="ai-match-field">
              <div className="ai-match-field-head">
                <span>비밀번호</span>
                <small>4~10자</small>
              </div>
              <input
                type="password"
                value={accessPin}
                maxLength={10}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (PASSWORD_INPUT_PATTERN.test(nextValue)) {
                    setAccessPin(nextValue);
                    setAccessError("");
                  }
                }}
                placeholder="예) 364657434"
              />
              {accessAttempted && accessPinMissing ? <small className="ai-match-field-error">비밀번호를 입력해 주세요.</small> : null}
              {accessAttempted && accessPinInvalid ? <small className="ai-match-field-error">비밀번호는 4~10자여야 합니다.</small> : null}
            </label>
            {accessError ? (
              <p className="am-login__error" role="alert">
                <b aria-hidden="true">!</b>
                {accessError}
              </p>
            ) : null}
            <button type="submit" className="ai-match-primary-button ai-match-primary-button--sheet" disabled={accessSubmitting}>
              <span className="ai-match-primary-button__label">
                {getAccessSubmitLabel()}
              </span>
            </button>
            <p className="am-login__foot">
              <IconShield className="h-4 w-4" />
              비밀번호를 잊었다면 총학생회 본부에서 확인해 드려요.
            </p>
          </form>
        </div>
      ) : null}
    </section>
  );
}
