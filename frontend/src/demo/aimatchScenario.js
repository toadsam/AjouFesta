// 눌러 보는 매뉴얼 · 사주 소개팅 흐름. 화면 셋(신청한 사람 · 신청받은 사람 · 소개팅 관리자)과 순서, 방금 일어난 일을 글로 바꾸는 규칙.
import { DEMO_ADMIN_TOKEN, DEMO_PIN, DEMO_USER_A, DEMO_USER_B } from "./aimatchDomain";

const ACCESS_SESSION_KEY = "ai-match-access-session";
const MATCHED = new Set(["ACCEPTED", "PROPOSED", "CONFIRMED"]);
const AFTER_CHAT = new Set(["CHOOSING", "MATCH", "NO_MATCH", "CLOSED"]);
const HOUR = 60 * 60_000;

const sessionFor = (nickname, screen) => [[ACCESS_SESSION_KEY, JSON.stringify({ nickname, pin: DEMO_PIN, screen })]];

const frames = [
  {
    id: "userA",
    who: "참가자",
    label: "신청한 사람",
    sub: `${DEMO_USER_A} · 먼저 신청을 보내는 쪽`,
    home: "/ai-match",
    allow: [/^\/ai-match$/],
    session: sessionFor(DEMO_USER_A, "intro"),
  },
  {
    id: "userB",
    who: "참가자",
    label: "신청받은 사람",
    sub: `${DEMO_USER_B} · 신청을 받는 쪽`,
    home: "/ai-match",
    allow: [/^\/ai-match$/],
    session: sessionFor(DEMO_USER_B, "requests"),
  },
  {
    id: "admin",
    who: "운영진",
    label: "소개팅 관리자",
    sub: "부스 스태프가 보는 화면",
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
    frame: "userA",
    title: "상대 프로필을 열어 데이트 신청 보내기",
    body: `목록에서 ‘${DEMO_USER_B}’ 카드의 ‘데이트 신청하기’를 누르고, 아래로 내려 메시지를 적어 보내요. 한 사람당 3번까지 보낼 수 있어요.`,
  },
  {
    key: "accept",
    frame: "userB",
    title: "신청함에서 ‘수락’ 누르기",
    body: "받은 요청에 방금 온 신청이 보여요. 수락하면 매치가 성사되고 시간을 잡을 수 있어요.",
  },
  {
    key: "propose",
    frame: "userA",
    title: "만날 시간 골라 제안하기",
    body: "신청함의 ‘만날 시간 고르기’에서 빈 칸을 하나 골라 제안해요. 30분 동안 그 칸이 임시로 잠겨요. (둘 중 누가 제안해도 돼요)",
  },
  {
    key: "confirm",
    frame: "userB",
    title: "‘이 시간으로 확정’ 누르기",
    body: "제안을 받은 사람이 확정해야 약속이 굳어요. 확정하면 둘 다 바꾸거나 취소할 수 없어요.",
  },
  {
    key: "skipMeetup",
    frame: null,
    title: "약속 시간이 됐다고 치기",
    body: "실제로는 약속 날까지 기다려요. 연습에서는 아래 버튼으로 약속 10분 전으로 건너뛰어요. 세 화면의 시계가 같이 넘어가요.",
    action: { name: "skipToMeetup", label: "약속 10분 전으로 건너뛰기" },
  },
  {
    key: "arrive",
    frame: "userA",
    title: "대기 장소에서 ‘도착했어요’ 누르기",
    body: "약속 1시간 전부터 누를 수 있어요. 누르면 운영진 시간표에 도착으로 떠요. 상대는 다른 곳에서 기다려요.",
  },
  {
    key: "escort",
    frame: "admin",
    title: "두 사람을 ‘부스 도착’까지 넘기기",
    body: "시간표에서 사람마다 도착 확인 → 출발하기 → 만났어요 → 부스 도착 순서로 눌러요. 누를 때마다 그 사람 티켓의 단계가 바뀌어요.",
  },
  {
    key: "chatStart",
    frame: "admin",
    title: "‘채팅 시작’ 누르기",
    body: "두 사람이 부스에 앉아 앱을 켠 걸 보고 눌러요. 누르는 순간 10분 타이머가 돌아요.",
  },
  {
    key: "chatTalk",
    frame: "userA",
    title: "채팅방에서 한마디 보내기",
    body: "얼굴을 가린 채 글로 10분 이야기해요. 주제를 눌러도 되고 직접 써도 돼요.",
  },
  {
    key: "skipChat",
    frame: null,
    title: "채팅 10분이 지났다고 치기",
    body: "실제로는 10분이 지나야 채팅이 닫혀요. 연습에서는 아래 버튼으로 끝나는 시각으로 건너뛰어요.",
    action: { name: "skipChat", label: "채팅 끝나는 시각으로 건너뛰기" },
  },
  {
    key: "chooseA",
    frame: "userA",
    title: "‘얼굴 보기’ 고르기",
    body: "채팅이 끝나면 3분 안에 골라요. 한 번 고르면 바꿀 수 없어요.",
  },
  {
    key: "chooseB",
    frame: "userB",
    title: "상대도 ‘얼굴 보기’ 고르기",
    body: "둘 다 ‘얼굴 보기’를 골라야 서로 얼굴을 봐요. 한 명이라도 ‘여기까지’면 누가 그랬는지 알려 주지 않고 끝나요.",
  },
  {
    key: "met",
    frame: "admin",
    title: "‘만남 완료’ 누르기",
    body: "얼굴 보기 결과가 나오면 버튼이 나타나요. 두 사람이 나가면 눌러요(확인 창). 그 줄이 끝난 것으로 정리돼요.",
  },
];

