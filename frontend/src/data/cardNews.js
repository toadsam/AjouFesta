// 총학생회 카드뉴스(인스타 게시물)를 앱 안에서 넘겨 보는 소식. 원본은 이미지지만 글자·지도·버튼을 살려 다시 그렸다.
// 새 묶음을 올리려면 CARD_NEWS 에 묶음을 하나 더하고, pages 에 components/cardnews/CardNewsViewer.jsx 의 PAGES 키를 적는다.
// PAGE_INFO 는 ⓘ 버튼을 눌렀을 때 나오는 한 줄 요약(원본 카드의 글을 옮긴 것).

export const CARD_NEWS_IMG = "/images/cardnews";

const BOTH_DAYS = "10. 07. (수) - 10. 08. (목)";
const DAY1 = "2026-10-07";
const DAY2 = "2026-10-08";

export const MAIN_BOOTH = {
  place: "성호관 잔디밭",
  placeLong: "성호관 앞 잔디밭 총학생회 메인부스",
  dates: "10.07 (수) – 10.08 (목)",
  hours: "10:00 – 17:00",
  days: ["2026-10-07", "2026-10-08"],
  open: "10:00",
  close: "17:00",
};

export const CONTACTS = [
  { role: "문화기획국 국장", name: "담당자", phone: "010-0000-0000" },
  { role: "문화기획국 차장", name: "담당자", phone: "010-0000-0000" },
  { role: "문화기획국 차장", name: "담당자", phone: "010-0000-0000" },
];

export const GOODS = {
  tee: { name: "치토 티셔츠 - 2color", price: "24,000원" },
  keyring: { name: "치토 키캡 키링 4구", price: "9,000원" },
};

/* ---------- 공연무대(10.08 노천극장) ---------- */
export const STAGE = {
  place: "노천극장(The Art)",
  entry: "17:30",
  entryNote: "입장 시간은 현장 상황에 따라 변동될 수 있습니다.",
  entryAt: "2026-10-08T17:30:00",
  rules: [
    { text: "노천극장은 [아주인(학부생, 대학원생, 교직원, 졸업생)]만 입장 가능합니다.", sub: "외부인은 노천극장 입장이 불가능합니다." },
    { text: "입장 전 [학생증(또는 모바일 학생증)을 통한 입장 확인 절차가 진행]될 예정이오니 미리 준비해 주시기 바랍니다." },
    { text: "노천극장의 수용인원을 초과하는 등 [현장 상황에 따라 입장이 제한]될 수 있습니다." },
    { text: "안전사고 예방을 위해 [가을축제 <바람> 현장 스태프의 통제]를 반드시 따라 주시기 바랍니다." },
  ],
  gate: "총학생회 본부 옆 노천극장 입구",
  queue: [
    "공연무대 입구는 [본부 옆에 위치한 입구가 유일]하며 [이외의 모든 출입구는 폐쇄]됩니다.",
    "반드시 정해진 입구로만 통행해 주시기 바랍니다.",
    "지정된 입구가 아닌 [다른 곳으로 통행을 하는 경우 퇴장 조치]됨을 알려드립니다.",
    "다른 학우분의 통행에 방해가 되지 않도록 한쪽으로 정렬하여 줄을 서주시기 바랍니다.",
    "[대리 줄 서기를 금지]합니다.",
    "[가을축제 <바람> 현장 스태프의 통제]를 반드시 따라 주시기 바랍니다.",
  ],
  teams: [
    "스파이더스",
    "라스트댄스",
    "5분쉼표",
    "하늘음표",
    "정민경, 박민서",
    "늙크크",
    "김준영",
    "MASTERPIECE",
    "B.E.A.T",
    "낮에는 착합니다",
    "보석함",
    "늑대야",
  ],
  banned: [
    { icon: "bottle", label: "병, 캔, 유리, 높은 굽 구두 등", strong: "날카롭고 뾰족한 모든 물건" },
    { icon: "knife", label: "칼, 총기류, 폭죽 등", strong: "위험물품" },
    { icon: "camera", label: "대포 카메라", strong: "전문 촬영 장비" },
    { icon: "fire", label: "가스버너, 폭죽 등", strong: "화기 물품" },
    { icon: "food", label: "", strong: "음식물, 주류" },
    { icon: "warn", label: "이 외 위험하다고 판단되는 모든 물품", strong: "" },
  ],
  etc: [
    "[공연 관람을 방해]하거나 [진행에 지장을 주는 행위]는 경고 없이 [즉각 퇴장 조치]됨을 알려드립니다.",
    "[스태프의 안전 통제를 따르지 않은 경우 즉각 퇴장 조치]됨을 알려드립니다.",
    "[노천극장 계단의 경사가 매우 가파르니] 계단에서는 발을 헛딛는 등 안전사고에 유의하시기 바랍니다.",
    "안전을 고려하여 현장 상황 및 인원 밀집도에 따라 [퇴장 후 재입장이 일시적으로 불가능]할 수 있습니다.",
    "공연이 종료된 후 퇴장 시에는 [입구에 가까운 인원부터 순차적으로 퇴장]하며, 압사 및 넘어짐 사고가 발생하지 않도록 [앞사람과의 적당한 간격을 두어 천천히 퇴장]해 주시기 바랍니다.",
  ],
};

