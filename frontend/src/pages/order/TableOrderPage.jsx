import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchOrderMenu, resolveApiAssetUrl } from "../../api";
import { IconArrowLeft, IconChevronRight } from "../../components/UxIcons";
import { resolveBoothImageUrl } from "../../config/boothImages";
import {
  addToCart,
  formatWon,
  getCart,
  getLatestOrderForTable,
  isTakeout,
  TAKEOUT_PICKUP,
  updateCartQuantity,
} from "../../utils/orderCart";
import "../../styles/order.css";

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function initialOf(name) {
  return (name || "").trim().slice(0, 1);
}

function formatTime(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

export default function TableOrderPage() {
  const { boothId, table } = useParams();
  const navigate = useNavigate();

  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCartState] = useState(() => getCart(boothId, table));
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchOrderMenu(boothId, table)
      .then((data) => {
        if (!alive) return;
        setMenu(data);
        setError("");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message || "메뉴를 불러오지 못했습니다.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [boothId, table]);

  useEffect(() => {
    setCartState(getCart(boothId, table));
  }, [boothId, table]);

  const priceByName = useMemo(() => {
    const map = new Map();
    (menu?.items || []).forEach((item) => map.set(item.name, item));
    return map;
  }, [menu]);

  const cartSummary = useMemo(() => {
    let count = 0;
    let total = 0;
    cart.forEach((line) => {
      const item = priceByName.get(line.name);
      if (!item || item.soldOut) return;
      count += line.quantity;
      total += (item.price || 0) * line.quantity;
    });
    return { count, total };
  }, [cart, priceByName]);

  const activeOrder = useMemo(() => getLatestOrderForTable(boothId, table), [boothId, table]);

  const bestName = menu?.items?.find((item) => !item.soldOut)?.name;

  function openItem(item) {
    if (item.soldOut) return;
    const inCart = cart.find((line) => line.name === item.name);
    setQuantity(inCart ? inCart.quantity : 1);
    setSelected(item);
  }

  function closeSheet() {
    setSelected(null);
  }

  function confirmItem() {
    if (!selected) return;
    const inCart = cart.find((line) => line.name === selected.name);
    const next = inCart
      ? updateCartQuantity(boothId, table, selected.name, quantity)
      : addToCart(boothId, table, selected.name, quantity);
    setCartState(next);
    setSelected(null);
  }

  function removeSelected() {
    if (!selected) return;
    setCartState(updateCartQuantity(boothId, table, selected.name, 0));
    setSelected(null);
  }

  function goCheckout() {
    if (!cartSummary.count) return;
    navigate(`/order/${boothId}/${encodeURIComponent(table)}/checkout`);
  }

  const orderClosed = menu && menu.orderEnabled === false;
  const minOrderAmount = Number(menu?.minOrderAmount) || 0;
  const selectedInCart = selected ? cart.find((line) => line.name === selected.name) : null;

  return (
    <div className="od-page">
      <div className="od-hero">
        {menu && (
          <img
            className="od-hero__img"
            src={resolveBoothImageUrl({ imageUrl: menu.boothImageUrl })}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="od-hero__shade" />
        <div className="od-hero__top">
          <button type="button" className="od-iconbtn od-iconbtn--dark" onClick={() => navigate(-1)} aria-label="뒤로">
            <IconArrowLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="od-hero__body">
          <div className="od-hero__chips">
            {isTakeout(table) ? (
              <span className="od-chip od-chip--takeout">포장 · {TAKEOUT_PICKUP}에서 받아요</span>
            ) : (
              <span className="od-chip od-chip--dark">테이블 {table}</span>
            )}
            {menu?.openTime && menu?.closeTime && (
              <span className="od-chip">
                {formatTime(menu.openTime)} - {formatTime(menu.closeTime)}
              </span>
            )}
          </div>
          {menu?.boothCategory && <span className="od-hero__sub">{menu.boothCategory}</span>}
          <h1 className="od-hero__title">{menu?.boothName || (loading ? "불러오는 중" : "부스")}</h1>
        </div>
      </div>

      <div className="od-body">
        {error && <div className="od-error">{error}</div>}
        {orderClosed && <div className="od-notice">지금은 이 부스에서 주문을 받지 않아요. 스태프에게 직접 주문해 주세요.</div>}

        {activeOrder && (
          <button
            type="button"
            className="od-notice od-notice--blue od-notice--link"
            onClick={() => navigate(`/orders/${activeOrder.id}?key=${encodeURIComponent(activeOrder.clientKey)}`)}
          >
            <span>{isTakeout(table) ? "낸 포장 주문이 있어요. 진행 상황 보기" : "이 테이블에서 낸 주문이 있어요. 진행 상황 보기"}</span>
            <IconChevronRight className="h-4 w-4" />
          </button>
        )}

        {menu?.boothIntro && <p className="od-muted" style={{ margin: "0 4px", lineHeight: 1.55 }}>{menu.boothIntro}</p>}

        <div className="od-section-head">
          <strong>메뉴</strong>
          <span>{menu?.items?.length ?? 0}개</span>
        </div>

        {loading && !menu && <div className="od-card" style={{ padding: 18 }} />}

        {menu && !menu.items?.length && (
          <div className="od-card" style={{ padding: 18 }}>
            <span className="od-muted">아직 등록된 메뉴가 없어요.</span>
          </div>
        )}

        {menu?.items?.map((item) => {
          const inCart = cart.find((line) => line.name === item.name);
          const disabled = item.soldOut || orderClosed;
          return (
            <button
              key={item.name}
              type="button"
              className={`od-menu-item ${disabled ? "od-menu-item--soldout" : ""}`}
              onClick={() => !disabled && openItem(item)}
              disabled={disabled}
            >
              <div className="od-thumb">
                {item.imageUrl ? <img src={resolveApiAssetUrl(item.imageUrl)} alt="" loading="lazy" /> : initialOf(item.name)}
              </div>
              <div className="od-menu-item__info">
                <span className="od-menu-item__name">
                  {item.name}
                  {item.name === bestName && <span className="od-badge">BEST</span>}
                </span>
                {item.description && <span className="od-menu-item__desc">{item.description}</span>}
                <span className={`od-menu-item__price ${item.soldOut ? "od-menu-item__price--soldout" : ""}`}>
                  {item.soldOut ? "품절" : formatWon(item.price)}
                </span>
              </div>
              <span className={`od-plus ${disabled ? "od-plus--muted" : ""}`}>
                {inCart ? <strong style={{ fontSize: 14 }}>{inCart.quantity}</strong> : <IconPlus />}
              </span>
            </button>
          );
        })}
      </div>

      {cartSummary.count > 0 && !orderClosed && (
        <div className="od-fixed">
          {cartSummary.total < minOrderAmount ? (
            // 최소 주문 금액에 못 미침: 얼마 더 담아야 하는지 보여 주고 넘어가지 않는다(서버도 같은 값으로 거절한다).
            <button type="button" className="od-cartbar od-cartbar--short" disabled>
              <span className="od-cartbar__meta">
                <small>{cartSummary.count}개 담김 · {formatWon(cartSummary.total)}</small>
                <strong>{formatWon(minOrderAmount)}부터 주문 · {formatWon(minOrderAmount - cartSummary.total)} 더 담아 주세요</strong>
              </span>
            </button>
          ) : (
            <button type="button" className="od-cartbar" onClick={goCheckout}>
              <span className="od-cartbar__meta">
                <small>{cartSummary.count}개 담김</small>
                <strong>{formatWon(cartSummary.total)}</strong>
              </span>
              <span className="od-cartbar__go">주문하기</span>
            </button>
          )}
        </div>
      )}

      {selected && (
        <>
          <div className="od-sheet-backdrop" onClick={closeSheet} role="presentation" />
          <div className="od-sheet" role="dialog" aria-modal="true" aria-label={`${selected.name} 담기`}>
            <div className="od-sheet__grip" />
            <div className="od-sheet__image">
              {selected.imageUrl ? (
                <img src={resolveApiAssetUrl(selected.imageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                initialOf(selected.name)
              )}
              {selected.name === bestName && <span className="od-badge">BEST</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h2 className="od-sheet__title">{selected.name}</h2>
              <span className="od-sheet__price">{formatWon(selected.price)}</span>
            </div>
            {selected.description && <p className="od-sheet__desc">{selected.description}</p>}
            <div className="od-divider" />
            <div className="od-row">
              <span className="od-row__label">수량</span>
              <div className="od-stepper">
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="수량 줄이기">
                  <IconMinus />
                </button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((q) => Math.min(20, q + 1))} disabled={quantity >= 20} aria-label="수량 늘리기">
                  <IconPlus />
                </button>
              </div>
            </div>
            <button type="button" className="od-cta" onClick={confirmItem}>
              {formatWon((selected.price || 0) * quantity)} {selectedInCart ? "수량 변경" : "담기"}
            </button>
            {selectedInCart && (
              <button type="button" className="od-ghost" onClick={removeSelected}>
                장바구니에서 빼기
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
