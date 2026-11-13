// 이번 축제(바람) 고정 정보. 포스터 기준. 서버 데이터가 없어도 첫 화면이 비지 않도록 여기서 읽는다.
export const FESTIVAL = {
  name: "바람",
  title: "2026 아주대학교 가을축제",
  tagline: "Records of Autumn 2026",
  startDate: "2026-10-07",
  endDate: "2026-10-08",
  place: "노천극장",
  instagram: "ajou_council",
  // 포스터 파일을 frontend/public/images/poster.jpg 로 넣으면 첫 화면 배경으로 깔린다. 없으면 CSS 하늘로 그린다.
  posterUrl: "/images/poster.jpg",
  // 이번 축제 주점은 총학 주점 하나. 서버 부스 중 이름에 이 말이 들어간 부스를 주점 탭에 바로 띄운다.
  mainBoothKeyword: "총학",
  // 이번 축제는 자리 예약을 안 받는다. 손님 화면의 예약 칸과 운영 콘솔의 예약 구역을 숨긴다(빈 자리 표시는 그대로).
  reservations: false,
  // 분실물 등록은 본부 스태프 화면(/staff)에서만. 손님은 목록을 보고 '내 물건이에요' 만 보낸다.
  lostFoundPublicRegister: false,
  // 분실물은 본부에서 보관만 하고, 잃어버린 사람이 직접 찾아온다. 손님 화면의 '내 물건이에요' 요청과 총괄 화면의 '주인 확인' 단계를 숨긴다.
  lostFoundClaim: false,
  // 손님 분실물 화면 맨 위의 보관 안내. hours(운영 시간) · after(축제가 끝난 뒤 보관처)는 비워 두면 화면에 나오지 않는다.
  lostFound: { place: "축제 본부(총학생회 부스)", hours: "", after: "" },
  // 손님 첫 화면 맨 아래의 사이트 문의 한 줄. 주문 · 자리 · 분실물 문의까지 몰리지 않게 '사이트 오류 · 문의'로만 적는다.
  // 누구나 보는 화면이라 축제가 끝나면 phone 을 비운다(비우면 줄이 통째로 안 나온다).
  siteContact: { role: "소통개발국장", name: "정재훈", phone: "010-0000-0000" },
};

/**
 * 총학 주점 정보(총학생회 확정본, 2026-09-30). 서버 부스에 값이 아직 없을 때 화면이 이 값을 쓴다.
 * 서버에서도 같은 값을 넣는다(backend DataInitializer.syncCouncilBooth) — 바꿀 땐 양쪽을 같이 고친다.
 * 입금 계좌는 주문 화면이 서버 값만 쓰므로 여기엔 두지 않는다.
 */
export const MAIN_BOOTH_FALLBACK = {
  name: "총학생회 주점",
  description: "총학생회가 직접 여는 주점 · 주점 본부는 카페 안녕",
  openTime: "16:00",
  closeTime: "23:00",
  tableCount: 60,
  // 길찾기 목적지: 주점 본부(카페 안녕, 수원시 영통구 월드컵로193번길 36)
  place: { name: "카페 안녕", label: "카페 안녕 (주점 본부)", lat: 37.27760004, lng: 127.04439431 },
  menu: [
    { name: "삼겹살/볶음김치 SET", description: "삼겹살 400g · 볶음김치 100g", price: "9,000원", imageUrl: "/images/booths/menu/samgyeopsal-kimchi.webp" },
    { name: "두부김치", description: "두부 300g · 김치 400g", price: "7,000원", imageUrl: "/images/booths/menu/dubu-kimchi.webp" },
    { name: "짜파게티/볶음김치 SET", description: "짜파게티 2개 · 볶음김치 100g", price: "7,000원", imageUrl: "/images/booths/menu/jjapaghetti-kimchi.webp" },
    { name: "어묵탕", description: "어묵 336g · 물 500ml", price: "5,000원", imageUrl: "/images/booths/menu/eomuk-tang.webp" },
  ],
};

export function isMainBooth(booth) {
  return `${booth?.name || ""}`.includes(FESTIVAL.mainBoothKeyword);
}

export function findMainBooth(booths) {
  if (!Array.isArray(booths)) return null;
  return booths.find(isMainBooth) || null;
}
