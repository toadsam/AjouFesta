// 관리자 페이지의 분실물 관리. 등록·상태 변경·삭제. 관리자 JWT 는 api.js 가 자동으로 붙인다.
// 이번 축제의 분실물은 '본부에서 보관 중'이라고 알리는 용도다. 잃어버린 사람이 직접 찾아오고, 내주면 '찾아감'을 누른다.
// 자잘한 물건이 많아서 등록 방식이 넷이다: 물건 하나(사진) · 학생증 / 카드(사진 없이 가린 이름만) · 잡화 모음(상자째 사진 한 장).
// PC 는 왼쪽 등록 폼 + 오른쪽 목록, 모바일은 등록 폼을 접어 두고 목록을 먼저 보여 준다.
import { useEffect, useMemo, useState } from "react";
import { createLostItem, createLostItemStream, deleteLostItem, fetchLostItems, resolveApiAssetUrl, updateLostItemStatus } from "../../api";
import { FESTIVAL } from "../../config/festival";
import "../../styles/admin-lost.css";

// 손님이 '내 물건이에요'를 보내는 기능을 쓰는지(config). 안 쓰면 '주인 확인' 단계 없이 보관 중 → 찾아감.
const CLAIM_ON = FESTIVAL.lostFoundClaim !== false;
const BUNDLE_CATEGORY = "잡화 모음";
const CATEGORIES = ["전자기기", "지갑/카드", "학생증", "의류", "가방", "파우치", "열쇠", "생활용품", "기타"];
const STATUS_OPTIONS = [
  { value: "REGISTERED", label: "보관 중", tone: "blue" },
  ...(CLAIM_ON ? [{ value: "OWNER_CLAIMED", label: "주인 확인", tone: "amber" }] : []),
  { value: "RETURNED", label: "찾아감", tone: "gray" },
];
// 지금 상태에서 보통 다음으로 누르는 버튼.
const NEXT_STEP = CLAIM_ON ? { REGISTERED: "OWNER_CLAIMED", OWNER_CLAIMED: "RETURNED" } : { REGISTERED: "RETURNED" };
const STATUS_BUTTON = { REGISTERED: "보관 중으로 되돌리기", OWNER_CLAIMED: "주인 확인으로", RETURNED: "찾아감" };

// 등록 방식. 학생증 · 카드는 얼굴 · 학번 · 카드 번호가 손님 화면에 그대로 나가지 않게 사진을 받지 않는다.
const KINDS = [
  { id: "item", label: "물건 하나" },
  { id: "id", label: "학생증", category: "학생증" },
  { id: "card", label: "카드", category: "지갑/카드" },
  { id: "bundle", label: "잡화 모음", category: BUNDLE_CATEGORY },
];
const LAST_LOCATION_KEY = "festa_lost_last_location";

function readLastLocation() {
  try {
    return localStorage.getItem(LAST_LOCATION_KEY) || "";
  } catch {
    return "";
  }
}

const emptyForm = () => ({ title: "", category: CATEGORIES[0], foundLocation: readLastLocation(), description: "", finderContact: "", ownerName: "" });

