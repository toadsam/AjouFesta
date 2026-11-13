import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const LANGUAGE_STORAGE_KEY = "festflow_language";

const KO_TO_EN = {
  "야외 모드": "Outdoor",
  "기본 모드": "Default",
  "홈으로 이동": "Go home",
  "홈으로 돌아가기": "Back to home",
  "Festival Control Interface": "Festival Control Interface",
  "아주대학교 축제 메인": "Ajou University Festival Main",
  "지금 축제를 바로 즐겨보세요": "Start enjoying the festival now",
  "곧 시작하는 공연 정보를 확인해보세요.": "Check the upcoming stage schedule.",
  "노천극장 인원 보기": "Stage Crowd",
  "공연 일정 보기": "Schedule",
  "지금 덜 붐비는 추천 부스": "Less Crowded Booths",
  "전체 보기": "View All",
  "실시간 운영 안내": "Live Operations Notice",
  "현재 등록된 운영 공지가 없습니다.": "No active operation notices.",
  "기준 위치": "Base location",
  "동시 보기": "Split View",
  "부스 목록": "Booth List",
  "내 위치로 가기": "My Location",
  "위치 찾는 중...": "Locating...",
  "빠른 부스 이동": "Quick Booth Jump",
  "전체 목록 보기": "Full List",
  "지도 아래 부스 리스트": "Booth List Below Map",
  "전체 목록으로": "Full List",
  "내 위치 전송": "Send My Location",
  "GPS 전송 중...": "Sending GPS...",
  "가로 카드 보기": "Horizontal Cards",
  "세로 카드 보기": "Vertical Cards",
  "부스 CSV": "Booth CSV",
  "좋아요만 보는 중": "Favorites Only",
  "좋아요만 보기": "Favorites Only",
  "필터 초기화": "Reset Filters",
  "부스 이름 검색": "Search booth name",
  "전체 유형": "All Types",
  "전체 시간대": "All Time",
  "운영중": "Open Now",
  "운영순": "Operation Order",
  "이름순": "Name",
  "혼잡도순": "Crowding",
  "혼잡도 요약": "Crowding Summary",
  "최근 본 부스": "Recently Viewed Booths",
  "부스와 혼잡도 데이터를 불러오는 중...": "Loading booths and crowding data...",
  "검색 조건에 맞는 부스가 없습니다. 지도 보기 탭에서 GPS를 전송하면 실시간 데이터가 더 정확해집니다.": "No booths match your filters. Send GPS from the map view for more accurate live data.",
  "자세히 보기": "View Details",
  "즐겨찾기": "Favorite",
  "운영전/종료": "Not Open / Closed",
  "시간 미정": "Time TBD",
  "집계중": "Collecting",
  "예약 없이 현장 이용": "Walk-in only",
  "예약/웨이팅 가능": "Reservation / Waiting Available",
  "예약 없음": "No Reservation",
  "예약 시작": "Start Reservation",
  "부스 소개": "Booth Info",
  "메뉴판": "Menu",
  "예약": "Reservation",
  "접기": "Collapse",
  "펼치기": "Expand",
  "대기": "Wait",
  "재고": "Stock",
  "메모": "Memo",
  "없음": "None",
  "최대 예약 유지 시간": "Reservation hold time",
  "인증": "Verify",
  "테이블": "Table",
  "테이블을 누르기 전에 전화번호 인증을 완료해야 예약이 가능합니다.": "Verify your phone before selecting a table.",
  "전화번호 인증": "Phone Verification",
  "전화번호 입력 (예: 01012345678)": "Phone number (ex. 01012345678)",
  "인증번호 6자리": "6-digit code",
  "인증 확인": "Verify Code",
  "인증번호 받기": "Send Code",
  "인증된 번호": "Verified Number",
  "인증 해제": "Clear Verification",
  "예약 제한 중": "Reservation Blocked",
  "노쇼 횟수": "No-show Count",
  "현재 활성 예약": "Active Reservation",
  "좌석": "Seats",
  "남은 시간": "Time Left",
  "체크인 QR 생성": "Generate Check-in QR",
  "QR 만료까지": "QR Expires In",
  "예약불가": "Unavailable",
  "인증 필요": "Verification Required",
  "예약가능": "Available",
  "테이블이 아직 설정되지 않았습니다.": "Tables are not configured yet.",
  "예약하기": "Reserve",
  "예약 중...": "Reserving...",
  "인증이 끝나면 테이블 선택 시 예약 확인 모달이 열립니다.": "After verification, selecting a table opens the confirmation modal.",
  "요청 좌석 수가 남은 좌석보다 많습니다.": "Requested seats exceed available seats.",
  "혼잡도 새로고침": "Refresh Crowding",
  "부스 관리자 로그인": "Booth Manager Login",
  "운영 키 입력": "Enter Ops Key",
  "로그인": "Log In",
  "예약하시겠습니까?": "Confirm Reservation?",
  "예약 좌석": "Reserved Seats",
  "남은 좌석": "Seats Left",
  "취소": "Cancel",
  "처리 중...": "Processing...",
  "전화번호 인증하고 예약하기": "Verify Phone and Reserve",
  "테이블 선택하고 예약하기": "Select Table and Reserve",
  "LIVE LINEUP": "LIVE LINEUP",
  "라인업 보기": "Lineup",
  "예정": "Scheduled",
  "대기중": "Waiting",
  "곧 시작": "Starting Soon",
  "진행중": "Live",
  "종료": "Ended",
  "지연": "Delayed",
  "취소": "Canceled",
  "선택한 상태의 공연이 없습니다. 관리자에서 공연을 등록하거나, 잠시 후 새로고침해 주세요.": "No events match this status. Add events in admin or refresh later.",
  "공연 목록을 불러오지 못했습니다.": "Could not load events.",
  "공연 CSV": "Event CSV",
  "노천극장 실시간 인원": "Live Stage Crowd",
  "최근": "Last",
  "분 기준 군중 밀집도를 시각화합니다.": "minutes crowd density visualization.",
  "새로고침": "Refresh",
  "현재 추정 인원": "Estimated Crowd",
  "혼잡도": "Crowding",
  "업데이트": "Updated",
  "최근 5분": "Last 5 min",
  "최근 10분": "Last 10 min",
  "최근 15분": "Last 15 min",
  "노천극장 혼잡 게이지": "Stage Crowd Gauge",
  "기준 수용치": "Capacity Basis",
  "대비": "vs",
  "노천극장 데이터를 불러오는 중...": "Loading stage crowd data...",
  "무대 혼잡 데이터를 불러오지 못했습니다.": "Could not load stage crowd data.",
  "데이터 분석 대시보드": "Data Analytics Dashboard",
  "방문량 흐름, 인기 부스, 혼잡 포인트를 한 화면에서 확인합니다.": "Track traffic, popular booths, and crowding hotspots in one view.",
  "총 방문 집계": "Total Visits",
  "현재 1위 부스": "Top Booth",
  "최고 강도 포인트": "Highest Intensity",
  "시간대별 방문량 (최근 24시간)": "Hourly Visits (Last 24h)",
  "집계 데이터가 없습니다. 홈에서 GPS를 전송해 보세요.": "No analytics data yet. Send GPS from Home.",
  "인기 부스 랭킹 (최근 1시간)": "Popular Booth Ranking (Last 1h)",
  "혼잡 히트맵 포인트 (최근 1시간)": "Crowding Heatmap Points (Last 1h)",
  "분실물 센터": "Lost & Found",
  "분실물 사진 확인 후 내 물건 표시가 가능합니다. 연락처가 등록된 물품은 바로 연락할 수 있습니다.": "Check lost item photos, mark an item as yours, and contact staff when contact info is available.",
  "분실물명, 위치, 설명으로 검색": "Search by item, location, or description",
  "전체": "All",
  "보관 중": "Stored",
  "주인 확인": "Owner Claimed",
  "반환 완료": "Returned",
  "검색 결과": "Search Results",
  "전체 물품": "All Items",
  "사진 확인 후 내 물건 표시를 누르면 스태프가 소유 확인을 진행합니다.": "After checking the photo, mark it as yours so staff can verify ownership.",
  "조건에 맞는 분실물이 없습니다.": "No lost items match your filters.",
  "현장 AI 도우미": "Festival AI Assistant",
  "예: 지금 빨리 먹을 수 있는 곳": "Ex: Where can I eat quickly now?",
  "지금 추천": "Recommend Now",
  "빠른 식사": "Quick Meal",
  "혼잡 회피": "Avoid Crowds",
  "분실물": "Lost Item",
  "다음 공연": "Next Event",
  "예약 가능": "Reservation Available",
  "카테고리별 바로 조회": "Quick Category Search",
  "지금 필요한 상황을 선택하거나 바로 질문해 주세요.": "Choose a situation or ask directly.",
  "근거 0개 · 신뢰도 낮음": "0 evidence · low confidence",
  "더 가까운 곳": "Closer",
  "대기 더 짧게": "Shorter Wait",
  "혼잡도 낮은 대안": "Less Crowded Alternative",
  "스태프 전용 관제 페이지": "Staff Control Page",
  "배정받은 스태프 번호 + PIN으로 로그인하세요.": "Log in with assigned staff number and PIN.",
  "스태프 번호": "Staff Number",
  "4자리 PIN": "4-digit PIN",
  "스태프 페이지 입장": "Enter Staff Page",
  "관리자 로그인": "Admin Login",
  "아이디": "Username",
  "비밀번호": "Password",
  "통합 운영 콘솔": "Master Ops Console",
  "적용": "Apply",
  "초기화": "Reset",
  "운영 키를 입력해 주세요.": "Enter an ops key.",
  "부스 번호": "Booth Number",
  "서버에 연결할 수 없습니다. 네트워크 상태 또는 운영 서버 연결을 확인해 주세요.": "Cannot connect to the server. Check your network or backend URL.",
  "Failed to fetch": "Cannot connect to the server.",
};

