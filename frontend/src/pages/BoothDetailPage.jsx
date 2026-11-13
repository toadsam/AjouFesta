// 주점 상세. 메뉴·운영 시간·자리 예약. 예약 로직은 그대로 두고 화면만 ver2 로 다시 그렸다.
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createBoothReservation,
  createBoothReservationCheckInToken,
  createBoothStream,
  createReservationStream,
  fetchBoothById,
  fetchBoothReservations,
  fetchCongestion,
  fetchOrderMenu,
  sendReservationAuthCode,
  verifyReservationAuthCode,
} from "../api";
import { IconArrowLeft, IconClock, IconMapPin, IconUsers } from "../components/UxIcons";
import { showBrowserNotification } from "../utils/notifications";
import { DishGrid, DishSheet } from "../components/v2/DishGrid";
import { BottomSheet, IconPhone, useToast } from "../components/v2/V2Kit";
import { resolveBoothImageUrl } from "../config/boothImages";
import { FESTIVAL, MAIN_BOOTH_FALLBACK, isMainBooth } from "../config/festival";
import { TableMap } from "../components/v2/TableMap";
import { TAKEOUT_TABLE } from "../utils/orderCart";
import {
  clearReservationAuth,
  getReservationPhone,
  getReservationToken,
  saveReservationAuth,
} from "../utils/reservationAuth";

const BOOTH_KEY_STORAGE_KEY = "festflow_ops_booth_key";

