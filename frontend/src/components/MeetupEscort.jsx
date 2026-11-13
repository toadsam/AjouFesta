// 확정 티켓 아래의 '오늘의 동선'. 배달 앱 주문 현황처럼 단계 바로 보여 준다.
// 대기 장소로 가기 → 도착(내가 누르거나 스태프가 체크) → 스태프가 가고 있어요 → 스태프와 만남 → 부스 도착.
// 단계는 스태프가 관리자 시간표에서 넘긴다. 신청함이 15초마다 새로 받아서 곧 반영된다.
// 블라인드 만남이라 상대의 단계는 보여 주지 않는다.
import { useEffect, useState } from "react";
import "../styles/saju-escort.css";

// 대기 장소 사진(frontend/public/images/meetup/). 세로 사진이라 티켓에는 4:3 으로 잘라 보여 주고(focus = 세로 위치),
// 누르면 원본을 크게 연다. spot 은 사진 속에서 서 있을 자리. 파일이 없으면 사진 칸을 숨긴다.
// map 은 길찾기 목적지 — 건물 한가운데가 아니라 사진 속 그 자리다.
//   성호관: 잔디밭 쪽(남서) 면의 로고 입구 앞. 중앙도서관: 뒤쪽(남쪽) 1층 카페 027 라운지 데크 앞.
//   지도에 따로 등록된 장소가 아니라서 위성 사진과 입구 위치로 잡은 좌표다(2026-10-03). 현장과 다르면 여기 숫자만 고친다.
const WAITING_PLACE_PHOTOS = {
  "성호관 앞": {
    src: "/images/meetup/seongho.jpg",
    focus: "50% 72%",
    spot: "아주대 로고가 있는 입구 앞",
    map: { label: "성호관 로고 입구 앞", lat: 37.28282, lng: 127.04489 },
  },
  "중앙도서관 앞": {
    src: "/images/meetup/library.jpg",
    focus: "50% 80%",
    spot: "1층 카페 027 라운지 앞 데크",
    map: { label: "중앙도서관 카페 027 라운지 앞", lat: 37.28137, lng: 127.04421 },
  },
};

/** 내 대기 장소로 가는 카카오맵 길찾기 주소. 좌표를 모르는 장소면 null. */
export function waitingPlaceMapUrl(place) {
  const target = WAITING_PLACE_PHOTOS[place]?.map;
  if (!target) return null;
  return `https://map.kakao.com/link/to/${encodeURIComponent(target.label)},${target.lat},${target.lng}`;
}

const STAGE_INDEX = { NONE: 0, ARRIVED: 1, DEPARTED: 2, PICKED_UP: 3, AT_BOOTH: 4 };
const ARRIVAL_OPEN_MS = 60 * 60_000;
const ARRIVAL_CLOSE_MS = 30 * 60_000;

function parseLocal(value) {
  if (!value) return null;
  const [datePart, timePart = "00:00:00"] = `${value}`.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

function clock(date) {
  return date ? `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}` : "";
}

function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function PlacePhoto({ place }) {
  const photo = WAITING_PLACE_PHOTOS[place];
  const [ok, setOk] = useState(Boolean(photo));
  if (!photo || !ok) return null;
  return (
    <figure className="esc-photo">
      <a href={photo.src} target="_blank" rel="noreferrer" aria-label={`${place} 사진 크게 보기`}>
        <img src={photo.src} alt={`${place} 대기 위치`} style={{ objectPosition: photo.focus }} onError={() => setOk(false)} />
        <span aria-hidden="true">크게 보기</span>
      </a>
      <figcaption>
        <b>{place}</b> · {photo.spot}에서 기다려 주세요
      </figcaption>
    </figure>
  );
}

export default function MeetupEscort({ request, iAmRequester, myPlace, busy, onArrived, onOpenChat }) {
  const now = useNow(15_000);
  const stage = (iAmRequester ? request.requesterEscortStage : request.profileEscortStage) || "NONE";
  const stageAt = parseLocal(iAmRequester ? request.requesterEscortStageAt : request.profileEscortStageAt);
  const meetupAt = parseLocal(request.meetupAt);
  const met = request.meetupOutcome === "MET";
  const index = met ? 5 : STAGE_INDEX[stage] ?? 0;
  const arriveBy = meetupAt ? new Date(meetupAt.getTime() - 5 * 60_000) : null;
  const minutesSince = stageAt ? Math.max(0, Math.floor((now - stageAt.getTime()) / 60_000)) : 0;
  const canPressArrived = meetupAt
    && now >= meetupAt.getTime() - ARRIVAL_OPEN_MS
    && now <= meetupAt.getTime() + ARRIVAL_CLOSE_MS;

  const steps = [
    { label: "이동", title: "대기 장소로 가요", sub: `${clock(arriveBy)}까지 ${myPlace}` },
    { label: "도착", title: "도착했어요", sub: "스태프가 곧 데리러 가요" },
    { label: "스태프 출발", title: "스태프가 가고 있어요", sub: `출발한 지 ${minutesSince}분 · 보통 5분 안에 도착해요` },
    { label: "만남", title: "스태프와 만났어요", sub: "함께 부스로 이동 중이에요" },
    { label: "부스", title: "부스에 도착했어요", sub: "얼굴을 보기 전에 채팅방에서 10분 이야기해요" },
    { label: "완료", title: "만남 완료", sub: "즐거운 시간 보내셨길 바라요" },
  ];
  const current = steps[Math.min(index, steps.length - 1)];
  const barSteps = steps.slice(0, 5);
  const atBooth = stage === "AT_BOOTH" && !met;
  // 이미 끝난 채팅(결과가 났거나 닫힘)은 자동으로 열지 않고, 다시 보기 버튼만 둔다.
  const chatOver = ["MATCH", "NO_MATCH", "CLOSED"].includes(request.chatPhase);

  // 부스에 도착하면 채팅방을 한 번 자동으로 연다(닫은 뒤에는 버튼으로 다시 들어간다).
  useEffect(() => {
    if (!atBooth || chatOver || !onOpenChat) return;
    const key = `festflow.chatOpened.${request.id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // 저장이 안 되면 매번 열릴 수 있지만 막지는 않는다.
    }
    onOpenChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atBooth, chatOver, request.id]);

  return (
    <section className={`esc esc--${met ? "done" : stage.toLowerCase()}`} aria-label="오늘의 동선">
      <div className="esc-head">
        <small>오늘의 동선</small>
        <strong>
          {current.title}
          {stage === "DEPARTED" && !met ? <span className="esc-walker" aria-hidden="true">🚶</span> : null}
        </strong>
        <p>{current.sub}</p>
      </div>

      <ol className="esc-bar" aria-label={`진행 ${Math.min(index, 4) + 1}/5단계`}>
        {barSteps.map((step, i) => (
          <li key={step.label} className={i < index ? "is-done" : i === index ? "is-now" : ""}>
            <i aria-hidden="true">{i < index ? "✓" : ""}</i>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      {index === 0 ? (
        <>
          <PlacePhoto place={myPlace} />
          <button type="button" className="esc-arrived" disabled={busy || !canPressArrived} onClick={onArrived}>
            {canPressArrived ? `${myPlace}에 도착했어요` : "약속 1시간 전부터 누를 수 있어요"}
          </button>
        </>
      ) : null}
      {index === 1 ? <PlacePhoto place={myPlace} /> : null}
      {atBooth ? (
        <button type="button" className="esc-arrived" onClick={onOpenChat}>
          {chatOver ? "채팅방 다시 보기" : "블라인드 채팅방 들어가기"}
        </button>
      ) : null}
    </section>
  );
}
