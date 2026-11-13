package com.festflow.backend.dto;

import jakarta.validation.constraints.Size;

public record BoothOrderConfigRequestDto(
        Boolean orderEnabled,
        @Size(max = 200) String bankAccount,
        @Size(max = 60) String bankHolder
) {
}
