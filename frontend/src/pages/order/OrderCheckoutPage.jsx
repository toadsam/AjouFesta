import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createBoothOrder, fetchOrderMenu } from "../../api";
import { IconArrowLeft } from "../../components/UxIcons";
import { resolveBoothImageUrl } from "../../config/boothImages";
import { clearCart, formatWon, getCart, isTakeout, rememberOrder, TAKEOUT_PICKUP, updateCartQuantity } from "../../utils/orderCart";
import "../../styles/order.css";

function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

// 이번 축제는 계좌이체만 받는다.
const PAYMENT_OPTIONS = [{ key: "BANK_TRANSFER", label: "계좌이체", enabled: true }];

// 휴대폰 번호는 필수. 숫자 10~11자리(0으로 시작)면 된다. 하이픈·띄어쓰기는 있어도 없어도 된다.
const PHONE_INPUT_PATTERN = /^[0-9+()\-\s]{0,30}$/;
function isValidPhone(value) {
  return /^0\d{9,10}$/.test(`${value}`.replace(/\D/g, ""));
}

export default function OrderCheckoutPage() {
  const { boothId, table } = useParams();
  const navigate = useNavigate();

  const [menu, setMenu] = useState(null);
  const [cart, setCart] = useState(() => getCart(boothId, table));
  const [depositorName, setDepositorName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [request, setRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchOrderMenu(boothId, table)
      .then(setMenu)
      .catch((e) => setError(e.message || "메뉴를 불러오지 못했습니다."));
  }, [boothId, table]);

  const lines = useMemo(() => {
    const byName = new Map((menu?.items || []).map((item) => [item.name, item]));
    return cart
      .map((line) => {
        const item = byName.get(line.name);
        if (!item) return null;
        return { ...line, price: item.price || 0, soldOut: Boolean(item.soldOut), lineTotal: (item.price || 0) * line.quantity };
      })
      .filter(Boolean);
  }, [cart, menu]);

  const total = lines.filter((line) => !line.soldOut).reduce((sum, line) => sum + line.lineTotal, 0);
  const hasSoldOut = lines.some((line) => line.soldOut);
  const phoneValid = isValidPhone(phoneNumber);
  const phoneError = phoneTouched && !phoneValid
    ? phoneNumber.trim()
      ? "휴대폰 번호를 다시 확인해 주세요. 숫자 10~11자리예요."
      : "휴대폰 번호를 입력해 주세요."
    : "";
  const minOrderAmount = Number(menu?.minOrderAmount) || 0;
  const underMin = total < minOrderAmount;
  const canSubmit =
    Boolean(menu) && lines.length > 0 && !hasSoldOut && !underMin && depositorName.trim().length > 0 && phoneValid && !submitting;

  function removeLine(name) {
    setCart(updateCartQuantity(boothId, table, name, 0));
  }

  async function handleCopy() {
    if (!menu?.bankAccount) return;
    const ok = await copyText(menu.bankAccount);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const created = await createBoothOrder(boothId, {
        tableLabel: table,
        items: lines.map((line) => ({ name: line.name, quantity: line.quantity })),
        depositorName: depositorName.trim(),
        phoneNumber: phoneNumber.trim(),
        request: request.trim() || null,
        paymentMethod: "BANK_TRANSFER",
      });
      rememberOrder(created);
      clearCart(boothId, table);
      navigate(`/orders/${created.id}?key=${encodeURIComponent(created.clientKey)}`, { replace: true });
    } catch (e) {
      setError(e.message || "주문 접수에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <div className="od-page">
      <div className="od-topbar">
        <button type="button" className="od-iconbtn" onClick={() => navigate(-1)} aria-label="뒤로">
          <IconArrowLeft className="h-6 w-6" />
        </button>
        <span className="od-topbar__title">주문 확인</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="od-body">
        <div className="od-card od-order-card">
          <div className="od-booth-line">
            <div className="od-thumb od-thumb--sm">
              {menu && <img src={resolveBoothImageUrl({ imageUrl: menu.boothImageUrl })} alt="" loading="lazy" decoding="async" />}
            </div>
            <div className="od-booth-line__info">
              {menu?.boothCategory && <small>{menu.boothCategory}</small>}
              <strong>{menu?.boothName || "부스"}</strong>
              <small>{isTakeout(table) ? `포장 · ${TAKEOUT_PICKUP}에서 받아요` : `테이블 ${table}`}</small>
            </div>
          </div>
          <div className="od-table-confirm">
            {isTakeout(table) ? (
              <span>
                <strong>포장</strong> 주문이에요. 음식이 나오면 {TAKEOUT_PICKUP}에서 받아 가세요.
              </span>
            ) : (
              <span>
                <strong>{table}</strong> 테이블 맞으신가요?
              </span>
            )}
            <button type="button" onClick={() => navigate(`/order/${boothId}`)}>
              {isTakeout(table) ? "자리에서 먹을게요" : "아니에요, 바꿀게요"}
            </button>
          </div>
          <div className="od-divider" />
          {lines.length === 0 && <span className="od-muted">담긴 메뉴가 없어요. 메뉴로 돌아가서 담아 주세요.</span>}
          {lines.map((line) => (
            <div key={line.name} className="od-line">
              <span className="od-line__name">
                {line.name} <em>× {line.quantity}</em>
                {line.soldOut && <span className="od-badge" style={{ background: "#b42318" }}>품절</span>}
                <button
                  type="button"
                  onClick={() => removeLine(line.name)}
                  style={{ border: 0, background: "transparent", color: "#a3aebf", fontSize: 12, cursor: "pointer", padding: "4px 6px" }}
                >
                  빼기
                </button>
              </span>
              <span className="od-line__amount">{formatWon(line.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ padding: "0 4px", fontSize: 13, fontWeight: 700, color: "#6b7a90" }}>결제 방법</span>
          <div className="od-card od-pay">
            {PAYMENT_OPTIONS.map((option) => (
              <div key={option.key}>
                <button type="button" className={`od-pay__option ${option.enabled ? "od-pay__option--on" : ""}`} disabled={!option.enabled}>
                  <span className={`od-radio ${option.enabled ? "od-radio--on" : ""}`} />
                  {option.label}
                </button>
                {option.enabled && (
                  <div className="od-pay__detail">
                    {menu?.bankAccount ? (
                      <div className="od-account">
                        <div className="od-account__text">
                          <strong>{menu.bankAccount}</strong>
                          {menu.bankHolder && <small>예금주: {menu.bankHolder}</small>}
                        </div>
                        <button type="button" className="od-copy" onClick={handleCopy}>
                          <IconCopy />
                          {copied ? "복사됨" : "복사"}
                        </button>
                      </div>
                    ) : (
                      <div className="od-notice">이 부스는 계좌를 아직 등록하지 않았어요. 주문 후 스태프에게 직접 결제해 주세요.</div>
                    )}
                    <span className="od-muted" style={{ fontSize: 12 }}>입금 후 스태프가 확인하면 조리를 시작해요.</span>
                    <div className="od-field">
                      <label htmlFor="od-depositor">입금자명</label>
                      <input
                        id="od-depositor"
                        className="od-input"
                        value={depositorName}
                        onChange={(e) => setDepositorName(e.target.value)}
                        placeholder="입금할 때 쓰는 이름"
                        maxLength={60}
                        autoComplete="name"
                      />
                    </div>
                    <div className="od-field">
                      <label htmlFor="od-phone">휴대폰 번호</label>
                      <input
                        id="od-phone"
                        className={`od-input${phoneError ? " od-input--error" : ""}`}
                        value={phoneNumber}
                        onChange={(e) => {
                          if (PHONE_INPUT_PATTERN.test(e.target.value)) setPhoneNumber(e.target.value);
                        }}
                        onBlur={() => setPhoneTouched(true)}
                        placeholder="010-1234-5678"
                        inputMode="tel"
                        maxLength={30}
                        autoComplete="tel"
                        aria-invalid={phoneError ? "true" : undefined}
                        aria-describedby="od-phone-hint"
                        required
                      />
                      <span id="od-phone-hint" className={`od-field__hint${phoneError ? " od-field__hint--error" : ""}`}>
                        {phoneError || "입금·주문 확인이 필요할 때만 연락드려요."}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="od-field">
          <label htmlFor="od-request">요청사항 (선택)</label>
          <textarea
            id="od-request"
            className="od-input"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="예: 덜 맵게 해주세요"
            maxLength={500}
          />
        </div>

        {error && <div className="od-error">{error}</div>}
        {menu && lines.length > 0 && underMin && (
          <div className="od-error">
            주문은 {formatWon(minOrderAmount)}부터 가능해요. {formatWon(minOrderAmount - total)} 더 담아 주세요.
          </div>
        )}

        <div className="od-line od-line--total">
          <span>총 결제 금액</span>
          <strong>{formatWon(total)}</strong>
        </div>
      </div>

      <div className="od-fixed">
        <button type="button" className="od-cta" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "접수 중..." : menu && lines.length > 0 && underMin ? `${formatWon(minOrderAmount)}부터 주문할 수 있어요` : `${formatWon(total)} 주문하기`}
        </button>
      </div>
    </div>
  );
}
