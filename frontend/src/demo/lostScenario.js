// 눌러 보는 매뉴얼 · 분실물 흐름. 화면 둘(총괄 화면의 분실물 관리 · 손님 분실물 화면)과 순서, 방금 일어난 일을 글로 바꾸는 규칙.
// 분실물은 본부에서 보관만 하고 잃어버린 사람이 직접 찾아온다. 손님 화면은 '여기 보관 중'이라고 보여 주는 안내판이다.
// 자잘한 물건이 많아서 올리는 방식이 셋이다: 물건 하나(사진) · 학생증 / 카드(사진 없이 가린 이름) · 잡화 모음(상자째 사진 한 장).
import { DEMO_ADMIN_TOKEN } from "./aimatchDomain";
import { DEMO_ADMIN_NAME } from "./festDomain";

const ADMIN = "lostAdmin";
const GUEST = "lostGuest";

const frames = [
  {
    id: ADMIN,
    who: "총괄",
    label: "총괄 화면",
    sub: "본부에서 여는 관리자 화면 · 분실물 관리",
    home: "/admin",
    allow: [/^\/admin$/],
    staff: true,
    width: 1040,
    local: [
      ["festflow_access_token", DEMO_ADMIN_TOKEN],
      ["festflow_admin_name", DEMO_ADMIN_NAME],
    ],
  },
  {
    id: GUEST,
    who: "손님",
    label: "손님 분실물 화면",
    sub: "분실물 탭 · 보관 안내판",
    home: "/lost-found",
    allow: [/^\/lost-found$/],
  },
];

const steps = [
  {
    key: "item",
    frame: ADMIN,
    title: "값나가는 물건은 하나씩 등록하기",
    body: "‘분실물 관리’에서 물건 이름과 발견 위치를 적고 ‘등록하기’. 지갑 · 폰 · 에어팟 · 가방처럼 알아보기 쉬운 물건만 이렇게 올려요. 사진은 선택이에요.",
  },
  {
    key: "name",
    frame: ADMIN,
    title: "학생증은 사진 없이 이름만",
    body: "‘학생증’을 고르고 적힌 이름을 적은 뒤 ‘등록하기’. 사진을 올리면 얼굴 · 학번이 그대로 나가서, 손님 화면에는 가운데를 가린 이름만 보여 줘요. 카드도 같아요.",
  },
  {
    key: "pickup",
    frame: ADMIN,
    title: "주인이 찾아왔어요 — ‘찾아감’ 누르기",
    body: "본인 물건인지 확인하고 내준 뒤, 처리 메모에 어떻게 확인했는지 적고 ‘찾아감’. 손님이 미리 요청을 보내는 단계는 없어요. 직접 찾아오는 방식이에요.",
  },
  {
    key: "bundle",
    frame: ADMIN,
    title: "자잘한 물건은 상자째 한 장 — ‘잡화 모음’",
    body: "‘잡화 모음’을 고르고 상자 사진을 넣은 뒤 ‘등록하기’. 립밤 · 키링 · 머리끈을 하나씩 올리지 않아도 돼요. (연습에서는 아무 사진이나 골라도 되고, 어디에도 올라가지 않아요.)",
  },
];

function progress(snapshot) {
  const { flow, items } = snapshot.lost;
  return {
    done: {
      item: flow.itemId != null,
      name: flow.nameId != null,
      pickup: flow.pickedUp,
      bundle: flow.bundleId != null,
    },
    context: {
      // '찾아감'을 누를 물건: 처음 등록한 물건, 이미 내줬으면 아직 보관 중인 아무 물건.
      pickup: items.find((item) => item.id === flow.itemId && item.status !== "RETURNED") || items.find((item) => item.status !== "RETURNED") || null,
    },
  };
}

