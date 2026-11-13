// 눌러 보는 매뉴얼 안의 연습 화면이면 서버 요청 · 저장소를 연습용으로 바꿔 끼운다. 다른 모듈보다 먼저 실행돼야 한다.
import { isDemoFrame } from "./demo/demoFrame";
import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { LanguageProvider } from "./i18n";
import "./index.css";
import "leaflet/dist/leaflet.css";
// ver2 스타일은 index.css 뒤에 와야 전역 !important 규칙을 이긴다.
import "./styles/v2.css";
import "./styles/v2-overrides.css";
import "./styles/v2-aimatch.css";
import "./styles/v2-hero.css";
import "./styles/v2-tables.css";
import "./styles/v2-splash.css";
import "./styles/v2-ops.css";
import "./styles/v2-admin.css";
import "./styles/saju-theme.css";
import "./styles/saju-night.css";

import "./styles/cardnews.css";
import AiMatchPage from "./pages/AiMatchPage";
import AiMatchAdminPage from "./pages/AiMatchAdminPage";
import AdminPage from "./pages/AdminPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import BoothDetailPage from "./pages/BoothDetailPage";
import BoothListPage from "./pages/BoothListPage";
import ChatPage from "./pages/ChatPage";
import EventDetailPage from "./pages/EventDetailPage";
import EventPage from "./pages/EventPage";
import FestivalPage from "./pages/FestivalPage";
import HomePage from "./pages/HomePage";
import LineupPage from "./pages/LineupPage";
import LostFoundPage from "./pages/LostFoundPage";
import MorePage from "./pages/MorePage";
import OpsBoothPage from "./pages/OpsBoothPage";
import OpsKitchenPage from "./pages/OpsKitchenPage";
import OpsSimulationPage from "./pages/OpsSimulationPage";
import OpsTableBoardPage from "./pages/OpsTableBoardPage";
import TableOrderPage from "./pages/order/TableOrderPage";
import TablePickPage from "./pages/order/TablePickPage";
import OrderCheckoutPage from "./pages/order/OrderCheckoutPage";
import OrderStatusPage from "./pages/order/OrderStatusPage";
import TableQrPage from "./pages/order/TableQrPage";
import StaffPage from "./pages/StaffPage";
import StageCrowdPage from "./pages/StageCrowdPage";
import StageMapPage from "./pages/StageMapPage";

// 눌러 보는 운영 매뉴얼. 스태프만 여는 화면이라 따로 내려받는다.
const LiveGuidePage = lazy(() => import("./pages/LiveGuidePage"));
// 스태프 화면(명단 · 시간표 · 상태). 스태프만 여는 화면이라 따로 내려받는다.
const StaffCrewPage = lazy(() => import("./pages/StaffCrewPage"));

function routeElement(Page) {
  return <Page />;
}

const isLocalRuntime =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

if ((!import.meta.env.PROD || isLocalRuntime) && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations?.().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  }).catch(() => {});

  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys
        .filter((key) => key.startsWith("fest-") || key.startsWith("festflow-"))
        .forEach((key) => caches.delete(key));
    }).catch(() => {});
  }
}

if (import.meta.env.PROD && !isLocalRuntime && !isDemoFrame && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Service worker registration failure should not block the app.
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* 탭 · 스플래시 없이 화면 전체를 쓴다. /guide/ (정적 매뉴얼)와 주소가 이어진다. */}
          <Route path="/guide/live" element={<Suspense fallback={null}><LiveGuidePage /></Suspense>} />
          {/* 스태프 화면도 앱 껍데기 밖에서 그린다(손님 탭 · 전역 스타일 없이). */}
          <Route path="/staff" element={<Suspense fallback={null}><StaffCrewPage /></Suspense>} />
          <Route path="/" element={<App />}>
            {/* ver2: 첫 화면은 축제 살펴보기. 이전 홈은 지우지 않고 /home-v1 로 옮겨 두었다. */}
            <Route index element={routeElement(FestivalPage)} />
            <Route path="home-v1" element={routeElement(HomePage)} />
            <Route path="booths" element={routeElement(BoothListPage)} />
            {/* 이번 축제는 주점이 하나라 /booths 는 총학 주점으로 바로 간다. 전체 목록은 숨겨 두고 여기서만 연다. */}
            <Route path="booths/all" element={routeElement(BoothListPage)} />
            <Route path="stage-map" element={routeElement(StageMapPage)} />
            <Route path="events" element={routeElement(EventPage)} />
            <Route path="events/lineup" element={routeElement(LineupPage)} />
            <Route path="events/:id" element={routeElement(EventDetailPage)} />
            <Route path="analytics" element={routeElement(AnalyticsPage)} />
            <Route path="analytics/stage" element={routeElement(StageCrowdPage)} />
            <Route path="booths/:id" element={routeElement(BoothDetailPage)} />
            <Route path="lost-found" element={routeElement(LostFoundPage)} />
            <Route path="chat" element={routeElement(ChatPage)} />
            {/* 예전 스태프 화면(직원번호 + PIN). /staff 는 새 스태프 화면이 쓰고, 이건 지우지 않고 옮겨 두었다. */}
            <Route path="staff-v1" element={routeElement(StaffPage)} />
            <Route path="more" element={routeElement(MorePage)} />
            <Route path="admin" element={routeElement(AdminPage)} />
            <Route path="admin/simulation" element={routeElement(OpsSimulationPage)} />
            <Route path="ops/master" element={<Navigate to="/admin" replace />} />
            <Route path="ops/simulation" element={<Navigate to="/admin/simulation" replace />} />
            <Route path="ops/booth/:id" element={routeElement(OpsBoothPage)} />
            <Route path="ops/booth/:id/table-qr" element={routeElement(TableQrPage)} />
            <Route path="ops/booth/:id/tables" element={routeElement(OpsTableBoardPage)} />
            <Route path="ops/booth/:id/kitchen" element={routeElement(OpsKitchenPage)} />
            {/* 공용 QR: 테이블을 고른 뒤 주문 화면으로 간다. */}
            <Route path="order/:boothId" element={routeElement(TablePickPage)} />
            <Route path="order/:boothId/:table" element={routeElement(TableOrderPage)} />
            <Route path="order/:boothId/:table/checkout" element={routeElement(OrderCheckoutPage)} />
            <Route path="orders/:orderId" element={routeElement(OrderStatusPage)} />
            <Route path="ai-match" element={routeElement(AiMatchPage)} />
            <Route path="ai-match/admin" element={routeElement(AiMatchAdminPage)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      {/* Vercel 방문 통계. 운영 사이트에서만 센다(로컬 · 매뉴얼 안의 연습 화면은 빼서 숫자가 부풀지 않게). */}
      {import.meta.env.PROD && !isLocalRuntime && !isDemoFrame ? <Analytics /> : null}
    </LanguageProvider>
  </React.StrictMode>,
);
