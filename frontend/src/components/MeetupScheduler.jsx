// 매칭된 두 사람이 소개팅 부스 시간을 잡는 곳.
// 20분 슬롯(09:00~21:40), 슬롯 하나에 한 쌍. 한 명이 고르면 30분 임시 잠금 → 상대가 확정하면 굳는다.
// 지금부터 30분 안에 시작하는 칸은 못 고른다(SOON). 날짜 탭에 남은 칸 수가 보이고, 얼마 안 남으면 안내가 뜬다.
// 블라인드 만남이라 두 사람은 서로 다른 대기 장소로 가고, 스태프가 부스로 데려온다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAiMatchMeetupSlots } from "../api";
import MeetupEscort, { waitingPlaceMapUrl } from "./MeetupEscort";
import "../styles/saju-meetup.css";

// 확정 뒤 약속 불이행·참가자 사이 일에 대한 안내. 확정 창·티켓·가입 화면에 같은 말을 쓴다.
export const ORGANIZER_DISCLAIMER =
  "약속을 지키지 않거나 만남 중·이후 참가자 사이에 생긴 일은 주최 측(총학생회)이 책임지지 않아요. 불편한 일이 생기면 바로 부스 스태프나 '신고하기'로 알려 주세요.";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 고를 수 있는 칸이 이만큼 이하로 남으면 '얼마 안 남았어요' 안내를 띄운다.
const SCARCE_SLOTS = 10;

function slotStatusLabel(status, leadMinutes) {
  if (status === "PAST") return "지난 시간";
  if (status === "SOON") return `${leadMinutes}분 안에 시작해서 못 고름`;
  if (status === "BUSY") return "다른 약속과 40분 안이라 못 고름";
  return "다른 커플이 잡음";
}

function pad(value) {
  return `${value}`.padStart(2, "0");
}

function parseLocal(value) {
  // 서버는 "2026-10-07T14:15:00" 처럼 시간대 없는 한국 시간을 준다.
  if (!value) return null;
  const [datePart, timePart = "00:00:00"] = `${value}`.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

function dateLabel(dateText) {
  const date = parseLocal(`${dateText}T00:00:00`);
  if (!date) return dateText;
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} (${WEEKDAYS[date.getDay()]})`;
}

function timeLabel(value) {
  const date = parseLocal(value);
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
}

function fullLabel(value) {
  if (!value) return "";
  return `${dateLabel(`${value}`.split("T")[0])} ${timeLabel(value)}`;
}

function useCountdown(until) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  const target = parseLocal(until)?.getTime();
  if (!target) return "";
  const left = Math.max(0, Math.floor((target - now) / 1000));
  return `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
}