function createKakaoDirectionsUrl(booth) {
  // 총학 주점은 주점 본부(카페 안녕)로 안내한다.
  const place = isMainBooth(booth) ? MAIN_BOOTH_FALLBACK.place : null;
  const name = place?.name || booth?.name || booth?.locationName || "바람 부스";
  const lat = Number(place?.lat ?? booth?.latitude);
  const lng = Number(place?.lng ?? booth?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
  }
  return `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;
}

// 서버 응답을 기다리는 동안 · 못 받았을 때 보여 줄 부스. 손님이 여는 부스는 총학 주점뿐이라 확정된 주점 정보를 쓴다
// (예전에는 시연용 '공대 야시장'이 이름 · 설명 · 길찾기까지 그대로 보였다).
function fallbackBooth(id) {
  return {
    id: Number(id),
    name: MAIN_BOOTH_FALLBACK.name,
    category: "주점",
    description: MAIN_BOOTH_FALLBACK.description,
    latitude: MAIN_BOOTH_FALLBACK.place.lat,
    longitude: MAIN_BOOTH_FALLBACK.place.lng,
    openTime: MAIN_BOOTH_FALLBACK.openTime,
    closeTime: MAIN_BOOTH_FALLBACK.closeTime,
  };
}

function createEmptyReservationState(maxReservationMinutes = 10) {
  return {
    maxReservationMinutes,
    tables: [],
    activeReservations: [],
    myReservation: null,
    penalty: null,
  };
}

function formatTimeRange(booth) {
  if (booth?.openTime || booth?.closeTime) {
    const cut = (value) => `${value || "--:--"}`.slice(0, 5);
    return `${cut(booth.openTime)} ~ ${cut(booth.closeTime)}`;
  }
  if (isMainBooth(booth)) return `${MAIN_BOOTH_FALLBACK.openTime} ~ ${MAIN_BOOTH_FALLBACK.closeTime}`;
  return "시간 확인 중";
}

function parseMenuBoardJson(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        name: String(item?.name || "").trim(),
        price: String(item?.price || "").trim(),
        description: String(item?.description || "").trim(),
        soldOut: Boolean(item?.soldOut),
        imageUrl: String(item?.imageUrl || "").trim(),
      }))
      .filter((item) => item.name);
  } catch {
    return [];
  }
}

function tableSeats(table) {
  return Math.max(0, Number(table?.reservableSeats ?? table?.availableSeats) || 0);
}

function tableStatus(table) {
  if (table?.occupancyStatus) return table.occupancyStatus;
  return tableSeats(table) > 0 ? "AVAILABLE" : "FULL";
}

function tableStatusLabel(table) {
  if (table?.occupancyLabel) return table.occupancyLabel;
  switch (tableStatus(table)) {
    case "IN_USE":
      return "이용 중";
    case "RESERVED":
      return "예약 중";
    case "FULL":
      return "마감";
    default:
      return "가능";
  }
}

function canReserveTable(table) {
  return tableStatus(table) === "AVAILABLE" && tableSeats(table) > 0;
}

function parseTimeMs(value) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function relativeTime(at) {
  if (!at) return "";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 5) return "방금 갱신";
  if (seconds < 60) return `${seconds}초 전 갱신`;
  return `${Math.floor(seconds / 60)}분 전 갱신`;
}

/** "4인 테이블 2개 · 2인 1개" 처럼 빈 테이블을 크기별로 묶는다. */
function freeTablesSummary(tables) {
  const bySize = new Map();
  tables.filter(canReserveTable).forEach((table) => {
    const size = Math.max(1, Number(table.totalSeats) || tableSeats(table) || 1);
    bySize.set(size, (bySize.get(size) || 0) + 1);
  });
  return [...bySize.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => `${size}인 테이블 ${count}개`)
    .join(" · ");
}

function timerText(seconds) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export default function BoothDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showToast, toastNode] = useToast();

  const [booth, setBooth] = useState(() => fallbackBooth(id));
  const [congestion, setCongestion] = useState(null);
  const [reservationState, setReservationState] = useState(() => createEmptyReservationState());
  const [error, setError] = useState("");
  const [reservationError, setReservationError] = useState("");

  const [phoneNumber, setPhoneNumber] = useState(getReservationPhone());
  const [verifyCode, setVerifyCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendCooldownSeconds, setSendCooldownSeconds] = useState(0);
  const [reservationToken, setReservationToken] = useState(getReservationToken());
  const [authSheetOpen, setAuthSheetOpen] = useState(false);

  const [seatCount, setSeatCount] = useState(1);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [checkInQrDataUrl, setCheckInQrDataUrl] = useState("");
  const [checkInQrToken, setCheckInQrToken] = useState("");
  const [checkInQrExpiresAt, setCheckInQrExpiresAt] = useState("");
  const [opsSheetOpen, setOpsSheetOpen] = useState(false);
  const [opsKeyInput, setOpsKeyInput] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  const [seatsUpdatedAt, setSeatsUpdatedAt] = useState(0);
  const [dish, setDish] = useState(null);
  // 주문을 받는 부스에서만 '포장 주문하기'를 보여 준다.
  const [orderOpen, setOrderOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    setOrderOpen(false);
    fetchOrderMenu(id, TAKEOUT_TABLE)
      .then((menu) => alive && setOrderOpen(Boolean(menu?.orderEnabled)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  function applyReservationState(nextState) {
    const safe = nextState || createEmptyReservationState(booth?.maxReservationMinutes);
    setReservationState(safe);
    setSelectedTableId((current) => {
      const tables = safe.tables || [];
      if (!tables.length) return null;
      if (current && tables.some((table) => table.id === current)) return current;
      const firstReservable = tables.find(canReserveTable) || tables[0];
      return firstReservable.id;
    });
  }

  async function loadReservations(token = reservationToken, boothData = booth) {
    try {
      const data = await fetchBoothReservations(id, token);
      applyReservationState(data);
      setSeatsUpdatedAt(Date.now());
      setReservationError("");
    } catch (loadError) {
      if (token) {
        clearReservationAuth();
        setReservationToken("");
        setReservationError("예약 인증이 만료됐어요. 다시 인증해 주세요.");
        try {
          const publicData = await fetchBoothReservations(id, "");
          applyReservationState(publicData);
          return;
        } catch {
          // 아래에서 빈 상태로 둔다.
        }
      } else {
        setReservationError(loadError.message);
      }
      applyReservationState(createEmptyReservationState(boothData?.maxReservationMinutes));
    }
  }

  async function loadPage() {
    const [boothResult, congestionResult] = await Promise.allSettled([
      fetchBoothById(id),
      fetchCongestion(id),
    ]);

    const boothData = boothResult.status === "fulfilled" ? boothResult.value : fallbackBooth(id);
    setBooth(boothData);
    setCongestion(congestionResult.status === "fulfilled" ? congestionResult.value : null);
    setError(boothResult.status === "rejected" ? "실시간 부스 정보를 불러오지 못해 기본 안내를 보여드려요." : "");
    await loadReservations(reservationToken, boothData);
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reservationToken]);

  useEffect(() => {
    let boothStream = null;
    try {
      boothStream = createBoothStream();
      boothStream.addEventListener("booths", (event) => {
        try {
          const list = JSON.parse(event.data);
          const next = Array.isArray(list) ? list.find((item) => String(item.id) === String(id)) : null;
          if (next) setBooth(next);
        } catch {
          // 잘못된 페이로드는 무시한다.
        }
      });
    } catch {
      // 스트림은 없어도 된다.
    }

    let reservationStream = null;
    let reservationReloadTimer = null;
    try {
      reservationStream = createReservationStream();
      reservationStream.addEventListener("reservations", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload?.boothId || String(payload.boothId) === String(id)) {
            // 보는 사람 전원이 같은 순간에 다시 읽지 않게 0~2.5초 흩어서, 그 사이 온 이벤트는 한 번으로 묶는다.
            if (!reservationReloadTimer) {
              reservationReloadTimer = window.setTimeout(() => {
                reservationReloadTimer = null;
                loadReservations(reservationToken).catch((streamError) => setReservationError(streamError.message));
              }, Math.random() * 2500);
            }
          }
        } catch {
          // 잘못된 페이로드는 무시한다.
        }
      });
    } catch {
      // 스트림은 없어도 된다.
    }

    return () => {
      if (reservationReloadTimer) window.clearTimeout(reservationReloadTimer);
      boothStream?.close();
      reservationStream?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reservationToken]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sendCooldownSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSendCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sendCooldownSeconds]);

  const selectedTable = useMemo(
    () => reservationState.tables?.find((table) => table.id === selectedTableId) || null,
    [reservationState.tables, selectedTableId],
  );

  const myReservation = reservationState.myReservation;
  const called = Boolean(myReservation?.calledAt) && myReservation?.status === "RESERVED";
  const calledKeyRef = useRef("");

  // 스태프가 호출하면 한 번만 알림·진동
  useEffect(() => {
    if (!called) return;
    const keyValue = `${myReservation.id}-${myReservation.calledAt}`;
    if (calledKeyRef.current === keyValue) return;
    calledKeyRef.current = keyValue;
    try {
      window.navigator.vibrate?.([120, 60, 120]);
    } catch {
      // 진동 없는 기기
    }
    showBrowserNotification(`${booth?.name || "주점"} 자리가 났어요`, { body: `${myReservation.tableName} · 지금 부스로 와서 QR을 보여 주세요.` });
  }, [called, myReservation, booth]);
  const penalty = reservationState.penalty;
  const isAuthComplete = Boolean(reservationToken);
  const remainingSeconds = myReservation ? Math.floor((parseTimeMs(myReservation.expiresAt) - nowTick) / 1000) : 0;
  const qrRemainingSeconds = checkInQrExpiresAt ? Math.floor((parseTimeMs(checkInQrExpiresAt) - nowTick) / 1000) : 0;
  const menuItems = useMemo(() => {
    const parsed = parseMenuBoardJson(booth?.menuBoardJson);
    // 총학 주점에 메뉴판이 아직 없으면 config 의 기본 메뉴를 보여 준다.
    if (!parsed.length && isMainBooth(booth)) return MAIN_BOOTH_FALLBACK.menu.map((item) => ({ ...item, soldOut: false }));
    return parsed;
  }, [booth]);
  const requestedSeatCount = Math.max(1, Number(seatCount) || 1);
  const noSeat = selectedTable && tableSeats(selectedTable) < requestedSeatCount;
  const tables = reservationState.tables || [];
  const availableTables = tables.filter(canReserveTable).length;
  const freeSummary = freeTablesSummary(tables);
  const seatsTone = tables.length === 0 ? "none" : availableTables === 0 ? "full" : "ok";
  // 이번 축제는 예약을 안 받는다(config). 빈 자리 카드는 예약과 상관없이 보여 준다.
  const reservationOn = FESTIVAL.reservations !== false && booth?.reservationEnabled !== false;
  const canReserve = Boolean(
    reservationToken && selectedTable && canReserveTable(selectedTable) && !myReservation && !penalty?.blocked && !noSeat,
  );

  async function handleSendCode() {
    try {
      setReservationError("");
      await sendReservationAuthCode(phoneNumber);
      setVerifyCode("");
      setCodeSent(true);
      setSendCooldownSeconds(30);
      showToast("인증번호를 문자로 보냈어요.");
    } catch (sendError) {
      setReservationError(sendError.message);
    }
  }

  async function handleVerifyCode() {
    try {
      setReservationError("");
      const response = await verifyReservationAuthCode(phoneNumber, verifyCode);
      saveReservationAuth(response.reservationToken, response.phoneNumber);
      setReservationToken(response.reservationToken);
      setPhoneNumber(response.phoneNumber);
      setVerifyCode("");
      setCodeSent(false);
      setAuthSheetOpen(false);
      showToast("인증이 끝났어요. 이제 자리를 잡아 보세요.");
    } catch (verifyError) {
      setReservationError(verifyError.message);
    }
  }

  function handleClearAuth() {
    clearReservationAuth();
    setReservationToken("");
    setCheckInQrDataUrl("");
    setCheckInQrToken("");
    setCheckInQrExpiresAt("");
    showToast("예약 인증을 해제했어요.");
  }

  async function handleReserve() {
    if (!selectedTable) {
      setReservationError("테이블을 골라 주세요.");
      return;
    }
    if (!reservationToken) {
      setReservationError("");
      setAuthSheetOpen(true);
      return;
    }
    if (!canReserve) {
      setReservationError(noSeat ? "남은 자리보다 인원이 많아요." : "지금은 예약할 수 없는 테이블이에요.");
      return;
    }

    setReserving(true);
    try {
      await createBoothReservation(id, { tableId: selectedTable.id, seatCount: requestedSeatCount }, reservationToken);
      showToast("예약됐어요. 시간 안에 QR로 체크인해 주세요.");
      await loadReservations(reservationToken);
    } catch (reserveError) {
      setReservationError(reserveError.message);
    } finally {
      setReserving(false);
    }
  }

  async function handleGenerateCheckInQr() {
    if (!myReservation?.id) return;
    try {
      const tokenPayload = await createBoothReservationCheckInToken(id, myReservation.id, reservationToken);
      const qrData = await QRCode.toDataURL(tokenPayload.token, { width: 220, margin: 1 });
      setCheckInQrDataUrl(qrData);
      setCheckInQrToken(tokenPayload.token);
      setCheckInQrExpiresAt(tokenPayload.expiresAt);
    } catch (qrError) {
      setReservationError(qrError.message);
    }
  }

  function handleOpsLogin() {
    const key = opsKeyInput.trim();
    if (!key) {
      showToast("운영 키를 입력해 주세요.");
      return;
    }
    sessionStorage.setItem(BOOTH_KEY_STORAGE_KEY, key);
    navigate(`/ops/booth/${id}`);
  }

  function handleDirections() {
    const url = createKakaoDirectionsUrl(booth);
    const opened = window.open(url, "_blank");
    if (opened) opened.opener = null;
    if (!opened) window.location.href = url;
  }

  const imageUrl = resolveBoothImageUrl(booth);
  const congestionLabel = congestion?.level || congestion?.label || booth?.congestion || "보통";
  const waitMinutes = Number(booth?.estimatedWaitMinutes);

  return (
    <section className="v2-page" data-i18n-skip>
      <div className="v2-detail-hero">
        <img src={imageUrl} alt="" />
        <header className="v2-topbar v2-topbar--overlay">
          <Link to="/" aria-label="축제 첫 화면으로">
            <IconArrowLeft />
          </Link>
          <span />
          <span />
        </header>
      </div>

      <div className="v2-detail-title v2-rise" style={{ "--i": 0 }}>
        <div className="v2-booth__tags">
          {booth?.category ? <span className="v2-badge">{booth.category}</span> : null}
          {Number.isFinite(waitMinutes) ? (
            <span className={`v2-badge ${waitMinutes >= 30 ? "v2-badge--red" : "v2-badge--blue"}`}>
              {waitMinutes <= 0 ? "바로 입장" : `대기 ${waitMinutes}분`}
            </span>
          ) : null}
        </div>
        <h1>{booth?.name || "축제 부스"}</h1>
        <p>{booth?.description || booth?.boothIntro || "메뉴와 자리를 확인해 보세요."}</p>
        {booth?.liveStatusMessage ? <p className="v2-booth__live" style={{ marginTop: "0.6rem", whiteSpace: "normal" }}>{booth.liveStatusMessage}</p> : null}
      </div>

      {error && <p className="v2-note">{error}</p>}

      <div className="v2-info-grid v2-rise" style={{ "--i": 1 }}>
        <div className="v2-info">
          <IconClock />
          <small>운영 시간</small>
          <strong>{formatTimeRange(booth)}</strong>
        </div>
        <button type="button" className="v2-info" onClick={handleDirections}>
          <IconMapPin />
          <small>길찾기</small>
          <strong>{isMainBooth(booth) ? MAIN_BOOTH_FALLBACK.place.name : booth?.locationName || "아주대 캠퍼스"}</strong>
        </button>
        <div className="v2-info">
          <IconUsers />
          <small>혼잡도</small>
          <strong>{congestionLabel}</strong>
        </div>
      </div>

      <div className={`v2-seats v2-seats--${seatsTone} v2-seats--map v2-rise`} style={{ "--i": 2 }} aria-live="polite">
        <div className="v2-seats__head">
          <div>
            <span className="v2-seats__label">
              지금 빈 자리
              <small>· 현장 기준 {relativeTime(seatsUpdatedAt) || "확인 중"}</small>
            </span>
            <strong>
              {tables.length === 0
                ? "자리 정보 준비 중"
                : availableTables === 0
                  ? "지금은 만석이에요"
                  : `테이블 ${availableTables}개 남음`}
            </strong>
            {tables.length > 0 ? (
              <p>{availableTables === 0 ? "자리가 나면 여기서 바로 보여요." : freeSummary}</p>
            ) : (
              <p>운영진이 테이블을 등록하면 실시간으로 보여요.</p>
            )}
          </div>
          {tables.length > 0 ? (
            <div className="v2-seats__ring" style={{ "--ratio": Math.round((availableTables / tables.length) * 100) }}>
              <span>
                {availableTables}/{tables.length}
              </span>
            </div>
          ) : null}
        </div>
        {tables.length > 0 ? <TableMap tables={tables} compact collapsible defaultOpen={false} storageKey="booth" toggleClass="v2-btn v2-btn--gray v2-btn--xs" /> : null}
      </div>

      {menuItems.length > 0 && (
        <section className="v2-section v2-rise" style={{ "--i": 3 }}>
          <div className="v2-section__head">
            <h2>메뉴</h2>
            <span>{menuItems.length}개</span>
          </div>
          <DishGrid items={menuItems} onSelect={setDish} />
          <p className="v2-note v2-note--blue" style={{ marginTop: "0.9rem" }}>
            테이블에 있는 QR을 찍으면 자리에서 바로 주문할 수 있어요.
          </p>
          {orderOpen ? (
            <Link className="v2-btn v2-btn--gray" style={{ marginTop: "0.6rem", width: "100%" }} to={`/order/${id}/${encodeURIComponent(TAKEOUT_TABLE)}`}>
              포장 주문하기
            </Link>
          ) : null}
        </section>
      )}

      <DishSheet dish={dish} onClose={() => setDish(null)} />

      {booth?.menuImageUrl && menuItems.length === 0 && (
        <section className="v2-section v2-rise" style={{ "--i": 2 }}>
          <div className="v2-section__head">
            <h2>메뉴판</h2>
          </div>
          <img src={booth.menuImageUrl} alt="메뉴판" style={{ width: "100%", borderRadius: 16 }} />
        </section>
      )}

      {reservationOn && (
        <section className="v2-section v2-rise" style={{ "--i": 4 }}>
          <div className="v2-section__head">
            <h2>자리 예약</h2>
            <span>{tables.length ? `${availableTables}/${tables.length} 테이블 가능` : ""}</span>
          </div>

          {myReservation ? (
            <div className={`v2-card ${called ? "v2-card--called" : "v2-card--blue"}`}>
              {called ? (
                <div className="v2-called">
                  <strong>지금 들어오세요!</strong>
                  <span>자리가 났어요. 부스 입구에서 QR을 보여 주세요.</span>
                </div>
              ) : null}
              <span className="v2-badge v2-badge--blue v2-badge--live">{called ? "호출됨" : "예약 중"}</span>
              <p style={{ margin: "0.6rem 0 0.2rem", fontSize: "1.05rem", fontWeight: 700 }}>
                {myReservation.tableName} · {myReservation.seatCount}명
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--v2-text-2)" }}>
                남은 시간 안에 부스에서 QR을 보여 주세요.
              </p>
              <div className="v2-timer" style={{ margin: "0.75rem 0 1rem" }}>{timerText(remainingSeconds)}</div>
              <button type="button" className="v2-btn" onClick={handleGenerateCheckInQr}>
                체크인 QR 만들기
              </button>
              {checkInQrDataUrl && qrRemainingSeconds > 0 && (
                <div className="v2-qr v2-pop">
                  <img src={checkInQrDataUrl} alt="체크인 QR" />
                  <strong style={{ fontSize: "0.9rem" }}>QR 만료까지 {timerText(qrRemainingSeconds)}</strong>
                  {checkInQrToken && (
                    <button
                      type="button"
                      className="v2-btn v2-btn--gray v2-btn--sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(checkInQrToken);
                        showToast("체크인 코드를 복사했어요.");
                      }}
                    >
                      코드 복사
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="v2-card v2-card--white">
              {tables.length ? (
                <>
                  <div className="v2-tables">
                    {tables.map((table, index) => {
                      const selected = selectedTableId === table.id;
                      return (
                        <button
                          key={table.id}
                          type="button"
                          className={`v2-table${selected ? " v2-table--selected" : ""}`}
                          onClick={() => setSelectedTableId(table.id)}
                          disabled={!canReserveTable(table)}
                        >
                          <strong>{table.tableName || index + 1}</strong>
                          <small>{canReserveTable(table) ? `${tableSeats(table)}석` : tableStatusLabel(table)}</small>
                        </button>
                      );
                    })}
                  </div>

                  <div className="v2-kv" style={{ marginTop: "1rem" }}>
                    <span>인원</span>
                    <div className="v2-stepper">
                      <button
                        type="button"
                        aria-label="인원 줄이기"
                        onClick={() => setSeatCount((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                        disabled={requestedSeatCount <= 1}
                      >
                        −
                      </button>
                      <strong>{requestedSeatCount}</strong>
                      <button
                        type="button"
                        aria-label="인원 늘리기"
                        onClick={() => setSeatCount((prev) => Math.min(20, (Number(prev) || 1) + 1))}
                        disabled={requestedSeatCount >= 20}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {selectedTable ? (
                    <div className="v2-kv">
                      <span>고른 테이블</span>
                      <strong>
                        {selectedTable.tableName} · {tableSeats(selectedTable)}석 남음
                      </strong>
                    </div>
                  ) : null}
                  {noSeat ? <p className="v2-note v2-note--danger">남은 자리보다 인원이 많아요.</p> : null}

                  <button
                    type="button"
                    className="v2-btn"
                    style={{ marginTop: "0.75rem" }}
                    onClick={handleReserve}
                    disabled={reserving || (isAuthComplete && !canReserve)}
                  >
                    {reserving ? "예약하는 중..." : isAuthComplete ? "이 자리 예약하기" : "휴대폰 인증하고 예약하기"}
                  </button>
                  {isAuthComplete ? (
                    <div className="v2-kv" style={{ marginTop: "0.5rem", fontSize: "0.82rem" }}>
                      <span>인증된 번호 {phoneNumber || getReservationPhone()}</span>
                      <button type="button" className="v2-btn v2-btn--gray v2-btn--xs" onClick={handleClearAuth}>
                        해제
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="v2-empty" style={{ padding: "1.5rem 0.5rem" }}>
                  <strong>예약 테이블이 아직 없어요</strong>
                  <p>현장에서 바로 이용할 수 있어요.</p>
                </div>
              )}
            </div>
          )}

          {penalty?.blocked && <p className="v2-note v2-note--danger">지금은 예약이 제한돼 있어요.</p>}
          {reservationError && !authSheetOpen && <p className="v2-note v2-note--danger">{reservationError}</p>}
        </section>
      )}

      <div className="v2-divider--thick" />

      <button type="button" className="v2-row" onClick={() => setOpsSheetOpen(true)}>
        <span className="v2-row__body">
          <strong style={{ fontSize: "0.9rem", color: "var(--v2-text-3)", fontWeight: 600 }}>부스 운영자이신가요?</strong>
        </span>
        <span className="v2-row__trail">운영 화면</span>
      </button>

      <BottomSheet
        open={authSheetOpen}
        onClose={() => setAuthSheetOpen(false)}
        title="휴대폰 인증"
        description="예약 확인 문자를 받을 번호예요. 한 번만 인증하면 돼요."
      >
        <label className="v2-field v2-field--inline">
          <input
            type="tel"
            inputMode="numeric"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="01012345678"
            aria-label="휴대폰 번호"
          />
          <button type="button" className="v2-btn v2-btn--soft" onClick={handleSendCode} disabled={sendCooldownSeconds > 0}>
            {sendCooldownSeconds > 0 ? `${sendCooldownSeconds}초` : codeSent ? "다시 받기" : "번호 받기"}
          </button>
        </label>
        <label className="v2-field">
          <span>인증번호</span>
          <input
            inputMode="numeric"
            value={verifyCode}
            onChange={(event) => setVerifyCode(event.target.value)}
            placeholder="문자로 온 숫자"
          />
        </label>
        {reservationError && <p className="v2-note v2-note--danger">{reservationError}</p>}
        <button type="button" className="v2-btn" onClick={handleVerifyCode} disabled={!verifyCode.trim()}>
          인증 확인
        </button>
      </BottomSheet>

      <BottomSheet open={opsSheetOpen} onClose={() => setOpsSheetOpen(false)} title="부스 운영 화면" description="운영진에게 받은 부스 키를 입력하세요.">
        <label className="v2-field">
          <span>운영 키</span>
          <input value={opsKeyInput} onChange={(event) => setOpsKeyInput(event.target.value)} placeholder="부스 키" />
        </label>
        <button type="button" className="v2-btn" onClick={handleOpsLogin}>
          <IconPhone style={{ width: 18, height: 18 }} />
          운영 화면 열기
        </button>
      </BottomSheet>

      {toastNode}
    </section>
  );
}