/* ---------- 배리어 프리존(10.08) ---------- */
export const BARRIER = {
  place: "아주대학교 노천극장(The Art)",
  hours: "18:00 – 22:00",
  about:
    "배리어 프리(Barrier - free)는 사회적 약자들의 사회 생활에 지장이 되는 물리적인 장애물이나 심리적인 장벽을 없애기 위해 실시하는 운동 및 정책을 의미합니다.",
  steps: [
    "공연무대(아주대학교 노천극장 The Art) 도착 후 현장 스태프에게 배리어 프리존 이동 문의",
    "간단한 입장 확인 절차 진행",
    "배리어 프리존 입장 통로로 현장 스태프와 함께 이동",
    "배리어 프리존 입장",
  ],
  notes: [
    "배리어 프리존 입장을 희망하시는 학우분께서는 학생증(또는 모바일 학생증)을 지참해 주시기 바랍니다.",
    "배리어 프리존은 아주대학교 학생만 입장 가능하며, 최대 동반 1인까지 입장 가능합니다.",
    "동반 1인은 아주대학교 학생이 아니어도 배리어 프리존 입장이 가능합니다.",
    "배리어 프리존 입장 절차를 반드시 준수하시기 바랍니다.",
  ],
};

/* ---------- 포토부스 · 주류 ---------- */
export const PHOTO_BOOTH = { place: "도서관 주차장", dates: "10.07 (수) – 10.08 (목)" };

export const BAR = {
  place: "교내 편의점",
  hours: "18:00 - 23:00",
  rule: "외부 주류의 경우 페트병으로 제한합니다. 안전상의 이유로 유리병 반입이 금지됩니다.",
  rule2: "유리병 적발 시 회수 조치 예정입니다.",
};

/* ---------- 아로새길 거리축제(10.07) ----------
 * box 는 지도 그림 위에서 그 구역이 차지하는 자리(왼쪽 · 위 · 너비 · 높이, %).
 */
export const ARO = {
  when: "26. 10. 07 (수) 14:00 ~ 23:00",
  place: "아로새길 및 아주대 삼거리 일대",
  about: "총학생회 구역 / 상인회 주민자치회 구역 / 도시재단 구역을 나누어 각각 부스를 진행",
  zones: [
    {
      key: "A",
      tone: "blue",
      name: "A구역: 총학생회 구역",
      subs: ["A-1 총학생회 주점부스", "A-2 쌈지공원 메인무대(본식운영)"],
      box: [24.3, 8.4, 4.6, 33],
    },
    { key: "B", tone: "mint", name: "B구역: 상인회, 주민자치회 구역", subs: [], box: [26.6, 42.4, 4.2, 36.6] },
    { key: "C", tone: "cyan", name: "C구역: 도시재단 구역", subs: [], box: [28.6, 78.4, 13, 20.6] },
  ],
  pub: {
    when: "26. 10. 07 (수) 16:00 ~ 23:00",
    start: "2026-10-07T16:00:00",
    end: "2026-10-07T23:00:00",
    place: "아로새길 거리축제 총학생회 구역",
    about: "총학생회 주점 운영",
    note: "모든 판매수익은 기부 예정",
    box: [37.9, 64.2, 4, 14.8],
  },
  menu: [
    { img: "dish-pork", name: "삼겹살/볶음김치", price: "9000원", detail: "삼겹살 400g · 볶음김치 100g" },
    { img: "dish-tofu", name: "두부김치", price: "7000원", detail: "두부 300g · 김치 400g" },
    { img: "dish-eomuk", name: "어묵탕", price: "5000원", detail: "어묵 336g · 물 500ml" },
    { img: "dish-jjapa", name: "짜파게티", price: "7000원", detail: "짜파게티 2개 · 볶음김치 100g" },
  ],
};

