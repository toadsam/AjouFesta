package com.festflow.backend.service.sms;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.sms", name = "provider", havingValue = "solapi")
public class SolapiSmsSender implements SmsSender {

    private final SolapiMessageClient solapiMessageClient;

    public SolapiSmsSender(SolapiMessageClient solapiMessageClient) {
        this.solapiMessageClient = solapiMessageClient;
    }

    @Override
    public void sendVerificationCode(String phoneNumber, String code) {
        solapiMessageClient.sendText(phoneNumber, "[Fest-A] 인증번호 " + code + " 를 입력해주세요.");
    }
}