/* ---------- 방금 일어난 일 ---------- */
const hasBatchim = (word) => {
  const text = `${word}`.trim();
  const code = text.charCodeAt(text.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
};
const eul = (word) => `‘${word}’${hasBatchim(word) ? "을" : "를"}`;

const titleIs = (node, selector, title) => node.querySelector(selector)?.textContent.trim() === title;
const guestItem = (title) => (doc) => [...doc.querySelectorAll(".v2-lost")].find((node) => titleIs(node, ".v2-lost__head strong", title)) || null;
const guestList = (doc) => doc.querySelector(".v2-lost-list");
const adminItem = (title) => (doc) => [...doc.querySelectorAll(".alost-item")].find((node) => titleIs(node, ".alost-item__title strong", title)) || null;

function describe(event) {
  const from = event.role === GUEST ? GUEST : ADMIN;
  const title = event.item?.title;
  switch (event.type) {
    case "lost.created": {
      const guestText =
        event.kind === "name"
          ? "목록 맨 위에 사진 없이 종류와 가린 이름만 떠요. 이름 전체 · 학번 · 카드 번호는 어디에도 나가지 않아요."
          : event.kind === "bundle"
            ? "목록 맨 위에 상자 사진 한 장으로 떠요. 손님이 눌러서 사진을 크게 보고, 자기 물건이 있으면 찾아와요."
            : `새로고침하지 않아도 목록 맨 위에 ‘보관 중’으로 바로 떠요.${event.item.finderContact ? " 습득자 연락처는 가운데가 가려져서 나가요." : ""}`;
      return {
        from,
        cause: `본부가 ${eul(title)} 등록했어요`,
        effects: [
          { frame: GUEST, text: guestText, show: guestItem(title) },
          { frame: ADMIN, text: "보관 목록 맨 위에 생겨요. 발견 위치는 다음 등록 때도 그대로 남아 있어요." },
        ],
      };
    }
    case "lost.claimed":
      return {
        from,
        cause: `손님이 ${eul(title)} ‘내 물건이에요’라고 요청했어요`,
        effects: [{ frame: ADMIN, text: "그 물건에 신청자 이름 · 연락처가 보여요.", show: adminItem(title) }],
      };
    case "lost.status": {
      const { status } = event.item;
      if (status === "RETURNED") {
        return {
          from,
          cause: `본부가 ${eul(title)} ‘찾아감’으로 바꿨어요`,
          effects: [
            { frame: GUEST, text: `‘찾아감’으로 바뀌고, 위쪽의 보관 수가 ${event.stored}개로 줄어요.`, show: guestItem(title) },
            { frame: ADMIN, text: "회색 ‘찾아감’이 되고 처리 메모가 같이 저장돼요. 잘못 눌렀으면 ‘보관 중으로 되돌리기’." },
          ],
        };
      }
      return {
        from,
        cause: `본부가 ${eul(title)} ‘보관 중’으로 되돌렸어요`,
        effects: [
          { frame: GUEST, text: `다시 ‘보관 중’으로 보이고, 보관 수가 ${event.stored}개로 늘어요.`, show: guestItem(title) },
          { frame: ADMIN, text: "‘보관 중’으로 돌아가요." },
        ],
      };
    }
    case "lost.deleted":
      if (event.replaced) {
        return {
          from,
          cause: `본부가 ${eul(title)} 새 사진으로 바꿨어요`,
          effects: [
            { frame: GUEST, text: "같은 묶음이 새 사진으로 목록 맨 위에 다시 떠요.", show: guestItem(title) },
            { frame: ADMIN, text: "예전 사진의 묶음은 없어지고 새 사진의 묶음만 남아요." },
          ],
        };
      }
      return {
        from,
        cause: `본부가 분실물 ${eul(title)} 지웠어요`,
        effects: [
          { frame: GUEST, text: "목록에서 바로 사라져요.", show: guestList },
          { frame: ADMIN, text: "보관 목록에서 없어져요. 지운 물건은 되살릴 수 없어요." },
        ],
      };
    default:
      return null;
  }
}

/* ---------- 지금 누를 곳 ---------- */
const onScreen = (node) => Boolean(node) && node.getClientRects().length > 0;
const navButton = (doc, label) =>
  [...doc.querySelectorAll(".admin-console-sidebar nav button, .admin-console-mobile-tabs button")].find(
    (button) => onScreen(button) && button.textContent.trim() === label,
  ) || null;
const KIND_LABEL = { item: "물건 하나", name: "학생증", bundle: "잡화 모음" };

function findTarget(stepKey, doc, { pickup }) {
  const panel = doc.querySelector(".alost");
  if (!panel) return navButton(doc, "분실물 관리");

  if (stepKey === "pickup") {
    const card = pickup ? adminItem(pickup.title)(doc) : null;
    if (!card) return null;
    const note = card.querySelector(".alost-note");
    if (note && !note.value.trim()) return note;
    return card.querySelector(".alost-btn--primary");
  }

  // 폰 폭에서는 등록 칸이 접혀 있다.
  const toggle = panel.querySelector(".alost-form__toggle");
  if (onScreen(toggle) && toggle.getAttribute("aria-expanded") !== "true") return toggle;
  const kinds = [...panel.querySelectorAll(".alost-kinds button")];
  const wanted = kinds.find((button) => button.textContent.trim() === KIND_LABEL[stepKey]);
  if (wanted && !wanted.classList.contains("is-on")) return wanted;
  const form = panel.querySelector(".alost-form__body");
  // 이름 칸(물건 이름 · 적힌 이름 · 묶음 이름)은 등록 방식 바로 아래의 첫 입력 칸이다.
  const [first] = form.querySelectorAll('label.alost-field input:not([type="file"])');
  if (first && !first.value.trim()) return first;
  const location = form.querySelector('input[placeholder="예: 노천극장 입구 계단"]');
  if (location && !location.value.trim()) return location;
  if (stepKey === "bundle") {
    const photo = form.querySelector(".alost-photo");
    if (photo && !photo.querySelector("img")) return photo;
  }
  return form.querySelector(".alost-submit");
}

export const lostScenario = {
  id: "lost",
  label: "분실물",
  shortLabel: "분실물",
  subtitle: "분실물 · 본부 보관 안내 (주인이 직접 찾아오는 방식)",
  frames,
  steps,
  progress,
  describe,
  findTarget,
  scrollAnchor: ".alost-item",
  ideas: [
    "손님 화면에서 잡화 모음을 눌러 사진을 크게 보기 (사진을 한 번 더 누르면 확대)",
    "잡화 모음의 ‘사진 다시 찍기’로 사진만 바꾸면 손님 화면은?",
    "‘카드’로 등록하면 손님 화면에 어떻게 보일까? (이름이 없으면 비워도 돼요)",
    "‘찾아감’을 잘못 눌렀을 때 ‘보관 중으로 되돌리기’",
    "손님 화면에서 분류 칩이나 검색으로 물건 찾아보기",
  ],
};
