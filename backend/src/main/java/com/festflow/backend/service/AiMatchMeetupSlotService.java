package com.festflow.backend.service;

import com.festflow.backend.dto.AiMatchMeetupDayDto;
import com.festflow.backend.dto.AiMatchMeetupSlotDto;
import com.festflow.backend.dto.AiMatchMeetupSlotsDto;
import com.festflow.backend.entity.AiMatchMeetupSlot;
import com.festflow.backend.repository.AiMatchMeetupSlotRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

/**
 * 소개팅 부스 시간표. 축제 날짜마다 운영 시간을 20분 슬롯으로 자르고, 슬롯 하나에는 한 쌍만 들어간다.
 * 운영 시간은 날짜마다 다르다(app.ai-match.meetup-hours, 10/7 10:00~16:30 · 10/8 09:00~17:30). 적지 않은 날짜는 09:00~22:00.
 * 마지막 칸은 닫는 시각 안에 끝나야 한다(16:30 에 닫으면 16:00 칸이 마지막).
 * 한 명이 시간을 고르면 30분 동안 임시로 잠기고(상대 확정 대기), 상대가 확정하면 굳는다.
 * 지금부터 leadMinutes 분 안에 시작하는 칸은 고를 수 없다(대기 장소까지 갈 시간·스태프 준비 시간).
 * 축제 전에 실제 서버에서 끝까지 돌려 볼 수 있게 리허설 날짜도 같은 시간표로 연다. 지난 날짜는 참가자 화면에서 빠진다.
 * 부스를 늘려 슬롯당 여러 쌍을 받으려면 slot_at 유니크 제약을 (slot_at, lane) 으로 바꿔야 한다.
 */
@Service
public class AiMatchMeetupSlotService {

    /** 한 칸 20분: 도착·착석 3분 + 블라인드 채팅 10분 + 얼굴 보기 선택·퇴장. */
    public static final int SLOT_MINUTES = 20;

    public int getHoldMinutes() {
        return holdMinutes;
    }
    /** 날짜별 운영 시간을 따로 적지 않은 날(리허설 등)의 기본값. */
    public static final LocalTime OPEN_TIME = LocalTime.of(9, 0);
    public static final LocalTime CLOSE_TIME = LocalTime.of(22, 0);
    public static final String BOOTH_NAME = "총학생회 소개팅 부스";
    /** 한 사람의 약속끼리 이 분 안으로는 붙여 잡지 못한다(대기 장소 이동·부스 대화 시간). */
    public static final int PERSONAL_GAP_MINUTES = 40;
    /** 블라인드 만남이라 두 사람은 서로 다른 곳에서 기다리고, 스태프가 부스로 데려온다. */
    public static final String WAITING_PLACE_FEMALE = "성호관 앞";
    public static final String WAITING_PLACE_MALE = "중앙도서관 앞";

    private final AiMatchMeetupSlotRepository slotRepository;
    /** 약속을 잡을 수 있는 모든 날짜(축제 + 리허설), 날짜순. */
    private final List<LocalDate> festivalDates;
    /** 실제 축제 날짜. 지난 뒤에도 운영진 시간표에 남는다. */
    private final List<LocalDate> coreDates;
    /** 시간을 고른 뒤 상대가 확정할 때까지 잠가 두는 시간(분). */
    private final int holdMinutes;
    /** 지금부터 이 분 안에 시작하는 칸은 새로 잡을 수 없다. */
    private final int leadMinutes;
    /** 날짜별 운영 시간(여는 시각 · 닫는 시각). 없는 날짜는 OPEN_TIME~CLOSE_TIME. */
    private final Map<LocalDate, LocalTime[]> hoursByDate;

    /** 날짜별 운영 시간 없이(모두 09:00~22:00) 만든다. 테스트용. */
    public AiMatchMeetupSlotService(
            AiMatchMeetupSlotRepository slotRepository, String meetupDates, int holdMinutes, int leadMinutes, String rehearsalDates) {
        this(slotRepository, meetupDates, holdMinutes, leadMinutes, rehearsalDates, "");
    }

