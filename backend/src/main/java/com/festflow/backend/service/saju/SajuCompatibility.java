package com.festflow.backend.service.saju;

import java.util.ArrayList;
import java.util.List;

/**
 * 두 사주의 궁합 점수.
 *
 * AI 를 쓰지 않고 규칙으로만 계산한다. 이유가 셋이다.
 * 1) 같은 두 사람은 언제 봐도 같은 점수가 나와야 한다. 축제에서 새로고침할 때마다 점수가 바뀌면 안 된다.
 * 2) A가 B를 볼 때와 B가 A를 볼 때 점수가 같아야 한다.
 * 3) 프로필을 열 때마다 AI를 부르면 느리고 비싸다. 점수는 즉시 나와야 목록에도 붙일 수 있다.
 *
 * 점수는 일간(오행 관계) · 일지(배우자궁) · 년지(띠) · 오행 보완 네 가지를 더해서 낸다.
 */
public final class SajuCompatibility {

    /** 삼합 그룹. 신자진 수국, 해묘미 목국, 인오술 화국, 사유축 금국. */
    private static final int[][] TRIADS = {
            {8, 0, 4},
            {11, 3, 7},
            {2, 6, 10},
            {5, 9, 1},
    };

    private SajuCompatibility() {
    }

    public record Result(int score, String grade, String headline, List<String> reasons) {
    }

    public static Result evaluate(SajuPillars mine, SajuPillars theirs) {
        List<String> reasons = new ArrayList<>();
        int score = 50;

        // 1. 일간: 두 사람의 본질이 서로를 살리는지 누르는지.
        int myDayElement = SajuCalculator.stemElement(mine.dayStem());
        int theirDayElement = SajuCalculator.stemElement(theirs.dayStem());
        String myElementName = SajuCalculator.elementName(myDayElement);
        String theirElementName = SajuCalculator.elementName(theirDayElement);

        if (myDayElement == theirDayElement) {
            score += 8;
            reasons.add("둘 다 " + myElementName + " 기운이라 말이 잘 통해요.");
        } else if (SajuCalculator.generates(myDayElement, theirDayElement)) {
            score += 18;
            reasons.add("내 " + myElementName + " 기운이 상대의 " + theirElementName + " 기운을 살려줘요.");
        } else if (SajuCalculator.generates(theirDayElement, myDayElement)) {
            score += 18;
            reasons.add("상대의 " + theirElementName + " 기운이 내 " + myElementName + " 기운을 살려줘요.");
        } else {
            score -= 12;
            reasons.add(withWa(myElementName) + " " + withNeun(theirElementName)
                    + " 서로 부딪치는 기운이라 속도 조절이 필요해요.");
        }

        // 2. 일지: 사주에서 배우자 자리로 본다. 가장 크게 반영한다.
        score += branchScore(mine.dayBranch(), theirs.dayBranch(), 15, 12, 6, -14, reasons, "일지");

        // 3. 년지: 흔히 말하는 띠 궁합.
        score += branchScore(mine.yearBranch(), theirs.yearBranch(), 9, 7, 4, -9, reasons, "띠");

        // 4. 오행 보완: 내게 없는 기운을 상대가 채워주는지.
        int complement = complementScore(mine, theirs);
        if (complement >= 6) {
            score += complement;
            reasons.add("서로 없는 기운을 채워주는 조합이에요.");
        } else if (complement > 0) {
            score += complement;
        }

        score = Math.max(35, Math.min(99, score));
        String grade = gradeOf(score);
        return new Result(score, grade, headlineOf(score), reasons);
    }

