// 공용 QR을 찍으면 오는 화면. "몇 번 테이블이세요?" 를 고르면 그 테이블 주문 화면으로 간다.
// 테이블 목록은 자리 예약에 등록한 테이블을 그대로 쓴다. 등록이 없으면 번호를 직접 넣는다.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchBoothById, fetchBoothReservations } from "../../api";
import { resolveBoothImageUrl } from "../../config/boothImages";
import { TAKEOUT_PICKUP, TAKEOUT_TABLE } from "../../utils/orderCart";
import "../../styles/order.css";

export default function TablePickPage() {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const [booth, setBooth] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchBoothById(boothId), fetchBoothReservations(boothId, "")]).then(([b, r]) => {
      if (!alive) return;
      if (b.status === "fulfilled") setBooth(b.value);
      if (r.status === "fulfilled" && Array.isArray(r.value?.tables)) setTables(r.value.tables);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [boothId]);

  const labels = useMemo(() => tables.map((table) => table.tableName).filter(Boolean), [tables]);

  function go(label) {
    const value = `${label || ""}`.trim();
    if (!value) return;
    navigate(`/order/${boothId}/${encodeURIComponent(value)}`, { replace: true });
  }

  return (
    <div className="od-page">
      <div className="od-hero od-hero--short">
        {booth && <img className="od-hero__img" src={resolveBoothImageUrl(booth)} alt="" />}
        <div className="od-hero__shade" />
        <div className="od-hero__body">
          {booth?.category && <span className="od-hero__sub">{booth.category}</span>}
          <h1 className="od-hero__title">{booth?.name || "주점"}</h1>
        </div>
      </div>

      <div className="od-body">
        <div className="od-pick-title">
          <h1>몇 번 테이블이세요?</h1>
          <p>테이블에 붙은 번호를 골라 주세요. 주문이 그 자리로 들어가요.</p>
        </div>

        {/* 포장 손님이 테이블 수십 개를 지나 내려가지 않게 번호판 위에 둔다. */}
        <button type="button" className="od-takeout-link" onClick={() => go(TAKEOUT_TABLE)}>
          <span>
            <strong>포장해 갈게요</strong>
            <small>자리 없이 주문하고 {TAKEOUT_PICKUP}에서 받아요</small>
          </span>
          <em>포장 주문 ›</em>
        </button>

        {loading ? (
          <div className="od-pick-grid">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="od-pick od-pick--skeleton" />
            ))}
          </div>
        ) : labels.length ? (
          <div className="od-pick-grid">
            {labels.map((label) => (
              <button
                key={label}
                type="button"
                className={`od-pick${picked === label ? " od-pick--on" : ""}`}
                onClick={() => setPicked(label)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <label className="od-pick-manual">
            <span>테이블 번호</span>
            <input
              inputMode="numeric"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="예) 3"
              autoFocus
            />
          </label>
        )}

        <p className="od-muted" style={{ textAlign: "center", marginTop: 14 }}>
          번호가 안 보이면 스태프에게 말씀해 주세요.
        </p>
      </div>

      <div className="od-fixed">
        <button
          type="button"
          className="od-cta"
          disabled={labels.length ? !picked : !manual.trim()}
          onClick={() => go(labels.length ? picked : manual)}
        >
          {labels.length && picked ? `${picked} 테이블로 주문하기` : "테이블 고르기"}
        </button>
      </div>
    </div>
  );
}
