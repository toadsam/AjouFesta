// 눌러 보는 매뉴얼 · 사주 소개팅 — 부스 시간을 못 잡은 커플의 연락처 주고받기.
// 신청 → 수락까지는 소개팅 흐름과 같고, 그 뒤 두 사람이 각자 '연락처 주고받기'에 동의하면 서로 번호가 보인다.
// 화면 id 는 흐름끼리 겹치면 안 되므로 소개팅 흐름(userA · userB · admin)과 다르게 짓는다.
import { DEMO_ADMIN_TOKEN, DEMO_PIN, DEMO_USER_A, DEMO_USER_B } from "./aimatchDomain";

const ACCESS_SESSION_KEY = "ai-match-access-session";
const MATCHED = new Set(["ACCEPTED", "PROPOSED", "CONFIRMED"]);
const A = "contactA";
const B = "contactB";
const ADMIN = "contactAdmin";

const sessionFor = (nickname, screen) => [[ACCESS_SESSION_KEY, JSON.stringify({ nickname, pin: DEMO_PIN, screen })]];

const frames = [
  {
    id: A,
    who: "참가자",
    label: "신청한 사람",
    sub: `${DEMO_USER_A} · 먼저 신청을 보내는 쪽`,
    home: "/ai-match",
    allow: [/^\/ai-match$/],
    session: sessionFor(DEMO_USER_A, "intro"),
  },
  {
    id: B,
    who: "참가자",
    label: "신청받은 사람",
    sub: `${DEMO_USER_B} · 신청을 받는 쪽`,
    home: "/ai-match",
    allow: [/^\/ai-match$/],
    session: sessionFor(DEMO_USER_B, "requests"),
  },
  {
    id: ADMIN,
    who: "운영진",
    label: "소개팅 관리자",
    sub: "성사 탭에서 동의 상태를 본다",
    home: "/ai-match/admin",
    allow: [/^\/ai-match\/admin$/],
    staff: true,
    local: [
      ["festflow_access_token", DEMO_ADMIN_TOKEN],
      ["festflow_admin_name", "연습 운영진"],
    ],
  },
];

const steps = [
  {
    key: "request",
    frame: A,
    title: "상대 프로필을 열어 데이트 신청 보내기",
    body: `목록에서 ‘${DEMO_USER_B}’ 카드의 ‘데이트 신청하기’를 누르고, 아래로 내려 메시지를 적어 보내요.`,
  },
  {
    key: "accept",
    frame: B,
    title: "신청함에서 ‘수락’ 누르기",
    body: "매치가 성사돼요. 원래는 여기서 부스 시간을 고르지만, 칸이 다 찼다고 치고 연락처로 이어가 볼게요.",
  },
  {
    key: "shareA",
    frame: A,
    title: "‘연락처 주고받기’ 누르기",
    body: "보낸 요청 카드 아래 ‘부스 시간을 못 잡았다면’ 칸에서 눌러요. 확인 창이 떠요. 나만 동의한 동안은 상대에게 내 번호가 안 가요.",
  },
  {
    key: "shareB",
    frame: B,
    title: "상대도 ‘나도 동의 · 번호 주고받기’ 누르기",
    body: "받은 요청 카드에 ‘신청한 사람이 동의했어요’가 노랗게 떠요. 누르면 그 자리에서 두 사람 모두에게 서로 번호가 보여요. 실제로는 둘 다에게 문자도 가요.",
  },
];

function progress(snapshot) {
  const { requests } = snapshot.aimatch;
  const request =
    requests
      .filter((item) => item.requesterNickname === DEMO_USER_A && item.profileNickname === DEMO_USER_B)
      .sort((a, b) => b.id - a.id)[0] || null;
  const status = request?.status;
  const conditions = [
    ["request", Boolean(request) && status !== "CANCELED" && status !== "REJECTED"],
    ["accept", MATCHED.has(status)],
    ["shareA", Boolean(request?.requesterContactConsentAt)],
    ["shareB", Boolean(request?.profileContactConsentAt)],
  ];
  const done = {};
  let chain = true;
  conditions.forEach(([key, value]) => {
    chain = chain && Boolean(value);
    done[key] = chain;
  });
  return { done, context: { request }, titles: {} };
}

/* ---------- 방금 일어난 일을 글로 ---------- */
const frameOf = (nickname) => (nickname === DEMO_USER_A ? A : nickname === DEMO_USER_B ? B : null);
const only = (effects) => effects.filter((effect) => effect.frame);

