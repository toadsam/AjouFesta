// 메뉴판. 사진이 있으면 사진, 없으면 메뉴 이름에 맞는 일러스트 타일을 그린다.
// 주점 상세와 총학 주점 미리보기가 같이 쓴다.
import { resolveApiAssetUrl } from "../../api";
import { BottomSheet } from "./V2Kit";

/** 메뉴 이름으로 이모지·색을 고른다. 운영 콘솔에서 사진을 올리면 이 타일 대신 사진이 나온다. */
const VISUALS = [
  { match: /삼겹|고기|목살|구이/, emoji: "🥓", tone: "rose", tag: "구이" },
  { match: /두부/, emoji: "🧈", tone: "amber", tag: "안주" },
  { match: /묵|도토리/, emoji: "🍮", tone: "brown", tag: "안주" },
  { match: /짜파|라면|면|국수/, emoji: "🍜", tone: "yellow", tag: "면" },
  { match: /오뎅|어묵|탕|국|찌개/, emoji: "🍢", tone: "sky", tag: "국물" },
  { match: /치킨|닭|튀김|강정/, emoji: "🍗", tone: "amber", tag: "튀김" },
  { match: /떡볶이|분식/, emoji: "🍡", tone: "rose", tag: "분식" },
  { match: /맥주|생맥|하이볼|소주|막걸리|술/, emoji: "🍺", tone: "yellow", tag: "주류" },
  { match: /음료|콜라|사이다|물|주스/, emoji: "🥤", tone: "sky", tag: "음료" },
  { match: /김치/, emoji: "🥬", tone: "green", tag: "안주" },
];

export function dishVisual(item) {
  const name = `${item?.name || ""}`;
  const found = VISUALS.find((visual) => visual.match.test(name));
  return {
    emoji: item?.emoji || found?.emoji || "🍽️",
    tone: item?.tone || found?.tone || "sky",
    tag: item?.tag || found?.tag || "",
  };
}

/** "삼겹살 400g · 볶음김치 100g" 같은 설명을 재료 칩으로 쪼갠다. */
function ingredientsOf(item) {
  const text = `${item?.description || ""}`;
  if (!text.includes("·")) return [];
  return text.split("·").map((part) => part.trim()).filter(Boolean);
}

function DishPhoto({ item, large = false }) {
  const visual = dishVisual(item);
  if (item.imageUrl) {
    return (
      <span className={`v2-dish__photo${large ? " v2-dish__photo--large" : ""}`}>
        <img src={resolveApiAssetUrl(item.imageUrl)} alt="" loading="lazy" />
        {item.soldOut ? <span className="v2-dish__soldout">품절</span> : null}
      </span>
    );
  }
  return (
    <span className={`v2-dish__photo v2-dish__photo--illust v2-dish__photo--${visual.tone}${large ? " v2-dish__photo--large" : ""}`}>
      <span className="v2-dish__emoji" aria-hidden="true">
        {visual.emoji}
      </span>
      {item.soldOut ? <span className="v2-dish__soldout">품절</span> : null}
    </span>
  );
}

export function DishGrid({ items, onSelect, best = "" }) {
  return (
    <div className="v2-menu-grid">
      {items.map((item, index) => {
        const visual = dishVisual(item);
        const ingredients = ingredientsOf(item);
        return (
          <button
            key={`${item.name}-${index}`}
            type="button"
            className={`v2-dish v2-rise${item.soldOut ? " v2-dish--soldout" : ""}`}
            style={{ "--i": index }}
            onClick={() => onSelect?.(item)}
          >
            <DishPhoto item={item} />
            <span className="v2-dish__body">
              <span className="v2-dish__tags">
                {best && item.name === best ? <span className="v2-badge v2-badge--red">인기</span> : null}
                {visual.tag ? <span className="v2-badge">{visual.tag}</span> : null}
              </span>
              <strong>{item.name}</strong>
              {ingredients.length ? (
                <small>{ingredients.slice(0, 2).join(" · ")}{ingredients.length > 2 ? ` 외 ${ingredients.length - 2}` : ""}</small>
              ) : item.description ? (
                <small>{item.description}</small>
              ) : null}
              {item.price ? <em>{item.price}</em> : <em className="is-tbd">판매가 확정 전</em>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DishSheet({ dish, onClose }) {
  const ingredients = dish ? ingredientsOf(dish) : [];
  const visual = dish ? dishVisual(dish) : null;
  return (
    <BottomSheet open={Boolean(dish)} onClose={onClose} title={dish?.name || ""}>
      {dish ? (
        <>
          <DishPhoto item={dish} large />
          <div className="v2-dish-sheet__row">
            <div className="v2-dish-sheet__price">{dish.price || "판매가 확정 전"}</div>
            {visual?.tag ? <span className="v2-badge">{visual.tag}</span> : null}
          </div>
          {ingredients.length ? (
            <div className="v2-dish-sheet__ingredients">
              <small>구성</small>
              <div className="v2-chips" style={{ margin: 0, padding: 0, flexWrap: "wrap" }}>
                {ingredients.map((part) => (
                  <span key={part} className="v2-chip" style={{ height: "1.9rem", fontSize: "0.82rem" }}>
                    {part}
                  </span>
                ))}
              </div>
            </div>
          ) : dish.description ? (
            <p style={{ margin: "0 0 1rem", fontSize: "0.92rem", color: "var(--v2-text-2)", lineHeight: 1.55 }}>{dish.description}</p>
          ) : null}
          {dish.soldOut ? <p className="v2-note v2-note--danger">지금은 품절이에요.</p> : null}
          <p className="v2-note v2-note--blue">테이블 QR을 찍으면 이 메뉴를 자리에서 바로 주문할 수 있어요.</p>
          <button type="button" className="v2-btn v2-btn--gray" onClick={onClose}>
            닫기
          </button>
        </>
      ) : null}
    </BottomSheet>
  );
}