    @Autowired
    public AiMatchMeetupSlotService(
            AiMatchMeetupSlotRepository slotRepository,
            @Value("${app.ai-match.meetup-dates:2026-10-07,2026-10-08}") String meetupDates,
            @Value("${app.ai-match.meetup-hold-minutes:30}") int holdMinutes,
            @Value("${app.ai-match.meetup-lead-minutes:30}") int leadMinutes,
            // 축제 전 리허설용 날짜. 리허설이 끝나 비워 둔다(2026-10-06) — 다시 열려면 APP_AI_MATCH_REHEARSAL_DATES 에 날짜를 적는다.
            @Value("${app.ai-match.rehearsal-dates:}") String rehearsalDates,
            // 날짜별 운영 시간 "날짜=여는시각-닫는시각" 을 쉼표로. 적지 않은 날짜는 09:00~22:00 (총학, 2026-10-06).
            @Value("${app.ai-match.meetup-hours:2026-10-07=10:00-16:30,2026-10-08=09:00-17:30}") String meetupHours
    ) {
        this.slotRepository = slotRepository;
        this.holdMinutes = Math.max(1, holdMinutes);
        this.leadMinutes = Math.max(0, leadMinutes);
        this.coreDates = parseDates(meetupDates);
        this.festivalDates = java.util.stream.Stream.concat(coreDates.stream(), parseDates(rehearsalDates).stream())
                .distinct()
                .sorted()
                .toList();
        this.hoursByDate = parseHours(meetupHours);
    }

    /** "2026-10-07=10:00-16:30,2026-10-08=09:00-17:30" → 날짜별 [여는 시각, 닫는 시각]. 잘못 적은 항목은 건너뛴다. */
    static Map<LocalDate, LocalTime[]> parseHours(String text) {
        Map<LocalDate, LocalTime[]> hours = new java.util.LinkedHashMap<>();
        for (String item : (text == null ? "" : text).split(",")) {
            String[] parts = item.trim().split("=");
            if (parts.length != 2) {
                continue;
            }
            String[] range = parts[1].trim().split("-");
            if (range.length != 2) {
                continue;
            }
            try {
                LocalTime open = LocalTime.parse(range[0].trim());
                LocalTime close = LocalTime.parse(range[1].trim());
                if (open.isBefore(close)) {
                    hours.put(LocalDate.parse(parts[0].trim()), new LocalTime[]{open, close});
                }
            } catch (DateTimeParseException ignored) {
                // 잘못 적은 항목은 기본 시간으로
            }
        }
        return hours;
    }

    /** 그날 여는 시각. */
    public LocalTime openTime(LocalDate date) {
        LocalTime[] hours = hoursByDate.get(date);
        return hours == null ? OPEN_TIME : hours[0];
    }

    /** 그날 닫는 시각. 마지막 칸은 이 시각 안에 끝난다. */
    public LocalTime closeTime(LocalDate date) {
        LocalTime[] hours = hoursByDate.get(date);
        return hours == null ? CLOSE_TIME : hours[1];
    }

    /** 그날 마지막 칸이 시작하는 시각(닫는 시각 안에 끝나는 마지막 20분 칸). */
    public LocalTime lastSlotTime(LocalDate date) {
        LocalTime open = openTime(date);
        long slots = java.time.Duration.between(open, closeTime(date)).toMinutes() / SLOT_MINUTES;
        return open.plusMinutes(Math.max(0, slots - 1) * SLOT_MINUTES);
    }