const stampMs = (value) => (value ? new Date(`${value}`.slice(0, 19)).getTime() : 0);

function progress(snapshot) {
  const { requests, nowMs } = snapshot.aimatch;
  const request =
    requests
      .filter((item) => item.requesterNickname === DEMO_USER_A && item.profileNickname === DEMO_USER_B)
      .sort((a, b) => b.id - a.id)[0] || null;
  const status = request?.status;
  const met = request?.meetupOutcome === "MET";
  const confirmed = status === "CONFIRMED";
  const phase = request?.chatPhase || "NONE";
  const conditions = [
    ["request", Boolean(request) && status !== "CANCELED" && status !== "REJECTED"],
    ["accept", MATCHED.has(status)],
    ["propose", status === "PROPOSED" || confirmed],
    ["confirm", confirmed],
    ["skipMeetup", confirmed && (met || nowMs >= stampMs(request.meetupAt) - HOUR)],
    ["arrive", met || (request && request.requesterEscortStage !== "NONE")],
    ["escort", met || phase !== "NONE" || (request && request.requesterEscortStage === "AT_BOOTH" && request.profileEscortStage === "AT_BOOTH")],
    ["chatStart", met || phase !== "NONE"],
    ["chatTalk", met || AFTER_CHAT.has(phase) || (request?.messageCount || 0) > 0],
    ["skipChat", met || AFTER_CHAT.has(phase)],
    ["chooseA", met || phase === "MATCH" || phase === "NO_MATCH" || Boolean(request?.requesterReveal)],
    ["chooseB", met || phase === "MATCH" || phase === "NO_MATCH" || Boolean(request?.profileReveal)],
    ["met", met],
  ];
  // 앞 단계가 끝나야 다음 단계가 끝난 것으로 본다.
  const done = {};
  let chain = true;
  conditions.forEach(([key, value]) => {
    chain = chain && Boolean(value);
    done[key] = chain;
  });
  const noShow = `${request?.meetupOutcome ?? ""}`.startsWith("NO_SHOW");
  return {
    done,
    context: { request },
    titles: noShow ? { propose: "노쇼로 약속이 취소됐어요. 시간을 다시 골라 제안하기" } : {},
  };
}

