package com.festflow.backend.service;

import com.festflow.backend.repository.ReservationAuthSessionRepository;
import com.festflow.backend.repository.ReservationUserAccountRepository;
import com.festflow.backend.repository.ReservationVerificationCodeRepository;
import com.festflow.backend.service.sms.SmsSender;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;
import org.mockito.ArgumentCaptor;

import com.festflow.backend.entity.ReservationAuthSession;
import com.festflow.backend.entity.ReservationUserAccount;
import com.festflow.backend.entity.ReservationVerificationCode;

@ExtendWith(MockitoExtension.class)
class ReservationAuthServiceTest {

    @Mock
    private ReservationVerificationCodeRepository verificationCodeRepository;

    @Mock
    private ReservationUserAccountRepository userAccountRepository;

    @Mock
    private ReservationAuthSessionRepository authSessionRepository;

    @Mock
    private SmsSender smsSender;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void sendCodeStoresHashedCodeAndSendsSmsWithoutReturningCode() {
        ReservationAuthService service = reservationAuthService();
        given(passwordEncoder.encode(anyString())).willAnswer(invocation -> "hash:" + invocation.getArgument(0));
        given(verificationCodeRepository.save(any(ReservationVerificationCode.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        var response = service.sendCode("010-1234-5678");

        ArgumentCaptor<ReservationVerificationCode> entityCaptor = ArgumentCaptor.forClass(ReservationVerificationCode.class);
        ArgumentCaptor<String> codeCaptor = ArgumentCaptor.forClass(String.class);
        verify(verificationCodeRepository).save(entityCaptor.capture());
        verify(smsSender).sendVerificationCode(eq("01012345678"), codeCaptor.capture());

        String code = codeCaptor.getValue();
        assertThat(code).matches("\\d{6}");
        assertThat(entityCaptor.getValue().getPhoneNumber()).isEqualTo("01012345678");
        assertThat(entityCaptor.getValue().getCode()).isEqualTo("hash:" + code);
        assertThat(response.phoneNumber()).isEqualTo("01012345678");
        assertThat(response.expiresAt()).isAfter(LocalDateTime.now());
    }

    @Test
    void verifyCodeMatchesStoredHashAndCreatesSession() {
        ReservationAuthService service = reservationAuthService();
        LocalDateTime now = LocalDateTime.now();
        ReservationVerificationCode latest = new ReservationVerificationCode(
                "01012345678",
                "hashed-code",
                now.plusMinutes(3),
                now.minusSeconds(5)
        );
        ReservationUserAccount account = new ReservationUserAccount("01012345678", now.minusDays(1));

        given(verificationCodeRepository.findFirstByPhoneNumberOrderByCreatedAtDesc("01012345678"))
                .willReturn(Optional.of(latest));
        given(passwordEncoder.matches("123456", "hashed-code")).willReturn(true);
        given(userAccountRepository.findByPhoneNumber("01012345678")).willReturn(Optional.of(account));
        given(authSessionRepository.save(any(ReservationAuthSession.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        var response = service.verifyCode("010-1234-5678", "123456");

        assertThat(latest.isUsed()).isTrue();
        assertThat(response.phoneNumber()).isEqualTo("01012345678");
        assertThat(response.reservationToken()).isNotBlank();
        assertThat(response.expiresAt()).isAfter(LocalDateTime.now());
        verify(verificationCodeRepository).save(latest);
        verify(userAccountRepository).save(account);
        verify(authSessionRepository).save(any(ReservationAuthSession.class));
    }

    // 예전 무서명 토큰(reservation-전화-만료-아무값)은 더 이상 전화번호로 인정하지 않는다. DB 세션에 없으면 그냥 무효.
    @Test
    void resolveUserKeyOrNullDoesNotTrustStatelessToken() {
        ReservationAuthService service = reservationAuthService();
        when(authSessionRepository.findByToken("reservation-01012345678-9999999999999-deadbeef")).thenReturn(Optional.empty());

        String userKey = service.resolveUserKeyOrNull("reservation-01012345678-9999999999999-deadbeef");

        assertThat(userKey).isNull();
    }

    @Test
    void requireUserKeyRejectsStatelessToken() {
        ReservationAuthService service = reservationAuthService();
        when(authSessionRepository.findByToken("reservation-01012345678-9999999999999-deadbeef")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requireUserKey("reservation-01012345678-9999999999999-deadbeef"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invalid reservation authentication token");
    }

    private ReservationAuthService reservationAuthService() {
        return new ReservationAuthService(
                verificationCodeRepository,
                userAccountRepository,
                authSessionRepository,
                smsSender,
                passwordEncoder
        );
    }
}