    private static List<LocalDate> parseDates(String text) {
        return Arrays.stream((text == null ? "" : text).split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(LocalDate::parse)
                .sorted()
                .toList();
    }

    /** 운영진 시간표의 날짜: 축제 날짜는 늘, 리허설 날짜는 지나기 전까지만. */
    public List<String> getDates() {
        LocalDate today = LocalDate.now();
        return festivalDates.stream()
                .filter(date -> coreDates.contains(date) || !date.isBefore(today))
                .map(LocalDate::toString)
                .toList();
    }

    /** 참가자가 고를 수 있는 날짜: 오늘부터. 다 지났으면 운영진과 같은 목록. */
    public List<String> getUpcomingDates() {
        List<String> upcoming = upcomingDates().stream().map(LocalDate::toString).toList();
        return upcoming.isEmpty() ? getDates() : upcoming;
    }

    private List<LocalDate> upcomingDates() {
        LocalDate today = LocalDate.now();
        return festivalDates.stream().filter(date -> !date.isBefore(today)).toList();
    }

    /** 기한이 지난 임시 잠금과, 신청이 닫혀 주인이 없어진 슬롯을 치운다. 읽기·쓰기 전에 매번 부른다. */
    @Transactional
    public void purge() {
        slotRepository.deleteExpiredHolds(LocalDateTime.now());
        slotRepository.deleteOrphans();
    }

    /** 두 칸(각각 SLOT_MINUTES 길이)이 시간상 겹치는지. */
    private static boolean overlaps(LocalDateTime a, LocalDateTime b) {
        return Math.abs(java.time.Duration.between(a, b).toMinutes()) < SLOT_MINUTES;
    }

    public static boolean isTooClose(LocalDateTime a, LocalDateTime b) {
        return Math.abs(java.time.Duration.between(a, b).toMinutes()) <= PERSONAL_GAP_MINUTES;
    }

    /** 곧 시작해서 새로 잡을 수 없는 칸인지(지난 칸 포함). */
    static boolean isTooSoon(LocalDateTime slotAt, LocalDateTime now, int leadMinutes) {
        return slotAt.isBefore(now.plusMinutes(leadMinutes));
    }

    /**
     * 임시 잠금이 풀리는 시각. 보통 holdMinutes 뒤지만, 약속이 가까우면 '약속 (leadMinutes / 2)분 전'까지만 기다린다.
     * 시작 직전에 확정돼 두 사람이 대기 장소에 못 오는 일을 막는다.
     */
    static LocalDateTime holdDeadline(LocalDateTime now, LocalDateTime slotAt, int holdMinutes, int leadMinutes) {
        LocalDateTime byHold = now.plusMinutes(holdMinutes);
        LocalDateTime byStart = slotAt.minusMinutes(leadMinutes / 2);
        return byStart.isBefore(byHold) ? byStart : byHold;
    }

    public int getLeadMinutes() {
        return leadMinutes;
    }

    private record Cell(LocalDateTime at, String status, AiMatchMeetupSlot slot) {
    }

    /** 그날의 칸을 순서대로. status 는 AiMatchMeetupSlotDto 와 같다. */
    private List<Cell> cells(LocalDate date, LocalDateTime now, Collection<LocalDateTime> busyTimes) {
        LocalDateTime open = date.atTime(openTime(date));
        LocalDateTime close = date.atTime(closeTime(date));
        Map<LocalDateTime, AiMatchMeetupSlot> taken = slotRepository
                .findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(open, close)
                .stream()
                .collect(Collectors.toMap(AiMatchMeetupSlot::getSlotAt, slot -> slot, (a, b) -> a));

        List<Cell> cells = new ArrayList<>();
        // 마지막 칸은 닫는 시각 안에 끝나야 한다.
        for (LocalDateTime at = open; !at.plusMinutes(SLOT_MINUTES).isAfter(close); at = at.plusMinutes(SLOT_MINUTES)) {
            AiMatchMeetupSlot slot = taken.get(at);
            if (slot == null) {
                // 칸 길이를 바꾸기 전에 잡힌(격자에 안 맞는) 약속이 이 칸과 겹치면 그 약속이 이 칸을 쓰는 것으로 본다.
                final LocalDateTime cell = at;
                slot = taken.values().stream().filter(other -> overlaps(other.getSlotAt(), cell)).findFirst().orElse(null);
            }
            String status;
            if (slot != null) {
                status = slot.isConfirmed() ? "TAKEN" : "HELD";
            } else if (at.isBefore(now)) {
                status = "PAST";
            } else if (isTooSoon(at, now, leadMinutes)) {
                status = "SOON";
            } else if (isNearAny(at, busyTimes)) {
                status = "BUSY";
            } else {
                status = "FREE";
            }
            cells.add(new Cell(at, status, slot));
        }
        return cells;
    }

    /** 오늘부터 남은 날짜별 남은 칸. busyTimes 를 주면 그 두 사람이 실제로 고를 수 있는 칸만 센다. */
    @Transactional
    public List<AiMatchMeetupDayDto> dayCounts(Collection<LocalDateTime> busyTimes) {
        LocalDateTime now = LocalDateTime.now();
        List<AiMatchMeetupDayDto> days = new ArrayList<>();
        for (LocalDate date : upcomingDates()) {
            List<Cell> cells = cells(date, now, busyTimes);
            days.add(new AiMatchMeetupDayDto(
                    date.toString(),
                    cells.size(),
                    (int) cells.stream().filter(cell -> "FREE".equals(cell.status())).count(),
                    (int) cells.stream().filter(cell -> "TAKEN".equals(cell.status())).count(),
                    (int) cells.stream().filter(cell -> "HELD".equals(cell.status())).count()
            ));
        }
        return days;
    }

    @Transactional
    public AiMatchMeetupSlotsDto getSlots(String dateText, Long myRequestId) {
        return getSlots(dateText, myRequestId, List.of());
    }

    /** busyTimes: 이 신청의 두 사람이 다른 신청으로 잡아 둔 시각. 그 앞뒤 칸은 BUSY 로 막는다. */
    @Transactional
    public AiMatchMeetupSlotsDto getSlots(String dateText, Long myRequestId, Collection<LocalDateTime> busyTimes) {
        purge();
        LocalDate date = resolveDate(dateText);
        List<AiMatchMeetupSlotDto> slots = cells(date, LocalDateTime.now(), busyTimes).stream()
                .map(cell -> new AiMatchMeetupSlotDto(
                        cell.at(),
                        cell.status(),
                        cell.slot() != null && myRequestId != null && myRequestId.equals(cell.slot().getRequestId())))
                .toList();
        return new AiMatchMeetupSlotsDto(
                date.toString(), getUpcomingDates(), SLOT_MINUTES, holdMinutes, BOOTH_NAME, slots, leadMinutes, dayCounts(busyTimes));
    }

    /** 이 신청 이름으로 슬롯을 임시로 잡는다. 이미 잡아 둔 슬롯이 있으면 놓고 새로 잡는다. */
    @Transactional
    public AiMatchMeetupSlot hold(Long requestId, LocalDateTime slotAt) {
        validateSlotTime(slotAt);
        purge();
        slotRepository.deleteByRequestIdNow(requestId);
        if (slotRepository.findBySlotAt(slotAt).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "방금 다른 커플이 먼저 잡은 시간이에요. 다른 시간을 골라 주세요.");
        }
        boolean overlapsOther = slotRepository
                .findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(
                        slotAt.minusMinutes(SLOT_MINUTES - 1L), slotAt.plusMinutes(SLOT_MINUTES))
                .stream()
                .anyMatch(other -> !requestId.equals(other.getRequestId()));
        if (overlapsOther) {
            throw new ResponseStatusException(CONFLICT, "다른 커플의 약속과 겹치는 시간이에요. 다른 시간을 골라 주세요.");
        }
        try {
            return slotRepository.saveAndFlush(
                    new AiMatchMeetupSlot(slotAt, requestId, holdDeadline(LocalDateTime.now(), slotAt, holdMinutes, leadMinutes))
            );
        } catch (DataIntegrityViolationException exception) {
            // 확인과 저장 사이에 다른 쌍이 끼어든 경우. DB 유니크 제약이 막아 준다.
            throw new ResponseStatusException(CONFLICT, "방금 다른 커플이 먼저 잡은 시간이에요. 다른 시간을 골라 주세요.");
        }
    }

