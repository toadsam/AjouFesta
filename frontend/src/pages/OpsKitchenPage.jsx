// 요리사 창(주방 화면). 주방이 메뉴별로 나뉘어 있어(두부김치 · 어묵탕 …) 기기마다 맡은 메뉴 하나를 고르고,
// 입금이 확인된 주문 가운데 그 메뉴가 든 것만, 입금이 확인된 순서대로(먼저 확인된 주문이 맨 위) 본다.
// 카드에는 그 주문에서 내 메뉴 몫만 크게 뜨고, '완료'를 누르면 그 줄만 끝난다. 주문에 든 메뉴가 모두 완료되면
// 서버가 주문을 '서빙할 것'(READY)으로 올리고 콘솔 · 손님 화면이 같이 바뀐다.
// 주소: /ops/booth/:id/kitchen?menu=두부김치 (메뉴 이름) · ?menu=all (한 주방이 다 만들 때). 없으면 고르는 화면.
// 금액 · 입금자 이름 · 전화번호는 주방에 필요 없어 보여 주지 않는다. 스타일은 styles/v2-ops.css 의 kt-.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { createOrderStream, fetchOpsBoothBootstrap, fetchOpsBoothOrders, markOpsBoothOrderItemDone } from "../api";
import { IconArrowLeft, IconRefresh } from "../components/UxIcons";
import { chimeReady, playChime } from "../utils/chime";
import { isTakeout, tableName } from "../utils/orderCart";

const BOOTH_KEY_STORAGE_KEY = "festflow_ops_booth_key";
const ALL_MENUS = "all";
// '완료'를 잘못 눌렀을 때 되돌릴 수 있는 시간. 서버는 끝난 줄을 되돌리지 못해서, 이 시간이 지난 뒤에야 서버로 보낸다.
const UNDO_MS = 5000;
// 입금 확인 뒤 이만큼 지나면 카드에 붉게 표시한다.
const LATE_MINUTES = 10;

// 서버가 주는 "2026-10-07T18:40:12" (한국 시간, 시간대 없음)을 읽는다.
function parseLocal(value) {
  if (!value) return 0;
  const time = new Date(`${value}`.slice(0, 19)).getTime();
  return Number.isFinite(time) ? time : 0;
}

const paidTime = (order) => parseLocal(order.paidAt || order.createdAt);

function clock(value) {
  return value ? `${value}`.slice(11, 16) : "";
}

function minutesSince(order, now) {
  const at = paidTime(order);
  return at ? Math.max(0, Math.floor((now - at) / 60_000)) : 0;
}