/** 손님 화면에 나가는 이름: 가운데를 가린다. "김아주" → "김*주", "김주" → "김*". */
function maskOwnerName(name) {
  const chars = [...`${name || ""}`.trim().replace(/\s+/g, " ")];
  if (chars.length <= 1) return chars.join("");
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

function bundleTitle() {
  const now = new Date();
  return `잡화 모음 · ${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}시`;
}

function statusOf(item) {
  const raw = `${item?.status || ""}`.toUpperCase().replace(/[\s-]/g, "_");
  return STATUS_OPTIONS.find((option) => option.value === raw) || STATUS_OPTIONS[0];
}

function timeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function AdminLostItems({ onMessage }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("item");
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});

  const say = (text) => onMessage?.(text);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await fetchLostItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      say(error.message || "분실물 목록을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    let stream = null;
    try {
      // 스트림은 손님용(가린 목록)이라 신호로만 쓰고, 관리자 토큰으로 다시 읽는다.
      stream = createLostItemStream();
      stream.addEventListener("lost-items", () => load(true));
    } catch {
      // 스트림은 없어도 된다.
    }
    return () => stream?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const counts = useMemo(() => {
    const result = { ALL: items.length };
    STATUS_OPTIONS.forEach((option) => {
      result[option.value] = items.filter((item) => statusOf(item).value === option.value).length;
    });
    return result;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "ALL" && statusOf(item).value !== filter) return false;
      if (!q) return true;
      return [item.title, item.category, item.foundLocation, item.description, item.claimantName]
        .some((value) => `${value || ""}`.toLowerCase().includes(q));
    });
  }, [items, filter, query]);

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const kindInfo = KINDS.find((entry) => entry.id === kind) || KINDS[0];
  const isNameKind = kind === "id" || kind === "card";
  const maskedName = maskOwnerName(form.ownerName);
  // 학생증 · 카드는 손님 화면에 "학생증 · 김*주" 처럼 종류와 가린 이름만 나간다.
  const nameKindTitle = `${kindInfo.label}${maskedName ? ` · ${maskedName}` : ""}`;

  function chooseKind(next) {
    setKind(next);
    setFormOpen(true);
    if (next !== "item" && next !== "bundle") setFile(null);
    setForm((prev) => ({ ...prev, title: next === "bundle" ? bundleTitle() : "", ownerName: "" }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    const title = (isNameKind ? nameKindTitle : form.title).trim();
    if (kind === "id" && !form.ownerName.trim()) {
      say("학생증에 적힌 이름을 적어 주세요. 손님 화면에는 가운데를 가려서 나가요.");
      return;
    }
    if (!title || !form.foundLocation.trim()) {
      say("물건 이름과 발견 위치는 꼭 적어 주세요.");
      return;
    }
    if (kind === "bundle" && !file) {
      say("잡화 모음은 상자째 찍은 사진이 있어야 해요. 손님이 사진을 보고 찾아요.");
      return;
    }
    setSaving(true);
    try {
      await createLostItem(
        {
          title,
          category: kindInfo.category || form.category,
          foundLocation: form.foundLocation.trim(),
          description: form.description,
          finderContact: isNameKind || kind === "bundle" ? "" : form.finderContact,
        },
        isNameKind ? null : file,
      );
      try {
        localStorage.setItem(LAST_LOCATION_KEY, form.foundLocation.trim());
      } catch {
        // 저장 못 해도 등록은 됐다.
      }
      // 발견 위치는 같은 자리에서 여러 개가 들어오는 일이 많아 그대로 둔다.
      setForm({ ...emptyForm(), foundLocation: form.foundLocation.trim(), title: kind === "bundle" ? bundleTitle() : "" });
      setFile(null);
      setFormOpen(false);
      say(`${title} 등록했어요. 손님 화면에 바로 떠요.`);
      await load(true);
    } catch (error) {
      say(error.message || "분실물을 등록하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, status) {
    setBusyId(item.id);
    try {
      await updateLostItemStatus(item.id, { status, resolveNote: noteDrafts[item.id] ?? item.resolveNote ?? "" });
      say(`${item.title} · ${STATUS_OPTIONS.find((option) => option.value === status)?.label}`);
      await load(true);
    } catch (error) {
      say(error.message || "상태를 바꾸지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  // 잡화 모음: 상자 안이 많이 달라지면 사진만 새로 찍는다. 서버에는 사진만 바꾸는 길이 없어서, 같은 내용으로 새로 올리고 예전 것을 지운다.
  async function replacePhoto(item, nextFile) {
    if (!nextFile) return;
    setBusyId(item.id);
    try {
      await createLostItem(
        { title: item.title, category: item.category, foundLocation: item.foundLocation, description: item.description || "", finderContact: item.finderContact || "" },
        nextFile,
      );
      await deleteLostItem(item.id);
      say(`${item.title} 사진을 바꿨어요.`);
      await load(true);
    } catch (error) {
      say(error.message || "사진을 바꾸지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item) {
    if (!window.confirm(`"${item.title}" 을(를) 목록에서 지울까요? 되돌릴 수 없어요.`)) return;
    setBusyId(item.id);
    try {
      await deleteLostItem(item.id);
      say("지웠어요.");
      await load(true);
    } catch (error) {
      say(error.message || "지우지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="alost">
      <section className={`alost-form${formOpen ? " is-open" : ""}`} aria-label="주운 물건 등록">
        <button type="button" className="alost-form__toggle" onClick={() => setFormOpen((open) => !open)} aria-expanded={formOpen}>
          <span>
            <b>주운 물건 등록</b>
            <small>등록하면 손님 분실물 화면에 바로 떠요</small>
          </span>
          <i aria-hidden="true">{formOpen ? "−" : "+"}</i>
        </button>
        <div className="alost-form__head">
          <b>주운 물건 등록</b>
          <small>등록하면 손님 분실물 화면에 바로 떠요</small>
        </div>

        <form className="alost-form__body" onSubmit={handleCreate}>
          <div className="alost-field">
            <span>무엇을 등록하나요</span>
            <div className="alost-cats alost-kinds" role="radiogroup" aria-label="등록 방식">
              {KINDS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === entry.id}
                  className={kind === entry.id ? "is-on" : ""}
                  onClick={() => chooseKind(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            {isNameKind ? (
              <p className="alost-hint">사진은 올리지 않아요. 얼굴 · 학번 · 카드 번호가 손님 화면에 그대로 나가기 때문이에요. 종류와 가린 이름만 보여 줘요.</p>
            ) : kind === "bundle" ? (
              <p className="alost-hint">립밤 · 키링 · 머리끈 같은 자잘한 물건은 상자째 한 장만 찍어요. 손님이 사진을 눌러 크게 보고 찾아와요.</p>
            ) : null}
          </div>

          {isNameKind ? (
            <label className="alost-field">
              <span>
                적힌 이름 {kind === "id" ? <em>필수</em> : <small>이름이 없는 카드는 비워 두세요</small>}
              </span>
              <input value={form.ownerName} onChange={setField("ownerName")} placeholder="예: 김아주" autoComplete="off" />
              <small className="alost-preview">손님 화면에는 <b>{nameKindTitle}</b> 로 보여요</small>
            </label>
          ) : (
            <label className="alost-field">
              <span>{kind === "bundle" ? "묶음 이름" : "물건 이름"} <em>필수</em></span>
              <input value={form.title} onChange={setField("title")} placeholder={kind === "bundle" ? "예: 잡화 모음 · 10/7 18시" : "예: 검은색 가죽 지갑"} />
            </label>
          )}

          {kind === "item" ? (
            <div className="alost-field">
              <span>종류</span>
              <div className="alost-cats" role="radiogroup" aria-label="종류">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="radio"
                    aria-checked={form.category === category}
                    className={form.category === category ? "is-on" : ""}
                    onClick={() => setForm((prev) => ({ ...prev, category }))}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="alost-field">
            <span>발견 위치 <em>필수</em> <small>직전에 쓴 곳이 그대로 남아요</small></span>
            <input value={form.foundLocation} onChange={setField("foundLocation")} placeholder="예: 노천극장 입구 계단" />
          </label>

          <label className="alost-field">
            <span>특징</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={setField("description")}
              placeholder={kind === "bundle" ? "예: 립밤, 키링, 머리끈, 보조배터리 선" : kind === "card" ? "예: 국민 체크카드 · 파란색" : kind === "id" ? "선택" : "색, 브랜드, 안에 든 것"}
            />
          </label>

          {kind === "item" ? (
            <label className="alost-field">
              <span>습득자 연락처 <small>손님에겐 안 보여요</small></span>
              <input value={form.finderContact} onChange={setField("finderContact")} placeholder="선택" />
            </label>
          ) : null}

          {isNameKind ? null : (
            <label className="alost-photo">
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {preview ? <img src={preview} alt="" /> : <i aria-hidden="true">+</i>}
              <span>
                <b>{file ? "사진 바꾸기" : kind === "bundle" ? "상자 사진 추가" : "사진 추가"}</b>
                <small>{file ? file.name : kind === "bundle" ? "필수 · 물건이 다 보이게 위에서" : "선택 · 물건이 잘 보이게"}</small>
              </span>
            </label>
          )}

          <button type="submit" className="alost-submit" disabled={saving}>
            {saving ? "등록 중…" : "등록하기"}
          </button>
        </form>
      </section>

      <section className="alost-list" aria-label="보관 목록">
        <div className="alost-list__top">
          <div className="alost-tabs" role="tablist">
            {[{ value: "ALL", label: "전체" }, ...STATUS_OPTIONS].map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={filter === option.value}
                className={filter === option.value ? "is-on" : ""}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
                <b>{counts[option.value] ?? 0}</b>
              </button>
            ))}
          </div>
          <input
            className="alost-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름·위치·특징으로 찾기"
            aria-label="분실물 검색"
          />
        </div>

        {loading && !items.length ? <p className="alost-empty">불러오는 중…</p> : null}
        {!loading && !visible.length ? (
          <p className="alost-empty">{query ? "검색 결과가 없어요." : "여기에 해당하는 물건이 없어요."}</p>
        ) : null}

        <ul className="alost-items">
          {visible.map((item) => {
            const status = statusOf(item);
            const busy = busyId === item.id;
            const next = NEXT_STEP[status.value];
            const others = STATUS_OPTIONS.filter((option) => option.value !== status.value && option.value !== next);
            const hasClaim = item.claimantName || item.claimantContact;
            const isBundle = item.category === BUNDLE_CATEGORY;
            return (
              <li key={item.id} className={`alost-item alost-item--${status.tone}`}>
                <div className="alost-item__main">
                  <div className="alost-item__thumb">
                    {item.imageUrl ? <img src={resolveApiAssetUrl(item.imageUrl)} alt="" /> : <span>{item.category?.slice(0, 2) || "물건"}</span>}
                  </div>
                  <div className="alost-item__info">
                    <div className="alost-item__title">
                      <strong>{item.title}</strong>
                      <span className={`alost-badge alost-badge--${status.tone}`}>{status.label}</span>
                    </div>
                    <p className="alost-item__meta">
                      <span>{item.category || "기타"}</span>
                      <span>{item.foundLocation || "위치 미상"}</span>
                      <span>{timeLabel(item.createdAt)}</span>
                    </p>
                    {item.description ? <p className="alost-item__desc">{item.description}</p> : null}
                    {item.finderContact ? <p className="alost-item__finder">습득자 {item.finderContact}</p> : null}
                  </div>
                </div>

                {hasClaim ? (
                  <div className="alost-claim">
                    <b>주인이라고 연락 왔어요</b>
                    <span>{item.claimantName || "이름 없음"} · {item.claimantContact || "연락처 없음"}</span>
                    {item.claimantNote ? <em>“{item.claimantNote}”</em> : null}
                  </div>
                ) : null}

                <div className="alost-item__foot">
                  <input
                    className="alost-note"
                    placeholder="처리 메모 (예: 학생증으로 본인 확인)"
                    value={noteDrafts[item.id] ?? item.resolveNote ?? ""}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <div className="alost-item__buttons">
                    {next ? (
                      <button type="button" className="alost-btn alost-btn--primary" disabled={busy} onClick={() => changeStatus(item, next)}>
                        {next === "OWNER_CLAIMED" ? "주인 확인됨" : "찾아감"}
                      </button>
                    ) : null}
                    {others.map((option) => (
                      <button key={option.value} type="button" className="alost-btn" disabled={busy} onClick={() => changeStatus(item, option.value)}>
                        {STATUS_BUTTON[option.value]}
                      </button>
                    ))}
                    {isBundle && status.value !== "RETURNED" ? (
                      <label className={`alost-btn alost-btn--file${busy ? " is-busy" : ""}`}>
                        사진 다시 찍기
                        <input
                          type="file"
                          accept="image/*"
                          disabled={busy}
                          onChange={(e) => {
                            const nextFile = e.target.files?.[0] || null;
                            e.target.value = "";
                            replacePhoto(item, nextFile);
                          }}
                        />
                      </label>
                    ) : null}
                    <button type="button" className="alost-btn alost-btn--danger" disabled={busy} onClick={() => remove(item)}>
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
