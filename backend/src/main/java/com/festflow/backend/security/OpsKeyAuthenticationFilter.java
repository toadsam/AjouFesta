package com.festflow.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Component
public class OpsKeyAuthenticationFilter extends OncePerRequestFilter {

    // 틀린 운영 키를 IP 하나에서 10분에 20번 넘게 보내면 그 IP 의 운영 요청을 창이 끝날 때까지 막는다(키 대입 방지).
    // 잠긴 동안에는 처음 보는 기기의 키를 확인하지 않는다 — 확인하면 맞는 키만 통과해서 대입이 계속된다.
    static final int MAX_FAILURES = 20;
    static final Duration FAILURE_WINDOW = Duration.ofMinutes(10);
    private static final int MAX_TRUSTED_DEVICES = 2_000;

    private final OpsKeyService opsKeyService;
    private final FailureLockout failureLockout;
    // 맞는 키로 들어온 적이 있는 (기기 + 키) 지문. 오래된 것부터 버린다. 메모리에만 둔다.
    private final Set<String> trustedDevices = Collections.newSetFromMap(new LinkedHashMap<>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
            return size() > MAX_TRUSTED_DEVICES;
        }
    });

    public OpsKeyAuthenticationFilter(OpsKeyService opsKeyService) {
        this.opsKeyService = opsKeyService;
        this.failureLockout = new FailureLockout(MAX_FAILURES, FAILURE_WINDOW);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod())
                || !ClientIp.normalizedPath(request).startsWith("/api/ops/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String clientIp = ClientIp.of(request);
        long now = System.currentTimeMillis();
        String key = request.getHeader("X-OPS-KEY");
        String trustKey = trustKey(request.getHeader("X-OPS-DEVICE"), key);

        // 잠긴 IP 라도, 잠기기 전에 이 키로 들어온 적이 있는 기기는 계속 쓴다.
        // 축제장 와이파이는 스태프와 손님이 공인 IP 하나를 같이 써서, 누가 일부러 틀린 키를 보내면 스태프 전원이 잠길 수 있기 때문이다.
        // 처음 보는 기기의 요청은 키가 맞는지 확인하지 않고 돌려보낸다(확인해 주면 대입이 계속된다).
        long retryAfterSeconds = failureLockout.retryAfterSeconds(clientIp, now);
        if (retryAfterSeconds > 0 && !isTrusted(trustKey)) {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            writeMessage(response, "운영 키를 여러 번 틀렸습니다. 잠시 후 다시 시도하세요.");
            return;
        }

        Optional<OpsIdentity> authenticated = opsKeyService.authenticate(key, ClientIp.normalizedPath(request));
        if (authenticated.isEmpty()) {
            // 키 없이 온 요청(키 입력 전 화면)은 대입 시도가 아니므로 세지 않는다.
            if (key != null && !key.isBlank()) {
                failureLockout.recordFailure(clientIp, now);
            }
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            writeMessage(response, "유효하지 않은 운영 키입니다.");
            return;
        }

        remember(trustKey);
        OpsIdentity identity = authenticated.get();
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        identity.username(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + identity.role()))
                );
        authentication.setDetails(identity.boothId());
        SecurityContextHolder.getContext().setAuthentication(authentication);

        filterChain.doFilter(request, response);
    }

    /** 기기 번호와 키를 묶은 지문. 기기 번호가 없거나 이상하면 null (믿는 기기로 치지 않는다). */
    private static String trustKey(String deviceId, String key) {
        if (deviceId == null || key == null || key.isBlank() || !deviceId.matches("[A-Za-z0-9-]{16,64}")) {
            return null;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(deviceId.getBytes(StandardCharsets.UTF_8));
            digest.update((byte) 0);
            return HexFormat.of().formatHex(digest.digest(key.trim().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private boolean isTrusted(String trustKey) {
        if (trustKey == null) {
            return false;
        }
        synchronized (trustedDevices) {
            return trustedDevices.contains(trustKey);
        }
    }

    private void remember(String trustKey) {
        if (trustKey == null) {
            return;
        }
        synchronized (trustedDevices) {
            trustedDevices.add(trustKey);
        }
    }

    private void writeMessage(HttpServletResponse response, String message) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