/* ---------- 뛰아주(10.07) ---------- */
export const RUN = {
  when: "26. 10. 07. (수) 10:30 ~ 12:00",
  start: "2026-10-07T10:30:00",
  end: "2026-10-07T12:00:00",
  schedule: [
    { time: "10:30", text: "참가자 확인 / 스트레칭 / 배번 및 물 배부" },
    { time: "10:40", text: "행사 시작" },
    { time: "12:00", text: "행사 종료 & 사진 촬영" },
  ],
  perk: "AAR 장학 마일리지 활용 가능",
  legs: [
    { key: "blue", label: "출발-반환 동선", from: "출발: 축구장", to: "반환: 혜령공원" },
    { key: "yellow", label: "반환-순환 동선", from: "반환: 혜령공원", to: "순환 구간" },
    { key: "green", label: "순환-도착 동선", from: "순환 구간", to: "도착: 선구자상" },
  ],
  items: [
    { img: "run-tee", name: "행사 티셔츠" },
    { img: "run-bib", name: "배번" },
    { img: "run-water", name: "물" },
    { img: "run-medal", name: "참가메달" },
  ],
};

/* ---------- SUCL 2026 with 아주대학교 결승(10.07) ---------- */
export const SUCL = {
  when: "26. 10. 07. (수) 15:00 ~ 19:00",
  start: "2026-10-07T15:00:00",
  end: "2026-10-07T19:00:00",
  place: "아주대학교 대운동장",
  teams: [
    { key: "eleven", name: "일레븐", img: "sucl-eleven" },
    { key: "fcmedia", name: "FC미디어", img: "sucl-fcmedia" },
  ],
  event: [
    "결승전 현장의 뜨거운 순간을 인스타그램 스토리에 올려주세요!",
    "경기 장면을 촬영해 인스타그램 스토리에 업로드하면 추첨을 통해 [5만원 상당의 상품권]을 드립니다. (@ajou_council 언급 필수)",
    "[총 10명에게, 50만 원 상당의 경품!] 결승전도 즐기고, 특별한 선물의 주인공에도 도전해보세요!",
  ],
  steps: ["결승전 경기 장면을 촬영해요", "인스타그램 스토리에 올려요", "@ajou_council 을 꼭 언급해요"],
  account: "@ajou_council",
};

