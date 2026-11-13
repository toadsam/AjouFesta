package com.festflow.backend.service.sms;

public interface SmsSender {
    void sendVerificationCode(String phoneNumber, String code);
}