/* ---------- 방금 일어난 일을 글로 ---------- */
const frameOf = (nickname) => (nickname === DEMO_USER_A ? "userA" : nickname === DEMO_USER_B ? "userB" : null);
const timeOf = (value) => (value ? `${value.slice(5, 7)}.${value.slice(8, 10)} ${value.slice(11, 16)}` : "");
const STAGE_LABEL = { NONE: "아직 안 옴", ARRIVED: "대기 장소 도착", DEPARTED: "스태프 가는 중", PICKED_UP: "스태프와 이동 중", AT_BOOTH: "부스 도착" };
const STAGE_TICKET = {
  NONE: "동선이 처음 단계(대기 장소로 가요)로 돌아가요.",
  ARRIVED: "동선이 ‘도착했어요 · 스태프가 곧 데리러 가요’로 바뀌어요.",
  DEPARTED: "동선이 ‘스태프가 가고 있어요’로 바뀌어요.",
  PICKED_UP: "동선이 ‘스태프와 만났어요’로 바뀌어요.",
  AT_BOOTH: "동선이 ‘부스에 도착했어요’로 바뀌고 채팅방이 저절로 열려요(채팅 시작 전에는 기다리는 화면).",
};

// 효과 목록에서 그 사람의 화면이 매뉴얼에 없으면(연습용 다른 사람) 뺀다.
const only = (effects) => effects.filter((effect) => effect.frame);