/* ---------- 응원대제전(10.08) ---------- */
export const CHEER = {
  playlist: ["Emperor", "투혼가", "전력질주", "승리의 푸른 횃불", "내가 바로 아주인", "우리는 하나", "부산 바캉스", "예술이야"],
  // 곡을 누르면 카드 안에서 트는 영상. 전부 아주대학교 응원단 센토 유튜브 채널의 무대 영상이다(카드 안 재생 허용 확인, 2026-10-01).
  // start / end 는 초 — 여러 곡이 이어진 영상은 그 곡이 나오는 구간만 튼다(영상 설명의 시간표 기준).
  // "승리의 푸른 횃불"은 유튜브에 영상이 없다(안무는 센토 인스타그램 릴스로 공개 예정).
  videos: {
    Emperor: { id: "zLmGZt3RZ-M", start: 0, end: 120, from: "2026 수페리얼" },
    투혼가: { id: "7k0jymTSEcM", start: 102, from: "2026 ACENTIA" },
    전력질주: { id: "FQ3k9wLocGY", from: "2023 응원대제전" },
    "내가 바로 아주인": { id: "zL1-3BrdW8M", from: "2024 응원대제전" },
    "우리는 하나": { id: "3iUk16N14nE", from: "2025 ACENTIA" },
    "부산 바캉스": { id: "8LuirFUBKcI", from: "2026 ACENTIA" },
    예술이야: { id: "3YHyRl_ns64", from: "2026 ACENTIA" },
  },
  noVideo: "영상은 아직 없어요 · 안무는 센토 인스타그램 릴스에서",
  intro: [
    "응원은 함께할 때 더욱 커집니다.",
    "응원오리엔테이션에서 CENTAUR와 함께 응원의 기본 동작과 구호를 익히고, 아주대학교만의 응원 문화를 직접 경험해보세요.",
    "함께 박자를 맞추고, 하나의 목소리로 힘차게 외치며 2026년의 응원을 함께 만들어가길 바랍니다.",
    "여러분의 목소리가 모일 때, 아주대학교는 더 크게 울려 퍼집니다.",
  ],
  ot: [
    "안녕하세요, 아주대학교 학우 여러분!",
    "새로운 계절을 맞아 아주의 곳곳에 다시 한번 힘찬 응원의 목소리가 울려 퍼집니다.",
    "함께 맞춰가는 박자와 서로의 목소리가 하나로 모이는 순간, 우리는 또 하나의 함성을 만들어갑니다.",
    "아주대학교 응원단 CENTAUR가 2026년 응원오리엔테이션을 통해 학우 여러분과 함께 새로운 응원의 장을 열어갑니다.",
    "작은 목소리가 하나둘 모여 더 큰 함성이 되고, 서로 다른 우리가 하나의 박자로 움직이는 순간.",
    "Crescentaur. 점점 더 커지는 응원, 아주 크게 울려 퍼지는 우리의 목소리.",
    "2026년, 함께 웃고, 함께 뛰고, 함께 외치며 아주대학교의 응원을 더욱 크게 만들어갈 여러분을 기다립니다.",
  ],
  levels: ["작은 목소리", "점점 더", "점점 더 크게", "크게", "더 크게", "아주 크게!"],
  torch: {
    lead: "푸른 횃불 릴스를 보고 미리 익혀주세요! 공연 당일, 무대 위에서 푸른 횃불 안무를 함께 따라 춰주시면 이벤트 참여 완료!",
    steps: ["센토 인스타그램 계정 팔로우", "공연 전 공개되는 푸른 횃불 안무 익히기", "공연 당일 무대에 올라와 푸른 횃불 안무 따라 추기"],
    prizes: [
      { rank: "1등", name: "Apple Watch SE3", count: "1명" },
      { rank: "2등", name: "신세계 상품권 10만원권", count: "4명" },
    ],
    close: "무대 위에서 함께 즐기고 푸짐한 경품의 주인공이 되어보세요!",
  },
  slogan: {
    when: "10. 08. (목)",
    how: "공연 무대 입장 시 배부",
    body: "공연 무대에 입장하는 학우분들을 대상으로 [선착순 500명]에게 푸른 횃불의 열기를 더욱 뜨겁게 만들어줄 [응원 슬로건을 증정]합니다.",
    close: "슬로건 들고 다 같이 무대를 뜨겁게 채워주세요!",
    note: "준비된 수량 소진 시 배부가 조기 마감될 수 있습니다.",
  },
};

/* ---------- 묶음 ----------
 * cover.lines 는 표지 큰 글씨(줄마다), cover.sub 는 그 아래 작은 영어 줄, cover.date 는 날짜 줄.
 * cover.sub 가 배열이면 줄마다 따로 쓴다. cover.small 에 적은 줄은 작게 쓴다. tone: "deep" 은 짙은 파랑 묶음.
 */
// 10.08(목) 공연무대 스페셜 아티스트. 인물 사진은 다시 그릴 수 없어서 총학 포스터를 그대로 쓴다.
export const ARTIST = {
  label: "SPECIAL ARTIST",
  name: "fromis_9",
  date: "10. 08. (목)",
  poster: "artist-poster",
  thumb: "artist-poster-s",
  entryRule: "노천극장은 아주인만 입장할 수 있어요. 학생증(또는 모바일 학생증)을 준비해 주세요.",
};

