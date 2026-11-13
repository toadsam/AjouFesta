import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createEventStream, fetchAiVisitorGuide, fetchEvents } from "../api";
import {
  IconBell,
  IconCalendar,
  IconChevronRight,
  IconMapPin,
  IconSparkles,
} from "../components/UxIcons";
import {
  EVENT_MAX_TIMER_MS,
  EVENT_REMINDER_LEAD_MS,
  EVENT_STAGE_FILTERS,
  EVENT_STATUS,
  eventDateKey,
  eventDateLabel,
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
} from "../data/eventExperience";
import {
  areNotificationsEnabled,
  ensureNotificationPermission,
  showBrowserNotification,
} from "../utils/notifications";

export default function EventPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [stageFilter, setStageFilter] = useState("전체");
  const [reminders, setReminders] = useState(() => readEventReminders());
  const [aiGuide, setAiGuide] = useState(null);
  const [message, setMessage] = useState("");
  const activeDateButtonRef = useRef(null);
  const reminderTimersRef = useRef(new Map());

  useEffect(() => {
    let mounted = true;

    fetchEvents()
      .then((data) => {
        if (mounted) setEvents(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (mounted) setMessage(error.message);
      });

    fetchAiVisitorGuide("events")
      .then((data) => {
        if (mounted) setAiGuide(data);
      })
      .catch(() => {
        if (mounted) setAiGuide(null);
      });

    let stream = null;
    try {
      stream = createEventStream();
      stream.addEventListener("events", (streamEvent) => {
        try {
          const next = JSON.parse(streamEvent.data);
          if (Array.isArray(next)) setEvents(next);
        } catch {
          // Live event stream is optional for this page.
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
  const dayEvents = useMemo(
    () => normalizedEvents.filter((item) => eventDateKey(item.startTime) === activeDate),
    [activeDate, normalizedEvents],
  );
  const visibleEvents = stageFilter === "전체"
    ? dayEvents
    : dayEvents.filter((item) => {
        return `${item.stage || ""}`.includes(stageFilter) || `${item.title || ""}`.includes(stageFilter);
      });
  const recommendedEvent =
    dayEvents.find((item) => item.status === EVENT_STATUS.SOON)
    || dayEvents.find((item) => item.status === EVENT_STATUS.LIVE)
    || dayEvents[0]
    || normalizedEvents[0];
  const aiSummary = aiGuide?.summary || "지금 이 순간, 놓치지 말아야 할 공연!";

  function goDetail(item, index = 0) {
    navigate(`/events/${eventKey(item, index)}`);
  }

  function selectDate(date) {
    setSelectedDate(date);
    setStageFilter("전체");
  }

  useEffect(() => {
    activeDateButtonRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeDate, dateOptions]);

  function clearReminderTimer(key) {
    const timer = reminderTimersRef.current.get(key);
    if (timer) {
      window.clearTimeout(timer);
      reminderTimersRef.current.delete(key);
    }
  }

  function scheduleReminderNotification(item, index = 0) {
    const key = eventKey(item, index);
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
      scheduleReminderNotification(item, index);
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
      if (reminders.has(key)) scheduleReminderNotification(item, index);
    });

    return () => {
      reminderTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      reminderTimersRef.current.clear();
    };
  }, [normalizedEvents, reminders]);

  return (
    <section className="events-mobile-page">
      <header className="events-mobile-header">
        <div>
          <h1>이벤트 & 공연</h1>
          <p>축제의 모든 순간을 놓치지 마세요!</p>
        </div>
        <button type="button" aria-label="타임테이블 보기" onClick={() => navigate("/events/lineup")}>
          <IconCalendar className="h-5 w-5" />
        </button>
      </header>

      <div className="events-mobile-date-tabs" aria-label="날짜 선택">
        {dateOptions.map((date) => (
          <button
            key={date}
            type="button"
            ref={activeDate === date ? activeDateButtonRef : null}
            className={activeDate === date ? "is-active" : ""}
            onClick={() => selectDate(date)}
          >
            {eventDateLabel(date, true)}
          </button>
        ))}
      </div>

      {recommendedEvent && (
        <section className="events-mobile-ai-card">
          <div className="events-mobile-ai-card__label">
            <IconSparkles className="h-4 w-4" />
            <span>AI 추천 오늘의 공연</span>
          </div>
          <strong>{aiSummary}</strong>
          <div className="events-mobile-ai-card__body">
            <img src={recommendedEvent.imageUrl} alt="" loading="lazy" decoding="async" />
            <div>
              <h2>{recommendedEvent.title}</h2>
              <p>
                {formatEventTime(recommendedEvent.startTime)} ~ {formatEventTime(recommendedEvent.endTime)}
                <span>
                  <IconMapPin className="h-3.5 w-3.5" />
                  {recommendedEvent.stage}
                </span>
              </p>
            </div>
            <button type="button" onClick={() => goDetail(recommendedEvent)}>
              자세히 보기
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      <div className="events-mobile-filter-tabs" aria-label="무대 필터">
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

      <section className="events-mobile-list" aria-label="공연 목록">
        {visibleEvents.map((item, index) => {
          const key = eventKey(item, index);
          const reminded = reminders.has(key);
          const status = reminded ? EVENT_STATUS.REMINDER : item.status;
          const duration = eventDurationMinutes(item);

          return (
            <article key={key} className="events-mobile-row">
              <button type="button" className="events-mobile-row__main" onClick={() => goDetail(item, index)}>
                <img src={item.imageUrl} alt="" loading="lazy" decoding="async" />
                <span className={`events-mobile-status events-mobile-status--${statusTone(status)}`}>
                  {status}
                </span>
                <div>
                  <h2>{item.title}</h2>
                  <p>
                    {formatEventTime(item.startTime)} ~ {formatEventTime(item.endTime)}
                    {duration ? ` (${duration}분)` : ""}
                  </p>
                  <small>
                    <IconMapPin className="h-3.5 w-3.5" />
                    {item.stage}
                  </small>
                </div>
              </button>
              <button
                type="button"
                className={`events-mobile-reminder ${reminded ? "is-active" : ""}`}
                onClick={() => toggleReminder(item, index)}
              >
                <IconBell className="h-4 w-4" />
                <span>{reminded ? "설정됨" : "알림"}</span>
              </button>
            </article>
          );
        })}

        {visibleEvents.length === 0 && (
          <p className="events-mobile-empty">선택한 조건의 공연이 아직 등록되지 않았습니다.</p>
        )}
      </section>
    </section>
  );
}