    /** 상대가 확정. 임시 잠금이 이미 풀렸으면 empty. */
    @Transactional
    public Optional<AiMatchMeetupSlot> confirm(Long requestId) {
        purge();
        Optional<AiMatchMeetupSlot> slot = slotRepository.findByRequestId(requestId);
        slot.ifPresent(AiMatchMeetupSlot::confirm);
        return slot;
    }

    private static boolean isNearAny(LocalDateTime at, Collection<LocalDateTime> busyTimes) {
        if (busyTimes == null) {
            return false;
        }
        for (LocalDateTime busy : busyTimes) {
            if (busy != null && isTooClose(at, busy)) {
                return true;
            }
        }
        return false;
    }

    @Transactional
    public long deleteAllSlots() {
        long count = slotRepository.count();
        slotRepository.deleteAllInBatch();
        return count;
    }

    @Transactional
    public void release(Long requestId) {
        slotRepository.deleteByRequestIdNow(requestId);
    }

    @Transactional(readOnly = true)
    public Map<Long, AiMatchMeetupSlot> findByRequestIds(Collection<Long> requestIds) {
        if (requestIds == null || requestIds.isEmpty()) {
            return Map.of();
        }
        return slotRepository.findAllByRequestIdIn(requestIds).stream()
                .collect(Collectors.toMap(AiMatchMeetupSlot::getRequestId, slot -> slot, (a, b) -> a));
    }

