package com.festflow.backend.service.sms;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.sms", name = "provider", havingValue = "twilio")
public class TwilioSmsSender implements SmsSender {

    @Value("${app.sms.twilio.account-sid}")
    private String accountSid;

    @Value("${app.sms.twilio.auth-token}")
    private String authToken;

    @Value("${app.sms.twilio.from-number}")
    private String fromNumber;

    @PostConstruct
    public void init() {
        Twilio.init(accountSid, authToken);
    }

    @Override
    public void sendVerificationCode(String phoneNumber, String code) {
        String body = "[Fest-A] 인증번호는 " + code + " 입니다. 3분 내 입력하세요.";
        Message.creator(new PhoneNumber(toE164(phoneNumber)), new PhoneNumber(fromNumber), body).create();
    }

    private String toE164(String phoneNumber) {
        if (phoneNumber.startsWith("0")) {
            return "+82" + phoneNumber.substring(1);
        }
        if (phoneNumber.startsWith("82")) {
            return "+" + phoneNumber;
        }
        if (phoneNumber.startsWith("+")) {
            return phoneNumber;
        }
        return "+82" + phoneNumber;
    }
}
