package com.festflow.backend.dto;

import java.util.List;

public record SajuCompatibilityDto(
        int score,
        String grade,
        String headline,
        List<String> reasons
) {
}
