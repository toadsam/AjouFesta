package com.festflow.backend.service.saju;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 만세력에서 널리 알려진 값과 맞춰 본다. 여기가 틀리면 사주 전체가 틀린다.
 */
class SajuCalculatorTest {

    @Test
    void dayPillarMatchesKnownAlmanacDates() {
        // 2000년 1월 1일은 무오일이다.
        SajuPillars y2k = SajuCalculator.calculate(LocalDate.of(2000, 1, 1), null);
        assertThat(y2k.dayPillar()).isEqualTo("무오");

        // 60갑자는 60일마다 정확히 돌아온다.
        SajuPillars sixtyDaysLater = SajuCalculator.calculate(LocalDate.of(2000, 1, 1).plusDays(60), null);
        assertThat(sixtyDaysLater.dayPillar()).isEqualTo("무오");

        // 하루 뒤는 다음 갑자다.
        SajuPillars nextDay = SajuCalculator.calculate(LocalDate.of(2000, 1, 2), null);
        assertThat(nextDay.dayPillar()).isEqualTo("기미");
    }

    @Test
    void yearPillarTurnsOverAtStartOfSpringNotNewYear() {
        // 2024년은 갑진년이지만, 입춘(2월 4일) 전은 아직 계묘년이다.
        assertThat(SajuCalculator.calculate(LocalDate.of(2024, 2, 4), null).yearPillar()).isEqualTo("갑진");
        assertThat(SajuCalculator.calculate(LocalDate.of(2024, 2, 3), null).yearPillar()).isEqualTo("계묘");
        assertThat(SajuCalculator.calculate(LocalDate.of(2024, 1, 15), null).yearPillar()).isEqualTo("계묘");
        assertThat(SajuCalculator.calculate(LocalDate.of(2024, 6, 1), null).yearPillar()).isEqualTo("갑진");

        // 띠도 같은 경계를 따른다. 2024는 용띠.
        assertThat(SajuCalculator.zodiacOf(SajuCalculator.calculate(LocalDate.of(2024, 6, 1), null).yearBranch()))
                .isEqualTo("용");
    }

    @Test
    void monthPillarFollowsSolarTermsAndFiveTigerRule() {
        // 1990-05-15 는 경오년, 입하(5/6) 이후라 신사월이다.
        SajuPillars pillars = SajuCalculator.calculate(LocalDate.of(1990, 5, 15), null);
        assertThat(pillars.yearPillar()).isEqualTo("경오");
        assertThat(pillars.monthPillar()).isEqualTo("신사");

        // 2월 1~3일은 아직 축월이다. 예전에 자월로 잘못 떨어지던 자리다.
        assertThat(SajuCalculator.branchName(SajuCalculator.calculate(LocalDate.of(2024, 2, 2), null).monthBranch()))
                .isEqualTo("축");
        // 1월 1~5일은 소한 전이라 자월이다.
        assertThat(SajuCalculator.branchName(SajuCalculator.calculate(LocalDate.of(2024, 1, 3), null).monthBranch()))
                .isEqualTo("자");
        // 1월 6일부터는 축월이다.
        assertThat(SajuCalculator.branchName(SajuCalculator.calculate(LocalDate.of(2024, 1, 10), null).monthBranch()))
                .isEqualTo("축");
        // 12월 3일은 대설(12/7) 전이라 해월이다.
        assertThat(SajuCalculator.branchName(SajuCalculator.calculate(LocalDate.of(2024, 12, 3), null).monthBranch()))
                .isEqualTo("해");
    }

    @Test
    void hourPillarIsOptionalAndFollowsFiveRatRule() {
        LocalDate date = LocalDate.of(2000, 1, 1); // 무오일

        SajuPillars withoutTime = SajuCalculator.calculate(date, null);
        assertThat(withoutTime.hourKnown()).isFalse();
        assertThat(withoutTime.hourPillar()).isNull();

        // 무일의 자시는 임자시다 (무계일 임자시).
        SajuPillars midnight = SajuCalculator.calculate(date, LocalTime.of(0, 30));
        assertThat(midnight.hourKnown()).isTrue();
        assertThat(midnight.hourPillar()).isEqualTo("임자");

        // 오시(11:00~12:59)는 무오시다.
        assertThat(SajuCalculator.calculate(date, LocalTime.of(12, 0)).hourPillar()).isEqualTo("무오");

        // 23시부터는 다음 날 자시로 넘어간다(야자시).
        SajuPillars lateNight = SajuCalculator.calculate(date, LocalTime.of(23, 30));
        assertThat(lateNight.dayPillar()).isEqualTo("기미");
    }

    @Test
    void elementCountsCoverEightCharactersOrSixWhenHourUnknown() {
        SajuPillars withHour = SajuCalculator.calculate(LocalDate.of(1999, 8, 20), LocalTime.of(9, 0));
        assertThat(SajuCalculator.elementCounts(withHour).values().stream().mapToInt(Integer::intValue).sum())
                .isEqualTo(8);

        SajuPillars withoutHour = SajuCalculator.calculate(LocalDate.of(1999, 8, 20), null);
        assertThat(SajuCalculator.elementCounts(withoutHour).values().stream().mapToInt(Integer::intValue).sum())
                .isEqualTo(6);
    }

    @Test
    void elementRelationsAreTheClassicCycles() {
        // 상생: 목생화 화생토 토생금 금생수 수생목
        assertThat(SajuCalculator.generates(0, 1)).isTrue();
        assertThat(SajuCalculator.generates(4, 0)).isTrue();
        assertThat(SajuCalculator.generates(1, 0)).isFalse();

        // 상극: 목극토 토극수 수극화 화극금 금극목
        assertThat(SajuCalculator.controls(0, 2)).isTrue();
        assertThat(SajuCalculator.controls(3, 0)).isTrue();
        assertThat(SajuCalculator.controls(0, 1)).isFalse();
    }
}
