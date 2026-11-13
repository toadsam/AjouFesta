import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n";
import {
  IconBox,
  IconChart,
  IconChat,
  IconHeart,
  IconMapPin,
  IconMusic,
  IconSettings,
  IconShield,
  IconSparkles,
  IconUsers,
} from "../components/UxIcons";
import {
  areNotificationsEnabled,
  ensureNotificationPermission,
  setNotificationsEnabled,
} from "../utils/notifications";

const aiHubCards = [
  {
    to: "/chat",
    title: "AI 챗봇",
    caption: "공연, 부스, 동선과 편의시설을 바로 물어보세요.",
    action: "대화하기",
    icon: IconChat,
    tone: "mint",
  },
  {
    to: "/analytics",
    title: "AI 혼잡도 예측",
    caption: "실시간 데이터로 붐비는 구역을 예측해요.",
    action: "확인하기",
    icon: IconChart,
    tone: "violet",
  },
  {
    to: "/ai-match",
    title: "AI 프로필 매칭",
    caption: "나와 취향이 맞는 축제 메이트를 찾아드려요.",
    action: "시작하기",
    icon: IconHeart,
    tone: "pink",
  },
];

const menuItems = [
  { to: "/lost-found", label: "분실물 센터", icon: IconBox, caption: "보관 물품 검색과 내 물건 표시" },
  { to: "/events", label: "공연 일정", icon: IconMusic, caption: "오늘 공연과 알림 설정" },
  { to: "/staff", label: "운영진 문의", icon: IconUsers, caption: "현장 문의와 스태프 연결" },
  { to: "/stage-map", label: "위치 설정", icon: IconMapPin, caption: "내 주변 정보 갱신" },
  { to: "/admin", label: "관리자 페이지", icon: IconShield, caption: "관리자 전용 진입" },
];

export default function MorePage() {
  const { language, setLanguage } = useLanguage();
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem("festflow_high_contrast") === "true");
  const [notifications, setNotifications] = useState(() => areNotificationsEnabled());

  useEffect(() => {
    localStorage.setItem("festflow_high_contrast", String(highContrast));
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
  }, [highContrast]);

  async function handleNotificationChange(event) {
    const enabled = event.target.checked;
    if (!enabled) {
      setNotifications(false);
      setNotificationsEnabled(false);
      return;
    }

    const granted = await ensureNotificationPermission();
    setNotifications(granted);
    setNotificationsEnabled(granted);
  }

  return (
    <section className="uni-page more-page">
      <header className="more-hero more-ai-hero">
        <div>
          <span>아주대학교</span>
          <strong>AI 허브</strong>
          <p>바람 AI의 모든 기능을 한 곳에서 이용하세요.</p>
        </div>
        <IconSparkles className="h-6 w-6" />
      </header>

      <section className="more-ai-grid" aria-label="AI 기능">
        {aiHubCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} to={item.to} className={`more-ai-card more-ai-card--${item.tone}`}>
              <span>
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.caption}</p>
                <em>{item.action}</em>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="more-section-title">
        <strong>더보기</strong>
        <span>안전하고 편리한 축제 경험</span>
      </div>

      <section className="more-menu-card">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={`${item.to}-${item.label}`} to={item.to} className="more-menu-row">
              <span>
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.caption}</small>
              </div>
              <em>›</em>
            </Link>
          );
        })}
      </section>

      <section className="more-menu-card settings-card">
        <label className="settings-row">
          <span>알림 설정</span>
          <input
            type="checkbox"
            checked={notifications}
            onChange={handleNotificationChange}
          />
        </label>
        <label className="settings-row">
          <span>고대비 모드</span>
          <input
            type="checkbox"
            checked={highContrast}
            onChange={(event) => setHighContrast(event.target.checked)}
          />
        </label>
        <label className="settings-row">
          <span>언어</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>

      <button type="button" className="logout-row">
        <IconShield className="h-4 w-4" />
        앱 정보 v1.0.0
      </button>
    </section>
  );
}
