// 눌러 보는 매뉴얼의 연습용 서버 · 사주 소개팅 쪽.
// 실제 서버(AiMatchService · AiMatchMeetupSlotService · AiMatchChatService)와 같은 규칙으로 답한다. 서버 규칙을 바꾸면 여기도 같이 바꾼다.
// 다른 점: 문자는 보내지 않는다. 가입 · 프로필 수정 · 삭제는 연습 화면에 없다. 사람과 사주는 지어낸 연습용 값이다.
import { NOT_HANDLED, httpError, parseStamp } from "./demoCore";

export const DEMO_ADMIN_TOKEN = "practice-admin";
export const DEMO_PIN = "1234";
/** 신청하는 사람 · 신청받는 사람. 매뉴얼의 두 참가자 화면이 이 닉네임으로 들어와 있다. */
export const DEMO_USER_A = "연습치토";
export const DEMO_USER_B = "연습바람";

const SLOT_MINUTES = 20;
const HOLD_MINUTES = 30;
const LEAD_MINUTES = 30;
const PERSONAL_GAP_MINUTES = 40;
const OPEN_HOUR = 9;
const CLOSE_HOUR = 22;
const CHAT_MINUTES = 10;
const CHOOSE_MINUTES = 3;
const SELF_ARRIVAL_OPEN_MINUTES = 60;
const MAX_SENT_REQUESTS = 3;
const BOOTH_NAME = "총학생회 소개팅 부스";
const WAITING_PLACE_FEMALE = "성호관 앞";
const WAITING_PLACE_MALE = "중앙도서관 앞";
const ESCORT_STAGES = ["NONE", "ARRIVED", "DEPARTED", "PICKED_UP", "AT_BOOTH"];
const REPORT_REASONS = new Set(["INAPPROPRIATE_PHOTO", "OFFENSIVE_MESSAGE", "FAKE_PROFILE", "HARASSMENT", "OTHER"]);
const MATCHED = new Set(["ACCEPTED", "PROPOSED", "CONFIRMED"]);
const MINUTE = 60_000;

const REGISTRATION_CLOSED_MESSAGE =
  "지금 참가자가 너무 많아 새 프로필 등록은 잠시 받지 않아요. 이미 등록한 분은 닉네임과 비밀번호로 그대로 들어갈 수 있어요.";
const CONFIRMED_LOCKED_MESSAGE =
  "확정된 약속은 앱에서 바꾸거나 취소할 수 없어요. 부득이하게 못 오면 소개팅 부스 스태프에게 알려 주세요.";
const NEARBY_MEETUP_MESSAGE = `두 사람 중 한 명의 다른 약속과 너무 가까워요. 앞뒤 ${PERSONAL_GAP_MINUTES}분은 비워 두고 골라 주세요.`;

const COMMON_TOPICS = [
  ["g1", "이번 축제에서 제일 기대한 공연은?"],
  ["g2", "축제 와서 제일 먼저 먹은 건 뭐예요?"],
  ["g3", "요즘 제일 자주 듣는 노래 한 곡만 추천한다면?"],
  ["g4", "쉬는 날엔 집에 있는 편? 나가는 편?"],
  ["g5", "최근에 본 영화나 드라마 중 제일 재밌었던 건?"],
  ["g6", "학교 근처 맛집을 하나만 꼽는다면?"],
  ["g7", "여행 간다면 바다 vs 산, 어디로?"],
  ["g8", "사주 풀이 결과, 본인이랑 얼마나 맞는 것 같아요?"],
  ["g9", "요즘 빠져 있는 취미가 있다면?"],
  ["g10", "아침형 인간 vs 올빼미형, 어느 쪽이에요?"],
  ["g11", "이번 학기에 꼭 해 보고 싶은 것 하나는?"],
  ["g12", "프로필 소개글을 쓸 때 제일 고민한 부분은?"],
].map(([id, text]) => ({ id, text }));

/* ---------- 연습용 사람들 (지어낸 값) ---------- */
function saju(pillars, dayMaster, dayMasterElement, zodiac, counts, reading) {
  const elements = ["목", "화", "토", "금", "수"];
  const elementCounts = Object.fromEntries(elements.map((name, index) => [name, counts[index]]));
  const sorted = [...elements].sort((a, b) => elementCounts[b] - elementCounts[a]);
  return {
    yearPillar: pillars[0],
    monthPillar: pillars[1],
    dayPillar: pillars[2],
    hourPillar: null,
    hourKnown: false,
    dayMaster,
    dayMasterElement,
    zodiac,
    elementCounts,
    strongestElement: sorted[0],
    weakestElement: sorted[sorted.length - 1],
    reading,
  };
}

const PEOPLE = [
  {
    id: 1,
    nickname: DEMO_USER_A,
    gender: "남성",
    intro: "러닝 뛰고 카페 가는 게 취미예요. 공연은 앞줄에서 보는 편!\nMBTI: ENFP\n#운동 #음악 #맛집",
    image: "/images/chito-wave.png",
    saju: saju(["임오", "계축", "무자"], "무", "토", "말", [0, 1, 2, 0, 3], "든든한 흙의 기운에 물이 넉넉해요. 차분해 보여도 속은 감수성이 풍부한 편이에요."),
  },
  {
    id: 2,
    nickname: DEMO_USER_B,
    gender: "여성",
    intro: "노천극장 공연 보러 다니는 걸 좋아해요. 맛집 지도 만드는 중.\nMBTI: INFJ\n#공연 #음악 #맛집",
    image: "/images/chito-cheer.png",
    saju: saju(["계미", "갑자", "신유"], "신", "금", "양", [1, 0, 1, 2, 2], "맑은 금의 기운이 또렷해요. 기준이 분명하고, 마음을 주면 오래 가는 편이에요."),
  },
  {
    id: 3,
    nickname: "갈대소리",
    gender: "여성",
    intro: "사진 찍으면서 걷는 걸 좋아해요.\nMBTI: ISFP\n#사진 #여행 #영화",
    image: "/images/chito-party.png",
    saju: saju(["임오", "임인", "신미"], "신", "금", "말", [1, 1, 1, 1, 2], "오행이 고르게 퍼져 있어요. 어디서든 무난하게 어울리는 편이에요."),
  },
  {
    id: 4,
    nickname: "노을산책",
    gender: "남성",
    intro: "보드게임 모임을 하고 있어요. 같이 한 판 어때요?\nMBTI: INTP\n#보드게임 #게임 #독서",
    image: "/images/chito-flame.png",
    saju: saju(["신사", "경인", "갑오"], "갑", "목", "뱀", [2, 2, 0, 2, 0], "곧게 뻗는 나무의 기운이에요. 새로운 일을 벌이는 데 망설임이 없어요."),
  },
  {
    id: 5,
    nickname: "가을하늘",
    gender: "여성",
    intro: "영화 보고 이야기 나누는 시간을 좋아해요.\nMBTI: ENFJ\n#영화 #독서 #음악",
    image: "/images/chito.png",
    saju: saju(["계미", "을묘", "병술"], "병", "화", "양", [2, 1, 2, 0, 1], "밝은 불의 기운이에요. 주변을 환하게 만드는 사람이에요."),
  },
  {
    id: 6,
    nickname: "달빛러너",
    gender: "남성",
    intro: "밤에 캠퍼스 한 바퀴 뛰는 걸 좋아해요.\nMBTI: ISTJ\n#운동 #여행 #맛집",
    image: "/images/saju/chito-dosa.png",
    saju: saju(["임오", "정미", "기해"], "기", "토", "말", [0, 2, 2, 0, 2], "부드러운 흙의 기운이에요. 꾸준하고 믿음직한 편이에요."),
  },
];

function gradeOf(score) {
  if (score >= 90) return "천생연분";
  if (score >= 80) return "아주 좋아요";
  if (score >= 70) return "잘 맞아요";
  if (score >= 60) return "무난해요";
  if (score >= 50) return "노력하면 좋아요";
  return "조심스러워요";
}

function headlineOf(score) {
  if (score >= 90) return "바람이 두 사람을 같은 쪽으로 불어요.";
  if (score >= 80) return "결이 잘 맞는 사이예요.";
  if (score >= 70) return "이야기가 잘 통할 사이예요.";
  if (score >= 60) return "천천히 알아가면 좋은 사이예요.";
  if (score >= 50) return "다른 점이 많아 그만큼 배울 게 있어요.";
  return "서로 속도가 달라요. 급하지 않게 다가가 보세요.";
}

