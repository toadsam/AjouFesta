// 부스 운영 콘솔의 "주문" 구역. 주문 받기 설정 + 실시간 주문 목록. 스타일은 styles/v2-ops.css.
// 흐름: 여기서 입금 확인 → 메뉴별 요리사 창(/ops/booth/:id/kitchen?menu=…)에서 메뉴마다 완료 → 모든 메뉴가 끝나면 여기 '서빙할 것'에 올라옴 → 가져다주고 서빙 완료.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createOrderStream,
  fetchOpsBoothOrders,
  updateOpsBoothOrderConfig,
  updateOpsBoothOrderStatus,
} from "../api";
import { formatWon, isTakeout, tableName } from "../utils/orderCart";
import { playChime } from "../utils/chime";

const STATUS_LABEL = {
  PENDING_PAYMENT: "입금 대기",
  PAID: "입금 확인",
  PREPARING: "조리 중",
  READY: "준비 완료",
  COMPLETED: "완료",
  CANCELED: "취소",
};

const STATUS_TONE = {
  PENDING_PAYMENT: "yellow",
  PAID: "blue",
  PREPARING: "violet",
  READY: "green",
  COMPLETED: "",
  CANCELED: "red",
};

// 조리는 메뉴별 요리사 창에서 메뉴마다 '완료'를 누른다(첫 메뉴가 끝나면 조리 중, 모두 끝나면 준비 완료).
// 여기 '준비 완료'는 주방 기기를 못 쓸 때 대신 누르는 것이라 눈에 덜 띄게 둔다(남은 메뉴를 모두 완료로 적는다).
const NEXT_ACTION = {
  PENDING_PAYMENT: { status: "PAID", label: "입금 확인", primary: true },
  PAID: { status: "READY", label: "준비 완료", kitchen: true },
  PREPARING: { status: "READY", label: "준비 완료", kitchen: true },
  READY: { status: "COMPLETED", label: "서빙 완료", primary: true },
};

// 주방 진행 안내: 완료된 메뉴 수 / 전체.
function kitchenHint(order) {
  const items = order.items || [];
  const done = items.filter((item) => item.doneAt).length;
  if (!done) return "요리사 창에 떠 있어요 · 주방이 만드는 중";
  return `주방에서 만드는 중 · 메뉴 ${done}/${items.length} 완료`;
}

function configOf(response) {
  return {
    orderEnabled: response?.orderEnabled ?? true,
    bankAccount: response?.bankAccount ?? "",
    bankHolder: response?.bankHolder ?? "",
  };
}

function formatTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(11, 16);
}

