import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { fetchBoothById, fetchBoothReservations } from "../../api";
import { TAKEOUT_PICKUP, TAKEOUT_TABLE } from "../../utils/orderCart";
import "../../styles/order.css";

// 부스 테이블마다 붙일 QR 인쇄 페이지. QR 안에는 /order/{부스}/{테이블} 주소만 들어간다.
export default function TableQrPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const count = Math.min(60, Math.max(1, Number(searchParams.get("count")) || 10));
  const from = Math.max(1, Number(searchParams.get("from")) || 1);

  const [booth, setBooth] = useState(null);
  const [registered, setRegistered] = useState([]);
  const [images, setImages] = useState({});
  const [sharedImage, setSharedImage] = useState("");
  const [takeoutImage, setTakeoutImage] = useState("");
  // shared=only 면 공용 QR 한 장만, shared=0 이면 테이블별만, 기본은 둘 다.
  const sharedMode = searchParams.get("shared") || "1";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // 자리 예약에 등록한 테이블이 있으면 그 이름을 그대로 쓴다. 손님 화면·현황판·주문 알림의 이름이 같아진다.
  const useRegistered = registered.length > 0 && searchParams.get("numbers") !== "1";
  const labels = useMemo(
    () => (useRegistered ? registered : Array.from({ length: count }, (_, i) => String(from + i))),
    [useRegistered, registered, count, from],
  );

  useEffect(() => {
    fetchBoothById(id).then(setBooth).catch(() => setBooth(null));
    fetchBoothReservations(id, "")
      .then((state) => setRegistered((state?.tables || []).map((table) => table.tableName).filter(Boolean)))
      .catch(() => setRegistered([]));
  }, [id]);

  useEffect(() => {
    QRCode.toDataURL(`${origin}/order/${id}`, { margin: 1, width: 360, errorCorrectionLevel: "M" })
      .then(setSharedImage)
      .catch(() => setSharedImage(""));
    // 포장 QR: 테이블 이름 자리에 '포장'. 찍으면 바로 메뉴가 열린다.
    QRCode.toDataURL(`${origin}/order/${id}/${encodeURIComponent(TAKEOUT_TABLE)}`, { margin: 1, width: 360, errorCorrectionLevel: "M" })
      .then(setTakeoutImage)
      .catch(() => setTakeoutImage(""));
  }, [id, origin]);

  useEffect(() => {
    let alive = true;
    Promise.all(
      labels.map((label) =>
        QRCode.toDataURL(`${origin}/order/${id}/${encodeURIComponent(label)}`, { margin: 1, width: 320, errorCorrectionLevel: "M" })
          .then((url) => [label, url])
          .catch(() => [label, ""]),
      ),
    ).then((pairs) => alive && setImages(Object.fromEntries(pairs)));
    return () => {
      alive = false;
    };
  }, [id, labels, origin]);

  function updateParam(name, value) {
    const next = new URLSearchParams(searchParams);
    next.set(name, String(value));
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="od-qr-page">
      <div className="od-noprint" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>테이블 QR 인쇄</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#556" }}>
          <b>공용 QR</b> 한 장이면 손님이 찍은 뒤 테이블 번호를 직접 골라요. 테이블마다 붙이는 <b>테이블별 QR</b>은 번호를 고를 필요 없이 바로 메뉴가 열려요.
          {" "}<b>포장 QR</b>은 자리 없이 주문하는 손님용이에요(입구 · 계산대에 붙여요). 공용 QR과 같이 나와요.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["1", "둘 다"], ["only", "공용 QR만"], ["0", "테이블별만"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => updateParam("shared", value)}
              style={{ padding: "6px 12px", border: 0, borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", background: sharedMode === value ? "#191f28" : "#eef1f5", color: sharedMode === value ? "#fff" : "#333" }}
            >
              {label}
            </button>
          ))}
        </div>
        {registered.length > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={useRegistered} onChange={(e) => updateParam("numbers", e.target.checked ? "0" : "1")} />
            자리 예약에 등록한 테이블 {registered.length}개 이름 그대로 쓰기
          </label>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", opacity: useRegistered ? 0.45 : 1 }}>
          <label style={{ fontSize: 13 }}>
            시작 번호{" "}
            <input type="number" min="1" value={from} onChange={(e) => updateParam("from", Math.max(1, Number(e.target.value) || 1))} style={{ width: 64, padding: 6, border: "1px solid #ccd", borderRadius: 8 }} />
          </label>
          <label style={{ fontSize: 13 }}>
            개수{" "}
            <input type="number" min="1" max="60" value={count} onChange={(e) => updateParam("count", Math.min(60, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 64, padding: 6, border: "1px solid #ccd", borderRadius: 8 }} />
          </label>
          <button type="button" onClick={() => window.print()} style={{ marginLeft: "auto", padding: "8px 14px", border: 0, borderRadius: 10, background: "#2b6de0", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            인쇄하기
          </button>
        </div>
      </div>

      {sharedMode !== "0" && (
        <div className="od-qr-grid" style={{ marginBottom: 16 }}>
          <div className="od-qr-card od-qr-card--shared">
            <span className="od-qr-card__booth">{booth?.name || `부스 ${id}`}</span>
            <span className="od-qr-card__table">공용 주문 QR</span>
            {sharedImage ? <img src={sharedImage} alt="공용 주문 QR" /> : <div style={{ width: 180, height: 180, background: "#eef" }} />}
            <span className="od-qr-card__hint">찍고 나서 테이블 번호를 골라 주세요</span>
          </div>
          <div className="od-qr-card od-qr-card--shared od-qr-card--takeout">
            <span className="od-qr-card__booth">{booth?.name || `부스 ${id}`}</span>
            <span className="od-qr-card__table">포장 주문 QR</span>
            {takeoutImage ? <img src={takeoutImage} alt="포장 주문 QR" /> : <div style={{ width: 180, height: 180, background: "#eef" }} />}
            <span className="od-qr-card__hint">찍고 주문하면 {TAKEOUT_PICKUP}에서 받아 가요</span>
          </div>
        </div>
      )}

      <div className="od-qr-grid">
        {sharedMode !== "only" && labels.map((label) => (
          <div key={label} className="od-qr-card">
            <span className="od-qr-card__booth">{booth?.name || `부스 ${id}`}</span>
            <span className="od-qr-card__table">테이블 {label}</span>
            {images[label] ? <img src={images[label]} alt={`테이블 ${label} 주문 QR`} /> : <div style={{ width: 180, height: 180, background: "#eef" }} />}
            <span className="od-qr-card__hint">카메라로 찍으면 메뉴가 열려요</span>
          </div>
        ))}
      </div>
    </div>
  );
}
