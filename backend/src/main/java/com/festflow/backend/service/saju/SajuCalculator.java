package com.festflow.backend.service.saju;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 만세력 계산. AI 없이 자바로만 구한다 — 언어 모델은 60갑자를 자주 틀린다.
 *
 * 정확도에 대한 정직한 한계 두 가지:
 * 1) 절기(입춘·경칩 등) 날짜를 해마다 계산하지 않고 대표 날짜로 근사한다. 실제 절기는 해마다
 *    하루 정도 앞뒤로 움직이므로, 절기 경계에 걸친 날(예: 2월 3~5일생)은 월주/년주가 하루 차이로
 *    달라질 수 있다. 축제용 재미 기능이라 이 정도 근사를 택했다.
 * 2) 입력은 양력 기준이다. 음력 생일만 아는 사람은 양력으로 변환해서 넣어야 한다.
 */
public final class SajuCalculator {

    /** 천간 10개. */
    public static final String[] STEMS = {"갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"};

    /** 지지 12개. */
    public static final String[] BRANCHES = {"자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"};

    /** 지지에 대응하는 띠. */
    public static final String[] ZODIAC = {"쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"};

    /** 오행 5개. */
    public static final String[] ELEMENTS = {"목", "화", "토", "금", "수"};

    /** 지지별 오행 인덱스. 자=수, 축=토, 인=목 ... */
    private static final int[] BRANCH_ELEMENT = {4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4};

    /**
     * 각 절기의 대표 시작일. 인덱스 0이 입춘(인월)이고 시계 방향으로 12개.
     * {월, 일} 순서.
     */
    private static final int[][] TERM_START = {
            {2, 4},   // 입춘 → 인월
            {3, 6},   // 경칩 → 묘월
            {4, 5},   // 청명 → 진월
            {5, 6},   // 입하 → 사월
            {6, 6},   // 망종 → 오월
            {7, 7},   // 소서 → 미월
            {8, 8},   // 입추 → 신월
            {9, 8},   // 백로 → 유월
            {10, 8},  // 한로 → 술월
            {11, 7},  // 입동 → 해월
            {12, 7},  // 대설 → 자월
            {1, 6},   // 소한 → 축월
    };

    /** 1900-01-01 은 갑술일(천간 0, 지지 10). 여기서부터 60갑자를 센다. */
    private static final long DAY_ANCHOR_EPOCH_DAY = LocalDate.of(1900, 1, 1).toEpochDay();
    private static final int DAY_ANCHOR_STEM = 0;
    private static final int DAY_ANCHOR_BRANCH = 10;

    private SajuCalculator() {
    }

    /**
     * 생년월일(양력)과 태어난 시간으로 사주를 세운다.
     *
     * @param birthTime null 이면 시주를 세우지 않는다.
     */
    public static SajuPillars calculate(LocalDate birthDate, LocalTime birthTime) {
        if (birthDate == null) {
            throw new IllegalArgumentException("birthDate is required");
        }

        int monthOrder = monthOrder(birthDate);

        // 년주: 사주에서 한 해는 1월 1일이 아니라 입춘에 바뀐다. 입춘 전이면 아직 지난해다.
        int sajuYear = birthDate.getYear();
        if (isBeforeStartOfSpring(birthDate)) {
            sajuYear -= 1;
        }
        int yearStem = floorMod(sajuYear - 4, 10);
        int yearBranch = floorMod(sajuYear - 4, 12);

        // 월주: 지지는 절기가 정하고, 천간은 오호둔(년간 → 인월 천간)으로 따라온다.
        int monthBranch = (monthOrder + 2) % 12;
        int firstMonthStem = ((yearStem % 5) * 2 + 2) % 10;
        int monthStem = (firstMonthStem + monthOrder) % 10;

        // 일주: 23시부터는 다음 날 자시로 넘긴다(야자시).
        LocalDate dayForPillar = birthDate;
        if (birthTime != null && birthTime.getHour() == 23) {
            dayForPillar = birthDate.plusDays(1);
        }
        long offset = dayForPillar.toEpochDay() - DAY_ANCHOR_EPOCH_DAY;
        int dayStem = (int) floorMod(DAY_ANCHOR_STEM + offset, 10);
        int dayBranch = (int) floorMod(DAY_ANCHOR_BRANCH + offset, 12);

        // 시주: 지지는 두 시간 단위, 천간은 오자둔(일간 → 자시 천간)으로 따라온다.
        Integer hourStem = null;
        Integer hourBranch = null;
        if (birthTime != null) {
            int branch = ((birthTime.getHour() + 1) / 2) % 12;
            hourBranch = branch;
            hourStem = ((dayStem % 5) * 2 + branch) % 10;
        }

        return new SajuPillars(yearStem, yearBranch, monthStem, monthBranch, dayStem, dayBranch, hourStem, hourBranch);
    }