function describe(event) {
  const from = frames.some((frame) => frame.id === event.role) ? event.role : "admin";
  const request = event.request;
  const requester = request ? frameOf(request.requesterNickname) : null;
  const target = request ? frameOf(request.profileNickname) : null;
  const both = (text, extra = {}) => [
    { frame: requester, text, ...extra },
    { frame: target, text, ...extra },
  ];
  switch (event.type) {
    case "aim.request.created":
      return {
        from,
        cause: `${request.requesterNickname} 님이 ${request.profileNickname} 님에게 데이트 신청을 보냈어요`,
        effects: only([
          { frame: requester, text: "신청함 ‘보낸 요청’에 ‘대기’로 쌓이고, 남은 신청 횟수가 하나 줄어요." },
          { frame: target, text: "신청함 ‘받은 요청’에 새 신청이 뜨고 알림이 떠요. 실제로는 문자도 가요." },
          { frame: "admin", text: "‘신청 기록’에 대기 중인 신청으로 잡혀요." },
        ]),
      };
    case "aim.request.accepted":
      return {
        from,
        cause: `${request.profileNickname} 님이 신청을 수락했어요 — 매치 성사`,
        effects: only([
          { frame: target, text: "받은 요청 카드에 ‘매치 성사 · 만날 시간 고르기’가 열려요." },
          { frame: requester, text: "보낸 요청이 ‘수락’으로 바뀌고 ‘만날 시간 고르기’가 열려요. 실제로는 문자도 가요." },
          { frame: "admin", text: "성사된 매치가 한 쌍 늘고 도장 알림이 떠요." },
        ]),
      };
    case "aim.request.rejected":
      return {
        from,
        cause: `${request.profileNickname} 님이 신청을 거절했어요`,
        effects: only([
          { frame: requester, text: "보낸 요청이 ‘거절’로 바뀌어요. 쓴 횟수는 돌아오지 않아요." },
          { frame: "admin", text: "‘신청 기록’에 거절로 남아요." },
        ]),
      };
    case "aim.request.canceled":
      return {
        from,
        cause: `${request.requesterNickname} 님이 보낸 신청을 취소했어요`,
        effects: only([
          { frame: target, text: "받은 요청이 ‘취소’로 바뀌어요." },
          { frame: "admin", text: "‘신청 기록’에 취소로 남아요." },
        ]),
      };
    case "aim.meetup.proposed": {
      const proposer = frameOf(event.by);
      const other = proposer === requester ? target : requester;
      return {
        from,
        cause: `${event.by} 님이 ${timeOf(request.meetupAt)}${event.counter ? " 로 다른 시간을" : " 을"} 제안했어요`,
        effects: only([
          { frame: proposer, text: `‘상대 확정 대기’와 남은 시간(⏳)이 보여요. ${event.holdMinutes}분 안에 확정이 없으면 이 칸은 다시 풀려요.` },
          { frame: other, text: "‘시간 제안 도착’ 카드와 ‘이 시간으로 확정’ 버튼이 떠요. 실제로는 문자도 가요." },
          { frame: "admin", text: "시간표를 그 날짜로 넘기면 그 칸에 ‘임시 · 확정 대기’로 떠요." },
        ]),
      };
    }
    case "aim.meetup.confirmed": {
      const confirmer = frameOf(event.by);
      const other = confirmer === requester ? target : requester;
      return {
        from,
        cause: `${event.by} 님이 ${timeOf(request.meetupAt)} 약속을 확정했어요`,
        effects: only([
          { frame: confirmer, text: "약속 티켓으로 바뀌어요. 내가 기다릴 곳과 ‘오늘의 동선’이 보여요." },
          { frame: other, text: "약속 티켓으로 바뀌어요. 실제로는 확정 문자도 가요." },
          { frame: "admin", text: "시간표 그 칸이 ‘확정’으로 굳고, 대기 장소 명단에 두 사람이 올라와요." },
        ]),
      };
    }
    case "aim.meetup.canceled": {
      const actor = frameOf(event.by);
      const other = actor === requester ? target : requester;
      return {
        from,
        cause: `${event.by} 님이 시간 제안을 ${event.withdrawn ? "취소" : "거절"}했어요`,
        effects: only([
          { frame: actor, text: "‘만날 시간 고르기’로 돌아가요. 매치는 그대로예요." },
          { frame: other, text: "제안이 사라지고 ‘만날 시간 고르기’로 돌아가요. 실제로는 문자도 가요." },
          { frame: "admin", text: "시간표의 임시 칸이 비어요." },
        ]),
      };
    }
    case "aim.clock":
      if (event.reason === "meetup") {
        return {
          from: "coach",
          cause: `약속 10분 전(${event.now.slice(11, 16)})으로 건너뛰었어요`,
          effects: only([
            ...both("티켓의 ‘도착했어요’ 버튼이 눌러지게 바뀌어요."),
            { frame: "admin", text: "시간표에서 약속 날짜를 누르면, 위쪽 카드가 이 두 사람을 ‘곧 대기 장소로’라고 알려요." },
          ]),
        };
      }
      return {
        from: "coach",
        cause: "채팅 10분이 지났어요",
        effects: only([
          ...both("채팅 입력이 닫히고 ‘얼굴 보기 / 여기까지 할게요’ 선택이 떠요. 3분 안에 골라야 해요."),
          { frame: "admin", text: "그 줄이 ‘얼굴 보기 고르는 중’으로 바뀌어요." },
        ]),
      };
    case "aim.arrived": {
      const me = frameOf(event.by);
      const other = me === requester ? target : requester;
      return {
        from,
        cause: `${event.by} 님이 대기 장소에서 ‘도착했어요’를 눌렀어요`,
        effects: only([
          { frame: me, text: STAGE_TICKET.ARRIVED },
          { frame: "admin", text: `${event.by} 님이 ‘대기 장소 도착’으로 바뀌고 ‘출발하기’ 버튼이 떠요.` },
          { frame: other, quiet: true, text: "아무것도 안 바뀌어요. 블라인드라 상대의 단계는 보여 주지 않아요." },
        ]),
      };
    }
    case "aim.escort": {
      const person = frameOf(event.nickname);
      return {
        from,
        cause: `운영진이 ${event.nickname} 님을 ‘${STAGE_LABEL[event.stage]}’(으)로 바꿨어요`,
        effects: only([
          { frame: person, text: STAGE_TICKET[event.stage] },
          {
            frame: "admin",
            text: event.bothAtBooth
              ? "두 사람 모두 부스 도착 — 그 줄에 ‘채팅 시작’ 버튼이 떠요."
              : "그 사람 줄의 단계와 다음에 누를 버튼이 바뀌어요.",
          },
        ]),
      };
    }
    case "aim.chat.started":
      return {
        from,
        cause: "운영진이 블라인드 채팅을 시작했어요",
        effects: only([
          ...both("채팅방이 열리고 10분 타이머가 돌기 시작해요. 대화 주제도 같이 떠요."),
          { frame: "admin", text: "그 줄에 ‘채팅 중 · 10분 남음’이 떠요." },
        ]),
      };
    case "aim.chat.message": {
      if (event.count !== 1) return null;
      const me = frameOf(event.by);
      const other = me === requester ? target : requester;
      return {
        from,
        cause: `${event.by} 님이 채팅방에 첫 ${event.kind === "TOPIC" ? "주제를 올렸어요" : "메시지를 보냈어요"}`,
        effects: only([
          { frame: me, text: "보낸 말이 오른쪽에 쌓여요." },
          { frame: other, text: "1초 안에 상대 화면에도 떠요. 서로 닉네임만 알고 얼굴은 몰라요." },
          { frame: "admin", quiet: true, text: "대화 내용은 평소에 보이지 않아요. ‘채팅 기록 보기’는 신고 확인용이에요." },
        ]),
      };
    }
    case "aim.chat.choice": {
      const me = frameOf(event.by);
      const other = me === requester ? target : requester;
      if (event.result === "MATCH") {
        return {
          from,
          cause: "둘 다 ‘얼굴 보기’를 골랐어요",
          effects: only([
            ...both("‘서로 얼굴을 보기로 했어요’가 떠요."),
            { frame: "admin", text: "‘둘 다 얼굴 보기 — 가림막을 걷어 주세요’가 떠요." },
          ]),
        };
      }
      if (event.result === "NO_MATCH") {
        return {
          from,
          cause: "한 명이 ‘여기까지 할게요’를 골랐어요",
          effects: only([
            ...both("‘이번 만남은 여기까지예요’가 떠요. 누가 그랬는지는 나오지 않아요."),
            { frame: "admin", text: "‘여기까지 — 한 분씩 따로 안내해 주세요’가 떠요." },
          ]),
        };
      }
      return {
        from,
        cause: `${event.by} 님이 선택을 보냈어요`,
        effects: only([
          { frame: me, text: "‘상대의 선택을 기다리고 있어요’로 바뀌어요." },
          { frame: other, quiet: true, text: "아무것도 안 바뀌어요. 상대가 뭘 골랐는지는 결과가 날 때까지 알려 주지 않아요." },
        ]),
      };
    }
    case "aim.met":
      return {
        from,
        cause: "운영진이 ‘만남 완료’를 눌렀어요",
        effects: only([
          ...both("티켓의 동선이 ‘만남 완료’로 바뀌어요."),
          { frame: "admin", text: "그 줄이 ‘만남 완료’로 흐려지고 버튼이 사라져요." },
        ]),
      };
    case "aim.noshow":
      return {
        from,
        cause: "운영진이 노쇼로 처리하고 칸을 반납했어요",
        effects: only([
          ...[requester, target].map((frame) => ({
            frame,
            text: `약속 티켓이 사라지고 ‘시간을 다시 잡을 수 있어요’가 떠요.${event.wasConfirmed ? " 실제로는 취소 문자도 가요." : ""}`,
          })),
          { frame: "admin", text: "그 칸이 비어서 다른 커플이 잡을 수 있어요. 매치는 남아 있어요." },
        ]),
      };
    case "aim.report.created":
      return {
        from,
        cause: `${event.report.reporterNickname} 님이 ${event.report.targetNickname} 님을 신고했어요`,
        effects: only([
          { frame: "admin", text: "‘신고’ 탭에 새 신고가 뜨고 숫자가 올라가요." },
          { frame: frameOf(event.report.targetNickname), quiet: true, text: "아무것도 안 바뀌어요. 신고한 사실은 상대에게 알려지지 않아요." },
        ]),
      };
    case "aim.report.resolved":
      return {
        from,
        cause: `운영진이 신고를 ${event.action === "HIDE" ? "숨김으로" : "문제 없음으로"} 처리했어요`,
        effects: only([
          { frame: "admin", text: "신고가 처리됨으로 바뀌어요." },
          event.action === "HIDE"
            ? { frame: frameOf(event.report.reporterNickname), quiet: true, text: "숨긴 사람은 목록에서 빠져요. 목록은 2분마다 새로 읽어요." }
            : { frame: null },
        ]),
      };
    case "aim.profile.hidden":
      return {
        from,
        cause: `운영진이 ${event.nickname} 님을 ${event.hidden ? "숨겼어요" : "다시 보이게 했어요"}`,
        effects: [{ frame: "admin", text: `‘사람들’에서 ${event.hidden ? "숨김" : "보임"}으로 바뀌어요. 참가자 목록에는 2분 안에 반영돼요.` }],
      };
    case "aim.photo.reviewed":
      return {
        from,
        cause: `운영진이 ${event.nickname} 님의 사진을 ${event.decision === "APPROVED" ? "승인" : "반려"}했어요`,
        effects: [
          {
            frame: "admin",
            text: event.decision === "APPROVED" ? "검수 대기열에서 빠져요." : "검수 대기열에서 빠지고, 그 사람은 목록에서 숨겨져요.",
          },
        ],
      };
    default:
      return null;
  }
}

