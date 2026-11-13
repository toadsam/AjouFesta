package com.festflow.backend.dto;

import com.festflow.backend.entity.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record OrderCreateRequestDto(
        @NotBlank @Size(max = 40) String tableLabel,
        @NotEmpty @Valid List<OrderCreateItemDto> items,
        @NotBlank @Size(max = 60) String depositorName,
        /** 입금·주문 확인이 필요할 때 연락할 번호. 필수. 숫자와 + ( ) - 공백만, 숫자는 9자리 이상. */
        @NotBlank @Size(max = 30) @Pattern(regexp = "^(?=(?:[^0-9]*[0-9]){9,})[0-9+()\\-\\s]+$") String phoneNumber,
        @Size(max = 500) String request,
        PaymentMethod paymentMethod
) {
}