    /** 입춘(2월 4일 근사) 전인가. 사주의 해가 바뀌는 경계다. */
    private static boolean isBeforeStartOfSpring(LocalDate date) {
        int month = date.getMonthValue();
        return month == 1 || (month == 2 && date.getDayOfMonth() < 4);
    }

    /** 절기 기준 월 순서. 0 = 인월(입춘 이후), 10 = 자월(대설 이후), 11 = 축월(소한 이후). */
    private static int monthOrder(LocalDate date) {
        int month = date.getMonthValue();
        int day = date.getDayOfMonth();

        // 연초는 지난해 절기가 이어진다. 1/1~1/5 는 자월, 1/6~2/3 은 축월.
        if (month == 1) {
            return day >= TERM_START[11][1] ? 11 : 10;
        }
        if (month == 2 && day < TERM_START[0][1]) {
            return 11;
        }

        // 입춘(i=0)부터 대설(i=10)까지는 달과 일로 곧장 정해진다.
        for (int i = 10; i >= 0; i--) {
            int termMonth = TERM_START[i][0];
            int termDay = TERM_START[i][1];
            if (month > termMonth || (month == termMonth && day >= termDay)) {
                return i;
            }
        }
        return 10;
    }

    public static String pillarName(int stem, int branch) {
        return STEMS[floorMod(stem, 10)] + BRANCHES[floorMod(branch, 12)];
    }

    public static String stemName(int stem) {
        return STEMS[floorMod(stem, 10)];
    }

    public static String branchName(int branch) {
        return BRANCHES[floorMod(branch, 12)];
    }

    public static String zodiacOf(int branch) {
        return ZODIAC[floorMod(branch, 12)];
    }

    /** 천간의 오행 인덱스. 갑을=목, 병정=화, 무기=토, 경신=금, 임계=수. */
    public static int stemElement(int stem) {
        return floorMod(stem, 10) / 2;
    }

    public static int branchElement(int branch) {
        return BRANCH_ELEMENT[floorMod(branch, 12)];
    }

    public static String elementName(int element) {
        return ELEMENTS[floorMod(element, 5)];
    }

    /** 사주 여덟 글자(시간 모르면 여섯 글자)의 오행 개수를 센다. */
    public static Map<String, Integer> elementCounts(SajuPillars pillars) {
        int[] counts = new int[5];
        counts[stemElement(pillars.yearStem())] += 1;
        counts[stemElement(pillars.monthStem())] += 1;
        counts[stemElement(pillars.dayStem())] += 1;
        counts[branchElement(pillars.yearBranch())] += 1;
        counts[branchElement(pillars.monthBranch())] += 1;
        counts[branchElement(pillars.dayBranch())] += 1;
        if (pillars.hourKnown()) {
            counts[stemElement(pillars.hourStem())] += 1;
            counts[branchElement(pillars.hourBranch())] += 1;
        }

        Map<String, Integer> result = new LinkedHashMap<>();
        for (int i = 0; i < ELEMENTS.length; i++) {
            result.put(ELEMENTS[i], counts[i]);
        }
        return result;
    }

    /** 가장 많은 오행. 동점이면 목·화·토·금·수 순으로 앞선 것. */
    public static int strongestElement(SajuPillars pillars) {
        int[] counts = countArray(pillars);
        int best = 0;
        for (int i = 1; i < counts.length; i++) {
            if (counts[i] > counts[best]) {
                best = i;
            }
        }
        return best;
    }

    /** 가장 적은 오행. */
    public static int weakestElement(SajuPillars pillars) {
        int[] counts = countArray(pillars);
        int worst = 0;
        for (int i = 1; i < counts.length; i++) {
            if (counts[i] < counts[worst]) {
                worst = i;
            }
        }
        return worst;
    }

    static int[] countArray(SajuPillars pillars) {
        int[] counts = new int[5];
        counts[stemElement(pillars.yearStem())] += 1;
        counts[stemElement(pillars.monthStem())] += 1;
        counts[stemElement(pillars.dayStem())] += 1;
        counts[branchElement(pillars.yearBranch())] += 1;
        counts[branchElement(pillars.monthBranch())] += 1;
        counts[branchElement(pillars.dayBranch())] += 1;
        if (pillars.hourKnown()) {
            counts[stemElement(pillars.hourStem())] += 1;
            counts[branchElement(pillars.hourBranch())] += 1;
        }
        return counts;
    }

    /** a가 b를 낳는가(상생). 목생화 화생토 토생금 금생수 수생목. */
    public static boolean generates(int a, int b) {
        return (a + 1) % 5 == b;
    }

    /** a가 b를 이기는가(상극). 목극토 토극수 수극화 화극금 금극목. */
    public static boolean controls(int a, int b) {
        return (a + 2) % 5 == b;
    }

    private static int floorMod(int value, int modulus) {
        return Math.floorMod(value, modulus);
    }

    private static long floorMod(long value, long modulus) {
        return Math.floorMod(value, modulus);
    }
}
