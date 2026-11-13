package com.festflow.backend.init;

import com.festflow.backend.entity.FestivalEvent;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BaramScheduleTest {

    private static FestivalEvent event(String title, LocalDateTime start, LocalDateTime end, String message) {
        FestivalEvent event = new FestivalEvent(title, start, end, "예정", null, null, "center");
        event.update(title, start, end, null, null, "center", "예정", message, 0);
        return event;
    }

    /** 2026-09-30 에 운영 서버에 들어 있던 모습. */
    private static List<FestivalEvent> oldProductionEvents() {
        return new ArrayList<>(List.of(
                event("뛰아주", at(7, 10, 30), at(7, 12, 0), "장소: 아주대학교 전체"),
                event("SUCL", at(7, 16, 30), at(7, 19, 0), "장소: 아주대학교 대운동장"),
                event("총학 주점", at(7, 16, 0), at(7, 23, 0), "장소: 아로새길"),
                event("공연무대", at(8, 17, 0), at(9, 1, 0), "장소: 노천극장(The Art)")
        ));
    }

    private static LocalDateTime at(int day, int hour, int minute) {
        return LocalDateTime.of(2026, 10, day, hour, minute);
    }

    private static FestivalEvent find(List<FestivalEvent> events, String title) {
        return events.stream().filter(item -> title.equals(item.getTitle())).findFirst().orElseThrow();
    }

    @Test
    void timetableFollowsTheCardNews() {
        List<FestivalEvent> timetable = BaramSchedule.timetable();

        assertThat(find(timetable, "SUCL").getStartTime()).isEqualTo(at(7, 15, 0));
        assertThat(find(timetable, "SUCL").getEndTime()).isEqualTo(at(7, 19, 0));
        assertThat(find(timetable, "아로새길 거리축제").getStartTime()).isEqualTo(at(7, 14, 0));
        assertThat(find(timetable, "아로새길 거리축제").getEndTime()).isEqualTo(at(7, 23, 0));
        assertThat(find(timetable, "총학 주점").getStartTime()).isEqualTo(at(7, 16, 0));
        assertThat(find(timetable, "뛰아주").getEndTime()).isEqualTo(at(7, 12, 0));
        // 자정을 넘기는 종료는 다음 날 새벽.
        assertThat(find(timetable, "야시장").getEndTime()).isEqualTo(at(8, 1, 0));
    }

    @Test
    void droppedEventsAreNotInTheTimetableAndGetPurged() {
        // 운영진 준비 시간 "주간부스 세팅" 과 안 하기로 한 "체육대회" 는 기본값에서 빠지고, 이미 들어간 것은 축제 날짜 안의 것만 지운다.
        assertThat(BaramSchedule.timetable()).extracting(FestivalEvent::getTitle).doesNotContain("주간부스 세팅", "체육대회");
        assertThat(BaramSchedule.isDropped(event("체육대회", at(7, 13, 0), at(7, 15, 0), "장소: 아주대학교 대운동장"))).isTrue();
        assertThat(BaramSchedule.isDropped(event("주간부스 세팅", at(7, 9, 0), at(7, 10, 0), "장소: 총학생회실"))).isTrue();
        assertThat(BaramSchedule.isDropped(event("주간부스 세팅", at(8, 9, 0), at(8, 10, 0), "장소: 총학생회실"))).isTrue();
        assertThat(BaramSchedule.isDropped(event("주간부스", at(7, 10, 30), at(7, 16, 30), null))).isFalse();
        assertThat(BaramSchedule.isDropped(event("주간부스 세팅", LocalDateTime.of(2026, 9, 22, 9, 0), LocalDateTime.of(2026, 9, 22, 10, 0), null))).isFalse();
        // 지운 뒤 '없는 일정'으로 다시 넣지 않는다.
        assertThat(BaramSchedule.missing(List.of())).extracting(FestivalEvent::getTitle).doesNotContain("주간부스 세팅", "체육대회");
    }

    @Test
    void movesOldDefaultsToTheConfirmedValues() {
        List<FestivalEvent> existing = oldProductionEvents();

        List<FestivalEvent> changed = BaramSchedule.applyConfirmedChanges(existing);

        assertThat(changed).extracting(FestivalEvent::getTitle)
                .containsExactlyInAnyOrder("SUCL", "뛰아주", "총학 주점", "공연무대");
        assertThat(find(existing, "SUCL").getStartTime()).isEqualTo(at(7, 15, 0));
        assertThat(find(existing, "SUCL").getEndTime()).isEqualTo(at(7, 19, 0));
        assertThat(find(existing, "뛰아주").getLiveMessage()).contains("축구장 출발");
        assertThat(find(existing, "총학 주점").getLiveMessage()).isEqualTo("장소: 아로새길 거리축제 총학생회 구역");
        assertThat(find(existing, "공연무대").getLiveMessage()).contains("입장 17:30");
        // 시작 시각은 건드리지 않는다.
        assertThat(find(existing, "공연무대").getStartTime()).isEqualTo(at(8, 17, 0));
    }

    @Test
    void secondRunChangesNothing() {
        List<FestivalEvent> existing = oldProductionEvents();
        BaramSchedule.applyConfirmedChanges(existing);

        assertThat(BaramSchedule.applyConfirmedChanges(existing)).isEmpty();
    }

    @Test
    void keepsWhatStaffChanged() {
        // 운영진이 SUCL 시작을 16:00 으로, 주점 안내를 다른 문구로 고쳐 둔 경우.
        FestivalEvent sucl = event("SUCL", at(7, 16, 0), at(7, 19, 0), "장소: 아주대학교 대운동장");
        FestivalEvent pub = event("총학 주점", at(7, 16, 0), at(7, 23, 0), "재료 소진 시 조기 마감");
        List<FestivalEvent> existing = new ArrayList<>(List.of(sucl, pub));

        assertThat(BaramSchedule.applyConfirmedChanges(existing)).isEmpty();
        assertThat(sucl.getStartTime()).isEqualTo(at(7, 16, 0));
        assertThat(pub.getLiveMessage()).isEqualTo("재료 소진 시 조기 마감");
    }

    @Test
    void addsOnlyEventsThatAreNotThereYet() {
        List<FestivalEvent> existing = oldProductionEvents();
        BaramSchedule.applyConfirmedChanges(existing);

        List<FestivalEvent> missing = BaramSchedule.missing(existing);

        assertThat(missing).extracting(FestivalEvent::getTitle)
                .contains("아로새길 거리축제", "주간부스", "야시장")
                .doesNotContain("SUCL", "뛰아주", "총학 주점", "공연무대");
        // 다 넣고 나면 더 넣을 것이 없다.
        existing.addAll(missing);
        assertThat(BaramSchedule.missing(existing)).isEmpty();
    }

    @Test
    void staffChangedTimeStillCountsAsPresent() {
        // 제목 + 날짜로 본다. 시간을 고친 일정이 있다고 같은 일정을 또 넣지 않는다.
        List<FestivalEvent> existing = new ArrayList<>(List.of(event("SUCL", at(7, 17, 0), at(7, 19, 30), "")));

        assertThat(BaramSchedule.missing(existing)).extracting(FestivalEvent::getTitle).doesNotContain("SUCL");
    }
}