export const CARD_NEWS = [
  {
    id: "main-booth",
    days: [DAY1, DAY2],
    title: "총학생회 메인부스",
    cover: { lines: ["총학생회 메인부스"], date: BOTH_DAYS },
    pages: ["cover", "booth-map", "goods", "leaflet", "tattoo", "wish-stamp", "sum-saju", "contact"],
  },
  {
    id: "goods",
    days: [DAY1, DAY2],
    title: "굿즈 안내",
    cover: { lines: ["굿즈 안내"], date: BOTH_DAYS },
    pages: ["cover", "goods-place", "tee", "keyring", "contact"],
  },
  {
    // 표지 · 진열대에 그린 표지 대신 포스터를 쓴다(cover.photo / cover.thumb).
    id: "artist",
    days: [DAY2],
    title: "스페셜 아티스트 fromis_9",
    cover: { lines: ["SPECIAL ARTIST"], sub: "fromis_9", date: "10. 08. (목)", photo: "artist-poster", thumb: "artist-poster-s" },
    pages: ["cover", "artist-info", "contact"],
  },
  {
    id: "stage",
    days: [DAY2],
    title: "공연무대 입장 안내 및 안전 유의사항",
    shelfTitle: ["공연무대", "입장·안전"],
    cover: { lines: ["공연무대 입장 안내", "및 안전 유의사항"], date: "10. 08. (목)" },
    pages: ["cover", "stage-entry", "stage-queue", "stage-teams", "stage-banned", "stage-etc", "contact"],
  },
  {
    id: "barrier-free",
    days: [DAY2],
    title: "공연 무대 배리어 프리존",
    shelfTitle: ["배리어", "프리존"],
    cover: { lines: ["공연 무대", "배리어 프리존"], sub: "BARRIER-FREE ZONE", date: "10.08 (목)" },
    pages: ["cover", "barrier-about", "barrier-steps", "barrier-map", "barrier-notes", "contact"],
  },
  {
    id: "photo-booth",
    days: [DAY1, DAY2],
    title: "포토부스 안내",
    cover: { lines: ["포토부스 안내"], date: BOTH_DAYS },
    pages: ["cover", "photo-place", "photo-frame", "contact"],
  },
  {
    id: "bar",
    days: [DAY1, DAY2],
    title: "주류 안내",
    cover: { lines: ["주류 안내"], date: BOTH_DAYS },
    pages: ["cover", "bar-rules", "contact"],
  },
  {
    id: "aro",
    days: [DAY1],
    title: "아로새길 거리축제 안내",
    shelfTitle: ["아로새길", "거리축제"],
    cover: { lines: ["아로새길 거리축제", "안내"], date: "10. 07. (수)" },
    pages: ["cover", "aro-info", "aro-pub", "aro-menu", "contact"],
  },
  {
    id: "run",
    days: [DAY1],
    title: "뛰아주 안내",
    cover: { lines: ["뛰아주", "안내"], date: "10. 07. (수)" },
    pages: ["cover", "run-info", "run-course", "run-items", "contact"],
  },
  {
    id: "sucl",
    days: [DAY1],
    title: "SUCL 2026 with 아주대학교 안내",
    shelfTitle: ["SUCL 2026", "결승 안내"],
    cover: { lines: ["SUCL 2026", "with", "아주대학교", "안내"], small: ["with"], date: "10. 07. (수)" },
    pages: ["cover", "sucl-final", "sucl-event", "contact"],
  },
  {
    // 원본 카드가 다른 묶음보다 짙은 파랑이다.
    id: "cheer",
    days: [DAY2],
    title: "응원대제전",
    tone: "deep",
    cover: { lines: ["응원대제전"], sub: ["Crescentaur(크레센토):", "점점 더, 아주 크게 응원의 함성"], date: "10. 08. (목)" },
    pages: ["cover", "cheer-playlist", "cheer-ot", "cheer-torch", "cheer-slogan"],
  },
];

export const PAGE_TITLES = {
  cover: "표지",
  "booth-map": "총학생회 부스 안내",
  goods: "가을축제 굿즈",
  leaflet: "리플렛",
  tattoo: "타투스티커",
  "wish-stamp": "바람을 묶다 & 스탬프 미션",
  "sum-saju": "SUM주팔자",
  contact: "문의 사항",
  "goods-place": "판매 위치 안내",
  tee: "치토 티셔츠",
  keyring: "치토 키캡 키링",
  "stage-entry": "공연무대 입장 안내",
  "stage-queue": "공연무대 대기줄 및 입구 안내",
  "stage-teams": "학생참여공연팀",
  "stage-banned": "반입금지 물품 안내",
  "stage-etc": "기타 유의사항",
  "artist-info": "스페셜 아티스트",
  "barrier-about": "공연 무대 배리어 프리존 입장 안내",
  "barrier-steps": "배리어 프리존 입장 절차",
  "barrier-map": "배리어 프리존 입구",
  "barrier-notes": "배리어 프리존 입장 관련 유의사항",
  "photo-place": "포토부스 위치 안내",
  "photo-frame": "포토 프레임",
  "bar-rules": "주류 관련 유의 사항",
  "aro-info": "아로새길 거리축제 안내",
  "aro-pub": "총학생회 주점 운영 안내",
  "aro-menu": "메뉴 안내",
  "run-info": "뛰아주 안내",
  "run-course": "런닝 코스",
  "run-items": "지급 물품",
  "sucl-final": "SUCL2026 with 아주대학교 결승 안내",
  "sucl-event": "결승전 관람 인증 EVENT",
  "cheer-playlist": "2026 아주대학교 응원단 CENTAUR",
  "cheer-ot": "2026 응원 오리엔테이션",
  "cheer-torch": "푸른 횃불 챌린지 EVENT",
  "cheer-slogan": "슬로건 증정 EVENT",
};

