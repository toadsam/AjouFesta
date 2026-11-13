package com.festflow.backend.dto;

import java.util.List;

public record AiVisitorGuideDto(
        String scope,
        String title,
        String summary,
        List<String> bullets,
        List<AiVisitorActionDto> actions,
        List<String> reasons,
        boolean generated
) {
}
