import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createEventStream, fetchEvents } from "../api";
import {
  IconArrowLeft,
  IconBell,
  IconMapPin,
  IconShare,
  IconSparkles,
} from "../components/UxIcons";
import {
  EVENT_MAX_TIMER_MS,
  EVENT_REMINDER_LEAD_MS,
  EVENT_STATUS,
  eventDurationMinutes,
  eventKey,
  formatEventTime,
  normalizeEvents,
  readEventReminders,
  saveEventReminders,
  sortedEvents,
} from "../data/eventExperience";
import {
  areNotificationsEnabled,
  ensureNotificationPermission,
  showBrowserNotification,
} from "../utils/notifications";

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState(() => readEventReminders());
  const [message, setMessage] = useState("");
  const reminderTimersRef = useRef(new Map());

  useEffect(() => {
    let mounted = true;

    fetchEvents()
      .then((data) => {
        if (mounted) setEvents(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (mounted) setEvents([]);
      });

    let stream = null;
    try {
      stream = createEventStream();
      stream.addEventListener("events", (streamEvent) => {
        try {
          const next = JSON.parse(streamEvent.data);
          if (Array.isArray(next)) setEvents(next);
        } catch {
          // Live event stream is optional.
        }
      });
    } catch {
      // Streaming is optional.
    }

    return () => {
      mounted = false;
      stream?.close();
    };
  }, []);

  const normalizedEvents = useMemo(() => sortedEvents(normalizeEvents(events)), [events]);
  const selectedEntry = useMemo(() => {
    const entries = normalizedEvents.map((item, index) => ({ item, index, key: eventKey(item, index) }));
    return (
      entries.find((entry) => entry.key === id)
      || entries.find((entry) => String(entry.item.id) === String(id))
      || entries.find((entry) => entry.item.status === EVENT_STATUS.SOON)
      || entries[0]
    );
  }, [id, normalizedEvents]);
  const selectedEvent = selectedEntry?.item;
  const selectedKey = selectedEntry?.key || "";
  const reminded = selectedKey ? reminders.has(selectedKey) : false;
  const duration = eventDurationMinutes(selectedEvent);

  function clearReminderTimer(key) {
    const timer = reminderTimersRef.current.get(key);
    if (timer) {
      window.clearTimeout(timer);
      reminderTimersRef.current.delete(key);
    }
  }

  function scheduleReminderNotification(item, key) {
    clearReminderTimer(key);
    const start = new Date(item?.startTime).getTime();
    if (!Number.isFinite(start)) return;

    const delay = start - Date.now() - EVENT_REMINDER_LEAD_MS;
    if (delay < 0 || delay > EVENT_MAX_TIMER_MS) return;

    const timer = window.setTimeout(() => {
      showBrowserNotification("공연 알림", {
        body: `${item.title} 시작이 가까워졌습니다. ${item.stage} 일정을 확인해 주세요.`,
        tag: `festa-event-${key}`,
      });
      reminderTimersRef.current.delete(key);
    }, delay);
    reminderTimersRef.current.set(key, timer);
  }

  async function toggleReminder() {
    if (!selectedEvent || !selectedKey) return;
    const next = new Set(reminders);

    if (next.has(selectedKey)) {
      next.delete(selectedKey);
      clearReminderTimer(selectedKey);
      setMessage("알림 설정을 해제했습니다.");
    } else {
      if (!areNotificationsEnabled()) {
        setMessage("더보기에서 알림 설정을 켠 뒤 다시 시도해 주세요.");
        return;
      }
      const granted = await ensureNotificationPermission();
      if (!granted) {
        setMessage("브라우저 알림 권한이 필요합니다.");
        return;
      }
      next.add(selectedKey);
      scheduleReminderNotification(selectedEvent, selectedKey);
      setMessage("공연 알림을 저장했습니다.");
    }

    setReminders(next);
    saveEventReminders(next);
  }

  async function shareEvent() {
    if (!selectedEvent) return;
    const shareData = {
      title: selectedEvent.title,
      text: `${selectedEvent.title} · ${formatEventTime(selectedEvent.startTime)} · ${selectedEvent.stage}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setMessage("공연 링크를 복사했습니다.");
      }
    } catch {
      setMessage("공유를 취소했습니다.");
    }
  }

  useEffect(() => {
    reminderTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    reminderTimersRef.current.clear();
    normalizedEvents.forEach((item, index) => {
      const key = eventKey(item, index);
      if (reminders.has(key)) scheduleReminderNotification(item, key);
    });

    return () => {
      reminderTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      reminderTimersRef.current.clear();
    };
  }, [normalizedEvents, reminders]);

  if (!selectedEvent) {
    return (
      <section className="event-detail-mobile-page">
        <button type="button" className="event-detail-back" onClick={() => navigate("/events")}>
          <IconArrowLeft className="h-5 w-5" />
        </button>
        <p className="events-mobile-empty">공연 정보를 불러오고 있습니다.</p>
      </section>
    );
  }

  return (
    <section className="event-detail-mobile-page">
      <header className="event-detail-hero" style={{ backgroundImage: `url(${selectedEvent.imageUrl})` }}>
        <nav className="event-detail-nav" aria-label="상세 화면 이동">
          <button type="button" aria-label="공연 목록으로 돌아가기" onClick={() => navigate("/events")}>
            <IconArrowLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="공연 공유" onClick={shareEvent}>
            <IconShare className="h-5 w-5" />
          </button>
        </nav>
        <span className="event-detail-badge">{selectedEvent.badge || selectedEvent.status}</span>
      </header>

      <article className="event-detail-card">
        <div className="event-detail-title-row">
          <div>
            <h1>{selectedEvent.title}</h1>
            <strong>
              {formatEventTime(selectedEvent.startTime)} ~ {formatEventTime(selectedEvent.endTime)}
              {duration ? ` (${duration}분)` : ""}
            </strong>
            <p>
              <IconMapPin className="h-4 w-4" />
              {selectedEvent.stage}
            </p>
          </div>
          <button type="button" className={reminded ? "is-active" : ""} onClick={toggleReminder}>
            <IconBell className="h-4 w-4" />
            {reminded ? "알림 설정됨" : "알림 설정"}
          </button>
        </div>

        <section className="event-detail-ai-box">
          <div>
            <IconSparkles className="h-5 w-5" />
            <strong>AI 추천 이유</strong>
          </div>
          <p>현재 위치에서 {selectedEvent.distance} 거리이며, 대기시간이 짧고 지금부터 즐기기 좋은 공연이에요!</p>
        </section>

        <section className="event-detail-section">
          <h2>공연 소개</h2>
          <p>{selectedEvent.description}</p>
        </section>

        <dl className="event-detail-info-grid">
          <div>
            <dt>장르</dt>
            <dd>{selectedEvent.genre}</dd>
          </div>
          <div>
            <dt>관람 연령</dt>
            <dd>{selectedEvent.age}</dd>
          </div>
          <div>
            <dt>주최</dt>
            <dd>{selectedEvent.host}</dd>
          </div>
        </dl>

        <section className="event-detail-live-info">
          <h2>실시간 정보</h2>
          <div>
            <span>
              대기 시간
              <strong>{selectedEvent.waitTime}</strong>
            </span>
            <span>
              혼잡도
              <strong>{selectedEvent.crowd}</strong>
            </span>
            <span>
              현재 날씨
              <strong>{selectedEvent.weather}</strong>
            </span>
          </div>
        </section>

        {message && <p className="event-detail-message">{message}</p>}
      </article>

      <div className="event-detail-actions">
        <button type="button" onClick={() => navigate("/stage-map")}>길찾기</button>
        <button type="button" onClick={shareEvent}>공연 공유</button>
      </div>
    </section>
  );
}
