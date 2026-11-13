package com.festflow.backend.init;

import com.festflow.backend.entity.FestivalEvent;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 2026 가을축제 "바람" 타임테이블(총학생회 확정본 + 카드뉴스 안내, 2026-10-01).
 *
 * 서버를 켤 때마다 불린다. DB 에 없는 일정(제목 + 날짜)만 새로 넣고, 총학이 나중에 고쳐 준 내용은
 * "예전 기본값 그대로인 일정"에만 반영한다. 그래서 운영 콘솔에서 고친 시간 · 안내 문구는 다시 배포해도 덮이지 않는다.
 * 화면 쪽 설명 · 장소는 frontend/src/data/eventExperience.js 의 EVENT_PRESETS — 바꿀 땐 양쪽을 같이 고친다.
 */
final class BaramSchedule {

    static final LocalDate DAY1 = LocalDate.of(2026, 10, 7);
    static final LocalDate DAY2 = LocalDate.of(2026, 10, 8);

    /**
     * 손님 일정에서 뺀 것. 예전 기본값에 들어 있었고, 서버가 켤 때 DB 에서 지운다(제목이 같고 축제 날짜 안의 것만).
     * "주간부스 세팅"은 운영진끼리의 준비 시간(손님 일정 탭에 09:00 부터 떴음), "체육대회"는 안 하기로 함(총학, 2026-10-06).
     */
    static final Set<String> DROPPED_TITLES = Set.of("주간부스 세팅", "체육대회");

    private BaramSchedule() {
    }

    /** 손님 일정에서 뺀 일정인지(제목 + 축제 날짜). */
    static boolean isDropped(FestivalEvent item) {
        return DROPPED_TITLES.contains(item.getTitle())
                && item.getStartTime() != null
                && (DAY1.equals(item.getStartTime().toLocalDate()) || DAY2.equals(item.getStartTime().toLocalDate()));
    }

    /** "25:00" 처럼 자정을 넘는 종료는 다음 날 새벽으로 넘긴다. */
    static List<FestivalEvent> timetable() {
        return List.of(
                schedule("뛰아주", DAY1, "10:30", "12:00", "장소: 축구장 출발 → 혜령공원 반환 → 선구자상 도착"),
                schedule("주간부스", DAY1, "10:30", "16:30", "장소: 아주대학교 성호관 잔디 / 가온마당"),
                schedule("야시장", DAY1, "10:30", "25:00", "장소: 도서관 주차장 / 성호관 잔디밭"),
                schedule("아로새길 거리축제", DAY1, "14:00", "23:00", "장소: 아로새길 및 아주대 삼거리 일대"),
                schedule("총학 주점", DAY1, "16:00", "23:00", "장소: 아로새길 거리축제 총학생회 구역"),
                schedule("SUCL", DAY1, "15:00", "19:00", "장소: 아주대학교 대운동장"),
                schedule("어썸 시네마", DAY1, "18:00", "22:00", "장소: 노천극장(The Art)"),
                schedule("주간부스", DAY2, "10:30", "16:30", "장소: 아주대학교 성호관 잔디 / 가온마당"),
                schedule("야간부스", DAY2, "10:30", "25:00", "장소: 가온마당"),
                schedule("공연무대", DAY2, "17:00", "25:00", "장소: 노천극장(The Art) · 입장 17:30 · 공연 18:00 ~ 22:00")
        );
    }

    /**
     * 처음 넣은 뒤에 확정 내용이 바뀐 것들. oldStart / oldMessage 가 "예전 기본값"이고, 그 값 그대로인 일정만 새 값으로 바꾼다.
     * (null 은 그 항목을 건드리지 않는다는 뜻)
     */
    private record Change(String title, LocalDate day, String oldStart, String newStart, String oldMessage, String newMessage) {
    }

    private static final List<Change> CHANGES = List.of(
            // 총학 주점 시작 15:00 → 16:00 (총학생회, 2026-09-30)
            new Change("총학 주점", DAY1, "15:00", "16:00", null, null),
            // SUCL 결승은 15:00 ~ 19:00 (총학 인스타 최종본, 2026-10-06). 10-01 에 16:30 으로 바꿨던 것을 되돌린다.
            new Change("SUCL", DAY1, "16:30", "15:00", null, null),
            new Change("뛰아주", DAY1, null, null, "장소: 아주대학교 전체", "장소: 축구장 출발 → 혜령공원 반환 → 선구자상 도착"),
            new Change("총학 주점", DAY1, null, null, "장소: 아로새길", "장소: 아로새길 거리축제 총학생회 구역"),
            new Change("공연무대", DAY2, null, null, "장소: 노천극장(The Art)", "장소: 노천극장(The Art) · 입장 17:30 · 공연 18:00 ~ 22:00")
    );

    /** 예전 기본값 그대로인 일정을 새 확정 내용으로 고친다. 고친 일정만 돌려준다(저장할 것). */
    static List<FestivalEvent> applyConfirmedChanges(List<FestivalEvent> existing) {
        Set<FestivalEvent> changed = new LinkedHashSet<>();
        for (Change change : CHANGES) {
            for (FestivalEvent item : existing) {
                if (!change.title().equals(item.getTitle()) || item.getStartTime() == null
                        || !change.day().equals(item.getStartTime().toLocalDate())) {
                    continue;
                }
                LocalDateTime start = item.getStartTime();
                String message = item.getLiveMessage();
                if (change.oldStart() != null && start.equals(change.day().atTime(LocalTime.parse(change.oldStart())))) {
                    start = change.day().atTime(LocalTime.parse(change.newStart()));
                }
                if (change.oldMessage() != null && change.oldMessage().equals(message)) {
                    message = change.newMessage();
                }
                if (start.equals(item.getStartTime()) && Objects.equals(message, item.getLiveMessage())) {
                    continue;
                }
                item.update(item.getTitle(), start, item.getEndTime(), item.getImageUrl(), item.getImageCredit(),
                        item.getImageFocus(), item.getStatusOverride(), message, item.getDelayMinutes());
                changed.add(item);
            }
        }
        return new ArrayList<>(changed);
    }

    /** 타임테이블에 있는데 DB 에 없는 일정(제목 + 날짜 기준). 운영진이 시간을 고친 일정은 있는 것으로 본다. */
    static List<FestivalEvent> missing(List<FestivalEvent> existing) {
        Set<String> keys = existing.stream()
                .map(item -> key(item.getTitle(), item.getStartTime()))
                .collect(Collectors.toSet());
        return timetable().stream()
                .filter(item -> !keys.contains(key(item.getTitle(), item.getStartTime())))
                .toList();
    }

    private static String key(String title, LocalDateTime startTime) {
        return title + "@" + (startTime == null ? "" : startTime.toLocalDate());
    }

    private static FestivalEvent schedule(String title, LocalDate day, String start, String end, String place) {
        LocalDateTime startTime = day.atTime(LocalTime.parse(start));
        String[] endParts = end.split(":");
        int endHour = Integer.parseInt(endParts[0]);
        LocalDateTime endTime = (endHour >= 24 ? day.plusDays(1) : day)
                .atTime(LocalTime.of(endHour % 24, Integer.parseInt(endParts[1])));
        FestivalEvent event = new FestivalEvent(title, startTime, endTime, "예정", null, null, "center");
        event.update(title, startTime, endTime, null, null, "center", "예정", place, 0);
        return event;
    }
}