    @Transactional(readOnly = true)
    public List<AiMatchMeetupSlot> findByDate(LocalDate date) {
        return slotRepository.findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(
                date.atTime(openTime(date)), date.atTime(closeTime(date)));
    }

    /** 그날 칸 수(닫는 시각 안에 끝나는 20분 칸). */
    public int slotsPerDay(LocalDate date) {
        return (int) (java.time.Duration.between(openTime(date), closeTime(date)).toMinutes() / SLOT_MINUTES);
    }

    /** 날짜가 비었거나 축제 날짜가 아니면: 오늘이 축제 날이면 오늘, 아니면 아직 안 지난 첫 날, 다 지났으면 마지막 날. */
    public LocalDate resolveDate(String dateText) {
        if (dateText != null && !dateText.isBlank()) {
            try {
                LocalDate parsed = LocalDate.parse(dateText.trim());
                if (festivalDates.contains(parsed)) {
                    return parsed;
                }
            } catch (DateTimeParseException ignored) {
                // 아래 기본값으로
            }
        }
        LocalDate today = LocalDate.now();
        return festivalDates.stream()
                .filter(date -> !date.isBefore(today))
                .findFirst()
                .orElse(festivalDates.get(festivalDates.size() - 1));
    }

    private void validateSlotTime(LocalDateTime slotAt) {
        if (slotAt == null) {
            throw new ResponseStatusException(BAD_REQUEST, "만날 시간을 선택해 주세요.");
        }
        if (!festivalDates.contains(slotAt.toLocalDate())) {
            throw new ResponseStatusException(BAD_REQUEST, "시간표에 있는 날짜의 시간만 고를 수 있어요.");
        }
        LocalDate date = slotAt.toLocalDate();
        LocalTime time = slotAt.toLocalTime();
        LocalTime open = openTime(date);
        // 칸은 여는 시각부터 20분 간격이고, 닫는 시각 안에 끝나야 한다.
        long offset = java.time.Duration.between(open, time).toMinutes();
        boolean aligned = time.getSecond() == 0 && time.getNano() == 0 && offset >= 0 && offset % SLOT_MINUTES == 0;
        if (!aligned || time.plusMinutes(SLOT_MINUTES).isAfter(closeTime(date))) {
            throw new ResponseStatusException(BAD_REQUEST,
                    open + "부터 " + lastSlotTime(date) + "까지 " + SLOT_MINUTES + "분 단위 시간만 고를 수 있어요.");
        }
        LocalDateTime now = LocalDateTime.now();
        if (slotAt.isBefore(now)) {
            throw new ResponseStatusException(BAD_REQUEST, "지나간 시간은 고를 수 없어요.");
        }
        if (isTooSoon(slotAt, now, leadMinutes)) {
            throw new ResponseStatusException(BAD_REQUEST, "지금부터 " + leadMinutes + "분 뒤 시간부터 고를 수 있어요.");
        }
    }
}
