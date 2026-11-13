package com.festflow.backend.dto;

import java.util.List;

public record AiMatchFavoriteResponseDto(
        Long profileId,
        boolean favorite,
        List<Long> favoriteProfileIds
) {
}