const PLACEHOLDER_ATTRS = ["placeholder", "aria-label", "title", "alt"];
const textOriginals = new WeakMap();
const attrOriginals = new WeakMap();
const LanguageContext = createContext(null);

function normalize(value) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function preserveWhitespace(original, translated) {
  const prefix = original.match(/^\s*/)?.[0] || "";
  const suffix = original.match(/\s*$/)?.[0] || "";
  return `${prefix}${translated}${suffix}`;
}

export function translateText(value, language) {
  if (language !== "en") return value;

  const source = `${value || ""}`;
  const normalized = normalize(source);
  if (!normalized) return source;

  if (KO_TO_EN[normalized]) {
    return preserveWhitespace(source, KO_TO_EN[normalized]);
  }

  let translated = normalized;
  Object.entries(KO_TO_EN)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([ko, en]) => {
      if (ko.length < 2 || !translated.includes(ko)) return;
      translated = translated.split(ko).join(en);
    });

  translated = translated
    .replace(/대기\s*([0-9-]+)분/g, "Wait $1 min")
    .replace(/([0-9,]+)명/g, "$1 people")
    .replace(/([0-9,]+)건/g, "$1 items")
    .replace(/강도\s*([0-9]+)/g, "Intensity $1")
    .replace(/Lv\.([0-9]+)/g, "Lv.$1");

  return preserveWhitespace(source, translated);
}

