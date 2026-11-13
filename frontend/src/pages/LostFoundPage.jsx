// 분실물. 본부에서 보관 중인 물건을 보여 주는 안내판이다. 목록을 보고, 눌러서 사진을 크게 보고, 내 물건이면 직접 찾아온다.
// ('내 물건이에요' 요청은 config 의 lostFoundClaim 으로 켜고 끈다. 이번 축제는 끈다.)
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { claimLostItem, createLostItem, createLostItemStream, fetchLostItems, resolveApiAssetUrl } from "../api";
import { FESTIVAL } from "../config/festival";
import { IconCamera, IconSearch, IconX } from "../components/UxIcons";
import { BottomSheet, IconPhone, IconPlus, Mascot, useToast } from "../components/v2/V2Kit";

const CLAIM_ON = FESTIVAL.lostFoundClaim !== false;
const PICKUP = FESTIVAL.lostFound || {};
const PICKUP_PLACE = PICKUP.place || "축제 본부";
const CATEGORY_TABS = ["전체", "전자기기", "지갑/카드", "학생증", "잡화", "기타"];
// 사진이 없는 물건(학생증 · 카드는 일부러 사진을 안 올린다)은 종류 그림으로 보여 준다.
const CATEGORY_EMOJI = [["학생증", "🪪"], ["카드", "💳"], ["지갑", "👛"], ["전자", "🎧"], ["잡화", "🧺"], ["의류", "🧥"], ["가방", "🎒"], ["열쇠", "🔑"]];
const emojiOf = (item) => CATEGORY_EMOJI.find(([key]) => `${item?.category || ""}${item?.title || ""}`.includes(key))?.[1] || "📦";
// 서버에 올린 사진은 "/uploads/..." 로 올 수 있어 API 주소를 붙인다.
// width(240 · 480 · 960)를 주면 서버가 그 폭으로 줄인 사진을 준다. 폰으로 찍은 원본은 한 장에 몇 MB 라,
// 목록 · 상세는 줄인 사진을 받고 원본은 손님이 사진을 눌러 크게 볼 때만 받는다(잡화 모음은 확대해야 보인다).
const photoOf = (item, width) => resolveApiAssetUrl(item?.imageUrl || item?.image || "", width);
const EMPTY_FORM = {
  title: "",
  category: "기타",
  foundLocation: "",
  description: "",
  finderContact: "",
};
const EMPTY_CLAIM = { claimantName: "", claimantContact: "", claimantNote: "" };
const STATUS_LABELS = {
  REGISTERED: "보관 중",
  FOUND: "보관 중",
  STORED: "보관 중",
  CLAIM_REQUESTED: "확인 요청",
  OWNER_CLAIMED: "주인 확인",
  RETURNED: "찾아감",
  EXPIRED: "보관 종료",
};
const STATUS_TEXT_LABELS = {
  registered: "보관 중",
  found: "보관 중",
  stored: "보관 중",
  "owner claimed": "주인 확인",
  "owner-claimed": "주인 확인",
  owner_claimed: "주인 확인",
  returned: "찾아감",
  claimed: "주인 확인",
};

function rawStatusLabel(item) {
  const rawLabel = `${item.statusLabel || ""}`.trim();
  const normalizedLabel = rawLabel.toLowerCase();
  if (STATUS_TEXT_LABELS[normalizedLabel]) return STATUS_TEXT_LABELS[normalizedLabel];
  if (rawLabel && !/^[a-z_\-\s]+$/i.test(rawLabel)) return rawLabel;
  const rawStatus = `${item.status || ""}`.trim().toUpperCase();
  if (STATUS_LABELS[rawStatus]) return STATUS_LABELS[rawStatus];
  return "보관 중";
}

// 요청 기능을 끈 축제에서는 '주인 확인' 단계가 없다. 그런 값이 남아 있어도 보관 중으로 보여 준다.
function statusLabel(item) {
  const label = rawStatusLabel(item);
  if (!CLAIM_ON && (label === "주인 확인" || label === "확인 요청")) return "보관 중";
  return label;
}

function statusTone(item) {
  const label = statusLabel(item);
  if (label === "찾아감" || label === "보관 종료") return "";
  if (label === "확인 요청" || label === "주인 확인") return "v2-badge--yellow";
  return "v2-badge--green";
}

function isReturned(item) {
  return `${item.status || ""}`.toUpperCase() === "RETURNED" || statusLabel(item) === "찾아감";
}