// 메뉴판(JSON)에서 이름만. 깨진 값이면 빈 목록.
function menuNamesOf(raw) {
  try {
    const rows = JSON.parse(raw || "[]");
    return Array.isArray(rows) ? rows.map((row) => `${row?.name ?? ""}`.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const lineKey = (orderId, lineNo) => `${orderId}:${lineNo}`;
const isCooking = (order) => order.status === "PAID" || order.status === "PREPARING";

export default function OpsKitchenPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // 맡은 메뉴. "all" 이면 모든 메뉴, 비어 있으면 아직 안 고름.
  const menuParam = (searchParams.get("menu") || "").trim();
  const allMenus = menuParam === ALL_MENUS;
  const myMenu = allMenus ? "" : menuParam;
  const [key, setKey] = useState(() => sessionStorage.getItem(BOOTH_KEY_STORAGE_KEY) || "");
  const [keyInput, setKeyInput] = useState("");
  const [boothName, setBoothName] = useState("");
  const [menuNames, setMenuNames] = useState([]);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [authFailed, setAuthFailed] = useState(false);
  const [flash, setFlash] = useState("");
  // 완료를 누르고 아직 서버로 보내지 않은 줄: { "주문id:줄번호": 보낼 시각(performance.now 기준) }
  const [pending, setPending] = useState({});
  // 되돌릴 시간이 끝나 서버로 보내는 중인 줄
  const [sending, setSending] = useState([]);
  const [, setTick] = useState(0);
  const [soundOn, setSoundOn] = useState(chimeReady);
  const knownIds = useRef(null);
  const pendingTimers = useRef(new Map());
  const authFailedRef = useRef(false);
  const flashTimer = useRef(0);
  const keyRef = useRef(key);
  keyRef.current = key;
  const menuRef = useRef({ allMenus, myMenu });
  menuRef.current = { allMenus, myMenu };

  // 이 줄이 내 주방 몫인가.
  const mine = (item) => (menuRef.current.allMenus ? true : item.name === menuRef.current.myMenu);
  // 이 주문에서 내가 아직 만들 줄.
  const todoLines = (order) => (order.items || []).filter((item) => mine(item) && !item.doneAt);

  async function load(currentKey = keyRef.current) {
    if (!currentKey) return;
    try {
      const next = await fetchOpsBoothOrders(id, currentKey);
      const list = Array.isArray(next?.orders) ? next.orders : [];
      // 처음 읽을 때는 조용히, 그 뒤로 처음 보는 '내 몫이 있는' 주문이 있으면 알린다.
      const cooking = list.filter((order) => isCooking(order) && todoLines(order).length > 0);
      if (knownIds.current) {
        const fresh = cooking.filter((order) => !knownIds.current.has(order.id));
        if (fresh.length) {
          const oldest = [...fresh].sort((a, b) => paidTime(a) - paidTime(b))[0];
          setFlash(`새 주문 · ${tableName(oldest.tableLabel)}${fresh.length > 1 ? ` 외 ${fresh.length - 1}건` : ""}`);
          playChime("kitchen");
          window.clearTimeout(flashTimer.current);
          flashTimer.current = window.setTimeout(() => setFlash(""), 8000);
        }
      } else {
        knownIds.current = new Set();
      }
      cooking.forEach((order) => knownIds.current.add(order.id));
      setOrders(list);
      setError("");
      authFailedRef.current = false;
      setAuthFailed(false);
    } catch (loadError) {
      // 키가 틀렸거나 잠긴 상태면 자동으로 다시 읽지 않는다(틀린 키로 계속 두드리면 잠금이 길어진다).
      const failed = loadError?.status === 401 || loadError?.status === 403 || loadError?.status === 429;
      authFailedRef.current = failed;
      setAuthFailed(failed);
      setError(loadError.message || "주문을 불러오지 못했어요.");
    }
  }

  useEffect(() => {
    if (!key) return undefined;
    knownIds.current = null;
    load(key);
    let alive = true;
    fetchOpsBoothBootstrap(id, key)
      .then((bootstrap) => {
        if (!alive) return;
        setBoothName(bootstrap?.booth?.name || "");
        setMenuNames(menuNamesOf(bootstrap?.booth?.menuBoardJson));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key]);

  // 맡은 메뉴를 바꾸면 '처음 보는 주문' 기준을 다시 잡는다(바꾼 직후 소리가 한꺼번에 울리지 않게).
  useEffect(() => {
    knownIds.current = null;
    if (key) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuParam]);

  // 실시간: 주문이 바뀌면 바로 다시 읽는다. 연결이 조용히 끊겨도 놓치지 않게 15초마다, 화면으로 돌아올 때도 읽는다.
  useEffect(() => {
    if (!key) return undefined;
    let stream = null;
    let reloadTimer = null;
    const reloadSoon = () => {
      if (reloadTimer) return;
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        if (!authFailedRef.current) load();
      }, 400);
    };
    try {
      stream = createOrderStream();
      stream.addEventListener("orders", (event) => {
        try {
          const order = JSON.parse(event.data);
          if (String(order.boothId) === String(id)) reloadSoon();
        } catch {
          // 잘못된 페이로드는 무시한다.
        }
      });
    } catch {
      // 스트림이 없으면 15초마다 읽는 것으로 본다.
    }
    const poll = () => {
      if (document.visibilityState !== "hidden" && !authFailedRef.current) load();
    };
    const pollTimer = window.setInterval(poll, 15000);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("focus", poll);
    return () => {
      stream?.close();
      if (reloadTimer) window.clearTimeout(reloadTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("focus", poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key]);

  // 지난 시간 · 되돌리기 남은 초를 다시 그린다.
  const hasPending = Object.keys(pending).length > 0;
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), hasPending ? 250 : 10000);
    return () => window.clearInterval(timer);
  }, [hasPending]);

  // 주방 기기 화면이 꺼지지 않게 한다(되는 브라우저에서만). 다른 앱에 갔다 오면 다시 건다.
  useEffect(() => {
    if (!key || !navigator.wakeLock?.request) return undefined;
    let lock = null;
    let closed = false;
    const hold = () => {
      if (closed || document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((next) => {
          if (closed) next.release().catch(() => {});
          else lock = next;
        })
        .catch(() => {});
    };
    hold();
    document.addEventListener("visibilitychange", hold);
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", hold);
      lock?.release().catch(() => {});
    };
  }, [key]);

  // 화면을 한 번 누르면 소리가 켜진다.
  useEffect(() => {
    if (soundOn) return undefined;
    const check = () => window.setTimeout(() => setSoundOn(chimeReady()), 150);
    document.addEventListener("pointerdown", check);
    return () => document.removeEventListener("pointerdown", check);
  }, [soundOn]);

  function clearPending(lineId) {
    window.clearTimeout(pendingTimers.current.get(lineId));
    pendingTimers.current.delete(lineId);
    setPending((current) => {
      const { [lineId]: _removed, ...rest } = current;
      return rest;
    });
  }

  // 되돌릴 시간이 끝났다. 서버로 보내는 동안에도 줄은 '완료로 넘기는 중' 그대로 둔다.
  async function commit(orderId, lineNo) {
    const lineId = lineKey(orderId, lineNo);
    if (!pendingTimers.current.has(lineId)) return;
    window.clearTimeout(pendingTimers.current.get(lineId));
    pendingTimers.current.delete(lineId);
    setSending((current) => [...current, lineId]);
    try {
      await markOpsBoothOrderItemDone(id, orderId, lineNo, keyRef.current);
    } catch (sendError) {
      // 409: 콘솔에서 이미 넘겼거나 취소한 주문. 다시 읽으면 맞는 상태가 보인다.
      if (sendError?.status !== 409) setError(sendError.message || "보내지 못했어요. 다시 눌러 주세요.");
    } finally {
      await load();
      setSending((current) => current.filter((item) => item !== lineId));
      clearPending(lineId);
    }
  }

  function finish(orderId, lineNo) {
    const lineId = lineKey(orderId, lineNo);
    if (pendingTimers.current.has(lineId)) return;
    pendingTimers.current.set(lineId, window.setTimeout(() => commit(orderId, lineNo), UNDO_MS));
    setPending((current) => ({ ...current, [lineId]: performance.now() + UNDO_MS }));
  }

  // 되돌릴 시간을 기다리던 '완료'는 화면을 떠날 때(다른 앱 · 뒤로 가기) 바로 보낸다. 눌러 놓고 사라지지 않게.
  useEffect(() => {
    const flush = () => {
      [...pendingTimers.current.keys()].forEach((lineId) => {
        const [orderId, lineNo] = lineId.split(":");
        window.clearTimeout(pendingTimers.current.get(lineId));
        pendingTimers.current.delete(lineId);
        markOpsBoothOrderItemDone(id, orderId, Number(lineNo), keyRef.current).catch(() => {});
      });
      setPending({});
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [id]);

  // 입금이 확인된 순서. 같은 시각이면 먼저 들어온 주문이 먼저. 내 몫이 남은 주문만.
  const queue = useMemo(
    () =>
      (orders || [])
        .filter((order) => isCooking(order) && todoLines(order).length > 0)
        .sort((a, b) => paidTime(a) - paidTime(b) || a.id - b.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, menuParam],
  );

  // 콘솔에서 취소했거나 이미 넘긴 줄은 되돌리기 대기에서 뺀다.
  useEffect(() => {
    [...pendingTimers.current.keys()].forEach((lineId) => {
      const [orderId, lineNo] = lineId.split(":");
      const order = queue.find((item) => String(item.id) === orderId);
      if (!order || !todoLines(order).some((item) => String(item.lineNo) === lineNo)) clearPending(lineId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const linePending = (order, item) => lineKey(order.id, item.lineNo) in pending;
  // 아직 완료를 누르지 않은 줄이 남은 주문.
  const toMake = queue.filter((order) => todoLines(order).some((item) => !linePending(order, item)));
  const totals = useMemo(() => {
    const tally = new Map();
    toMake.forEach((order) =>
      todoLines(order)
        .filter((item) => !linePending(order, item))
        .forEach((item) => tally.set(item.name, (tally.get(item.name) || 0) + (Number(item.quantity) || 0))),
    );
    return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, pending]);
  // 내 몫은 끝났는데 다른 주방이 아직인 주문.
  const waitingOthers = (orders || [])
    .filter((order) => isCooking(order) && todoLines(order).length === 0 && (order.items || []).some((item) => mine(item)))
    .sort((a, b) => paidTime(a) - paidTime(b) || a.id - b.id);
  const waitingToServe = (orders || [])
    .filter((order) => order.status === "READY")
    .sort((a, b) => parseLocal(a.readyAt) - parseLocal(b.readyAt) || a.id - b.id);
  // 메뉴 고르기 목록: 메뉴판 + 지금 주문에만 있는 이름(메뉴판에서 이름을 바꿨을 때).
  const pickable = useMemo(() => {
    const names = [...menuNames];
    (orders || []).forEach((order) => {
      if (!isCooking(order)) return;
      (order.items || []).forEach((item) => {
        if (item.name && !names.includes(item.name)) names.push(item.name);
      });
    });
    return names;
  }, [menuNames, orders]);
  const countFor = (name) =>
    (orders || []).filter((order) => isCooking(order) && (order.items || []).some((item) => item.name === name && !item.doneAt)).length;

  function pickMenu(name) {
    setPending({});
    [...pendingTimers.current.values()].forEach((timer) => window.clearTimeout(timer));
    pendingTimers.current.clear();
    setSearchParams(name ? { menu: name } : {}, { replace: true });
  }

  function handleKeySubmit(event) {
    event.preventDefault();
    const next = keyInput.trim();
    if (!next) return;
    sessionStorage.setItem(BOOTH_KEY_STORAGE_KEY, next);
    setError("");
    setKey(next);
  }

  function forgetKey() {
    sessionStorage.removeItem(BOOTH_KEY_STORAGE_KEY);
    setKeyInput("");
    setOrders(null);
    setError("");
    setAuthFailed(false);
    setKey("");
  }

  if (!key) {
    return (
      <div className="ops-gate" data-i18n-skip>
        <form className="ops-gate__card" onSubmit={handleKeySubmit}>
          <img src="/images/chito-wave.png" alt="" onError={(e) => { e.currentTarget.src = "/images/chito.png"; }} />
          <h1>요리사 창</h1>
          <p>주방에서 보는 화면이에요. 운영진에게 받은 부스 키를 넣어 주세요.</p>
          <input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="부스 키" autoComplete="off" autoFocus />
          <button type="submit" className="ops-btn ops-btn--primary ops-btn--block" disabled={!keyInput.trim()}>
            열기
          </button>
        </form>
      </div>
    );
  }

  const errorBanner = error ? (
    <div className="ops-banner ops-banner--red">
      <span>{error}</span>
      {authFailed && (
        <button type="button" className="ops-btn ops-btn--ghost ops-btn--sm" onClick={forgetKey}>
          키 다시 넣기
        </button>
      )}
    </div>
  ) : null;

  // 맡은 메뉴를 아직 안 골랐다: 고르는 화면.
  if (!menuParam) {
    return (
      <div className="kt" data-i18n-skip>
        <header className="kt__top">
          <Link to={`/ops/booth/${id}`} className="kt__icon" aria-label="주문 콘솔로">
            <IconArrowLeft />
          </Link>
          <div className="kt__title">
            <small>요리사 창 · {boothName || "주방"}</small>
            <strong>이 기기가 맡은 메뉴는?</strong>
          </div>
          <span />
        </header>
        {errorBanner}
        <section className="kt-pick" aria-label="맡은 메뉴 고르기">
          <p className="kt-pick__hint">주방마다 기기 하나씩. 고른 메뉴가 든 주문만 떠요. 나중에 위쪽 메뉴 이름을 누르면 바꿀 수 있어요.</p>
          {orders == null && !error && pickable.length === 0 ? <div className="ops-skeleton" style={{ height: 120 }} /> : null}
          <div className="kt-pick__grid">
            {pickable.map((name) => {
              const count = countFor(name);
              return (
                <button key={name} type="button" className="kt-pick__item" onClick={() => pickMenu(name)}>
                  <strong>{name}</strong>
                  <small>{count ? `지금 만들 주문 ${count}건` : "지금 만들 주문 없음"}</small>
                </button>
              );
            })}
          </div>
          <button type="button" className="kt-pick__all" onClick={() => pickMenu(ALL_MENUS)}>
            <strong>모든 메뉴</strong>
            <small>한 주방이 다 만들 때 · 메뉴마다 완료를 따로 눌러요</small>
          </button>
        </section>
      </div>
    );
  }

  const now = Date.now();

  return (
    <div className="kt" data-i18n-skip>
      <header className="kt__top">
        <Link to={`/ops/booth/${id}`} className="kt__icon" aria-label="주문 콘솔로">
          <IconArrowLeft />
        </Link>
        <button type="button" className="kt__title kt__title--menu" onClick={() => pickMenu("")} title="맡은 메뉴 바꾸기">
          <small>요리사 창 · {boothName || "주방"} · 입금 확인된 순서</small>
          <strong>
            {allMenus ? "모든 메뉴" : myMenu}
            <span className="kt__title-change">바꾸기</span>
          </strong>
        </button>
        <button type="button" className="kt__icon" aria-label="새로고침" onClick={() => load()}>
          <IconRefresh />
        </button>
      </header>

      <section className="kt-sum" aria-label="지금 만들 것">
        <div className="kt-sum__head">
          <strong>지금 만들 것</strong>
          <span>주문 {toMake.length}건</span>
        </div>
        {totals.length ? (
          <div className="kt-totals">
            {totals.map(([name, quantity]) => (
              <span key={name} className="kt-total">
                {name}
                <b>{quantity}</b>
              </span>
            ))}
          </div>
        ) : (
          <p className="kt-sum__none">없어요</p>
        )}
      </section>

      <div className="kt-sound">
        <span>
          {soundOn
            ? "새 주문이 오면 소리가 나요. 기기 소리(미디어 음량)를 끝까지 올려 두세요."
            : "화면을 한 번 누르면 새 주문이 올 때 소리가 나요."}
        </span>
        <button type="button" className="ops-btn ops-btn--ghost ops-btn--sm" onClick={() => playChime("kitchen")}>
          소리 듣기
        </button>
      </div>
      {flash && <div className="ops-banner">{flash}</div>}
      {errorBanner}

      {orders == null && !error && <div className="ops-skeleton" style={{ height: 160 }} />}

      {orders != null && queue.length === 0 && (
        <div className="kt-empty">
          <strong>{allMenus ? "지금 만들 주문이 없어요" : `지금 만들 ‘${myMenu}’ 주문이 없어요`}</strong>
          <p>주문 콘솔에서 입금을 확인하면 {allMenus ? "여기에" : "이 메뉴가 든 주문이"} 바로 떠요.</p>
        </div>
      )}

      {queue.length > 0 && (
        <div className="kt-orders">
          {queue.map((order) => {
            const lines = todoLines(order);
            const allWaiting = lines.every((item) => linePending(order, item));
            // '먼저': 아직 완료를 누르지 않은 주문 가운데 입금이 가장 먼저 확인된 것.
            const first = toMake[0]?.id === order.id;
            const minutes = minutesSince(order, now);
            const tone = allWaiting ? "done" : "waiting";
            // 이 주문의 다른 줄(다른 주방 몫 · 이미 끝난 것). 같이 나가는 음식이 뭔지 보여 준다.
            const others = (order.items || []).filter((item) => !lines.includes(item));
            return (
              <article key={order.id} className={`kt-order kt-order--${tone}${minutes >= LATE_MINUTES && !allWaiting ? " kt-order--late" : ""}${isTakeout(order.tableLabel) ? " kt-order--takeout" : ""}`}>
                <div className="kt-order__head">
                  <div>
                    <strong className="kt-order__table">
                      {isTakeout(order.tableLabel) ? <><span className="kt-takeout-tag">포장</span> 용기에 담아요</> : `${order.tableLabel} 테이블`}
                    </strong>
                    <small className="kt-order__meta">
                      #{order.orderNo || order.id} · 입금 확인 {clock(order.paidAt || order.createdAt)}
                    </small>
                  </div>
                  <div className="kt-order__side">
                    {first ? <em className="kt-first">먼저</em> : null}
                    <span className="kt-order__ago">{minutes < 1 ? "방금" : `${minutes}분 전`}</span>
                  </div>
                </div>
                <ul className="kt-order__items kt-order__items--mine">
                  {lines.map((item) => {
                    const lineId = lineKey(order.id, item.lineNo);
                    const waiting = lineId in pending;
                    const leaving = sending.includes(lineId);
                    const left = waiting ? Math.max(1, Math.ceil((pending[lineId] - performance.now()) / 1000)) : 0;
                    return (
                      <li key={lineId} className={waiting ? "kt-line--done" : ""}>
                        <span className="kt-line__name">
                          {item.name}
                          <b>× {item.quantity}</b>
                        </span>
                        {leaving ? (
                          <span className="kt-state kt-state--done">넘기는 중…</span>
                        ) : waiting ? (
                          <button type="button" className="kt-btn kt-btn--undo" onClick={() => clearPending(lineId)}>
                            되돌리기 {left}
                          </button>
                        ) : (
                          <button type="button" className="kt-btn kt-btn--done" onClick={() => finish(order.id, item.lineNo)}>
                            완료
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {order.request && <p className="kt-order__request">요청 · {order.request}</p>}
                {others.length > 0 && (
                  <p className="kt-order__others">
                    같이 나가요 ·{" "}
                    {others.map((item, index) => (
                      <span key={`${order.id}-${item.lineNo ?? index}`} className={item.doneAt ? "kt-other--done" : ""}>
                        {index ? ", " : ""}
                        {item.name} {item.quantity}
                        {item.doneAt ? " ✓" : ""}
                      </span>
                    ))}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {waitingOthers.length > 0 && (
        <p className="kt-served kt-served--others">
          <strong>내 몫은 끝난 주문 {waitingOthers.length}건</strong> · 다른 주방 기다리는 중:{" "}
          {waitingOthers
            .map((order) => {
              const left = (order.items || []).filter((item) => !item.doneAt).map((item) => item.name);
              return `${isTakeout(order.tableLabel) ? `포장 #${order.orderNo || order.id}` : order.tableLabel}(${left.join(" · ")})`;
            })
            .join(", ")}
        </p>
      )}

      {waitingToServe.length > 0 && (
        <p className="kt-served">
          <strong>다 만든 주문 {waitingToServe.length}건</strong> · 서빙 기다리는 중:{" "}
          {waitingToServe.map((order) => (isTakeout(order.tableLabel) ? `포장 #${order.orderNo || order.id}` : order.tableLabel)).join(", ")}
        </p>
      )}
    </div>
  );
}
