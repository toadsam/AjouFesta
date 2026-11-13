package com.festflow.backend.service.sms;

import com.festflow.backend.service.notification.AiMatchSmsNotifier;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Solapi SDK(Kotlin)는 통신 오류 · 잘못된 번호 · 잔액 부족을 검사 예외로 던진다.
 * 닿지 않는 주소로 보내 진짜 SDK 가 던지는 예외가 새어 나가지 않는지 본다.
 */
class SolapiMessageClientTest {

    private SolapiMessageClient unreachableClient() {
        return new SolapiMessageClient("solapi", "test-key", "test-secret", "http://127.0.0.1:1", "010-0000-0000");
    }

    @Test
    void sdkFailureBecomesResponseStatusException() {
        assertThatThrownBy(() -> unreachableClient().sendText("010-1111-2222", "test"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void notifierSwallowsSdkFailure() {
        AiMatchSmsNotifier notifier = new AiMatchSmsNotifier(unreachableClient(), true, "https://www.ajoufesta.com");

        assertThatCode(() -> notifier.notifyRequestCreated("010-1111-2222")).doesNotThrowAnyException();
    }
}