function describe(event) {
  const from = frames.some((frame) => frame.id === event.role) ? event.role : ADMIN;
  const request = event.request;
  const requester = request ? frameOf(request.requesterNickname) : null;
  const target = request ? frameOf(request.profileNickname) : null;
  switch (event.type) {
    case "aim.request.created":
      return {
        from,
        cause: `${request.requesterNickname} 님이 ${request.profileNickname} 님에게 데이트 신청을 보냈어요`,
        effects: only([
          { frame: requester, text: "신청함 ‘보낸 요청’에 ‘대기’로 쌓여요." },
          { frame: target, text: "신청함 ‘받은 요청’에 새 신청이 뜨고 알림이 떠요. 실제로는 문자도 가요." },
          { frame: ADMIN, text: "‘신청 기록’에 대기 중인 신청으로 잡혀요." },
        ]),
      };
    case "aim.request.accepted":
      return {
        from,
        cause: `${request.profileNickname} 님이 신청을 수락했어요 — 매치 성사`,
        effects: only([
          { frame: target, text: "받은 요청 카드에 ‘만날 시간 고르기’와 그 아래 ‘부스 시간을 못 잡았다면 · 연락처 주고받기’ 칸이 열려요." },
          { frame: requester, text: "보낸 요청이 ‘수락’으로 바뀌고 같은 칸이 열려요. 실제로는 문자도 가요." },
          { frame: ADMIN, text: "성사된 매치가 한 쌍 늘어요. 아직 시간 미정이에요." },
        ]),
      };
    case "aim.contact.consented": {
      const me = frameOf(event.by);
      const other = me === requester ? target : requester;
      if (event.shared) {
        return {
          from,
          cause: `${event.by} 님도 동의했어요 — 두 사람 다 동의, 연락처 공개`,
          effects: only([
            { frame: me, text: "그 자리에서 ‘연락처 공유됨’과 상대 번호가 보여요. 누르면 전화가 걸려요." },
            { frame: other, text: "카드가 ‘연락처 공유됨’으로 바뀌고 상대 번호가 보여요. 실제로는 두 사람 모두에게 문자가 가요." },
            { frame: ADMIN, text: "성사 탭 그 카드에 ‘연락처 공유됨 · 두 사람 다 동의’가 초록으로 붙어요." },
          ]),
        };
      }
      return {
        from,
        cause: `${event.by} 님이 연락처 주고받기에 동의했어요 (상대는 아직)`,
        effects: only([
          { frame: me, text: "‘상대 동의 기다리는 중’으로 바뀌어요. 내 번호는 아직 상대에게 안 보여요." },
          { frame: other, text: "카드에 ‘상대가 연락처 공유에 동의했어요’가 노랗게 뜨고 ‘나도 동의’ 버튼이 생겨요. 실제로는 문자도 가요." },
          { frame: ADMIN, text: "성사 탭 그 카드에 ‘연락처 공유 동의: 누구 · 누구 님 답 기다리는 중’이 붙어요. 번호는 아직 안 열렸어요." },
        ]),
      };
    }
    default:
      return null;
  }
}

/* ---------- 지금 단계에서 누를 곳 ---------- */
const textOf = (node) => (node?.textContent || "").replace(/\s+/g, " ").trim();
const all = (doc, selector) => [...doc.querySelectorAll(selector)];
const byText = (doc, selector, text) => all(doc, selector).find((node) => textOf(node).includes(text)) || null;
const enabled = (node) => (node && !node.disabled ? node : null);

function requestCard(doc, partner, tab) {
  const onRequests = byText(doc, ".ai-match-request-summary", "신청함");
  if (!onRequests) return { go: byText(doc, ".ai-match-bottom-tab", "신청함") };
  const chip = byText(doc, ".ai-match-filter-chip", tab);
  if (chip && !chip.classList.contains("is-active")) return { go: chip };
  return { card: all(doc, ".ai-match-request-history-card").find((card) => textOf(card.querySelector(".ai-match-request-history-person")).includes(partner)) || null };
}

function findTarget(stepKey, doc) {
  switch (stepKey) {
    case "request": {
      const sheetButton = doc.querySelector(".ai-match-primary-button--sheet");
      if (sheetButton) return enabled(sheetButton);
      const card = all(doc, ".ai-match-person-card").find((node) => textOf(node.querySelector(".ai-match-person-copy strong")).includes(DEMO_USER_B));
      if (card) return card.querySelector(".ai-match-request-button--card");
      return byText(doc, ".ai-match-bottom-tab", "처음");
    }
    case "accept": {
      const { go, card } = requestCard(doc, DEMO_USER_A, "받은 요청");
      return go || (card ? byText(card, ".ai-match-request-actions button", "수락") : null);
    }
    case "shareA": {
      const { go, card } = requestCard(doc, DEMO_USER_B, "보낸 요청");
      return go || enabled(card?.querySelector(".mu-contact__button")) || null;
    }
    case "shareB": {
      const { go, card } = requestCard(doc, DEMO_USER_A, "받은 요청");
      return go || enabled(card?.querySelector(".mu-contact__button")) || null;
    }
    default:
      return null;
  }
}

export const aimatchContactScenario = {
  id: "contact",
  label: "소개팅 · 연락처 주고받기",
  shortLabel: "연락처",
  subtitle: "사주 소개팅 · 부스 시간을 못 잡은 커플이 서로 동의해 번호를 주고받기",
  frames,
  steps,
  progress,
  describe,
  findTarget,
  scrollAnchor: ".ai-match-request-history-card .mu, .ai-match-person-card, .aa-match",
  ideas: [
    "한 사람만 동의하고 상대는 그냥 두면 어떻게 보일까?",
    "둘 다 동의한 뒤 운영진 성사 탭의 카드는?",
    "시간 제안이 오간 뒤(확정 전)에도 연락처 칸이 보일까? 확정된 약속이 있으면?",
  ],
};
