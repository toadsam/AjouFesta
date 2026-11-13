package com.festflow.backend.dto;

import java.util.Map;

/**
 * 프로필에 붙는 사주. 실명과 생년월일은 여기에 담지 않는다 — 사주를 뽑는 데만 쓰고 공개하지 않는다.
 */
public record SajuDto(
        String yearPillar,
        String monthPillar,
        String dayPillar,
        String hourPillar,
        boolean hourKnown,
        String dayMaster,
        String dayMasterElement,
        String zodiac,
        Map<String, Integer> elementCounts,
        String strongestElement,
        String weakestElement,
        String reading
) {
}