/* ---------- 지금 누를 곳 ---------- */
const textOf = (node) => (node?.textContent || "").replace(/\s+/g, " ").trim();
const all = (doc, selector) => [...doc.querySelectorAll(selector)];
const byText = (doc, selector, text) => all(doc, selector).find((node) => textOf(node).includes(text)) || null;
const enabled = (node) => (node && !node.disabled ? node : null);

// 신청함의 그 사람 카드. 탭(받은 요청 · 보낸 요청)이 다르면 탭을, 신청함이 아니면 아래 '신청함'을 누르게 한다.
function requestCard(doc, partner, tab) {
  if (doc.querySelector(".mchat")) return { go: doc.querySelector(".mchat__close") };
  const onRequests = byText(doc, ".ai-match-request-summary", "신청함");
  if (!onRequests) return { go: byText(doc, ".ai-match-bottom-tab", "신청함") };
  const chip = byText(doc, ".ai-match-filter-chip", tab);
  if (chip && !chip.classList.contains("is-active")) return { go: chip };
  return { card: all(doc, ".ai-match-request-history-card").find((card) => textOf(card.querySelector(".ai-match-request-history-person")).includes(partner)) || null };
}

function adminRow(doc, request) {
  if (!request) return null;
  return (
    all(doc, ".mu-admin__row").find((row) => textOf(row).includes(request.requesterNickname) && textOf(row).includes(request.profileNickname)) || null
  );
}