    private static int branchScore(
            int mineBranch,
            int theirsBranch,
            int harmonyPoint,
            int triadPoint,
            int samePoint,
            int clashPoint,
            List<String> reasons,
            String label
    ) {
        String mineName = SajuCalculator.branchName(mineBranch);
        String theirsName = SajuCalculator.branchName(theirsBranch);

        if (isSixHarmony(mineBranch, theirsBranch)) {
            reasons.add(label + "가 " + mineName + "·" + theirsName + " 육합이라 잘 맞아요.");
            return harmonyPoint;
        }
        if (isClash(mineBranch, theirsBranch)) {
            reasons.add(label + "가 " + mineName + "·" + theirsName + " 충이라 부딪칠 수 있어요.");
            return clashPoint;
        }
        if (isTriad(mineBranch, theirsBranch)) {
            reasons.add(label + "가 " + mineName + "·" + theirsName + " 삼합이라 힘을 합치기 좋아요.");
            return triadPoint;
        }
        if (mineBranch == theirsBranch) {
            reasons.add(label + "가 둘 다 " + withIra(mineName) + " 비슷한 결이에요.");
            return samePoint;
        }
        return 0;
    }

    /** 받침이 있으면 "과", 없으면 "와". 지지와 오행 이름은 한 글자라 마지막 글자만 보면 된다. */
    private static String withWa(String word) {
        return word + (hasFinalConsonant(word) ? "과" : "와");
    }

    /** 받침이 있으면 "은", 없으면 "는". */
    private static String withNeun(String word) {
        return word + (hasFinalConsonant(word) ? "은" : "는");
    }

    /** 받침이 있으면 "이라", 없으면 "라". */
    private static String withIra(String word) {
        return word + (hasFinalConsonant(word) ? "이라" : "라");
    }

    private static boolean hasFinalConsonant(String word) {
        if (word == null || word.isEmpty()) {
            return false;
        }
        char last = word.charAt(word.length() - 1);
        if (last < 0xAC00 || last > 0xD7A3) {
            return false;
        }
        return (last - 0xAC00) % 28 != 0;
    }

    /** 육합: 자축 인해 묘술 진유 사신 오미. 두 지지를 더하면 1 또는 13이다. */
    private static boolean isSixHarmony(int a, int b) {
        int sum = a + b;
        return sum == 1 || sum == 13;
    }

    /** 충: 여섯 칸 떨어진 지지끼리 부딪친다. 자오 축미 인신 묘유 진술 사해. */
    private static boolean isClash(int a, int b) {
        return Math.abs(a - b) == 6;
    }

    private static boolean isTriad(int a, int b) {
        if (a == b) {
            return false;
        }
        for (int[] triad : TRIADS) {
            boolean hasA = triad[0] == a || triad[1] == a || triad[2] == a;
            boolean hasB = triad[0] == b || triad[1] == b || triad[2] == b;
            if (hasA && hasB) {
                return true;
            }
        }
        return false;
    }

    /** 서로의 빈 오행을 채워주는 정도. 방향에 상관없도록 양쪽을 평균 낸다. */
    private static int complementScore(SajuPillars mine, SajuPillars theirs) {
        int[] mineCounts = SajuCalculator.countArray(mine);
        int[] theirsCounts = SajuCalculator.countArray(theirs);
        int fillsMine = fillCount(mineCounts, theirsCounts);
        int fillsTheirs = fillCount(theirsCounts, mineCounts);
        int average = Math.round((fillsMine + fillsTheirs) / 2.0f);
        return Math.min(10, average * 3);
    }

    private static int fillCount(int[] emptySide, int[] fullSide) {
        int filled = 0;
        for (int i = 0; i < emptySide.length; i++) {
            if (emptySide[i] == 0 && fullSide[i] >= 2) {
                filled += 1;
            }
        }
        return filled;
    }

    private static String gradeOf(int score) {
        if (score >= 90) return "천생연분";
        if (score >= 80) return "아주 좋아요";
        if (score >= 70) return "잘 맞아요";
        if (score >= 60) return "무난해요";
        if (score >= 50) return "노력하면 좋아요";
        return "조심스러워요";
    }

    private static String headlineOf(int score) {
        if (score >= 90) return "바람이 두 사람을 같은 쪽으로 불어요.";
        if (score >= 80) return "결이 잘 맞는 사이예요.";
        if (score >= 70) return "이야기가 잘 통할 사이예요.";
        if (score >= 60) return "천천히 알아가면 좋은 사이예요.";
        if (score >= 50) return "다른 점이 많아 그만큼 배울 게 있어요.";
        return "서로 속도가 달라요. 급하지 않게 다가가 보세요.";
    }
}
