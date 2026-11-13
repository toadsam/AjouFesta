import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createEventStream, fetchEvents } from "../api";
import { IconBell, IconCalendar, IconMapPin } from "../components/UxIcons";
import {
  EVENT_MAX_TIMER_MS,
  EVENT_REMINDER_LEAD_MS,
  EVENT_STAGE_FILTERS,
  EVENT_STATUS,
  eventDayHeading,
  eventDurationMinutes,
  eventKey,
  formatEventTime,
  normalizeEvents,
  primaryFestivalDate,
  readEventReminders,
  saveEventReminders,
  sortedEvents,
  statusTone,
  uniqueEventDates,
  eventDateLabel,
} from "../data/eventExperience";
import {
  areNotificationsEnabled,
  ensureNotificationPermission,
  showBrowserNotification,
} from "../utils/notifications";

export default function LineupPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [stageFilter, setStageFilter] = useState("전체");
  const [selectedDate, setSelectedDate] = useState("");
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
          // Streaming is optional.
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
  const dateOptions = useMemo(() => uniqueEventDates(normalizedEvents), [normalizedEvents]);
  const activeDate = selectedDate || primaryFestivalDate(normalizedEvents);
  const dayEvents = normalizedEvents.filter((item) => String(item.startTime).startsWith(activeDate));
  const visibleEvents = stageFilter === "전체"
    ? dayEvents
    : dayEvents.filter((item) => {
        return `${item.stage || ""}`.includes(stageFilter) || `${item.title || ""}`.includes(stageFilter);
      });

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

  async function toggleReminder(item, index = 0) {
    const key = eventKey(item, index);
    const next = new Set(reminders);

    if (next.has(key)) {
      next.delete(key);
      clearReminderTimer(key);
      setMessage("공연 알림을 해제했습니다.");
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
      next.add(key);
      scheduleReminderNotification(item, key);
      setMessage("공연 알림을 저장했습니다.");
    }

    setReminders(next);
    saveEventReminders(next);
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

  return (
    <section className="events-lineup-mobile-page">
      <header className="events-mobile-header events-lineup-mobile-header">
        <div>
          <h1>타임테이블</h1>
          <p>{eventDayHeading(activeDate)}</p>
        </div>
        <button type="button" aria-label="공연 목록 보기" onClick={() => navigate("/events")}>
          <IconCalendar className="h-5 w-5" />
        </button>
      </header>

      <div className="events-mobile-date-tabs" aria-label="날짜 선택">
        {dateOptions.map((date) => (
          <button
            key={date}
            type="button"
            className={activeDate === date ? "is-active" : ""}
            onClick={() => setSelectedDate(date)}
          >
            {eventDateLabel(date, true)}
          </button>
        ))}
      </div>

      <div className="events-mobile-filter-tabs events-lineup-filter-tabs" aria-label="라인업 필터">
        {EVENT_STAGE_FILTERS.map((stage) => (
          <button
            key={stage}
            type="button"
            className={stageFilter === stage ? "is-active" : ""}
            onClick={() => setStageFilter(stage)}
          >
            {stage}
          </button>
        ))}
      </div>

      {message && <p className="events-mobile-message">{message}</p>}

      <section className="events-timeline-list" aria-label="타임테이블 목록">
        {visibleEvents.map((item, index) => {
          const key = eventKey(item, index);
          const reminded = reminders.has(key);
          const status = reminded ? EVENT_STATUS.REMINDER : item.status;
          const duration = eventDurationMinutes(item);

          return (
            <article key={key} className="events-timeline-item">
              <time>{formatEventTime(item.startTime)}</time>
              <span className={`events-timeline-dot events-timeline-dot--${statusTone(status)}`} />
              <div className="events-timeline-card">
                <button type="button" className="events-timeline-card__main" onClick={() => navigate(`/events/${key}`)}>
                  <span className={`events-mobile-status events-mobile-status--${statusTone(status)}`}>
                    {status}
                  </span>
                  <h2>{item.title}</h2>
                  <p>
                    {formatEventTime(item.startTime)} ~ {formatEventTime(item.endTime)}
                    {duration ? ` (${duration}분)` : ""}
                  </p>
                  <small>
                    <IconMapPin className="h-3.5 w-3.5" />
                    {item.stage}
                  </small>
                </button>
                <button
                  type="button"
                  className={`events-timeline-bell ${reminded ? "is-active" : ""}`}
                  onClick={() => toggleReminder(item, index)}
                >
                  <IconBell className="h-5 w-5" />
                  {reminded ? "설정됨" : "알림"}
                </button>
              </div>
            </article>
          );
        })}

        {visibleEvents.length === 0 && (
          <p className="events-mobile-empty">선택한 조건의 라인업이 아직 등록되지 않았습니다.</p>
        )}
      </section>
    </section>
  );
}