export default function OpsBoothOrders({ boothId, opsKey, notify, onSummary }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [serveFlash, setServeFlash] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [config, setConfig] = useState({ orderEnabled: true, bankAccount: "", bankHolder: "" });
  const [savedConfig, setSavedConfig] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  // 조용히 다시 읽는 쪽(타이머 · 실시간)에서 지금 입력값과 마지막으로 받은 값을 보려고 둔다.
  const configRef = useRef(config);
  const savedConfigRef = useRef(savedConfig);
  configRef.current = config;
  savedConfigRef.current = savedConfig;
  const knownIds = useRef(new Set());
  const freshIds = useRef(new Set());
  // 주문마다 마지막으로 본 상태. '준비 완료'로 막 바뀐 주문(주방에서 음식이 나옴)을 알아챈다.
  const lastStatus = useRef(new Map());
  // 이 화면에서 직접 상태를 바꾼 주문은 알림을 울리지 않는다.
  const selfChanged = useRef(new Set());
  const serveTimer = useRef(0);
  const soundTimer = useRef(0);
  const loadedOnce = useRef(false);
  const authFailed = useRef(false);

  const say = (text, tone) => (notify ? notify(text, tone) : undefined);

  async function load(silent = false) {
    if (!boothId || !opsKey) return;
    if (!silent) setLoading(true);
    try {
      const next = await fetchOpsBoothOrders(boothId, opsKey);
      // 조용히 다시 읽다가 처음 보는 입금 대기 주문이 있으면(실시간 연결이 끊긴 사이 들어온 주문) 알린다.
      if (silent && loadedOnce.current) {
        const fresh = (next.orders || []).filter(
          (order) => order.status === "PENDING_PAYMENT" && !knownIds.current.has(order.id),
        );
        if (fresh.length) {
          fresh.forEach((order) => {
            knownIds.current.add(order.id);
            freshIds.current.add(order.id);
            window.setTimeout(() => freshIds.current.delete(order.id), 60000);
          });
          const latest = fresh[0];
          setFlash(`새 주문 · ${tableName(latest.tableLabel)} · ${formatWon(latest.totalAmount)}`);
          playChime("order");
          window.setTimeout(() => setFlash(""), 8000);
        }
      }
      // 주방에서 막 '완료'한 주문: 서빙하라고 알린다.
      if (loadedOnce.current) {
        const served = (next.orders || []).filter(
          (order) => order.status === "READY" && lastStatus.current.get(order.id) !== "READY" && !selfChanged.current.has(order.id),
        );
        if (served.length) {
          setServeFlash(`음식 나왔어요 · ${served.map((order) => (isTakeout(order.tableLabel) ? `포장 #${order.orderNo || order.id}` : tableName(order.tableLabel))).join(", ")} · ${served.every((order) => isTakeout(order.tableLabel)) ? "손님이 받으러 와요" : "가져다주세요"}`);
          playChime("ready");
          window.clearTimeout(serveTimer.current);
          serveTimer.current = window.setTimeout(() => setServeFlash(""), 10000);
        }
      }
      (next.orders || []).forEach((order) => lastStatus.current.set(order.id, order.status));
      loadedOnce.current = true;
      setData(next);
      // 조용히 다시 읽을 때: 고치던 중이면 입력칸을 건드리지 않고(고치던 계좌가 지워지지 않게),
      // 손대지 않았으면 서버 값으로 맞춘다(다른 폰이 바꾼 계좌 · 주문 받기가 이 폰에도 보이게).
      if (!silent || JSON.stringify(configRef.current) === savedConfigRef.current) {
        const nextConfig = configOf(next);
        setConfig(nextConfig);
        setSavedConfig(JSON.stringify(nextConfig));
      }
      setError("");
      authFailed.current = false;
    } catch (e) {
      // 키가 틀렸거나 잠긴 상태면 자동으로 다시 읽지 않는다(틀린 키로 계속 두드리면 잠금이 길어진다).
      authFailed.current = e?.status === 401 || e?.status === 403 || e?.status === 429;
      setError(e.message || "주문을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boothId, opsKey]);

  useEffect(() => {
    if (!data) return;
    (data.orders || []).forEach((order) => knownIds.current.add(order.id));
  }, [data]);

  useEffect(() => {
    if (!boothId || !opsKey) return undefined;
    const stream = createOrderStream();
    let timer = null;
    // 주문이 몰리면 이벤트마다 목록을 다시 읽지 않고 0.4초 모아서 한 번만 읽는다.
    let reloadTimer = null;
    const reloadSoon = () => {
      if (reloadTimer) return;
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        load(true);
      }, 400);
    };
    // 실시간 연결이 조용히 끊겨도 놓치지 않게 15초마다, 화면으로 돌아올 때 다시 읽는다.
    const poll = () => {
      if (document.visibilityState !== "hidden" && !authFailed.current) load(true);
    };
    const pollTimer = window.setInterval(poll, 15000);
    document.addEventListener("visibilitychange", poll);
    stream.addEventListener("orders", (event) => {
      try {
        const order = JSON.parse(event.data);
        if (String(order.boothId) !== String(boothId)) return;
        if (order.status === "PENDING_PAYMENT" && !knownIds.current.has(order.id)) {
          knownIds.current.add(order.id);
          freshIds.current.add(order.id);
          window.setTimeout(() => freshIds.current.delete(order.id), 60000);
          setFlash(`새 주문 · ${tableName(order.tableLabel)} · ${formatWon(order.totalAmount)}`);
          playChime("order");
          if (timer) window.clearTimeout(timer);
          timer = window.setTimeout(() => setFlash(""), 8000);
        }
        reloadSoon();
      } catch {
        // ignore
      }
    });
    return () => {
      if (timer) window.clearTimeout(timer);
      if (reloadTimer) window.clearTimeout(reloadTimer);
      window.clearTimeout(serveTimer.current);
      window.clearTimeout(soundTimer.current);
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", poll);
      stream.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boothId, opsKey]);

  const allOrders = data?.orders || [];
  // 서빙할 것: 요리사가 완료한 주문. 먼저 나온 음식이 앞에 온다. 늘 맨 위에 따로 보여 준다.
  const readyOrders = useMemo(
    () =>
      allOrders
        .filter((order) => order.status === "READY")
        .sort((a, b) => String(a.readyAt || "").localeCompare(String(b.readyAt || "")) || a.id - b.id),
    [allOrders],
  );
  // 입금 확인할 것(먼저 들어온 주문부터) → 조리 중(입금 확인 순) → 끝난 주문(최신순).
  // 새 주문은 입금 대기 줄 맨 아래에 붙는다. 맨 위에 끼어들면 '입금 확인'을 누르는 순간 카드가 밀려 엉뚱한 주문을 누르게 된다(되돌릴 수 없음).
  const orders = useMemo(() => {
    const rank = (order) => (order.status === "PENDING_PAYMENT" ? 0 : order.status === "PAID" || order.status === "PREPARING" ? 1 : 2);
    const oldestFirst = (a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.id - b.id;
    return allOrders
      .filter((order) => order.status !== "READY" && (showAll || (order.status !== "COMPLETED" && order.status !== "CANCELED")))
      .sort((a, b) => {
        const byRank = rank(a) - rank(b);
        if (byRank) return byRank;
        if (rank(a) === 1) return String(a.paidAt || "").localeCompare(String(b.paidAt || "")) || oldestFirst(a, b);
        return rank(a) === 0 ? oldestFirst(a, b) : -oldestFirst(a, b);
      });
  }, [allOrders, showAll]);

  const pendingCount = allOrders.filter((o) => o.status === "PENDING_PAYMENT").length;
  const cookingCount = allOrders.filter((o) => o.status === "PAID" || o.status === "PREPARING").length;
  const readyCount = readyOrders.length;

  useEffect(() => {
    onSummary?.({ pending: pendingCount, cooking: cookingCount, ready: readyCount });
  }, [pendingCount, cookingCount, readyCount, onSummary]);

  async function changeStatus(order, status) {
    if (status === "CANCELED" && !window.confirm(`${tableName(order.tableLabel)} 주문 #${order.orderNo || order.id}을 취소할까요?`)) return;
    setBusyId(order.id);
    selfChanged.current.add(order.id);
    try {
      await updateOpsBoothOrderStatus(boothId, order.id, status, opsKey);
      await load(true);
      say(`${tableName(order.tableLabel)} · ${status === "COMPLETED" ? (isTakeout(order.tableLabel) ? "건네줌" : "서빙 완료") : STATUS_LABEL[status] || status}`, "success");
    } catch (e) {
      say(e.message || "상태를 바꾸지 못했어요.", "error");
      // 요리사 창에서 먼저 넘긴 주문일 수 있다. 다시 읽어 맞는 상태를 보여 준다.
      load(true);
    } finally {
      selfChanged.current.delete(order.id);
      setBusyId(null);
    }
  }

  // 현장에서 기기 소리가 충분히 큰지 미리 들어 본다: 새 주문 소리 → 음식 나옴 소리.
  function testSound() {
    playChime("order");
    window.clearTimeout(soundTimer.current);
    soundTimer.current = window.setTimeout(() => playChime("ready"), 2600);
    say("새 주문 소리 → 음식 나옴 소리 순서로 나요. 작으면 기기 소리를 올려 주세요.");
  }

  async function saveConfig() {
    setSavingConfig(true);
    try {
      // 이 폰이 화면을 연 뒤 다른 폰이 계좌나 '주문 받기'를 바꿨을 수 있다. 통째로 보내면 그 변경을 되돌린다.
      // 저장 직전에 서버 값을 다시 읽고, 이 폰에서 실제로 바꾼 칸만 그 위에 얹어 보낸다.
      const base = savedConfig ? JSON.parse(savedConfig) : config;
      const server = configOf(await fetchOpsBoothOrders(boothId, opsKey));
      const merged = { ...server };
      Object.keys(config).forEach((field) => {
        if (config[field] !== base[field]) merged[field] = config[field];
      });
      const next = await updateOpsBoothOrderConfig(boothId, merged, opsKey);
      setData(next);
      setConfig(merged);
      setSavedConfig(JSON.stringify(merged));
      setError("");
      say("주문 설정을 저장했어요.", "success");
    } catch (e) {
      say(e.message || "주문 설정을 저장하지 못했어요.", "error");
    } finally {
      setSavingConfig(false);
    }
  }

  if (!boothId || !opsKey) return null;

  const configDirty = savedConfig && JSON.stringify(config) !== savedConfig;

  const renderOrder = (order) => {
    const next = NEXT_ACTION[order.status];
    const active = order.status !== "COMPLETED" && order.status !== "CANCELED";
    const busy = busyId === order.id;
    const fresh = freshIds.current.has(order.id) && order.status === "PENDING_PAYMENT";
    const takeout = isTakeout(order.tableLabel);
    const phoneTail = `${order.phoneNumber || ""}`.replace(/\D/g, "").slice(-4);
    return (
      <div key={order.id} className={`ops-order${fresh ? " ops-order--new" : ""}${active ? "" : " ops-order--done"}`}>
        <div className="ops-order__head">
          <div>
            <div className="ops-order__table">
              {takeout ? (
                <>
                  <span className="ops-takeout-tag">포장</span> #{order.orderNo || order.id}
                  {phoneTail ? <small className="ops-takeout-tail"> 끝번호 {phoneTail}</small> : null}
                </>
              ) : (
                `${order.tableLabel} 테이블`
              )}
            </div>
            <div className="ops-order__meta">
              #{order.orderNo || order.id} · {formatTime(order.createdAt)} · {order.depositorName}
              {order.phoneNumber && !takeout ? ` · ${order.phoneNumber}` : ""}
              {order.phoneNumber && takeout ? <> · <a href={`tel:${order.phoneNumber.replace(/[^0-9+]/g, "")}`}>{order.phoneNumber}</a></> : null}
            </div>
          </div>
          <span className={`ops-chip ops-chip--dot ops-chip--${STATUS_TONE[order.status] || ""}`}>{STATUS_LABEL[order.status] || order.status}</span>
        </div>
        <ul className="ops-order__items">
          {order.items?.map((item) => {
            // 주방이 끝낸 메뉴에 ✓. 끝난 주문에서는 다 끝난 게 당연해 표시하지 않는다.
            const done = Boolean(item.doneAt) && active;
            return (
              <li key={`${order.id}-${item.lineNo ?? item.name}`} className={done ? "ops-item--done" : ""}>
                <span>{item.name}<em>× {item.quantity}</em>{done ? <i className="ops-item__done">✓</i> : null}</span>
                <span>{formatWon(item.lineTotal)}</span>
              </li>
            );
          })}
        </ul>
        {order.request && <div className="ops-order__request">요청 · {order.request}</div>}
        {next?.kitchen && <p className="ops-order__kitchen">{kitchenHint(order)}</p>}
        <div className="ops-order__foot">
          <span className="ops-order__total">{formatWon(order.totalAmount)}</span>
          {active && (
            <div className="ops-row">
              <button type="button" className="ops-btn ops-btn--danger ops-btn--sm" disabled={busy} onClick={() => changeStatus(order, "CANCELED")}>취소</button>
              {next && (
                <button
                  type="button"
                  className={`ops-btn ops-btn--sm ${next.primary ? "ops-btn--primary" : "ops-btn--ghost"}`}
                  title={next.kitchen ? "주방 기기를 못 쓸 때만 여기서 눌러요 · 남은 메뉴를 모두 완료로 적어요" : undefined}
                  disabled={busy}
                  onClick={() => changeStatus(order, next.status)}
                >
                  {busy ? "처리 중…" : takeout && next.status === "COMPLETED" ? "건네줌" : next.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <article className="ops-card">
        <div className="ops-card__head">
          <div>
            <h2>주문</h2>
            <p>
              손님이 테이블 QR로 넣은 주문이 바로 떠요. 입금 확인을 누르면 메뉴별 요리사 창에 뜨고, 주문에 든 메뉴가 모두
              완료되면 ‘서빙할 것’에 올라와요. 가져다준 뒤 서빙 완료를 눌러요.
            </p>
          </div>
          <div className="ops-card__actions">
            <span className="ops-chip ops-chip--yellow">대기 {pendingCount}</span>
            <span className="ops-chip ops-chip--violet">조리 {cookingCount}</span>
            <span className="ops-chip ops-chip--green">서빙 {readyCount}</span>
          </div>
        </div>

        {flash && <div className="ops-banner">{flash}</div>}
        {serveFlash && <div className="ops-banner ops-banner--green">{serveFlash}</div>}
        {error && <div className="ops-banner ops-banner--red">{error}</div>}

        {readyOrders.length > 0 && (
          <div className="ops-serve">
            <div className="ops-serve__head">
              <strong>서빙할 것 {readyOrders.length}</strong>
              <span>음식이 나왔어요. 테이블에 가져다주고 ‘서빙 완료’를 눌러요. 포장은 손님이 번호를 보여 주면 건네주고 ‘건네줌’.</span>
            </div>
            <div className="ops-orders">{readyOrders.map(renderOrder)}</div>
          </div>
        )}

        <div className="ops-row ops-row--between ops-row--wrap">
          <div className="ops-seg">
            <button type="button" className={!showAll ? "ops-seg--on" : ""} onClick={() => setShowAll(false)}>처리 중</button>
            <button type="button" className={showAll ? "ops-seg--on" : ""} onClick={() => setShowAll(true)}>오늘 전체</button>
          </div>
          <div className="ops-row ops-row--wrap">
            <button type="button" className="ops-btn ops-btn--ghost ops-btn--sm" onClick={testSound}>알림 소리 듣기</button>
            <Link to={`/ops/booth/${boothId}/kitchen`} className="ops-btn ops-btn--dark ops-btn--sm">요리사 창 열기</Link>
            <Link to={`/ops/booth/${boothId}/table-qr`} className="ops-btn ops-btn--ghost ops-btn--sm">주문 QR 인쇄</Link>
          </div>
        </div>
        <p className="ops-order__kitchen">
          완료는 메뉴별 요리사 창에서 메뉴마다 눌러요. 주문 카드의 회색 ‘준비 완료’는 주방 기기를 못 쓸 때만 대신 눌러요(남은 메뉴를 모두 완료로 적어요).
        </p>

        {loading && !data && <div className="ops-skeleton" style={{ height: 120 }} />}

        {data && orders.length === 0 && readyOrders.length === 0 && (
          <div className="ops-empty">
            {showAll ? "오늘 들어온 주문이 없어요." : "처리 중인 주문이 없어요. 손님이 QR로 주문하면 여기 바로 떠요."}
          </div>
        )}

        {orders.length > 0 && <div className="ops-orders">{orders.map(renderOrder)}</div>}
      </article>

      <article className="ops-card">
        <div className="ops-card__head">
          <div>
            <h2>주문 받기</h2>
            <p>계좌는 손님 결제 화면에 그대로 보여요. 메뉴 가격은 메뉴판의 숫자를 써요.</p>
          </div>
          <div className="ops-card__actions">
            <button type="button" className={`ops-btn ops-btn--sm ${configDirty ? "ops-btn--primary" : "ops-btn--ghost"}`} disabled={savingConfig || !configDirty} onClick={saveConfig}>
              {savingConfig ? "저장 중…" : configDirty ? "설정 저장" : "저장됨"}
            </button>
          </div>
        </div>
        <label className="ops-switch">
          <span className="ops-switch__text">
            <strong>QR 주문 받기</strong>
            <small>끄면 손님 QR 화면에 "주문을 받지 않아요"가 떠요.</small>
          </span>
          <input type="checkbox" checked={config.orderEnabled} onChange={(e) => setConfig((c) => ({ ...c, orderEnabled: e.target.checked }))} />
          <span className="ops-switch__knob" />
        </label>
        <div className="ops-grid-2">
          <label className="ops-field">
            <span>입금 계좌</span>
            <input value={config.bankAccount} onChange={(e) => setConfig((c) => ({ ...c, bankAccount: e.target.value }))} placeholder="예) 국민 000000-00-000000" maxLength={200} />
          </label>
          <label className="ops-field">
            <span>예금주</span>
            <input value={config.bankHolder} onChange={(e) => setConfig((c) => ({ ...c, bankHolder: e.target.value }))} placeholder="예) 아주대 총학생회" maxLength={60} />
          </label>
        </div>
      </article>
    </>
  );
}