function SlotPicker({ requestId, currentSlot, busy, onPick, onClose }) {
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const datesRef = useRef(null);
  const hoursRef = useRef(null);

  // 날짜를 열면 고를 수 있는 첫 시간대가 맨 위에 오게 시간 목록만 내린다(오후에 열면 지난 칸이 길게 앞에 있다).
  const shownDate = data?.date || "";
  useEffect(() => {
    const box = hoursRef.current;
    const row = box?.querySelector(".mu-slot:not([disabled])")?.closest(".mu-hour");
    if (box && row) box.scrollTop += row.getBoundingClientRect().top - box.getBoundingClientRect().top;
  }, [shownDate]);

  // 날짜가 많아 탭이 옆으로 넘어갈 때, 고른 날짜가 보이게 탭 줄만 움직인다(페이지는 안 움직임).
  useEffect(() => {
    const row = datesRef.current;
    const tab = row?.querySelector(".mu-date.is-on");
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [date]);

  const load = useCallback(
    (nextDate) => {
      setLoading(true);
      return fetchAiMatchMeetupSlots(nextDate, requestId)
        .then((response) => {
          setData(response);
          setDate(response.date);
          setError("");
        })
        .catch((loadError) => setError(loadError.message || "시간표를 불러오지 못했어요."))
        .finally(() => setLoading(false));
    },
    [requestId],
  );

  useEffect(() => {
    load(currentSlot ? `${currentSlot}`.split("T")[0] : "");
  }, [load, currentSlot]);

  // 다른 커플이 계속 잡으니 열려 있는 동안 20초마다 새로 받는다.
  useEffect(() => {
    if (!date) return undefined;
    const id = window.setInterval(() => load(date), 20_000);
    return () => window.clearInterval(id);
  }, [date, load]);

  const hours = useMemo(() => {
    const groups = new Map();
    (data?.slots || []).forEach((slot) => {
      const hour = parseLocal(slot.startAt)?.getHours();
      if (!groups.has(hour)) groups.set(hour, []);
      groups.get(hour).push(slot);
    });
    return [...groups.entries()];
  }, [data]);

  const freeCount = (data?.slots || []).filter((slot) => slot.status === "FREE").length;
  const hasBusy = (data?.slots || []).some((slot) => slot.status === "BUSY");
  const hasSoon = (data?.slots || []).some((slot) => slot.status === "SOON");
  const leadMinutes = data?.leadMinutes ?? 30;
  const holdMinutes = data?.holdMinutes || 30;
  const days = data?.days || [];
  const freeByDate = new Map(days.map((day) => [day.date, day.freeSlots]));
  const totalFree = days.reduce((sum, day) => sum + (day.freeSlots || 0), 0);
  // 약속이 가까우면 잠금이 30분보다 일찍(약속 15분 전) 풀린다.
  const selectedMs = selected ? parseLocal(selected)?.getTime() : 0;
  const holdFor = selectedMs
    ? Math.max(1, Math.min(holdMinutes, Math.floor((selectedMs - Date.now()) / 60_000) - Math.floor(leadMinutes / 2)))
    : holdMinutes;

  async function submit() {
    if (!selected) return;
    const result = await onPick(selected);
    if (result?.ok) {
      onClose();
      return;
    }
    setError(result?.message || "시간을 잡지 못했어요. 다시 골라 주세요.");
    setSelected("");
    load(date);
  }

  return (
    <div className="mu-picker">
      <div className="mu-picker__head">
        <strong>만날 시간 고르기</strong>
        <button type="button" className="mu-link" onClick={onClose}>
          닫기
        </button>
      </div>

      <div className="mu-dates" role="tablist" aria-label="날짜" ref={datesRef}>
        {(data?.dates || []).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={item === date}
            className={`mu-date${item === date ? " is-on" : ""}`}
            onClick={() => {
              setSelected("");
              load(item);
            }}
          >
            <span className="mu-date__day">{dateLabel(item)}</span>
            {freeByDate.has(item) ? (
              <small className="mu-date__left">{freeByDate.get(item) > 0 ? `${freeByDate.get(item)}칸 남음` : "마감"}</small>
            ) : null}
          </button>
        ))}
      </div>

      {days.length && totalFree === 0 ? (
        <p className="mu-notice mu-notice--full">
          지금은 고를 수 있는 칸이 없어요. 다른 커플이 확정하지 않거나 취소하면 다시 열리니, 조금 뒤에 다시 확인해 주세요.
        </p>
      ) : days.length && totalFree <= SCARCE_SLOTS ? (
        <p className="mu-notice">남은 칸이 {totalFree}개뿐이에요. 늦기 전에 잡아 주세요.</p>
      ) : null}

      <div className="mu-legend">
        <span className="mu-legend__free">고를 수 있어요</span>
        <span className="mu-legend__taken">다른 커플</span>
        <span className="mu-legend__past">지난 시간</span>
        {hasBusy ? <span className="mu-legend__busy">약속 겹침</span> : null}
        <b className="mu-legend__count">{loading ? "불러오는 중…" : `${freeCount}칸 남음`}</b>
      </div>
      {hasSoon ? <p className="mu-soon-note">지금부터 {leadMinutes}분 안에 시작하는 칸은 고를 수 없어요.</p> : null}

      <div className="mu-hours" ref={hoursRef}>
        {hours.map(([hour, slots]) => (
          <div key={hour} className="mu-hour">
            <span className="mu-hour__label">{pad(hour)}시</span>
            <div className="mu-hour__slots">
              {slots.map((slot) => {
                const free = slot.status === "FREE" || slot.mine;
                const label = `:${pad(parseLocal(slot.startAt)?.getMinutes())}`;
                return (
                  <button
                    key={slot.startAt}
                    type="button"
                    className={`mu-slot mu-slot--${slot.status.toLowerCase()}${slot.mine ? " mu-slot--mine" : ""}${selected === slot.startAt ? " is-on" : ""}`}
                    disabled={!free || busy}
                    aria-pressed={selected === slot.startAt}
                    aria-label={`${pad(hour)}시 ${label.slice(1)}분 ${free ? "선택 가능" : slotStatusLabel(slot.status, leadMinutes)}`}
                    onClick={() => setSelected(slot.startAt)}
                  >
                    {selected === slot.startAt ? <span className="mu-slot__check" aria-hidden="true">✓</span> : null}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="mu-error">{error}</p> : null}

      <div className="mu-picker__foot">
        <p>
          고르면 <b>{holdFor}분 동안</b> 이 시간이 우리 몫으로 잠겨요. 그 안에 상대가 확정하면 끝!
        </p>
        <p className="mu-picker__warn">상대가 확정하면 두 사람 모두 시간을 바꾸거나 취소할 수 없어요.</p>
        <button type="button" className="mu-primary" disabled={!selected || busy} onClick={submit}>
          {selected ? `${fullLabel(selected)} 로 제안하기` : "시간을 골라 주세요"}
        </button>
      </div>
    </div>
  );
}

/**
 * 부스 시간을 못 잡은 커플의 연락처 주고받기. 둘 다 '동의'를 눌러야 서로 번호가 보이고,
 * 한쪽만 누른 동안은 상대에게 아무것도 안 넘어간다. 확정 약속이 있는 카드에는 안 보인다.
 */
function ContactShare({ request, iAmRequester, partner, busy, onShare }) {
  const mine = iAmRequester ? request.requesterContactConsentAt : request.profileContactConsentAt;
  const theirs = iAmRequester ? request.profileContactConsentAt : request.requesterContactConsentAt;
  const phone = request.sharedPhoneNumber || "";
  if (mine && theirs) {
    return (
      <div className="mu-contact mu-contact--shared">
        <span className="mu-contact__eyebrow">연락처 공유됨</span>
        {phone ? (
          <a className="mu-contact__phone" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
            {phone}
          </a>
        ) : (
          <strong className="mu-contact__phone">번호를 불러오는 중…</strong>
        )}
        <p className="mu-contact__copy">
          두 분 다 동의해서 {partner} 님의 번호가 보여요. {partner} 님도 내 번호를 볼 수 있어요. 부스 밖에서 만나는 건 두 사람이 알아서 정해요.
        </p>
      </div>
    );
  }
  if (mine) {
    return (
      <div className="mu-contact mu-contact--waiting">
        <span className="mu-contact__eyebrow">상대 동의 기다리는 중</span>
        <p className="mu-contact__copy">{partner} 님도 동의하면 그때 서로 번호가 보여요. 아직은 내 번호도 상대에게 안 보여요.</p>
      </div>
    );
  }
  return (
    <div className={`mu-contact${theirs ? " mu-contact--asked" : ""}`}>
      <span className="mu-contact__eyebrow">{theirs ? `${partner} 님이 연락처 공유에 동의했어요` : "부스 시간을 못 잡았다면"}</span>
      <p className="mu-contact__copy">
        {theirs
          ? "나도 동의하면 그 자리에서 서로 번호가 보여요. 원하지 않으면 그냥 두면 돼요 — 상대에게 알려지지 않아요."
          : "서로 동의하면 연락처를 주고받을 수 있어요. 둘 다 눌러야 열리고, 한쪽만 누른 동안은 아무것도 안 보여요."}
      </p>
      <button type="button" className={theirs ? "mu-primary mu-contact__button" : "mu-ghost mu-contact__button"} disabled={busy} onClick={() => onShare(request)}>
        {theirs ? "나도 동의 · 번호 주고받기" : "연락처 주고받기"}
      </button>
    </div>
  );
}

export default function MeetupScheduler({ request, myProfileId, busy, onPropose, onConfirm, onCancel, onOpenMap, onArrived, onOpenChat, onShareContact }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const countdown = useCountdown(request.status === "PROPOSED" ? request.meetupHeldUntil : "");

  const iAmRequester = request.requesterProfileId === myProfileId;
  const myPlace = iAmRequester ? request.requesterWaitingPlace : request.profileWaitingPlace;
  const partner = iAmRequester ? request.profileNickname : request.requesterNickname;
  const iProposed = request.meetupProposerProfileId === myProfileId;
  // 스태프가 노쇼로 처리하면 약속만 지워지고 매칭은 남는다. 누가 안 왔는지에 따라 안내가 다르다.
  const outcome = request.meetupOutcome || "";
  const noShow = outcome.startsWith("NO_SHOW");
  const iWasAbsent = outcome === "NO_SHOW_BOTH" || outcome === (iAmRequester ? "NO_SHOW_REQUESTER" : "NO_SHOW_PROFILE");

  if (!["ACCEPTED", "PROPOSED", "CONFIRMED"].includes(request.status)) return null;

  const contactShare = onShareContact ? (
    <ContactShare request={request} iAmRequester={iAmRequester} partner={partner} busy={busy} onShare={onShareContact} />
  ) : null;
  // 번호를 주고받은 뒤에 부스 약속을 잡아도 번호는 그대로 보여 준다(새로 동의하는 칸은 확정 뒤엔 안 연다).
  const contactShared = Boolean(request.requesterContactConsentAt && request.profileContactConsentAt);

  const picker = pickerOpen ? (
    <SlotPicker
      requestId={request.id}
      currentSlot={request.meetupAt}
      busy={busy}
      onPick={(slotAt) => onPropose(request, slotAt)}
      onClose={() => setPickerOpen(false)}
    />
  ) : null;

  if (request.status === "CONFIRMED") {
    return (
      <div className="mu mu--confirmed">
        <div className="mu-ticket">
          <span className="mu-ticket__eyebrow">약속 확정 · 블라인드 소개팅</span>
          <strong className="mu-ticket__time">{fullLabel(request.meetupAt)}</strong>
          <div className="mu-ticket__rows">
            <div>
              <small>내가 기다릴 곳</small>
              <b>{myPlace}</b>
            </div>
            <div>
              <small>만나는 곳</small>
              <b>{request.meetupPlace || "총학생회 소개팅 부스"}</b>
            </div>
          </div>
          <MeetupEscort
            request={request}
            iAmRequester={iAmRequester}
            myPlace={myPlace}
            busy={busy}
            onArrived={() => onArrived?.(request.id)}
            onOpenChat={() => onOpenChat?.(request.id)}
          />
          <ul className="mu-ticket__rules">
            <li>약속 5분 전까지 <b>{myPlace}</b>(으)로 와 주세요. {partner} 님은 다른 곳에서 기다려요.</li>
            <li>스태프가 닉네임을 확인하고 부스로 안내해요.</li>
            <li>약속 시각에서 <b>10분</b>이 지나도 오지 않으면 노쇼로 처리되고 약속이 취소돼요.</li>
            <li>부스에서는 얼굴을 가린 채 앱 채팅으로 10분 이야기해요. 끝나고 둘 다 원하면 얼굴을 봐요.</li>
          </ul>
          <div className="mu-ticket__actions">
            {/* 부스가 아니라 내가 기다릴 곳으로 안내한다(부스까지는 스태프가 데려간다). 좌표를 모르는 장소면 부스 길찾기. */}
            {waitingPlaceMapUrl(myPlace) ? (
              <button
                type="button"
                className="mu-ghost"
                onClick={() => window.open(waitingPlaceMapUrl(myPlace), "_blank", "noopener,noreferrer")}
              >
                {myPlace} 길찾기
              </button>
            ) : (
              <button type="button" className="mu-ghost" onClick={onOpenMap}>
                부스 길찾기
              </button>
            )}
          </div>
          {contactShared ? contactShare : null}
          <p className="mu-ticket__lock">
            확정된 약속은 바꾸거나 취소할 수 없어요. 부득이하게 못 오면 소개팅 부스 스태프에게 꼭 알려 주세요.
          </p>
          <p className="mu-ticket__disclaimer">{ORGANIZER_DISCLAIMER}</p>
        </div>
      </div>
    );
  }

  if (request.status === "PROPOSED") {
    return (
      <div className="mu mu--proposed">
        <div className="mu-head">
          <span className="mu-head__badge">{iProposed ? "상대 확정 대기" : "시간 제안 도착"}</span>
          {countdown ? <span className="mu-head__timer">⏳ {countdown}</span> : null}
        </div>
        <strong className="mu-time">{fullLabel(request.meetupAt)}</strong>
        <p className="mu-copy">
          {iProposed
            ? `${partner} 님이 확정하면 약속이 굳어서 둘 다 바꿀 수 없어요. 시간이 다 되면 이 자리는 다시 풀려요.`
            : `${partner} 님이 이 시간을 제안했어요. 확정하면 바꾸거나 취소할 수 없으니 꼭 올 수 있는 시간인지 확인해 주세요.`}
        </p>
        {!pickerOpen ? (
          <div className="mu-actions">
            {!iProposed ? (
              <button
                type="button"
                className="mu-primary"
                disabled={busy}
                onClick={() => {
                  const ok = window.confirm(
                    [
                      `${fullLabel(request.meetupAt)} · ${request.meetupPlace || "총학생회 소개팅 부스"}`,
                      "",
                      "이 시간으로 확정할까요?",
                      "한 번 확정하면 바꾸거나 취소할 수 없어요.",
                      "",
                      ORGANIZER_DISCLAIMER,
                    ].join("\n"),
                  );
                  if (ok) onConfirm(request.id);
                }}
              >
                이 시간으로 확정
              </button>
            ) : null}
            <button type="button" className="mu-ghost" disabled={busy} onClick={() => setPickerOpen(true)}>
              {iProposed ? "시간 바꾸기" : "다른 시간 제안"}
            </button>
            <button type="button" className="mu-link mu-link--danger" disabled={busy} onClick={() => onCancel(request.id)}>
              {iProposed ? "제안 취소" : "거절"}
            </button>
          </div>
        ) : null}
        {picker}
        {!pickerOpen ? contactShare : null}
      </div>
    );
  }

  return (
    <div className="mu mu--accepted">
      <div className="mu-head">
        <span className="mu-head__badge mu-head__badge--gold">매치 성사</span>
      </div>
      {noShow ? (
        <p className="mu-notice mu-notice--noshow">
          {iWasAbsent
            ? "지난 약속은 참석하지 못해 취소됐어요."
            : `지난 약속은 ${partner} 님이 오지 못해 취소됐어요. 기다려 주셔서 고마워요.`}
        </p>
      ) : null}
      <strong className="mu-title">{noShow ? "시간을 다시 잡을 수 있어요" : "이제 만날 시간을 정해요"}</strong>
      <p className="mu-copy">
        소개팅 부스는 20분에 한 쌍만 받아요. 빈 시간을 골라 제안하면 {partner} 님이 확정해요.
      </p>
      {!pickerOpen ? (
        <button type="button" className="mu-primary" disabled={busy} onClick={() => setPickerOpen(true)}>
          만날 시간 고르기
        </button>
      ) : null}
      {picker}
      {!pickerOpen ? contactShare : null}
    </div>
  );
}