export const PAGE_INFO = {
  cover: "2026 아주대학교 가을축제 〈바람〉 · 아주대학교 제45대 총학생회 AU:SUM",
  "booth-map":
    "총학생회 메인부스는 성호관 잔디밭 주간부스 1, 2번에서, 'SUM주팔자' 부스는 주간부스 3, 4번에서 만날 수 있어요. 10.07(수) – 10.08(목), 10:00 – 17:00 운영.",
  goods:
    "2026 아주대학교 가을축제 〈바람〉의 굿즈 배부 및 판매가 총학생회 메인부스(성호관 잔디밭 1, 2번 부스)에서 이루어집니다. 굿즈 티셔츠 2color 24,000원, 키캡 키링 4구 9,000원.",
  leaflet: "총학생회 메인부스에서 〈바람〉의 부스팀, 공연팀, 아티스트까지 확인할 수 있는 리플렛을 배부합니다.",
  tattoo: "아주대학교 공식 마스코트 '치토'를 담은 타투스티커 2종. 학생증 확인 후 총학생회 메인부스에서 받을 수 있어요.",
  "wish-stamp":
    "바람을 묶다: 리본에 나만의 소원과 바람을 적어 걸어 주세요. 스탬프 미션: 축제 곳곳의 프로그램에 참여하고 스탬프를 모으면 꽝 없는 돌림판으로 특별한 선물을 드려요.",
  "sum-saju": "총학생회 소개팅 부스 SUM주팔자. 익명 채팅으로 시작되는 두근두근 소개팅, 사주로 오늘의 인연과 궁합까지 확인해 보세요.",
  contact: "제45대 총학생회 〈AU:SUM〉은 성공적인 가을축제 〈바람〉을 만들기 위해 노력하겠습니다. 문의는 문화기획국으로.",
  "goods-place": "판매 장소: 성호관 앞 잔디밭 총학생회 메인부스(1, 2번). 10.07(수) – 10.08(목), 10:00 – 17:00.",
  tee: "치토 티셔츠 2color(네이비·화이트). 앞면에는 작은 치토 친구들, 뒷면에는 2026 AJOU AUTUMN FESTIVAL 치토 프린팅. 24,000원.",
  keyring: "치토 키캡 키링 4구. 키캡 네 개에 치토 친구들과 AU 로고가 들어가요. 9,000원.",
  "stage-entry": "10.08(목) 노천극장(The Art), 17:30 입장(현장 상황에 따라 변동). 아주인만 입장, 학생증(모바일 학생증) 확인.",
  "stage-queue": "공연무대 입구는 총학생회 본부 옆 노천극장 입구 하나뿐. 다른 곳으로 들어가면 퇴장, 대리 줄 서기 금지.",
  "stage-teams": "학생참여공연팀 12팀: 스파이더스, 라스트댄스, 5분쉼표, 하늘음표, 정민경·박민서, 늙크크, 김준영, MASTERPIECE, B.E.A.T, 낮에는 착합니다, 보석함, 늑대야.",
  "stage-banned": "반입 물품 검사를 합니다. 날카롭고 뾰족한 물건, 위험물품, 전문 촬영 장비, 화기 물품, 음식물·주류 등은 반입 금지.",
  "artist-info": "10.08(목) 공연무대 스페셜 아티스트는 fromis_9. 노천극장(The Art), 입장은 17:30부터이고 아주인만 입장할 수 있어요(학생증 확인).",
  "stage-etc": "관람 방해·통제 불응 시 즉각 퇴장. 노천극장 계단이 가파르니 조심, 재입장이 막힐 수 있음, 퇴장은 입구 가까운 사람부터 천천히.",
  "barrier-about": "10.08(목) 18:00 – 22:00 노천극장(The Art)에서 배리어 프리존을 운영해요.",
  "barrier-steps": "사전 신청 없이 노천극장에서 현장 스태프에게 요청하면 배리어 프리존으로 안전하고 빠르게 이동할 수 있어요.",
  "barrier-map": "배리어 프리존 입구는 노천극장 왼쪽 아래, 쓰레기장 옆이에요.",
  "barrier-notes": "학생증 지참, 아주대 학생 + 동반 1인까지(동반인은 아주대 학생이 아니어도 가능), 입장 절차 준수.",
  "photo-place": "포토부스는 도서관 주차장, 야시장 옆에서 10.07(수) – 10.08(목) 운영해요. 바람 프레임과 함께 축제를 즐겨 봐요!",
  "photo-frame": "〈바람〉 전용 포토 프레임.",
  "bar-rules": "주류 판매는 교내 편의점, 18:00 – 23:00. 외부 주류는 페트병만, 유리병은 반입 금지(적발 시 회수).",
  "aro-info":
    "아로새길 거리축제는 10.07(수) 14:00 – 23:00, 아로새길 및 아주대 삼거리 일대에서 열려요. A구역 총학생회(A-1 주점부스, A-2 쌈지공원 메인무대), B구역 상인회·주민자치회, C구역 도시재단.",
  "aro-pub": "총학생회 주점은 10.07(수) 16:00 – 23:00, 아로새길 거리축제 총학생회 구역에서 운영해요. 모든 판매수익은 기부 예정.",
  "aro-menu": "삼겹살/볶음김치 9000원, 두부김치 7000원, 어묵탕 5000원, 짜파게티 7000원.",
  "run-info": "뛰아주는 10.07(수) 10:30 – 12:00. 10:30 참가자 확인·스트레칭·배번 및 물 배부, 10:40 행사 시작, 12:00 행사 종료 & 사진 촬영. AAR 장학 마일리지 활용 가능.",
  "run-course": "런닝 코스: 축구장에서 출발해 혜령공원에서 반환하고, 교내를 한 바퀴 돌아 선구자상에 도착해요.",
  "run-items": "지급 물품: 행사 티셔츠, 배번, 물, 참가메달.",
  "sucl-final": "SUCL2026 with 아주대학교 결승: 일레븐 VS FC미디어. 10.07(수) 15:00 – 19:00, 아주대학교 대운동장.",
  "sucl-event": "결승전 장면을 촬영해 인스타그램 스토리에 올리고 @ajou_council 을 언급하면, 추첨으로 10명에게 5만원 상당 상품권(총 50만 원 상당)을 드려요.",
  "cheer-playlist": "CENTAUR PLAYLIST: Emperor, 투혼가, 전력질주, 승리의 푸른 횃불, 내가 바로 아주인, 우리는 하나, 부산 바캉스, 예술이야. 곡을 누르면 응원단 센토의 무대 영상이 재생돼요.",
  "cheer-ot": "2026 응원 오리엔테이션 · Crescentaur: 점점 더, 아주 크게. 아주대학교 응원단 CENTAUR와 함께 새로운 응원의 장을 열어요.",
  "cheer-torch": "푸른 횃불 챌린지: 센토 인스타그램 팔로우 → 푸른 횃불 안무 익히기 → 공연 당일 무대에서 따라 추기. 1등 Apple Watch SE3(1명), 2등 신세계 상품권 10만원권(4명).",
  "cheer-slogan": "10.08(목) 공연 무대 입장 시 선착순 500명에게 응원 슬로건을 증정해요. 수량 소진 시 조기 마감.",
};

