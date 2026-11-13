package com.festflow.backend.service;

import com.festflow.backend.dto.ReservationAuthSendCodeResponseDto;
import com.festflow.backend.dto.ReservationAuthVerifyResponseDto;
import com.festflow.backend.entity.ReservationAuthSession;
import com.festflow.backend.entity.ReservationUserAccount;
import com.festflow.backend.entity.ReservationVerificationCode;
import com.festflow.backend.repository.ReservationAuthSessionRepository;
import com.festflow.backend.repository.ReservationUserAccountRepository;
import com.festflow.backend.repository.ReservationVerificationCodeRepository;
import com.festflow.backend.service.sms.SmsSender;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.security.SecureRandom;
import java.util.UUID;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class ReservationAuthService {

    private final ReservationVerificationCodeRepository verificationCodeRepository;
    private final ReservationUserAccountRepository userAccountRepository;
    private final ReservationAuthSessionRepository authSessionRepository;
    private final SmsSender smsSender;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    @Value("${app.sms.max-verify-attempts:5}")
    private int maxVerifyAttempts;

    public ReservationAuthService(
            ReservationVerificationCodeRepository verificationCodeRepository,
            ReservationUserAccountRepository userAccountRepository,
            ReservationAuthSessionRepository authSessionRepository,
            SmsSender smsSender,
            PasswordEncoder passwordEncoder
    ) {
        this.verificationCodeRepository = verificationCodeRepository;
        this.userAccountRepository = userAccountRepository;
        this.authSessionRepository = authSessionRepository;
        this.smsSender = smsSender;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public ReservationAuthSendCodeResponseDto sendCode(String rawPhoneNumber) {
        String phoneNumber = normalizePhoneNumber(rawPhoneNumber);
        LocalDateTime now = LocalDateTime.now();
        String code = generateVerificationCode();
        LocalDateTime expiresAt = now.plusMinutes(3);

        verificationCodeRepository.save(new ReservationVerificationCode(
                phoneNumber,
                passwordEncoder.encode(code),
                expiresAt,
                now
        ));
        smsSender.sendVerificationCode(phoneNumber, code);

        return new ReservationAuthSendCodeResponseDto(phoneNumber, expiresAt);
    }

    @Transactional
    public ReservationAuthVerifyResponseDto verifyCode(String rawPhoneNumber, String rawCode) {
        String phoneNumber = normalizePhoneNumber(rawPhoneNumber);
        String code = normalizeCode(rawCode);
        LocalDateTime now = LocalDateTime.now();

        ReservationVerificationCode latest = verificationCodeRepository.findFirstByPhoneNumberOrderByCreatedAtDesc(phoneNumber)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Verification code was not requested."));

        if (latest.isUsed()) {
            throw new ResponseStatusException(BAD_REQUEST, "Verification code is already used.");
        }
        if (latest.isExpired(now)) {
            throw new ResponseStatusException(BAD_REQUEST, "Verification code has expired.");
        }
        if (!matchesVerificationCode(latest.getCode(), code)) {
            int attempts = latest.incrementFailedAttempts();
            if (attempts >= Math.max(1, maxVerifyAttempts)) {
                latest.markUsed(now);
                verificationCodeRepository.save(latest);
                throw new ResponseStatusException(TOO_MANY_REQUESTS, "Too many verification attempts. Request a new code.");
            }
            verificationCodeRepository.save(latest);
            throw new ResponseStatusException(BAD_REQUEST, "Verification code is incorrect.");
        }

        latest.markUsed(now);
        verificationCodeRepository.save(latest);

        ReservationUserAccount account = userAccountRepository.findByPhoneNumber(phoneNumber)
                .orElseGet(() -> userAccountRepository.save(new ReservationUserAccount(phoneNumber, now)));
        account.markVerified(now);
        userAccountRepository.save(account);

        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        LocalDateTime expiresAt = now.plusHours(12);
        authSessionRepository.save(new ReservationAuthSession(account, token, now, expiresAt));

        return new ReservationAuthVerifyResponseDto(token, account.getPhoneNumber(), expiresAt);
    }

    @Transactional
    public String requireUserKey(String authToken) {
        String token = normalizeToken(authToken);
        if (token == null) {
            throw new ResponseStatusException(UNAUTHORIZED, "Reservation authentication is required.");
        }

        LocalDateTime now = LocalDateTime.now();
        ReservationAuthSession session = authSessionRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Invalid reservation authentication token."));

        if (session.isExpired(now)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Reservation authentication token has expired.");
        }

        return session.getUserAccount().getPhoneNumber();
    }

    @Transactional
    public String resolveUserKeyOrNull(String authToken) {
        String token = normalizeToken(authToken);
        if (token == null) {
            return null;
        }


        LocalDateTime now = LocalDateTime.now();
        return authSessionRepository.findByToken(token)
                .filter(session -> !session.isExpired(now))
                .map(session -> session.getUserAccount().getPhoneNumber())
                .orElse(null);
    }

    private String normalizePhoneNumber(String rawPhoneNumber) {
        if (rawPhoneNumber == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Phone number is required.");
        }

        String digitsOnly = rawPhoneNumber.replaceAll("[^0-9]", "");
        if (digitsOnly.length() < 10 || digitsOnly.length() > 15) {
            throw new ResponseStatusException(BAD_REQUEST, "Phone number format is invalid.");
        }
        return digitsOnly;
    }

    private String normalizeCode(String rawCode) {
        if (rawCode == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Verification code is required.");
        }
        String trimmed = rawCode.trim();
        if (!trimmed.matches("\\d{6}")) {
            throw new ResponseStatusException(BAD_REQUEST, "Verification code format is invalid.");
        }
        return trimmed;
    }

    private String normalizeToken(String rawToken) {
        if (rawToken == null) {
            return null;
        }
        String trimmed = rawToken.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String generateVerificationCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    private String createStatelessReservationToken(String phoneNumber, LocalDateTime expiresAt) {
        long epochMillis = expiresAt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
        return "reservation-" + phoneNumber + "-" + epochMillis + "-"
                + UUID.randomUUID().toString().replace("-", "");
    }


    private boolean matchesVerificationCode(String storedCode, String inputCode) {
        if (storedCode == null || storedCode.isBlank()) {
            return false;
        }

        // Backward compatibility for rows created before hashing rollout.
        if (storedCode.matches("\\d{6}")) {
            return storedCode.equals(inputCode);
        }

        return passwordEncoder.matches(inputCode, storedCode);
    }
}
