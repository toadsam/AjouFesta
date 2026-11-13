package com.festflow.backend.service.saju;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

class SajuCompatibilityTest {

    private SajuPillars of(int year, int month, int day) {
        return SajuCalculator.calculate(LocalDate.of(year, month, day), null);
    }

    @Test
    void scoreIsSymmetricSoBothPeopleSeeTheSameNumber() {
        SajuPillars a = of(2001, 3, 14);
        SajuPillars b = of(2002, 9, 2);

        assertThat(SajuCompatibility.evaluate(a, b).score())
                .isEqualTo(SajuCompatibility.evaluate(b, a).score());
    }

    @Test
    void scoreIsStableAcrossCalls() {
        SajuPillars a = of(1998, 12, 25);
        SajuPillars b = of(2003, 6, 8);

        int first = SajuCompatibility.evaluate(a, b).score();
        for (int i = 0; i < 20; i++) {
            assertThat(SajuCompatibility.evaluate(a, b).score()).isEqualTo(first);
        }
    }

    @Test
    void scoreStaysInsideTheFestivalFriendlyRange() {
        for (int year = 1996; year <= 2006; year++) {
            for (int month = 1; month <= 12; month++) {
                SajuPillars a = of(year, month, 15);
                SajuPillars b = of(2002, ((month + 5) % 12) + 1, 20);
                SajuCompatibility.Result result = SajuCompatibility.evaluate(a, b);
                assertThat(result.score()).isBetween(35, 99);
                assertThat(result.grade()).isNotBlank();
                assertThat(result.headline()).isNotBlank();
                assertThat(result.reasons()).isNotEmpty();
            }
        }
    }

    @Test
    void sameBirthDateStillProducesAReadableResult() {
        SajuPillars a = of(2000, 5, 5);
        SajuCompatibility.Result result = SajuCompatibility.evaluate(a, a);

        assertThat(result.score()).isBetween(35, 99);
        assertThat(result.reasons()).isNotEmpty();
    }

    @Test
    void hourKnownOnOneSideDoesNotBreakTheComparison() {
        SajuPillars withHour = SajuCalculator.calculate(LocalDate.of(2001, 4, 4), LocalTime.of(7, 30));
        SajuPillars withoutHour = of(2001, 11, 11);

        SajuCompatibility.Result result = SajuCompatibility.evaluate(withHour, withoutHour);
        assertThat(result.score()).isBetween(35, 99);
    }
}
