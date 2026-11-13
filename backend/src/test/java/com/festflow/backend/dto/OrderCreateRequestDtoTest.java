package com.festflow.backend.dto;

import com.festflow.backend.entity.PaymentMethod;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 테이블 주문은 휴대폰 번호가 필수다. */
class OrderCreateRequestDtoTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    void 휴대폰_번호가_없거나_이상하면_거절한다() {
        assertThat(phoneErrors(null)).isTrue();
        assertThat(phoneErrors("")).isTrue();
        assertThat(phoneErrors("   ")).isTrue();
        assertThat(phoneErrors("1234")).isTrue();
        assertThat(phoneErrors("전화번호없음")).isTrue();
        assertThat(phoneErrors("010-abcd-5678")).isTrue();
    }

    @Test
    void 하이픈이_있든_없든_받는다() {
        assertThat(phoneErrors("01012345678")).isFalse();
        assertThat(phoneErrors("010-1234-5678")).isFalse();
        assertThat(phoneErrors("010 1234 5678")).isFalse();
        assertThat(phoneErrors("+82 10-1234-5678")).isFalse();
    }

    private static boolean phoneErrors(String phoneNumber) {
        OrderCreateRequestDto dto = new OrderCreateRequestDto(
                "1번", List.of(new OrderCreateItemDto("논알콜 음료", 1)), "재훈", phoneNumber, null, PaymentMethod.BANK_TRANSFER);
        return validator.validate(dto).stream().anyMatch(violation -> "phoneNumber".equals(violation.getPropertyPath().toString()));
    }
}
