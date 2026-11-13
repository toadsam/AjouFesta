import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createOrderStream, fetchOrder, fetchOrderMenu } from "../../api";
import SkyReeds from "../../components/order/SkyReeds";
import { IconCheck, IconX } from "../../components/UxIcons";
import { formatWon, getRememberedOrder, isTakeout, TAKEOUT_PICKUP } from "../../utils/orderCart";
import "../../styles/order.css";

const STEPS = [
  { key: "PENDING_PAYMENT", label: "주문 접수", hint: "" },
  { key: "PAID", label: "입금 확인", hint: "스태프가 입금을 확인하고 있어요" },
  { key: "PREPARING", label: "조리 중", hint: "곧 준비돼요" },
  { key: "READY", label: "준비 완료", hint: "테이블로 가져다드려요" },
];

const STATUS_INDEX = { PENDING_PAYMENT: 0, PAID: 1, PREPARING: 2, READY: 3, COMPLETED: 4, CANCELED: -1 };

function formatClock(value) {
  if (!value) return "";
  const text = String(value);
  return text.length >= 16 ? text.slice(11, 16) : text;
}

export default function OrderStatusPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const key = searchParams.get("key") || getRememberedOrder(orderId)?.clientKey || "";

  const [order, setOrder] = useState(null);
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchOrder(orderId, key)
      .then((data) => {
        if (!alive) return;
        setOrder(data);
        setError("");
        return fetchOrderMenu(data.boothId, data.tableLabel)
          .then((m) => alive && setMenu(m))
          .catch(() => {});
      })
      .catch((e) => alive && setError(e.message || "주문을 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [orderId, key]);

  useEffect(() => {
    if (!order) return undefined;
    const stream = createOrderStream();
    stream.addEventListener("orders", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (String(payload.id) !== String(orderId)) return;
        const patch = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== null && value !== undefined));
        setOrder((current) => ({ ...(current || {}), ...patch, clientKey: current?.clientKey ?? key }));
      } catch {
        // ignore
      }
    });
    return () => stream.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, Boolean(order)]);

  // 실시간 연결은 서버 재시작 · 통신 끊김으로 조용히 멈출 수 있다. 끝나지 않은 주문은 20초마다, 화면으로 돌아올 때 다시 읽는다.
  const finished = order?.status === "COMPLETED" || order?.status === "CANCELED";
  useEffect(() => {
    if (!order || finished) return undefined;
    let alive = true;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      fetchOrder(orderId, key)
        .then((data) => alive && setOrder(data))
        .catch(() => {});
    };
    const timer = window.setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, key, Boolean(order), finished]);

  const statusIndex = order ? STATUS_INDEX[order.status] ?? 0 : 0;
  const canceled = order?.status === "CANCELED";
  const completed = order?.status === "COMPLETED";
  const takeout = isTakeout(order?.tableLabel);
  const readyToPickUp = takeout && order?.status === "READY";

  // 포장은 손님이 받으러 와야 하니, 음식이 나오면 폰을 울려 알린다(진동이 되는 폰만).
  useEffect(() => {
    if (!readyToPickUp) return;
    try {
      navigator.vibrate?.([300, 150, 300, 150, 500]);
    } catch {
      // 진동을 못 쓰는 기기
    }
  }, [readyToPickUp]);

  const headline = useMemo(() => {
    if (!order) return { title: "주문을 확인하고 있어요", body: "" };
    if (canceled) return { title: "주문이 취소되었어요", body: "궁금한 점은 부스 스태프에게 물어봐 주세요." };
    if (completed) return { title: "맛있게 드세요!", body: "주문이 모두 끝났어요. 바람이 더 맛있어지는 축제가 되길." };
    if (order.status === "READY" && takeout) {
      return { title: "포장이 나왔어요!", body: `${TAKEOUT_PICKUP}에서 주문번호를 보여 주고 받아 가세요.` };
    }
    if (order.status === "READY") return { title: "준비가 끝났어요!", body: "테이블로 가져다드릴게요." };
    if (order.status === "PREPARING") return { title: "조리 중이에요", body: "잠시만 기다려 주세요." };
    if (order.status === "PAID") return { title: "입금이 확인됐어요", body: "곧 조리를 시작해요." };
    return { title: "주문이 완료되었어요!", body: "입금이 확인되면 조리를 시작해요." };
  }, [order, canceled, completed, takeout]);

  return (
    <div className="od-page" style={{ paddingBottom: 176 }}>
      <SkyReeds height={330}>
        <div className="od-sky__fade" />
        <div className="od-done-hero">
          <div className={`od-done-hero__check ${canceled ? "od-done-hero__check--gray" : ""}`}>
            {canceled ? <IconX className="h-7 w-7" /> : <IconCheck className="h-7 w-7" />}
          </div>
          <h1>{headline.title}</h1>
          {headline.body && <p>{headline.body}</p>}
          {order && (
            <span className="od-pill">
              주문번호 #{order.orderNo || order.id} · {takeout ? "포장" : `테이블 ${order.tableLabel}`}
            </span>
          )}
        </div>
      </SkyReeds>

      <div className="od-body" style={{ paddingTop: 0 }}>
        {error && <div className="od-error">{error}</div>}

        {order && takeout && !canceled && !completed && (
          <div className={`od-card od-pickup${readyToPickUp ? " od-pickup--ready" : ""}`}>
            <span className="od-pickup__label">{readyToPickUp ? "지금 받으러 오세요" : "포장 주문번호"}</span>
            <strong className="od-pickup__no">{order.orderNo || order.id}</strong>
            <span className="od-pickup__where">
              {readyToPickUp
                ? `${TAKEOUT_PICKUP}에서 이 번호를 보여 주세요`
                : `음식이 나오면 이 화면이 바뀌어요 · 받는 곳 ${TAKEOUT_PICKUP}`}
            </span>
          </div>
        )}

        {order && !canceled && (
          <div className="od-card od-steps">
            {STEPS.map((step, index) => {
              const state = index < statusIndex || completed ? "done" : index === statusIndex ? "current" : "todo";
              const time =
                step.key === "PENDING_PAYMENT" ? formatClock(order.createdAt)
                : step.key === "PAID" ? formatClock(order.paidAt)
                : step.key === "READY" ? formatClock(order.readyAt)
                : "";
              return (
                <div key={step.key} className={`od-step od-step--${state}`}>
                  <div className="od-step__dot">{state === "done" && <IconCheck className="h-4 w-4" />}</div>
                  <div className="od-step__text">
                    <strong>{step.label}</strong>
                    {state === "current" && step.hint && (
                      <small>{takeout && step.key === "READY" ? `${TAKEOUT_PICKUP}에서 받아 가세요` : step.hint}</small>
                    )}
                    {state === "done" && time && <small>{time}</small>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {order?.status === "PENDING_PAYMENT" && menu?.bankAccount && (
          <div className="od-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6b7a90" }}>입금 계좌</span>
            <div className="od-account">
              <div className="od-account__text">
                <strong>{menu.bankAccount}</strong>
                {menu.bankHolder && <small>예금주: {menu.bankHolder}</small>}
              </div>
              <strong style={{ fontSize: 15, whiteSpace: "nowrap" }}>{formatWon(order.totalAmount)}</strong>
            </div>
            <span className="od-muted" style={{ fontSize: 12 }}>입금자명 "{order.depositorName}" 으로 보내 주세요.</span>
          </div>
        )}

        {order && (
          <div className="od-card od-order-card">
            <div className="od-booth-line__info">
              <strong>{order.boothName}</strong>
              <small>{formatClock(order.createdAt)} 주문</small>
            </div>
            <div className="od-divider" />
            {order.items?.map((item) => (
              <div key={`${item.name}-${item.quantity}`} className="od-line">
                <span className="od-line__name">
                  {item.name} <em>× {item.quantity}</em>
                </span>
                <span className="od-line__amount">{formatWon(item.lineTotal)}</span>
              </div>
            ))}
            {order.request && <span className="od-muted" style={{ fontSize: 12 }}>요청: {order.request}</span>}
            <div className="od-divider" />
            <div className="od-line">
              <span style={{ fontWeight: 700 }}>{order.paymentMethod === "BANK_TRANSFER" ? "계좌이체" : "결제"}{order.status === "PENDING_PAYMENT" ? " · 입금 대기" : ""}</span>
              <strong style={{ fontSize: 17 }}>{formatWon(order.totalAmount)}</strong>
            </div>
          </div>
        )}
      </div>

      <div className="od-fixed" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {order && (
          <button type="button" className="od-ghost" onClick={() => navigate(`/order/${order.boothId}/${encodeURIComponent(order.tableLabel)}`)}>
            메뉴 다시 보기
          </button>
        )}
        <button type="button" className="od-cta" onClick={() => navigate("/")}>
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
