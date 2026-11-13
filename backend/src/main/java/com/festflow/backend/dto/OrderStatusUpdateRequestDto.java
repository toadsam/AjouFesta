package com.festflow.backend.dto;

import com.festflow.backend.entity.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record OrderStatusUpdateRequestDto(
        @NotNull OrderStatus status
) {
}