// 시간표가 약속 날짜가 아니면 그 날짜 탭을 누르게 한다.
function adminScheduleRow(doc, request) {
  const row = adminRow(doc, request);
  if (row) return { row };
  const day = `${request?.meetupAt || ""}`.slice(5, 10).replace("-", ".");
  return { go: day ? byText(doc, ".mu-admin__tab", day) : null };
}

function findTarget(stepKey, doc, { request }) {
  // 그 화면의 신청함에서 찾을 카드: 상대의 닉네임이 적혀 있다.
  const partner = stepKey === "chooseB" || stepKey === "accept" || stepKey === "confirm" ? DEMO_USER_A : DEMO_USER_B;
  switch (stepKey) {
    case "request": {
      const sheetButton = doc.querySelector(".ai-match-primary-button--sheet");
      if (sheetButton) return enabled(sheetButton);
      const card = all(doc, ".ai-match-person-card").find((node) => textOf(node.querySelector(".ai-match-person-copy strong")).includes(DEMO_USER_B));
      if (card) return card.querySelector(".ai-match-request-button--card");
      return byText(doc, ".ai-match-bottom-tab", "처음");
    }
    case "accept": {
      const { go, card } = requestCard(doc, partner, "받은 요청");
      return go || (card ? byText(card, ".ai-match-request-actions button", "수락") : null);
    }
    case "propose": {
      const { go, card } = requestCard(doc, partner, "보낸 요청");
      if (go || !card) return go || null;
      if (card.querySelector(".mu-picker")) {
        // 칸을 골랐으면 제안 버튼, 아니면 빈 칸. 오늘 칸이 다 지났으면 칸이 남은 다른 날짜.
        return (
          enabled(card.querySelector(".mu-picker__foot .mu-primary")) ||
          card.querySelector(".mu-slot:not([disabled])") ||
          all(card, ".mu-date").find((tab) => !tab.classList.contains("is-on") && !textOf(tab).includes("마감")) ||
          null
        );
      }
      return card.querySelector(".mu--accepted .mu-primary");
    }
    case "confirm": {
      // 제안한 사람이 누구든, 제안받은 쪽 화면에 확정 버튼이 있다. 이 단계는 신청받은 사람 화면을 본다.
      const { go, card } = requestCard(doc, partner, "받은 요청");
      return go || card?.querySelector(".mu--proposed .mu-primary") || null;
    }
    case "arrive": {
      const { go, card } = requestCard(doc, partner, "보낸 요청");
      return go || enabled(card?.querySelector(".esc-arrived")) || null;
    }
    case "escort": {
      const { go, row } = adminScheduleRow(doc, request);
      return go || row?.querySelector(".mu-admin__pair .mu-esc__next:not([disabled])") || null;
    }
    case "chatStart": {
      const { go, row } = adminScheduleRow(doc, request);
      return go || row?.querySelector(".mu-chat-start") || null;
    }
    case "chatTalk": {
      if (doc.querySelector(".mchat")) return doc.querySelector(".mchat__chip:not([disabled])") || doc.querySelector(".mchat__composer input");
      const { go, card } = requestCard(doc, partner, "보낸 요청");
      return go || card?.querySelector(".esc-arrived") || null;
    }
    case "chooseA":
    case "chooseB": {
      if (doc.querySelector(".mchat")) return doc.querySelector(".mchat__yes:not([disabled])");
      const { go, card } = requestCard(doc, partner, stepKey === "chooseA" ? "보낸 요청" : "받은 요청");
      return go || card?.querySelector(".esc-arrived") || null;
    }
    case "met": {
      const { go, row } = adminScheduleRow(doc, request);
      return go || row?.querySelector(".mu-admin__btn--met") || null;
    }
    default:
      return null;
  }
}

export const aimatchScenario = {
  id: "aimatch",
  label: "사주 소개팅",
  shortLabel: "소개팅",
  subtitle: "사주 소개팅 · 신청부터 부스 만남까지",
  frames,
  steps,
  progress,
  describe,
  findTarget,
  scrollAnchor: ".mu-admin__row, .ai-match-request-history-card .mu, .ai-match-person-card",
  /** 매뉴얼 버튼(건너뛰기)이 연습용 서버에 시키는 일. */
  runAction(server, action, { request }) {
    if (request) server.act("aimatch", action.name, { requestId: request.id });
  },
  ideas: [
    "신청받은 사람이 ‘거절’하면 신청한 사람 화면은?",
    "제안받은 시간을 ‘거절’하거나 ‘다른 시간 제안’을 하면?",
    "운영진이 ‘노쇼 · 슬롯 반납’을 누르면 두 사람 화면은?",
    "채팅방에서 ‘신고’를 누르면 운영진 화면은?",
  ],
};