function shouldSkipNode(node) {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!element) return true;
  if (element.closest("[data-i18n-skip]")) return true;
  return Boolean(element.closest("script, style, code, pre"));
}

function applyTextTranslations(root, language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach((node) => {
    if (shouldSkipNode(node)) return;
    if (!textOriginals.has(node)) {
      textOriginals.set(node, node.nodeValue);
    }
    let original = textOriginals.get(node);
    const translated = translateText(original, "en");

    if (language !== "en") {
      if (node.nodeValue === translated) {
        node.nodeValue = original;
      } else if (node.nodeValue !== original) {
        textOriginals.set(node, node.nodeValue);
      }
      return;
    }

    if (node.nodeValue !== original && node.nodeValue !== translated) {
      original = node.nodeValue;
      textOriginals.set(node, original);
    }

    const nextValue = translateText(original, language);
    if (node.nodeValue !== nextValue) {
      node.nodeValue = nextValue;
    }
  });
}

function applyAttributeTranslations(root, language) {
  const elements = root.querySelectorAll("*");
  elements.forEach((element) => {
    if (shouldSkipNode(element)) return;
    PLACEHOLDER_ATTRS.forEach((attr) => {
      if (!element.hasAttribute(attr)) return;
      let originalByAttr = attrOriginals.get(element);
      if (!originalByAttr) {
        originalByAttr = {};
        attrOriginals.set(element, originalByAttr);
      }
      if (!originalByAttr[attr]) {
        originalByAttr[attr] = element.getAttribute(attr);
      }
      let original = originalByAttr[attr];
      const currentValue = element.getAttribute(attr);
      const translated = translateText(original, "en");

      if (language !== "en") {
        if (currentValue === translated) {
          element.setAttribute(attr, original);
        } else if (currentValue !== original) {
          originalByAttr[attr] = currentValue;
        }
        return;
      }

      if (currentValue !== original && currentValue !== translated) {
        original = currentValue;
        originalByAttr[attr] = original;
      }

      const nextValue = translateText(original, language);
      if (element.getAttribute(attr) !== nextValue) {
        element.setAttribute(attr, nextValue);
      }
    });
  });
}

function applyDocumentTranslations(language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language === "en" ? "en" : "ko";
  applyTextTranslations(document.body, language);
  applyAttributeTranslations(document.body, language);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") return "ko";
    const queryLanguage = new URLSearchParams(window.location.search).get("lang");
    if (queryLanguage === "en" || queryLanguage === "ko") {
      return queryLanguage;
    }
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en"
      ? "en"
      : "ko";
  });

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    applyDocumentTranslations(language);
  }, [language]);

  useEffect(() => {
    if (typeof MutationObserver === "undefined" || language !== "en") return undefined;

    let frameId = 0;
    const scheduleTranslation = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        applyDocumentTranslations(language);
      });
    };

    const observer = new MutationObserver(scheduleTranslation);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: PLACEHOLDER_ATTRS,
    });
    return () => {
      observer.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () =>
        setLanguage((current) => (current === "en" ? "ko" : "en")),
      t: (text) => translateText(text, language),
    }),
    [language],
  );

  return createElement(LanguageContext.Provider, { value }, children);
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider.");
  }
  return context;
}