function telHref(value) {
  const raw = `${value || ""}`.trim();
  if (!raw || raw.includes("*")) return "";
  const digits = raw.replace(/[^0-9+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function timeLabel(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMinutes = Math.round((now - date) / 60000);
  if (diffMinutes < 1) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffMinutes < 60 * 24) return `${Math.floor(diffMinutes / 60)}시간 전`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function LostFoundPage() {
  const location = useLocation();
  const [showToast, toastNode] = useToast();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get("query") || "");
  const [tab, setTab] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState(EMPTY_FORM);
  const [registerFile, setRegisterFile] = useState(null);
  const [registerError, setRegisterError] = useState("");
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [claimMode, setClaimMode] = useState(false);
  const [claimForm, setClaimForm] = useState(EMPTY_CLAIM);
  const [claimError, setClaimError] = useState("");
  const [claiming, setClaiming] = useState(false);
  // 사진 크게 보기. 잡화 모음처럼 한 장에 여러 물건이 찍힌 사진은 확대해야 보인다.
  const [viewer, setViewer] = useState(null);
  const [zoomed, setZoomed] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchLostItems();
      setItems(Array.isArray(data) ? data : []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    let stream = null;
    try {
      stream = createLostItemStream();
      stream.addEventListener("lost-items", (event) => {
        try {
          const next = JSON.parse(event.data);
          if (Array.isArray(next)) setItems(next);
        } catch {
          // 잘못된 페이로드는 무시한다.
        }
      });
    } catch {
      // 스트림은 없어도 된다.
    }
    return () => stream?.close();
  }, []);

  useEffect(() => {
    setQuery(new URLSearchParams(location.search).get("query") || "");
  }, [location.search]);

  // 불러오지 못했을 때 예시 물건을 보여 주지 않는다(손님이 보고 실제로 본부를 찾아온다).
  const source = items;

  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return source.filter((item) => {
      const matchTab = tab === "전체" || `${item.category || ""}`.includes(tab);
      const matchQuery =
        !keyword ||
        [item.title, item.description, item.foundLocation, item.category].some((field) =>
          `${field || ""}`.toLowerCase().includes(keyword),
        );
      return matchTab && matchQuery;
    });
  }, [source, query, tab]);

  const selected = useMemo(() => source.find((item) => item.id === selectedId) || null, [source, selectedId]);
  const storedCount = source.filter((item) => !isReturned(item)).length;

  function openItem(item) {
    setSelectedId(item.id);
    setClaimMode(false);
    setClaimError("");
  }

  function closeItem() {
    setSelectedId(null);
    setClaimMode(false);
    setClaimError("");
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (!registerForm.title.trim() || !registerForm.foundLocation.trim()) {
      setRegisterError("물건 이름과 발견한 곳은 꼭 적어 주세요.");
      return;
    }
    setSaving(true);
    setRegisterError("");
    try {
      await createLostItem(registerForm, registerFile);
      setRegisterForm(EMPTY_FORM);
      setRegisterFile(null);
      setRegisterOpen(false);
      showToast("분실물을 등록했어요. 고마워요!");
      await load();
    } catch (saveError) {
      setRegisterError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClaim() {
    if (!selected) return;
    const claimantName = claimForm.claimantName.trim();
    const claimantContact = claimForm.claimantContact.trim();
    const claimantNote = claimForm.claimantNote.trim();
    if (!claimantName || !claimantContact) {
      setClaimError("이름과 연락처를 적어 주세요.");
      return;
    }
    setClaiming(true);
    setClaimError("");
    try {
      await claimLostItem(selected.id, { claimantName, claimantContact, claimantNote });
      setClaimForm(EMPTY_CLAIM);
      closeItem();
      showToast("요청을 보냈어요. 본부에서 확인 후 연락드릴게요.");
      await load();
    } catch (claimErr) {
      setClaimError(claimErr.message);
    } finally {
      setClaiming(false);
    }
  }

  // 공개 응답은 연락처를 가려 보내므로(*), 가려진 번호로는 전화 버튼을 만들지 않는다.
  const selectedPhone = selected && !`${selected.finderContact || ""}`.includes("*") ? telHref(selected.finderContact) : "";

  return (
    <section className="v2-page" data-i18n-skip>
      <div className="v2-title">
        <h1>분실물</h1>
        <p>{loading && !source.length ? "보관 목록을 불러오는 중이에요" : `지금 ${storedCount}개를 보관하고 있어요`}</p>
      </div>

      <div className="v2-card v2-lost-pickup">
        <Mascot style={{ width: "3.2rem", height: "auto", flex: "0 0 auto" }} />
        <div>
          <strong>{PICKUP_PLACE}에서 보관하고 있어요</strong>
          <p>내 물건이 보이면 직접 와서 찾아가세요. 본인 물건인지 확인한 뒤 드려요.</p>
          {PICKUP.hours ? <small>운영 시간 · {PICKUP.hours}</small> : null}
          {PICKUP.after ? <small>축제가 끝난 뒤 · {PICKUP.after}</small> : null}
        </div>
      </div>

      <label className="v2-search">
        <IconSearch />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="물건 이름, 색상, 잃어버린 곳"
          aria-label="분실물 검색"
        />
        {query ? (
          <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")}>
            <IconX />
          </button>
        ) : null}
      </label>

      <div className="v2-chips" style={{ marginTop: "0.85rem" }}>
        {CATEGORY_TABS.map((item) => (
          <button
            key={item}
            type="button"
            className={`v2-chip${tab === item ? " v2-chip--active" : ""}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {failed && !items.length && <p className="v2-note">분실물 목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>}

      <div className="v2-lost-list" style={{ marginTop: "1rem" }}>
        {loading && !source.length
          ? [0, 1, 2].map((index) => <div key={index} className="v2-skeleton" style={{ height: "5.9rem", borderRadius: 18 }} />)
          : visibleItems.map((item, index) => (
              <button
                key={item.id || item.title}
                type="button"
                className="v2-lost v2-rise"
                style={{ "--i": Math.min(index, 8) }}
                onClick={() => openItem(item)}
              >
                {photoOf(item) ? (
                  <span className="v2-lost__thumb">
                    <img src={photoOf(item, 240)} alt="" loading="lazy" />
                  </span>
                ) : (
                  <span className="v2-lost__thumb v2-lost__thumb--text" aria-hidden="true">{emojiOf(item)}</span>
                )}
                <span className="v2-lost__body">
                  <span className="v2-lost__head">
                    <strong>{item.title}</strong>
                    <span className={`v2-badge ${statusTone(item)}`}>{statusLabel(item)}</span>
                  </span>
                  <small>{item.foundLocation || "축제 본부"}{item.category ? ` · ${item.category}` : ""}</small>
                  <small>{timeLabel(item.createdAt) || "접수 시간 확인 중"}</small>
                </span>
              </button>
            ))}
        {!loading && visibleItems.length === 0 && !(failed && !items.length) && (
          <div className="v2-empty">
            <Mascot kind="flame" className="v2-empty__mascot" />
            <strong>{query || tab !== "전체" ? "조건에 맞는 물건이 없어요" : "보관 중인 분실물이 없어요"}</strong>
            <p>{query || tab !== "전체" ? "검색어나 분류를 바꿔 보세요." : `주운 물건은 ${PICKUP_PLACE}에 맡겨 주세요.`}</p>
          </div>
        )}
      </div>

      {FESTIVAL.lostFoundPublicRegister !== false && (
      <button type="button" className="v2-fab" onClick={() => setRegisterOpen(true)}>
        <IconPlus />
        주운 물건 등록
      </button>
      )}

      <BottomSheet
        open={Boolean(selected)}
        onClose={closeItem}
        title={selected?.title || ""}
        description={selected ? `${selected.foundLocation || "축제 본부"} · ${timeLabel(selected.createdAt) || "접수 시간 확인 중"}` : ""}
      >
        {selected ? (
          <>
            {photoOf(selected) ? (
              <div className="v2-lost-detail__photo" role="button" tabIndex={0} aria-label="사진 크게 보기" onClick={() => { setViewer(photoOf(selected)); setZoomed(false); }} onKeyDown={(event) => { if (event.key === "Enter") { setViewer(photoOf(selected)); setZoomed(false); } }}>
                <img className="v2-lost-detail__img" src={photoOf(selected, 960)} alt="" />
                <span>눌러서 크게 보기</span>
              </div>
            ) : (
              <p className="v2-note" style={{ marginBottom: "1rem" }}>사진 없이 보관 중인 물건이에요. 이름과 특징을 보고 확인해 주세요.</p>
            )}
            <div className="v2-kv">
              <span>상태</span>
              <strong>
                <span className={`v2-badge ${statusTone(selected)}`}>{statusLabel(selected)}</span>
              </strong>
            </div>
            {selected.category ? (
              <div className="v2-kv">
                <span>분류</span>
                <strong>{selected.category}</strong>
              </div>
            ) : null}
            {selected.description ? (
              <p style={{ margin: "0.5rem 0 1rem", fontSize: "0.92rem", lineHeight: 1.55, color: "var(--v2-text-2)" }}>
                {selected.description}
              </p>
            ) : null}

            {!CLAIM_ON ? (
              <p className="v2-note v2-note--blue" style={{ marginTop: "0.75rem" }}>
                {isReturned(selected)
                  ? "주인이 찾아간 물건이에요."
                  : `${PICKUP_PLACE}에서 보관 중이에요. 직접 와서 찾아가세요.${PICKUP.hours ? ` (운영 시간 ${PICKUP.hours})` : ""}`}
              </p>
            ) : claimMode ? (
              <div className="v2-pop">
                <label className="v2-field">
                  <span>이름</span>
                  <input
                    value={claimForm.claimantName}
                    onChange={(event) => setClaimForm((prev) => ({ ...prev, claimantName: event.target.value }))}
                    placeholder="본부에서 확인할 이름"
                    autoFocus
                  />
                </label>
                <label className="v2-field">
                  <span>연락처</span>
                  <input
                    type="tel"
                    value={claimForm.claimantContact}
                    onChange={(event) => setClaimForm((prev) => ({ ...prev, claimantContact: event.target.value }))}
                    placeholder="010-0000-0000"
                  />
                </label>
                <label className="v2-field">
                  <span>내 물건이라는 증거 (선택)</span>
                  <textarea
                    value={claimForm.claimantNote}
                    onChange={(event) => setClaimForm((prev) => ({ ...prev, claimantNote: event.target.value }))}
                    placeholder="예) 케이스 안쪽에 스티커가 붙어 있어요"
                    rows={2}
                  />
                </label>
                {claimError && <p className="v2-note v2-note--danger">{claimError}</p>}
                <div className="v2-btn-row">
                  <button type="button" className="v2-btn v2-btn--gray" onClick={() => setClaimMode(false)}>
                    뒤로
                  </button>
                  <button type="button" className="v2-btn" onClick={handleClaim} disabled={claiming}>
                    {claiming ? "보내는 중..." : "요청 보내기"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="v2-btn-row" style={{ marginTop: "0.75rem" }}>
                {selectedPhone ? (
                  <a className="v2-btn v2-btn--gray" href={selectedPhone}>
                    <IconPhone style={{ width: 18, height: 18 }} />
                    연락하기
                  </a>
                ) : null}
                <button type="button" className="v2-btn" onClick={() => setClaimMode(true)} disabled={isReturned(selected)}>
                  {isReturned(selected) ? "주인이 찾아간 물건이에요" : "내 물건이에요"}
                </button>
              </div>
            )}
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={registerOpen}
        onClose={() => {
          if (!saving) setRegisterOpen(false);
        }}
        title="주운 물건 등록"
        description="본부에 맡기기 전에 먼저 올려 두면 주인이 더 빨리 찾아요."
      >
        <form onSubmit={handleRegister}>
          <label className="v2-field">
            <span>물건 이름</span>
            <input
              value={registerForm.title}
              onChange={(event) => setRegisterForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="예) 검정 에어팟 케이스"
            />
          </label>
          <div className="v2-field-grid">
            <label className="v2-field">
              <span>분류</span>
              <select
                value={registerForm.category}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, category: event.target.value }))}
              >
                {CATEGORY_TABS.filter((item) => item !== "전체").map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="v2-field">
              <span>발견한 곳</span>
              <input
                value={registerForm.foundLocation}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, foundLocation: event.target.value }))}
                placeholder="예) 노천극장 앞"
              />
            </label>
          </div>
          <label className="v2-field">
            <span>특징 (선택)</span>
            <textarea
              value={registerForm.description}
              onChange={(event) => setRegisterForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="색상, 스티커, 발견 상황"
              rows={2}
            />
          </label>
          <label className="v2-field">
            <span>내 연락처 (선택)</span>
            <input
              type="tel"
              value={registerForm.finderContact}
              onChange={(event) => setRegisterForm((prev) => ({ ...prev, finderContact: event.target.value }))}
              placeholder="주인이 연락할 번호"
            />
          </label>
          <label className={`v2-file${registerFile ? " v2-file--filled" : ""}`} style={{ marginBottom: "1rem" }}>
            <IconCamera style={{ width: 18, height: 18 }} />
            {registerFile ? registerFile.name : "사진 추가"}
            <input type="file" accept="image/*" onChange={(event) => setRegisterFile(event.target.files?.[0] || null)} />
          </label>
          {registerError && <p className="v2-note v2-note--danger">{registerError}</p>}
          <button type="submit" className="v2-btn" disabled={saving}>
            {saving ? "등록하는 중..." : "등록하기"}
          </button>
        </form>
      </BottomSheet>

      {viewer
        ? createPortal(
            <div className="v2-lost-viewer" role="dialog" aria-modal="true" aria-label="사진 크게 보기">
              <div className="v2-lost-viewer__scroll" onClick={() => setViewer(null)}>
                <img
                  src={viewer}
                  alt=""
                  className={zoomed ? "is-zoomed" : ""}
                  onClick={(event) => {
                    event.stopPropagation();
                    setZoomed((value) => !value);
                  }}
                />
              </div>
              <p className="v2-lost-viewer__hint">{zoomed ? "밀어서 둘러보고, 한 번 더 누르면 작아져요" : "사진을 누르면 커져요"}</p>
              <div className="v2-lost-viewer__close" role="button" tabIndex={0} aria-label="닫기" onClick={() => setViewer(null)} onKeyDown={(event) => { if (event.key === "Enter") setViewer(null); }}>
                <IconX />
              </div>
            </div>,
            document.querySelector(".app-shell") || document.body,
          )
        : null}

      {toastNode}
    </section>
  );
}
