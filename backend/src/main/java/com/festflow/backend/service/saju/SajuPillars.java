package com.festflow.backend.service.saju;

/**
 * 사주팔자의 네 기둥. 각 값은 천간(0~9)·지지(0~11) 인덱스다.
 * 태어난 시간을 모르면 hourStem/hourBranch 가 null 이고 세 기둥(삼주)만 나온다.
 */
public record SajuPillars(
        int yearStem,
        int yearBranch,
        int monthStem,
        int monthBranch,
        int dayStem,
        int dayBranch,
        Integer hourStem,
        Integer hourBranch
) {
    public boolean hourKnown() {
        return hourStem != null && hourBranch != null;
    }

    public String yearPillar() {
        return SajuCalculator.pillarName(yearStem, yearBranch);
    }

    public String monthPillar() {
        return SajuCalculator.pillarName(monthStem, monthBranch);
    }

    public String dayPillar() {
        return SajuCalculator.pillarName(dayStem, dayBranch);
    }

    public String hourPillar() {
        return hourKnown() ? SajuCalculator.pillarName(hourStem, hourBranch) : null;
    }
}