// 연습용 궁합 점수. 두 사람 번호로 정해지고, 누가 보든 같은 값이다.
function compatibilityOf(viewer, target) {
  const low = Math.min(viewer.id, target.id);
  const high = Math.max(viewer.id, target.id);
  const score = low === 1 && high === 2 ? 88 : 54 + ((low * 17 + high * 11) % 30);
  return {
    score,
    grade: gradeOf(score),
    headline: headlineOf(score),
    reasons: [
      `내 ${viewer.saju.dayMasterElement} 기운과 상대의 ${target.saju.dayMasterElement} 기운이 서로를 받쳐 줘요.`,
      `나에게 적은 ${viewer.saju.weakestElement} 기운을 상대가 채워 줘요.`,
      "일지가 서로 편안한 자리에 있어요.",
    ],
  };
}

function waitingPlaces(requester, profile) {
  const requesterFemale = `${requester?.gender ?? ""}`.includes("여");
  const profileFemale = `${profile?.gender ?? ""}`.includes("여");
  return requesterFemale && !profileFemale
    ? [WAITING_PLACE_FEMALE, WAITING_PLACE_MALE]
    : [WAITING_PLACE_MALE, WAITING_PLACE_FEMALE];
}

function tagsOf(intro) {
  return new Set([...`${intro ?? ""}`.matchAll(/#([^\s#]+)/g)].map((match) => match[1]));
}

function mbtiOf(intro) {
  return (`${intro ?? ""}`.match(/\bMBTI\s*:\s*([A-Za-z]{4})\b/i)?.[1] || "").toUpperCase();
}

export function createAimatchDomain({ nowMs, stamp, emit, clock }) {
  let state = null;

  /* ---------- 처음 상태 ---------- */
  function dayStart(ms) {
    const date = new Date(ms);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function initialState() {
    // state.registrationOpen 은 운영진이 스위치를 끄면 false 가 된다. 처음(undefined)은 받는 상태.
    const today = dayStart(nowMs());
    const day = 24 * 60 * MINUTE;
    const profiles = PEOPLE.map((person, index) => ({
      ...person,
      pin: DEMO_PIN,
      meetPlace: "총학생회 부스",
      phoneNumber: `010-0000-000${person.id}`,
      status: "ACTIVE",
      hidden: false,
      hiddenReason: null,
      photoReview: index < 4 ? "APPROVED" : "PENDING",
      createdAt: stamp(nowMs() - (index + 2) * 3 * 60 * MINUTE),
    }));
    const next = {
      // 약속을 잡을 수 있는 날짜: 오늘부터 사흘. (실제로는 축제 날짜와 리허설 날짜)
      dates: [today, today + day, today + 2 * day],
      profiles,
      requests: [],
      slots: [],
      messages: [],
      reports: [],
      favorites: new Map(),
      sessions: new Map(),
      nextRequestId: 31,
      nextMessageId: 1,
      nextReportId: 1,
    };
    // 이미 약속을 잡아 둔 다른 커플 하나. 시간표와 시간 고르기에 '다른 커플' 칸으로 보인다.
    const slotAt = today + day + 18 * 60 * MINUTE;
    next.requests.push(newRequest(next, profiles[4], profiles[3], "총학생회 부스", "보드게임 좋아하신다고 해서요!", nowMs() - 5 * 60 * MINUTE));
    Object.assign(next.requests[0], {
      status: "CONFIRMED",
      connectionStatus: "WAITING",
      meetupPlace: BOOTH_NAME,
      meetupAt: stamp(slotAt),
      meetupProposerProfileId: profiles[3].id,
      meetupProposerNickname: profiles[3].nickname,
    });
    next.slots.push({ slotAt, requestId: next.requests[0].id, confirmed: true, heldUntil: null });
    return next;
  }

  function newRequest(target, profile, requester, meetPlace, message, at) {
    const id = target.nextRequestId;
    target.nextRequestId += 1;
    return {
      id,
      profileId: profile.id,
      requesterProfileId: requester.id,
      requesterNickname: requester.nickname,
      meetPlace,
      message,
      status: "PENDING",
      statusReason: null,
      connectionStatus: null,
      adminNote: null,
      createdAt: stamp(at),
      updatedAt: stamp(at),
      meetupPlace: null,
      meetupAt: null,
      meetupProposerProfileId: null,
      meetupProposerNickname: null,
      // 안내 단계가 된 시각: [대기 장소 도착, 스태프 출발, 스태프와 만남, 부스 도착]
      requesterStages: [null, null, null, null],
      profileStages: [null, null, null, null],
      meetupOutcome: null,
      reminderSentAt: null,
      chatStartedAt: null,
      requesterReveal: null,
      profileReveal: null,
      // 연락처 공유 동의 시각(신청자 · 상대). 둘 다 있으면 서로 번호가 보인다.
      requesterContactConsentAt: null,
      profileContactConsentAt: null,
    };
  }

  /* ---------- 찾기 · 인증 ---------- */
  const profileById = (id) => state.profiles.find((profile) => String(profile.id) === String(id)) || null;

  function authenticateProfile(nickname, pin) {
    const safeNickname = `${nickname ?? ""}`.trim().toLowerCase();
    const profile = state.profiles.find((item) => item.status === "ACTIVE" && item.nickname.toLowerCase() === safeNickname);
    if (!profile || profile.pin !== `${pin ?? ""}`.trim()) {
      throw httpError(401, "닉네임 또는 비밀번호가 올바르지 않습니다.");
    }
    return profile;
  }

  function requireAdmin(headers) {
    if ((headers.authorization || "") !== `Bearer ${DEMO_ADMIN_TOKEN}`) throw httpError(401, "로그인이 필요합니다.");
  }

  function findRequest(requestId) {
    const request = state.requests.find((item) => String(item.id) === String(requestId));
    if (!request) throw httpError(404, "데이트 신청을 찾을 수 없습니다.");
    return request;
  }

  function participatingRequest(requestId, profile) {
    const request = findRequest(requestId);
    if (request.profileId !== profile.id && request.requesterProfileId !== profile.id) {
      throw httpError(401, "이 데이트 신청에 접근할 수 없습니다.");
    }
    return request;
  }

  function findMeetupRequest(requestId) {
    const request = findRequest(requestId);
    if (!MATCHED.has(request.status)) throw httpError(409, "성사된 매치만 현장 처리할 수 있습니다.");
    return request;
  }

  /* ---------- 신청의 상태 ---------- */
  const stagesOf = (request, requesterSide) => (requesterSide ? request.requesterStages : request.profileStages);

  function escortStage(request, requesterSide) {
    const values = stagesOf(request, requesterSide);
    let stage = 0;
    values.forEach((value, index) => {
      if (value) stage = index + 1;
    });
    return ESCORT_STAGES[stage];
  }

  function escortStageAt(request, requesterSide) {
    const index = ESCORT_STAGES.indexOf(escortStage(request, requesterSide));
    return index > 0 ? stagesOf(request, requesterSide)[index - 1] : null;
  }

  // 그 단계까지 비어 있는 시각은 지금으로 채우고, 그 뒤 단계는 지운다. 한 칸 되돌리기도 같은 방식.
  function setEscortStage(request, requesterSide, stage) {
    const target = ESCORT_STAGES.indexOf(stage);
    const current = stagesOf(request, requesterSide);
    const now = stamp();
    const next = current.map((value, index) => (index < target ? value || now : null));
    if (requesterSide) request.requesterStages = next;
    else request.profileStages = next;
    request.updatedAt = now;
  }

  const bothAtBooth = (request) => Boolean(request.requesterStages[3] && request.profileStages[3]);

  function resetChat(request) {
    request.chatStartedAt = null;
    request.requesterReveal = null;
    request.profileReveal = null;
  }

  function clearEscort(request) {
    resetChat(request);
    request.requesterStages = [null, null, null, null];
    request.profileStages = [null, null, null, null];
    request.reminderSentAt = null;
  }

  function clearMeetup(request) {
    request.status = "ACCEPTED";
    request.statusReason = null;
    request.meetupPlace = null;
    request.meetupAt = null;
    request.meetupProposerProfileId = null;
    request.meetupProposerNickname = null;
    request.updatedAt = stamp();
  }

  function revealResult(request, now) {
    if (!request.chatStartedAt) return null;
    if (request.requesterReveal && request.profileReveal) {
      return request.requesterReveal === "YES" && request.profileReveal === "YES" ? "MATCH" : "NO_MATCH";
    }
    return now > parseStamp(request.chatStartedAt) + (CHAT_MINUTES + CHOOSE_MINUTES) * MINUTE ? "NO_MATCH" : null;
  }

  /** 채팅 단계: NONE(아직 안 열림) · OPEN · CHOOSING · MATCH · NO_MATCH · CLOSED(선택 전에 만남이 끝남). */
  function chatPhase(request, now = nowMs()) {
    if (!request.chatStartedAt) return "NONE";
    const endsAt = parseStamp(request.chatStartedAt) + CHAT_MINUTES * MINUTE;
    const result = revealResult(request, now);
    if (result && now >= endsAt) return result;
    if (request.meetupOutcome === "MET") return "CLOSED";
    return now < endsAt ? "OPEN" : "CHOOSING";
  }

  const connectionStatus = (request) => (MATCHED.has(request.status) ? request.connectionStatus || "WAITING" : "");

  /* ---------- 부스 시간표 ---------- */
  function purgeSlots() {
    const now = nowMs();
    state.slots = state.slots.filter((slot) => {
      if (!slot.confirmed && slot.heldUntil && slot.heldUntil < now) return false;
      const owner = state.requests.find((request) => request.id === slot.requestId);
      return owner && MATCHED.has(owner.status);
    });
  }

  const slotOf = (requestId) => state.slots.find((slot) => slot.requestId === requestId) || null;
  const isTooClose = (a, b) => Math.abs(a - b) <= PERSONAL_GAP_MINUTES * MINUTE;
  const upcomingDates = () => state.dates.filter((date) => date >= dayStart(nowMs()));
  const dateText = (ms) => stamp(ms).slice(0, 10);

  function resolveDate(text) {
    const wanted = state.dates.find((date) => dateText(date) === `${text ?? ""}`.trim());
    if (wanted != null) return wanted;
    return upcomingDates()[0] ?? state.dates[state.dates.length - 1];
  }

  function cells(date, busyTimes) {
    const now = nowMs();
    const out = [];
    for (let at = date + OPEN_HOUR * 60 * MINUTE; at < date + CLOSE_HOUR * 60 * MINUTE; at += SLOT_MINUTES * MINUTE) {
      const slot = state.slots.find((item) => item.slotAt === at) || null;
      let status;
      if (slot) status = slot.confirmed ? "TAKEN" : "HELD";
      else if (at < now) status = "PAST";
      else if (at < now + LEAD_MINUTES * MINUTE) status = "SOON";
      else if (busyTimes.some((busy) => isTooClose(at, busy))) status = "BUSY";
      else status = "FREE";
      out.push({ at, status, slot });
    }
    return out;
  }

  function dayCounts(busyTimes) {
    return upcomingDates().map((date) => {
      const list = cells(date, busyTimes);
      const count = (status) => list.filter((cell) => cell.status === status).length;
      return { date: dateText(date), totalSlots: list.length, freeSlots: count("FREE"), confirmedSlots: count("TAKEN"), heldSlots: count("HELD") };
    });
  }

  /** 이 신청의 두 사람이 다른 신청으로 잡아 둔(임시 포함) 약속 시각들. */
  function otherMeetupTimes(request) {
    const people = new Set([request.profileId, request.requesterProfileId]);
    const others = state.requests.filter(
      (other) => other.id !== request.id && (people.has(other.profileId) || people.has(other.requesterProfileId)),
    );
    return others.map((other) => slotOf(other.id)?.slotAt).filter((at) => at != null);
  }

  function holdSlot(request, slotAt) {
    if (!slotAt) throw httpError(400, "만날 시간을 선택해 주세요.");
    const date = dayStart(slotAt);
    if (!state.dates.includes(date)) throw httpError(400, "시간표에 있는 날짜의 시간만 고를 수 있어요.");
    const minutes = (slotAt - date) / MINUTE;
    if (minutes % SLOT_MINUTES !== 0 || minutes < OPEN_HOUR * 60 || minutes >= CLOSE_HOUR * 60) {
      throw httpError(400, "09:00부터 21:40까지 20분 단위 시간만 고를 수 있어요.");
    }
    const now = nowMs();
    if (slotAt < now) throw httpError(400, "지나간 시간은 고를 수 없어요.");
    if (slotAt < now + LEAD_MINUTES * MINUTE) throw httpError(400, `지금부터 ${LEAD_MINUTES}분 뒤 시간부터 고를 수 있어요.`);
    purgeSlots();
    state.slots = state.slots.filter((slot) => slot.requestId !== request.id);
    if (state.slots.some((slot) => slot.slotAt === slotAt)) {
      throw httpError(409, "방금 다른 커플이 먼저 잡은 시간이에요. 다른 시간을 골라 주세요.");
    }
    // 임시 잠금은 보통 30분. 약속이 가까우면 '약속 15분 전'까지만 기다린다.
    const heldUntil = Math.min(now + HOLD_MINUTES * MINUTE, slotAt - (LEAD_MINUTES / 2) * MINUTE);
    const slot = { slotAt, requestId: request.id, confirmed: false, heldUntil };
    state.slots.push(slot);
    return slot;
  }

  function expireStaleProposals() {
    purgeSlots();
    state.requests.filter((request) => request.status === "PROPOSED" && !slotOf(request.id)).forEach(clearMeetup);
  }

  /* ---------- 내보내는 모양 ---------- */
  function profileDto(profile, viewer, includeOriginal = false) {
    return {
      id: profile.id,
      nickname: profile.nickname,
      gender: profile.gender,
      intro: profile.intro,
      meetPlace: profile.meetPlace,
      originalImageUrl: includeOriginal ? profile.image : "",
      generatedImageUrl: profile.image,
      createdAt: profile.createdAt,
      saju: profile.saju,
      compatibility: viewer && viewer.id !== profile.id ? compatibilityOf(viewer, profile) : null,
    };
  }

  /** viewer 가 있고 둘 다 연락처 공유에 동의했을 때만 viewer 의 상대 번호를 싣는다(실제 서버와 같은 규칙). */
  function requestDto(request, viewer = null) {
    const profile = profileById(request.profileId);
    const requester = profileById(request.requesterProfileId);
    const places = waitingPlaces(requester, profile);
    const slot = request.status === "PROPOSED" ? slotOf(request.id) : null;
    const shared = Boolean(request.requesterContactConsentAt && request.profileContactConsentAt);
    const partnerOf = (me) => (me && requester && requester.id === me.id ? profile : requester);
    const sharedPhoneNumber = viewer && shared && MATCHED.has(request.status) ? partnerOf(viewer)?.phoneNumber ?? "" : "";
    return {
      id: request.id,
      profileId: profile?.id ?? null,
      profileNickname: profile?.nickname ?? "",
      profileOriginalImageUrl: "",
      profileImageUrl: profile?.image ?? "",
      requesterProfileId: requester?.id ?? null,
      requesterNickname: request.requesterNickname,
      requesterOriginalImageUrl: "",
      requesterImageUrl: requester?.image ?? "",
      meetPlace: request.meetPlace,
      message: request.message,
      status: request.status,
      statusReason: request.statusReason || "",
      meetupPlace: request.meetupPlace,
      meetupAt: request.meetupAt,
      meetupProposerProfileId: request.meetupProposerProfileId,
      meetupProposerNickname: request.meetupProposerNickname,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      meetupHeldUntil: slot?.heldUntil ? stamp(slot.heldUntil) : null,
      requesterWaitingPlace: places[0],
      profileWaitingPlace: places[1],
      requesterEscortStage: escortStage(request, true),
      requesterEscortStageAt: escortStageAt(request, true),
      profileEscortStage: escortStage(request, false),
      profileEscortStageAt: escortStageAt(request, false),
      meetupOutcome: request.meetupOutcome,
      chatPhase: chatPhase(request),
      requesterContactConsentAt: request.requesterContactConsentAt,
      profileContactConsentAt: request.profileContactConsentAt,
      sharedPhoneNumber,
    };
  }

  function adminRequestDto(request) {
    const profile = profileById(request.profileId);
    const requester = profileById(request.requesterProfileId);
    const places = waitingPlaces(requester, profile);
    return {
      id: request.id,
      profileId: profile?.id ?? null,
      profileNickname: profile?.nickname ?? "",
      profilePhoneNumber: profile?.phoneNumber ?? "",
      profileOriginalImageUrl: profile?.image ?? "",
      profileImageUrl: profile?.image ?? "",
      requesterProfileId: requester?.id ?? null,
      requesterNickname: request.requesterNickname,
      requesterPhoneNumber: requester?.phoneNumber ?? "",
      requesterOriginalImageUrl: requester?.image ?? "",
      requesterImageUrl: requester?.image ?? "",
      meetPlace: request.meetPlace,
      message: request.message,
      status: request.status,
      statusReason: request.statusReason || "",
      connectionStatus: connectionStatus(request),
      adminNote: request.adminNote || "",
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      meetupPlace: request.meetupPlace,
      meetupAt: request.meetupAt,
      requesterWaitingPlace: places[0],
      profileWaitingPlace: places[1],
      requesterArrivedAt: request.requesterStages[0],
      profileArrivedAt: request.profileStages[0],
      meetupOutcome: request.meetupOutcome,
      requesterContactConsentAt: request.requesterContactConsentAt,
      profileContactConsentAt: request.profileContactConsentAt,
    };
  }

  function adminProfileDto(profile, counts = {}) {
    return {
      id: profile.id,
      nickname: profile.nickname,
      gender: profile.gender,
      intro: profile.intro,
      meetPlace: profile.meetPlace,
      phoneNumber: profile.phoneNumber,
      originalImageUrl: profile.image,
      generatedImageUrl: profile.image,
      status: profile.status,
      receivedCount: counts.received || 0,
      sentCount: counts.sent || 0,
      pendingReceivedCount: counts.pendingReceived || 0,
      matchedCount: counts.matched || 0,
      createdAt: profile.createdAt,
      hidden: profile.hidden,
      hiddenReason: profile.hiddenReason,
      photoReview: profile.photoReview,
      openReportCount: state.reports.filter((report) => report.status === "OPEN" && report.targetProfileId === profile.id).length,
    };
  }

  const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id);

  function access(body, includeProfiles) {
    const profile = authenticateProfile(body?.nickname, body?.pin);
    expireStaleProposals();
    const received = state.requests.filter((request) => request.profileId === profile.id).sort(byNewest);
    const sent = state.requests.filter((request) => request.requesterProfileId === profile.id).sort(byNewest);
    const used = sent.filter((request) => request.statusReason !== "PROFILE_DELETED").length;
    return {
      profile: profileDto(profile, null, true),
      phoneNumber: profile.phoneNumber,
      phoneUsage: {
        phoneNumber: profile.phoneNumber.replace(/\D/g, ""),
        available: true,
        usedImageConversions: 1,
        remainingImageConversions: 1,
        message: "AI 변환 1회 남았습니다.",
      },
      receivedRequests: received.map((request) => requestDto(request, profile)),
      sentRequests: sent.map((request) => requestDto(request, profile)),
      profiles: includeProfiles
        ? state.profiles
            .filter((item) => item.status === "ACTIVE" && !item.hidden && item.id !== profile.id)
            .sort(byNewest)
            .map((item) => profileDto(item, profile))
        : null,
      favoriteProfileIds: [...(state.favorites.get(profile.id) || [])],
      requestQuota: { limit: MAX_SENT_REQUESTS, used, remaining: Math.max(0, MAX_SENT_REQUESTS - used) },
    };
  }

  /* ---------- 참가자가 하는 일 ---------- */
  function createRequest(profileId, body, role) {
    const profile = profileById(profileId);
    if (!profile || profile.status !== "ACTIVE") throw httpError(404, "존재하지 않는 프로필입니다.");
    const requester = authenticateProfile(body?.requesterNickname, body?.requesterPin);
    if (requester.id === profile.id) throw httpError(400, "자기 자신에게는 데이트 신청을 보낼 수 없습니다.");
    if (state.requests.some((item) => item.requesterProfileId === requester.id && item.profileId === profile.id && item.status === "PENDING")) {
      throw httpError(409, "이미 대기 중인 데이트 신청이 있습니다.");
    }
    const used = state.requests.filter((item) => item.requesterProfileId === requester.id && item.statusReason !== "PROFILE_DELETED").length;
    if (used >= MAX_SENT_REQUESTS) {
      throw httpError(409, `데이트 신청은 한 사람당 ${MAX_SENT_REQUESTS}번까지만 보낼 수 있어요. 이미 다 썼어요.`);
    }
    const meetPlace = `${body?.meetPlace ?? ""}`.trim();
    const message = `${body?.message ?? ""}`.trim();
    if (!meetPlace || !message) throw httpError(400, "만날 장소와 메시지를 적어 주세요.");
    const request = newRequest(state, profile, requester, meetPlace.slice(0, 120), message.slice(0, 500), nowMs());
    state.requests.push(request);
    emit({ type: "aim.request.created", role, request: adminRequestDto(request) });
    return requestDto(request);
  }

  function decideRequest(requestId, body, decision, role) {
    const profile = authenticateProfile(body?.nickname, body?.pin);
    const mine = decision === "cancel" ? "requesterProfileId" : "profileId";
    const request = state.requests.find((item) => String(item.id) === String(requestId) && item[mine] === profile.id);
    if (!request) throw httpError(404, decision === "cancel" ? "보낸 데이트 신청을 찾을 수 없습니다." : "데이트 신청을 찾을 수 없습니다.");
    if (request.status !== "PENDING") throw httpError(409, "이미 처리된 데이트 신청입니다.");
    request.statusReason = null;
    if (decision === "accept") {
      request.status = "ACCEPTED";
      request.connectionStatus = request.connectionStatus || "WAITING";
    } else if (decision === "reject") {
      request.status = "REJECTED";
    } else {
      request.status = "CANCELED";
      request.statusReason = "USER_CANCELED";
    }
    request.updatedAt = stamp();
    emit({ type: `aim.request.${decision === "accept" ? "accepted" : decision === "reject" ? "rejected" : "canceled"}`, role, request: adminRequestDto(request) });
    return requestDto(request);
  }

  function proposeMeetup(requestId, body, role) {
    const profile = authenticateProfile(body?.nickname, body?.pin);
    const request = participatingRequest(requestId, profile);
    if (request.status !== "ACCEPTED" && request.status !== "PROPOSED") throw httpError(409, "약속을 조율할 수 있는 상태가 아닙니다.");
    const counter = request.status === "PROPOSED" && request.meetupProposerProfileId != null && request.meetupProposerProfileId !== profile.id;
    const slotAt = parseStamp(body?.meetupAt);
    purgeSlots();
    if (slotAt && otherMeetupTimes(request).some((at) => isTooClose(at, slotAt))) throw httpError(409, NEARBY_MEETUP_MESSAGE);
    const slot = holdSlot(request, slotAt);
    // 장소는 늘 소개팅 부스.
    request.status = "PROPOSED";
    request.statusReason = null;
    request.connectionStatus = request.connectionStatus || "WAITING";
    request.meetupPlace = BOOTH_NAME;
    request.meetupAt = stamp(slotAt);
    request.meetupProposerProfileId = profile.id;
    request.meetupProposerNickname = profile.nickname;
    clearEscort(request);
    request.meetupOutcome = null;
    request.updatedAt = stamp();
    const holdMinutes = Math.max(1, Math.ceil((slot.heldUntil - nowMs()) / MINUTE));
    emit({ type: "aim.meetup.proposed", role, request: adminRequestDto(request), counter, holdMinutes, by: profile.nickname });
    return requestDto(request);
  }

  function confirmMeetup(requestId, body, role) {
    const profile = authenticateProfile(body?.nickname, body?.pin);
    const request = participatingRequest(requestId, profile);
    if (request.status !== "PROPOSED") throw httpError(409, "확정할 약속 제안이 없습니다.");
    if (request.meetupProposerProfileId === profile.id) throw httpError(409, "상대방이 제안한 약속만 확정할 수 있습니다.");
    purgeSlots();
    const meetupAt = parseStamp(request.meetupAt);
    if (meetupAt && otherMeetupTimes(request).some((at) => isTooClose(at, meetupAt))) {
      state.slots = state.slots.filter((slot) => slot.requestId !== request.id);
      clearMeetup(request);
      throw httpError(409, NEARBY_MEETUP_MESSAGE);
    }
    const slot = slotOf(request.id);
    if (!slot) {
      clearMeetup(request);
      throw httpError(409, "제안한 시간의 임시 예약이 풀렸어요. 시간을 다시 골라 주세요.");
    }
    slot.confirmed = true;
    slot.heldUntil = null;
    request.status = "CONFIRMED";
    request.statusReason = null;
    request.connectionStatus = request.connectionStatus || "COMPLETED";
    request.updatedAt = stamp();
    emit({ type: "aim.meetup.confirmed", role, request: adminRequestDto(request), by: profile.nickname });
    return requestDto(request);
  }

  function cancelMeetup(requestId, body, role) {
    const profile = authenticateProfile(body?.nickname, body?.pin);
    const request = participatingRequest(requestId, profile);
    if (request.status === "CONFIRMED") throw httpError(409, CONFIRMED_LOCKED_MESSAGE);
    if (request.status !== "PROPOSED") throw httpError(409, "취소할 약속이 없습니다.");
    const withdrawn = profile.id === request.meetupProposerProfileId;
    state.slots = state.slots.filter((slot) => slot.requestId !== request.id);
    clearMeetup(request);
    emit({ type: "aim.meetup.canceled", role, request: adminRequestDto(request), withdrawn, by: profile.nickname });
    return requestDto(request);
  }

  /** 부스 시간을 못 잡은 커플의 연락처 공유 동의. 둘 다 누르면 서로 번호가 보인다. 확정 약속이 있으면 막는다. */
  function consentContactShare(requestId, body, role) {
    const profile = authenticateProfile(body?.nickname, body?.pin);
    const request = participatingRequest(requestId, profile);
    if (!MATCHED.has(request.status)) throw httpError(409, "성사된 매치에서만 연락처를 주고받을 수 있어요.");
    if (request.status === "CONFIRMED") throw httpError(409, "부스 약속이 잡혀 있어요. 약속 시간에 부스에서 만나 주세요.");
    const requesterSide = request.requesterProfileId === profile.id;
    const key = requesterSide ? "requesterContactConsentAt" : "profileContactConsentAt";
    if (request[key]) return requestDto(request, profile);
    request[key] = stamp();
    request.updatedAt = stamp();
    const shared = Boolean(request.requesterContactConsentAt && request.profileContactConsentAt);
    emit({ type: "aim.contact.consented", role, request: adminRequestDto(request), by: profile.nickname, shared });
    return requestDto(request, profile);
  }

  /** 참가자가 대기 장소에 도착해 '도착했어요'를 누른다. 확정된 약속, 약속 1시간 전부터 30분 뒤까지. */
  function markSelfArrived(requestId, body, role) {
    const profile = authenticateProfile(body?.nickname, body?.pin);
    const request = participatingRequest(requestId, profile);
    if (request.status !== "CONFIRMED" || !request.meetupAt) throw httpError(409, "확정된 약속이 없습니다.");
    const now = nowMs();
    const meetupAt = parseStamp(request.meetupAt);
    if (now < meetupAt - SELF_ARRIVAL_OPEN_MINUTES * MINUTE) throw httpError(409, `약속 ${SELF_ARRIVAL_OPEN_MINUTES}분 전부터 누를 수 있어요.`);
    if (now > meetupAt + 30 * MINUTE) throw httpError(409, "약속 시간이 지났어요. 부스 스태프에게 알려 주세요.");
    const requesterSide = request.requesterProfileId === profile.id;
    if (escortStage(request, requesterSide) === "NONE") setEscortStage(request, requesterSide, "ARRIVED");
    emit({ type: "aim.arrived", role, request: adminRequestDto(request), by: profile.nickname, requesterSide });
    return requestDto(request);
  }

  function toggleFavorite(profileId, body) {
    const me = authenticateProfile(body?.nickname, body?.pin);
    const profile = profileById(profileId);
    if (!profile || profile.status !== "ACTIVE") throw httpError(404, "존재하지 않는 프로필입니다.");
    if (me.id === profile.id) throw httpError(400, "자기 자신은 좋아요할 수 없습니다.");
    if (!state.favorites.has(me.id)) state.favorites.set(me.id, new Set());
    const mine = state.favorites.get(me.id);
    const favorite = !mine.has(profile.id);
    if (favorite) mine.add(profile.id);
    else mine.delete(profile.id);
    return { profileId: profile.id, favorite, favoriteProfileIds: [...mine] };
  }

  const reportDto = (report) => ({ ...report });

  function createReport(profileId, body, role) {
    const reporter = authenticateProfile(body?.nickname, body?.pin);
    const target = profileById(profileId);
    if (!target) throw httpError(404, "존재하지 않는 프로필입니다.");
    if (reporter.id === target.id) throw httpError(400, "자기 자신은 신고할 수 없습니다.");
    const reason = `${body?.reason ?? ""}`.trim().toUpperCase();
    if (!REPORT_REASONS.has(reason)) throw httpError(400, "신고 사유를 골라 주세요.");
    if (state.reports.some((report) => report.reporterProfileId === reporter.id && report.targetProfileId === target.id && report.status === "OPEN")) {
      throw httpError(409, "이미 접수된 신고가 있어요. 운영진이 확인 중입니다.");
    }
    const report = {
      id: state.nextReportId,
      reporterProfileId: reporter.id,
      reporterNickname: reporter.nickname,
      targetProfileId: target.id,
      targetNickname: target.nickname,
      reason,
      detail: `${body?.detail ?? ""}`.trim().slice(0, 500),
      status: "OPEN",
      resolution: null,
      createdAt: stamp(),
      resolvedAt: null,
    };
    state.nextReportId += 1;
    state.reports.unshift(report);
    emit({ type: "aim.report.created", role, report: reportDto(report) });
    return reportDto(report);
  }

  /* ---------- 블라인드 채팅 ---------- */
  function topicsFor(request) {
    const introA = profileById(request.requesterProfileId)?.intro;
    const introB = profileById(request.profileId)?.intro;
    const shared = [...tagsOf(introA)].filter((tag) => tagsOf(introB).has(tag)).slice(0, 3);
    const topics = shared.map((tag, index) => ({ id: `t${index + 1}`, text: `둘 다 '${tag}'에 관심이 있네요. 요즘 제일 빠져 있는 건?` }));
    const mbtiA = mbtiOf(introA);
    const mbtiB = mbtiOf(introB);
    if (mbtiA && mbtiB) {
      topics.push({
        id: "m1",
        text: mbtiA === mbtiB ? `둘 다 MBTI가 ${mbtiA}네요. 어떤 점이 제일 닮았을까요?` : `MBTI가 ${mbtiA}와 ${mbtiB}예요. 서로 어떤 점이 다를 것 같나요?`,
      });
    }
    return [...topics, ...COMMON_TOPICS];
  }

  /** 참가자가 보는 단계. 약속이 풀렸으면(노쇼 등) CLOSED. */
  function viewerPhase(request) {
    if (request.status !== "CONFIRMED") return "CLOSED";
    const phase = chatPhase(request);
    return phase === "NONE" ? "WAITING" : phase;
  }

  function currentMessages(request, afterId) {
    if (!request.chatStartedAt) return [];
    return state.messages.filter((message) => message.requestId === request.id && message.id > afterId && message.createdAt >= request.chatStartedAt);
  }

  const messageDto = (message, viewerProfileId) => ({
    id: message.id,
    type: message.type,
    mine: message.senderProfileId === viewerProfileId,
    content: message.content,
    createdAt: message.createdAt,
  });

  function chatState(request, session, afterId, includeTopics) {
    const startedAt = request.chatStartedAt ? parseStamp(request.chatStartedAt) : 0;
    const partner = profileById(session.requesterSide ? request.profileId : request.requesterProfileId);
    const myReveal = session.requesterSide ? request.requesterReveal : request.profileReveal;
    return {
      requestId: request.id,
      phase: viewerPhase(request),
      serverNow: stamp(),
      startedAt: request.chatStartedAt,
      endsAt: startedAt ? stamp(startedAt + CHAT_MINUTES * MINUTE) : null,
      chooseUntil: startedAt ? stamp(startedAt + (CHAT_MINUTES + CHOOSE_MINUTES) * MINUTE) : null,
      partnerNickname: session.requesterSide ? partner?.nickname ?? "" : request.requesterNickname,
      partnerProfileId: partner?.id ?? null,
      myChoice: myReveal == null ? null : myReveal === "YES",
      messages: currentMessages(request, afterId).map((message) => messageDto(message, session.profileId)),
      topics: includeTopics ? topicsFor(request) : [],
    };
  }

  function requireSession(headers) {
    const session = state.sessions.get(`${headers["x-chat-token"] ?? ""}`.trim());
    if (!session) throw httpError(401, "채팅방에 다시 들어와 주세요.");
    return session;
  }

  function enterChat(requestId, body) {
    const profile = authenticateProfile(body?.nickname, body?.pin);
    const request = participatingRequest(requestId, profile);
    if (request.status !== "CONFIRMED" || !request.meetupAt) throw httpError(409, "확정된 약속이 있어야 채팅방에 들어갈 수 있어요.");
    const token = `chat-${request.id}-${profile.id}-${Math.random().toString(36).slice(2)}`;
    const session = { requestId: request.id, profileId: profile.id, requesterSide: request.requesterProfileId === profile.id };
    state.sessions.set(token, session);
    return { token, state: chatState(request, session, 0, true) };
  }

  function sendChat(headers, body, role) {
    const session = requireSession(headers);
    const request = findRequest(session.requestId);
    if (viewerPhase(request) !== "OPEN") throw httpError(409, "지금은 메시지를 보낼 수 없어요.");
    const topicId = `${body?.topicId ?? ""}`.trim();
    let type = "TEXT";
    let content;
    if (topicId) {
      const topic = topicsFor(request).find((item) => item.id === topicId);
      if (!topic) throw httpError(400, "없는 주제예요.");
      if (currentMessages(request, 0).some((message) => message.type === "TOPIC" && message.content === topic.text)) {
        throw httpError(409, "이미 나온 주제예요.");
      }
      type = "TOPIC";
      content = topic.text;
    } else {
      content = `${body?.content ?? ""}`.trim();
      if (!content) throw httpError(400, "보낼 말을 적어 주세요.");
      if (content.length > 300) throw httpError(400, "메시지는 300자까지 보낼 수 있어요.");
    }
    const message = { id: state.nextMessageId, requestId: request.id, senderProfileId: session.profileId, type, content, createdAt: stamp() };
    state.nextMessageId += 1;
    state.messages.push(message);
    emit({ type: "aim.chat.message", role, request: adminRequestDto(request), by: profileById(session.profileId)?.nickname, kind: type, count: currentMessages(request, 0).length });
    return messageDto(message, session.profileId);
  }

  /** 채팅이 끝난 뒤 얼굴 보기 선택. 한 번 고르면 바꿀 수 없다. */
  function chooseReveal(headers, body, role) {
    const session = requireSession(headers);
    if (typeof body?.reveal !== "boolean") throw httpError(400, "얼굴을 볼지 골라 주세요.");
    const request = findRequest(session.requestId);
    const phase = viewerPhase(request);
    if (phase === "OPEN" || phase === "WAITING") throw httpError(409, "채팅이 끝난 뒤에 고를 수 있어요.");
    if (phase !== "CHOOSING") throw httpError(409, "선택 시간이 끝났어요.");
    const key = session.requesterSide ? "requesterReveal" : "profileReveal";
    if (request[key] != null) throw httpError(409, "이미 골랐어요.");
    request[key] = body.reveal ? "YES" : "NO";
    request.updatedAt = stamp();
    emit({
      type: "aim.chat.choice",
      role,
      request: adminRequestDto(request),
      by: profileById(session.profileId)?.nickname,
      result: request.requesterReveal && request.profileReveal ? chatPhase(request) : null,
    });
    return chatState(request, session, 0, false);
  }

  /* ---------- 운영진이 하는 일 ---------- */
  function overview() {
    expireStaleProposals();
    const requests = [...state.requests].sort(byNewest);
    const counts = new Map(state.profiles.map((profile) => [profile.id, { received: 0, sent: 0, pendingReceived: 0, matched: 0 }]));
    requests.forEach((request) => {
      const target = counts.get(request.profileId);
      const requester = counts.get(request.requesterProfileId);
      if (target) target.received += 1;
      if (requester) requester.sent += 1;
      if (request.status === "PENDING" && target) target.pendingReceived += 1;
      if (MATCHED.has(request.status)) {
        if (target) target.matched += 1;
        if (requester) requester.matched += 1;
      }
    });
    const active = state.profiles.filter((profile) => profile.status === "ACTIVE");
    return {
      activeProfileCount: active.length,
      totalProfileCount: state.profiles.length,
      totalRequestCount: requests.length,
      pendingRequestCount: requests.filter((request) => request.status === "PENDING").length,
      matchedRequestCount: requests.filter((request) => MATCHED.has(request.status)).length,
      registrationOpen: state.registrationOpen !== false,
      profiles: [...state.profiles].sort(byNewest).map((profile) => adminProfileDto(profile, counts.get(profile.id))),
      requests: requests.map(adminRequestDto),
      reports: state.reports.map(reportDto),
      openReportCount: state.reports.filter((report) => report.status === "OPEN").length,
      pendingPhotoReviewCount: active.filter((profile) => profile.photoReview === "PENDING").length,
    };
  }

  function masterSummary() {
    const now = nowMs();
    const withMeetup = state.requests.filter((request) => request.meetupAt && MATCHED.has(request.status));
    const next = withMeetup
      .filter((request) => parseStamp(request.meetupAt) + SLOT_MINUTES * MINUTE >= now)
      .sort((a, b) => (a.meetupAt < b.meetupAt ? -1 : 1))[0];
    const active = state.profiles.filter((profile) => profile.status === "ACTIVE");
    return {
      activeProfileCount: active.length,
      matchedCount: state.requests.filter((request) => MATCHED.has(request.status)).length,
      pendingRequestCount: state.requests.filter((request) => request.status === "PENDING").length,
      openReportCount: state.reports.filter((report) => report.status === "OPEN").length,
      pendingPhotoReviewCount: active.filter((profile) => profile.photoReview === "PENDING").length,
      meetupsToday: withMeetup.filter((request) => request.meetupAt.slice(0, 10) === stamp().slice(0, 10)).length,
      nextMeetupAt: next?.meetupAt ?? null,
      nextMeetupPair: next ? `${next.requesterNickname} · ${profileById(next.profileId)?.nickname ?? ""}` : "",
    };
  }

  function schedule(text) {
    purgeSlots();
    const date = resolveDate(text);
    const items = state.slots
      .filter((slot) => dayStart(slot.slotAt) === date)
      .sort((a, b) => a.slotAt - b.slotAt)
      .map((slot) => {
        const request = state.requests.find((item) => item.id === slot.requestId);
        if (!request) return null;
        const profile = profileById(request.profileId);
        const requester = profileById(request.requesterProfileId);
        const places = waitingPlaces(requester, profile);
        return {
          slotAt: stamp(slot.slotAt),
          confirmed: slot.confirmed,
          heldUntil: slot.heldUntil ? stamp(slot.heldUntil) : null,
          requestId: request.id,
          connectionStatus: connectionStatus(request),
          requesterNickname: request.requesterNickname,
          requesterGender: requester?.gender ?? "",
          requesterPhoneNumber: requester?.phoneNumber ?? "",
          requesterWaitingPlace: places[0],
          profileNickname: profile?.nickname ?? "",
          profileGender: profile?.gender ?? "",
          profilePhoneNumber: profile?.phoneNumber ?? "",
          profileWaitingPlace: places[1],
          requesterArrivedAt: request.requesterStages[0],
          profileArrivedAt: request.profileStages[0],
          meetupOutcome: request.meetupOutcome,
          requesterEscortStage: escortStage(request, true),
          requesterEscortStageAt: escortStageAt(request, true),
          profileEscortStage: escortStage(request, false),
          profileEscortStageAt: escortStageAt(request, false),
          reminderSentAt: request.reminderSentAt,
          chatPhase: chatPhase(request),
          chatEndsAt: request.chatStartedAt ? stamp(parseStamp(request.chatStartedAt) + CHAT_MINUTES * MINUTE) : null,
        };
      })
      .filter(Boolean);
    return {
      date: dateText(date),
      dates: state.dates.map(dateText),
      boothName: BOOTH_NAME,
      totalSlots: ((CLOSE_HOUR - OPEN_HOUR) * 60) / SLOT_MINUTES,
      slotMinutes: SLOT_MINUTES,
      // 한눈에 표가 줄을 만들 때 쓰는 여는 시각 · 마지막 칸 시각(연습 화면은 날마다 같다)
      openTime: `${String(OPEN_HOUR).padStart(2, "0")}:00`,
      lastSlotTime: `${String(CLOSE_HOUR - 1).padStart(2, "0")}:${String(60 - SLOT_MINUTES).padStart(2, "0")}`,
      serverNow: stamp(),
      items,
      days: dayCounts([]),
    };
  }

  function sideOf(body, message) {
    const side = `${body?.side ?? ""}`.trim().toUpperCase();
    if (side !== "REQUESTER" && side !== "PROFILE") throw httpError(400, message);
    return side === "REQUESTER";
  }

  function adminEscort(requestId, body, role) {
    const request = findMeetupRequest(requestId);
    if (!request.meetupAt) throw httpError(409, "잡힌 약속이 없습니다.");
    const requesterSide = sideOf(body, "누구의 단계인지 골라 주세요.");
    const stage = `${body?.stage ?? ""}`.trim().toUpperCase();
    if (!ESCORT_STAGES.includes(stage)) throw httpError(400, "알 수 없는 단계입니다.");
    const before = escortStage(request, requesterSide);
    // 화면이 본 단계와 지금 단계가 다르면 다른 스태프가 먼저 바꾼 것이다(실제 서버와 같다).
    const fromStage = `${body?.fromStage ?? ""}`.trim().toUpperCase();
    if (fromStage && fromStage !== before) {
      throw httpError(409, "다른 스태프가 방금 이 사람의 단계를 바꿨어요. 화면을 새로 읽었으니 다시 확인해 주세요.");
    }
    setEscortStage(request, requesterSide, stage);
    // 채팅을 시작해 놓고 '부스 도착'을 되돌린 경우(잘못 누름), 아직 아무 말도 선택도 없으면 채팅을 다시 닫아 시간을 돌려준다.
    if (
      !bothAtBooth(request) &&
      request.chatStartedAt &&
      !request.requesterReveal &&
      !request.profileReveal &&
      !currentMessages(request, 0).some((message) => message.type === "TEXT")
    ) {
      resetChat(request);
    }
    emit({
      type: "aim.escort",
      role,
      request: adminRequestDto(request),
      requesterSide,
      stage,
      before,
      nickname: requesterSide ? request.requesterNickname : profileById(request.profileId)?.nickname,
      bothAtBooth: bothAtBooth(request),
    });
    return adminRequestDto(request);
  }

  function adminArrival(requestId, body, role) {
    const request = findMeetupRequest(requestId);
    const requesterSide = sideOf(body, "누가 도착했는지 골라 주세요.");
    if (body?.arrived) {
      if (escortStage(request, requesterSide) === "NONE") setEscortStage(request, requesterSide, "ARRIVED");
    } else {
      setEscortStage(request, requesterSide, "NONE");
    }
    emit({ type: "aim.escort", role, request: adminRequestDto(request), requesterSide, stage: escortStage(request, requesterSide), nickname: requesterSide ? request.requesterNickname : profileById(request.profileId)?.nickname, bothAtBooth: bothAtBooth(request) });
    return adminRequestDto(request);
  }

  /** 두 사람이 모두 부스에 도착해 있어야 하고, 누르는 순간 채팅 시간이 흐르기 시작한다. 두 번 눌러도 다시 시작되지 않는다. */
  function startChat(requestId, role) {
    const request = findMeetupRequest(requestId);
    if (request.status !== "CONFIRMED" || !request.meetupAt) throw httpError(409, "확정된 약속이 없습니다.");
    if (!bothAtBooth(request)) throw httpError(409, "두 사람이 모두 부스에 도착한 뒤에 시작할 수 있어요.");
    if (!request.chatStartedAt) {
      request.chatStartedAt = stamp();
      request.updatedAt = request.chatStartedAt;
    }
    emit({ type: "aim.chat.started", role, request: adminRequestDto(request) });
    return adminRequestDto(request);
  }

  function markMet(requestId, role) {
    const request = findMeetupRequest(requestId);
    const phase = chatPhase(request);
    if (phase !== "MATCH" && phase !== "NO_MATCH") {
      throw httpError(409, "만남 완료는 채팅이 끝나 얼굴 보기 결과가 나온 뒤에 누를 수 있어요.");
    }
    const now = stamp();
    request.requesterStages[0] = request.requesterStages[0] || now;
    request.profileStages[0] = request.profileStages[0] || now;
    request.meetupOutcome = "MET";
    request.connectionStatus = "COMPLETED";
    request.updatedAt = now;
    emit({ type: "aim.met", role, request: adminRequestDto(request) });
    return adminRequestDto(request);
  }

  /** 노쇼 처리. 슬롯을 바로 반납해 다음 쌍이 쓸 수 있게 하고, 매칭은 남겨 둔다. */
  function markNoShow(requestId, body, role) {
    const request = findMeetupRequest(requestId);
    const side = `${body?.side ?? "BOTH"}`.trim().toUpperCase();
    const outcome = { REQUESTER: "NO_SHOW_REQUESTER", PROFILE: "NO_SHOW_PROFILE", BOTH: "NO_SHOW_BOTH" }[side];
    if (!outcome) throw httpError(400, "누가 안 왔는지 골라 주세요.");
    if (request.chatStartedAt || request.meetupOutcome === "MET") {
      throw httpError(409, "채팅을 시작한 커플은 노쇼로 처리할 수 없어요. 두 사람 모두 온 약속이에요.");
    }
    const wasConfirmed = request.status === "CONFIRMED";
    state.slots = state.slots.filter((slot) => slot.requestId !== request.id);
    request.meetupOutcome = outcome;
    clearMeetup(request);
    clearEscort(request);
    emit({ type: "aim.noshow", role, request: adminRequestDto(request), side, wasConfirmed, profileNickname: profileById(request.profileId)?.nickname });
    return adminRequestDto(request);
  }

  function updateConnection(requestId, body) {
    const request = findRequest(requestId);
    if (!MATCHED.has(request.status)) throw httpError(409, "성사된 매치만 연결 상태를 변경할 수 있습니다.");
    const next = `${body?.connectionStatus ?? ""}`.trim().toUpperCase();
    if (!["WAITING", "COMPLETED", "FAILED"].includes(next)) throw httpError(400, "연결 상태가 올바르지 않습니다.");
    request.connectionStatus = next;
    request.updatedAt = stamp();
    return adminRequestDto(request);
  }

  function updateNote(requestId, body) {
    const request = findRequest(requestId);
    if (!MATCHED.has(request.status)) throw httpError(409, "성사된 매치만 관리자 메모를 남길 수 있습니다.");
    request.adminNote = `${body?.adminNote ?? ""}`.trim().slice(0, 1000);
    request.updatedAt = stamp();
    return adminRequestDto(request);
  }

  function setHidden(profileId, body, role) {
    const profile = profileById(profileId);
    if (!profile) throw httpError(404, "AI match profile not found.");
    profile.hidden = Boolean(body?.hidden);
    profile.hiddenReason = profile.hidden ? `${body?.reason ?? ""}`.trim().slice(0, 200) || null : null;
    emit({ type: "aim.profile.hidden", role, nickname: profile.nickname, hidden: profile.hidden });
    return adminProfileDto(profile);
  }

  function reviewPhoto(profileId, body, role) {
    const profile = profileById(profileId);
    if (!profile) throw httpError(404, "AI match profile not found.");
    const decision = `${body?.decision ?? ""}`.trim().toUpperCase();
    if (decision === "APPROVED") {
      profile.photoReview = "APPROVED";
      if (profile.hidden && `${profile.hiddenReason ?? ""}`.startsWith("사진 반려")) {
        profile.hidden = false;
        profile.hiddenReason = null;
      }
    } else if (decision === "REJECTED") {
      const reason = `${body?.reason ?? ""}`.trim().slice(0, 150);
      profile.photoReview = "REJECTED";
      profile.hidden = true;
      profile.hiddenReason = `사진 반려${reason ? ` · ${reason}` : ""}`;
    } else {
      throw httpError(400, "승인 또는 반려만 고를 수 있습니다.");
    }
    emit({ type: "aim.photo.reviewed", role, nickname: profile.nickname, decision });
    return adminProfileDto(profile);
  }

  function resolveReport(reportId, body, role) {
    const report = state.reports.find((item) => String(item.id) === String(reportId));
    if (!report) throw httpError(404, "신고를 찾을 수 없습니다.");
    const action = `${body?.action ?? "DISMISS"}`.trim().toUpperCase();
    const note = `${body?.note ?? ""}`.trim().slice(0, 200);
    const target = profileById(report.targetProfileId);
    if (action === "HIDE" && target) {
      target.hidden = true;
      target.hiddenReason = note || "신고 처리";
    } else if (action === "DELETE") {
      throw httpError(400, "연습 화면에서는 계정을 지울 수 없어요.");
    } else if (action !== "DISMISS") {
      throw httpError(400, "처리 방법이 올바르지 않습니다.");
    }
    report.status = "RESOLVED";
    report.resolution = `${action}${note ? ` · ${note}` : ""}`;
    report.resolvedAt = stamp();
    emit({ type: "aim.report.resolved", role, report: reportDto(report), action });
    return reportDto(report);
  }

  /* ---------- 길 찾기 ---------- */
  function route(method, path, query, body, headers, role) {
    let match;
    if (method === "POST" && path === "/auth/login") {
      if (!`${body?.username ?? ""}`.trim() || !`${body?.password ?? ""}`.trim()) throw httpError(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
      // 연습 화면이라 어떤 아이디로도 들어간다.
      return { token: DEMO_ADMIN_TOKEN, username: `${body.username}`.trim() };
    }

    if (path.startsWith("/admin/ai-match")) {
      requireAdmin(headers);
      const rest = path.slice("/admin/ai-match".length);
      if (method === "GET" && rest === "/overview") return overview();
      if (method === "PUT" && rest === "/registration") {
        state.registrationOpen = body?.open !== false;
        emit({ type: "aim.registration", role, open: state.registrationOpen });
        return { registrationOpen: state.registrationOpen, registrationClosedMessage: state.registrationOpen ? "" : REGISTRATION_CLOSED_MESSAGE };
      }
      if (method === "GET" && rest === "/summary") return masterSummary();
      if (method === "GET" && rest === "/meetup-schedule") return schedule(query.get("date"));
      match = rest.match(/^\/requests\/(\d+)\/([a-z-]+(?:\/start)?)$/);
      if (match) {
        const [, id, action] = match;
        if (method === "PUT" && action === "connection-status") return updateConnection(id, body);
        if (method === "PUT" && action === "admin-note") return updateNote(id, body);
        if (method === "PUT" && action === "escort") return adminEscort(id, body, role);
        if (method === "PUT" && action === "arrival") return adminArrival(id, body, role);
        if (method === "POST" && action === "chat/start") return startChat(id, role);
        if (method === "POST" && action === "met") return markMet(id, role);
        if (method === "POST" && action === "no-show") return markNoShow(id, body, role);
        if (method === "GET" && action === "chat") {
          const request = findRequest(id);
          return state.messages
            .filter((message) => message.requestId === request.id)
            .map((message) => ({
              id: message.id,
              senderNickname: profileById(message.senderProfileId)?.nickname ?? "?",
              type: message.type,
              content: message.content,
              createdAt: message.createdAt,
            }));
        }
      }
      match = rest.match(/^\/profiles\/(\d+)\/(hidden|photo-review)$/);
      if (method === "PUT" && match) return match[2] === "hidden" ? setHidden(match[1], body, role) : reviewPhoto(match[1], body, role);
      match = rest.match(/^\/reports\/(\d+)\/resolve$/);
      if (method === "PUT" && match) return resolveReport(match[1], body, role);
      throw httpError(400, "연습 화면에서는 쓸 수 없는 기능이에요. (삭제 · 초기화 · 내려받기)");
    }

    if (!path.startsWith("/ai-match")) return NOT_HANDLED;
    const rest = path.slice("/ai-match".length);
    if (method === "GET" && rest === "/status") {
      return { registrationOpen: state.registrationOpen !== false, registrationClosedMessage: state.registrationOpen === false ? REGISTRATION_CLOSED_MESSAGE : "" };
    }
    if (method === "POST" && rest === "/profiles/access") return access(body, true);
    if (method === "POST" && rest === "/profiles/inbox") return access(body, false);
    if (method === "GET" && rest === "/meetup-slots") {
      purgeSlots();
      const requestId = query.get("requestId");
      const request = requestId ? state.requests.find((item) => String(item.id) === requestId) : null;
      const busy = request ? otherMeetupTimes(request) : [];
      const date = resolveDate(query.get("date"));
      return {
        date: dateText(date),
        dates: (upcomingDates().length ? upcomingDates() : state.dates).map(dateText),
        slotMinutes: SLOT_MINUTES,
        holdMinutes: HOLD_MINUTES,
        boothName: BOOTH_NAME,
        slots: cells(date, busy).map((cell) => ({
          startAt: stamp(cell.at),
          status: cell.status,
          mine: Boolean(cell.slot && request && cell.slot.requestId === request.id),
        })),
        leadMinutes: LEAD_MINUTES,
        days: dayCounts(busy),
      };
    }
    match = rest.match(/^\/profiles\/(\d+)\/(requests|favorite|report)$/);
    if (method === "POST" && match) {
      if (match[2] === "requests") return createRequest(match[1], body, role);
      if (match[2] === "favorite") return toggleFavorite(match[1], body);
      return createReport(match[1], body, role);
    }
    match = rest.match(/^\/requests\/(\d+)\/(accept|reject|cancel)$/);
    if (method === "POST" && match) return decideRequest(match[1], body, match[2], role);
    match = rest.match(/^\/requests\/(\d+)\/meetup\/(propose|confirm|cancel|arrived)$/);
    if (method === "POST" && match) {
      const action = { propose: proposeMeetup, confirm: confirmMeetup, cancel: cancelMeetup, arrived: markSelfArrived }[match[2]];
      return action(match[1], body, role);
    }
    match = rest.match(/^\/requests\/(\d+)\/contact\/consent$/);
    if (method === "POST" && match) return consentContactShare(match[1], body, role);
    match = rest.match(/^\/requests\/(\d+)\/chat\/enter$/);
    if (method === "POST" && match) return enterChat(match[1], body);
    if (method === "GET" && rest === "/chat/state") {
      const session = requireSession(headers);
      const afterId = Math.max(0, Number(query.get("afterId")) || 0);
      return chatState(findRequest(session.requestId), session, afterId, afterId === 0);
    }
    if (method === "POST" && rest === "/chat/messages") return sendChat(headers, body, role);
    if (method === "POST" && rest === "/chat/choice") return chooseReveal(headers, body, role);
    throw httpError(400, "연습 화면에서는 쓸 수 없는 기능이에요. (가입 · 프로필 수정 · 삭제)");
  }

  /* ---------- 매뉴얼 화면의 '건너뛰기' ---------- */
  function act(name, payload) {
    const request = state.requests.find((item) => item.id === payload?.requestId);
    if (!request) return;
    if (name === "skipToMeetup" && request.meetupAt) {
      // 약속 10분 전으로. 이미 지났으면 그대로 둔다.
      const target = parseStamp(request.meetupAt) - 10 * MINUTE;
      if (target > nowMs()) clock.offset += target - nowMs();
      emit({ type: "aim.clock", reason: "meetup", request: adminRequestDto(request), now: stamp() });
    }
    if (name === "skipChat" && request.chatStartedAt) {
      const target = parseStamp(request.chatStartedAt) + CHAT_MINUTES * MINUTE + 1000;
      if (target > nowMs()) clock.offset += target - nowMs();
      emit({ type: "aim.clock", reason: "chat", request: adminRequestDto(request), now: stamp() });
    }
  }

  state = initialState();

  return {
    route,
    act,
    snapshot() {
      return {
        now: stamp(),
        nowMs: nowMs(),
        profiles: state.profiles.map((profile) => ({ id: profile.id, nickname: profile.nickname })),
        requests: state.requests.map((request) => ({
          ...adminRequestDto(request),
          requesterEscortStage: escortStage(request, true),
          profileEscortStage: escortStage(request, false),
          chatPhase: chatPhase(request),
          chatStartedAt: request.chatStartedAt,
          requesterReveal: request.requesterReveal,
          profileReveal: request.profileReveal,
          meetupProposerProfileId: request.meetupProposerProfileId,
          messageCount: currentMessages(request, 0).length,
        })),
      };
    },
    reset() {
      state = initialState();
    },
  };
}