export function findCardNews(id) {
  return CARD_NEWS.find((set) => set.id === id) || null;
}

// 진열대 날짜 칩. 이틀 다 하는 묶음은 날짜 칩에 섞지 않고 "이틀 내내"에 따로 모은다(섞으면 거의 줄지 않는다).
export const NEWS_DAY_FILTERS = [
  { key: "all", label: "전체" },
  { key: DAY1, label: "10.07 수" },
  { key: DAY2, label: "10.08 목" },
  { key: "both", label: "이틀 내내" },
];

export function cardNewsDayKey(set) {
  return set.days?.length === 1 ? set.days[0] : "both";
}

// 첫 화면 하이라이트 배너(돌아가며 보여 준다).
// 평소에는 pre 가 붙은 것만 이 순서대로, 축제 당일에는 그날(day) 것만 시작 시간 순으로 보여 준다(start 가 없으면 맨 앞).
// title 은 줄 단위, art 는 public/images/cardnews 의 소품, page 를 적으면 그 장부터 연다.
const HIGHLIGHTS = [
  {
    id: "artist",
    day: DAY2,
    pre: true,
    set: "artist",
    photo: "artist-poster",
    label: "SPECIAL ARTIST",
    title: ["fromis_9"],
    meta: "10.08 (목) · 노천극장 공연무대",
    end: "2026-10-08T22:00:00",
  },
  {
    // 응원대제전은 시간이 따로 공지되지 않아서 공연 시작(18:00)으로 줄만 세운다.
    id: "cheer",
    day: DAY2,
    pre: true,
    set: "cheer",
    tone: "deep",
    label: "응원대제전",
    title: ["점점 더,", "아주 크게"],
    meta: "10.08 (목) · 공연무대",
    art: ["cheer-slogan"],
    artKind: "wide",
    start: "2026-10-08T18:00:00",
    end: "2026-10-08T22:00:00",
  },
  {
    id: "aro",
    day: DAY1,
    pre: true,
    set: "aro",
    label: "아로새길 거리축제",
    title: ["거리축제 ·", "총학 주점"],
    meta: "10.07 (수) 14:00 ~ 23:00",
    art: ["dish-jjapa", "dish-pork"],
    artKind: "stack",
    start: "2026-10-07T14:00:00",
    end: "2026-10-07T23:00:00",
  },
  {
    id: "run",
    day: DAY1,
    pre: true,
    set: "run",
    label: "뛰아주",
    title: ["캠퍼스를", "달려요"],
    meta: "10.07 (수) 10:30 · 축구장 출발",
    art: ["run-tee", "run-medal"],
    start: "2026-10-07T10:30:00",
    end: "2026-10-07T12:00:00",
  },
  {
    id: "sucl",
    day: DAY1,
    pre: true,
    set: "sucl",
    label: "SUCL 2026 결승",
    title: ["일레븐 VS", "FC미디어"],
    meta: "10.07 (수) 15:00 · 대운동장",
    art: ["sucl-eleven", "sucl-fcmedia"],
    artKind: "versus",
    start: "2026-10-07T15:00:00",
    end: "2026-10-07T19:00:00",
  },
  // 아래는 당일에만 나온다.
  {
    id: "stage",
    day: DAY2,
    set: "stage",
    page: "stage-entry",
    label: "공연무대 입장",
    title: ["입장은", "17:30부터"],
    meta: "아주인만 입장 · 학생증 준비",
    art: ["bird"],
    start: "2026-10-08T17:30:00",
    end: "2026-10-08T22:00:00",
  },
];

function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 지금 보여 줄 하이라이트. 축제 당일이면 { today: true, items: 그날 것(끝난 행사는 뒤로) }. */
export function highlightsFor(now = new Date()) {
  const today = localDayKey(now);
  if (today !== DAY1 && today !== DAY2) return { today: false, items: HIGHLIGHTS.filter((item) => item.pre) };
  const ended = (item) => Boolean(item.end) && new Date(item.end) < now;
  const items = HIGHLIGHTS.filter((item) => item.day === today).sort(
    (a, b) => Number(ended(a)) - Number(ended(b)) || (a.start || "").localeCompare(b.start || ""),
  );
  return { today: true, items };
}

// 타임테이블 일정에서 바로 여는 카드뉴스. 일정 제목(BaramSchedule · EVENT_PRESETS 와 같은 글자)으로 찾는다.
// page 를 적으면 그 장부터, 없으면 표지부터 연다.
const EVENT_NEWS = {
  뛰아주: [{ set: "run", label: "뛰아주 안내" }],
  주간부스: [{ set: "main-booth", label: "총학 메인부스" }, { set: "goods", label: "굿즈" }],
  야시장: [{ set: "photo-booth", label: "포토부스" }, { set: "bar", label: "주류 안내" }],
  "아로새길 거리축제": [{ set: "aro", label: "거리축제 안내" }],
  "총학 주점": [{ set: "aro", page: "aro-pub", label: "주점 위치 · 메뉴" }],
  SUCL: [{ set: "sucl", label: "결승 안내" }],
  야간부스: [{ set: "bar", label: "주류 안내" }],
  공연무대: [
    { set: "artist", label: "스페셜 아티스트" },
    { set: "stage", label: "입장 · 안전" },
    { set: "barrier-free", label: "배리어 프리존" },
    { set: "cheer", label: "응원대제전" },
  ],
};

/** 일정 제목에 붙는 카드뉴스 바로가기. [{ set, index, label }] — index 는 열 장(0 부터). */
export function newsForEvent(title) {
  return (EVENT_NEWS[`${title || ""}`.trim()] || []).flatMap((link) => {
    const set = findCardNews(link.set);
    if (!set) return [];
    return [{ set: set.id, index: Math.max(0, set.pages.indexOf(link.page)), label: link.label }];
  });
}
