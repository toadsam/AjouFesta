package com.festflow.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Component
public class PublicApiRateLimitFilter extends OncePerRequestFilter {

    // IP 기준 한도. 축제 캠퍼스 와이파이(NAT)는 수백 명이 공인 IP 하나를 같이 쓰므로, 돈이 드는 요청(AI · 문자)만 빡빡하게 두고
    // 주문 · 소개팅 · 운영 콘솔처럼 현장에서 몰리는 요청은 폭주 방지 수준으로 넉넉히 잡는다.
    // 비밀번호 무차별 대입은 AiMatchService 의 닉네임별 실패 잠금이, 운영 키 대입은 OpsKeyAuthenticationFilter 의 실패 잠금이 따로 막는다.
    private static final List<Rule> RULES = List.of(
            new Rule("POST", Pattern.compile("^/api/auth/login$"), "admin-login", 10, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/staff/auth/login$"), "staff-login", 30, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/staff/ai/.*"), "staff-ai", 60, Duration.ofMinutes(10)),
            // 운영 콘솔은 주문이 들어올 때마다 목록을 다시 읽고, 스태프 기기 여러 대가 같은 IP 를 쓴다.
            new Rule("*", Pattern.compile("^/api/ops/.*"), "ops-key", 1200, Duration.ofMinutes(1)),
            new Rule("POST", Pattern.compile("^/api/gps$"), "gps", 60, Duration.ofMinutes(1)),
            new Rule("POST", Pattern.compile("^/api/chat$"), "chat", 30, Duration.ofMinutes(1)),
            new Rule("GET", Pattern.compile("^/api/ai/visitor-guide/.*"), "ai-visitor-guide", 30, Duration.ofMinutes(1)),
            new Rule("GET", Pattern.compile("^/api/ai/(guide|congestion/predictions)$"), "ai-guide", 120, Duration.ofMinutes(1)),
            new Rule("POST", Pattern.compile("^/api/ai-match/image-preview$"), "ai-match-image-preview", 60, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/ai-match/profiles$"), "ai-match-profile-create", 120, Duration.ofMinutes(10)),
            // 로그인(access)과 신청함 갱신(inbox)은 앱이 15초마다 부른다. 같은 와이파이에 1000명이 있어도 막히지 않게.
            new Rule("POST", Pattern.compile("^/api/ai-match/profiles/(access|inbox)$"), "ai-match-profile-access", 60_000, Duration.ofMinutes(10)),
            new Rule("GET", Pattern.compile("^/api/ai-match/phone-check$"), "ai-match-phone-check", 600, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/ai-match/profiles/\\d+/(requests|favorite|report)$"), "ai-match-profile-action", 3000, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/ai-match/requests/\\d+/(accept|reject|cancel|meetup/propose|meetup/confirm|meetup/cancel|meetup/arrived|contact/consent)$"), "ai-match-request-action", 3000, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/reservations/auth/send-code$"), "reservation-auth", 5, Duration.ofMinutes(10)),
            // 블라인드 채팅: 두 사람이 같은 와이파이(IP)에서 1초마다 상태를 받으니 넉넉히. 입장은 비밀번호 확인이라 빡빡하게.
            new Rule("POST", Pattern.compile("^/api/ai-match/requests/\\d+/chat/enter$"), "ai-match-chat-enter", 120, Duration.ofMinutes(10)),
            new Rule("GET", Pattern.compile("^/api/ai-match/chat/state$"), "ai-match-chat-state", 6000, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/ai-match/chat/(messages|choice)$"), "ai-match-chat-send", 600, Duration.ofMinutes(10)),
            // 주점 테이블 60개가 같은 와이파이에서 한꺼번에 주문해도 막히지 않게.
            new Rule("POST", Pattern.compile("^/api/booths/\\d+/orders$"), "order-create", 600, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/notices/\\d+/view$"), "notice-view", 1200, Duration.ofMinutes(10)),
            new Rule("GET", Pattern.compile("^/api/ai-match/meetup-slots$"), "ai-match-meetup-slots", 3000, Duration.ofMinutes(10)),
            // 첫 화면이 1분마다 읽는 운영 상태(새 가입 받는지). 같은 와이파이 사람 수를 생각해 넉넉히.
            new Rule("GET", Pattern.compile("^/api/ai-match/status$"), "ai-match-status", 3000, Duration.ofMinutes(10)),
            new Rule("*", Pattern.compile("^/api/ai-match/profiles/\\d+(/delete)?$"), "ai-match-profile-edit", 300, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/translate.*"), "translate", 30, Duration.ofMinutes(10)),
            new Rule("POST", Pattern.compile("^/api/lost-items$"), "lost-item-create", 20, Duration.ofMinutes(10)),
            new Rule("PUT", Pattern.compile("^/api/lost-items/\\d+/claim$"), "lost-item-claim", 60, Duration.ofMinutes(1))
    );

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Rule rule = findRule(request);
        if (rule == null) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = ClientIp.of(request) + ":" + rule.key();
        Bucket bucket = buckets.computeIfAbsent(key, ignored -> new Bucket(Instant.now(), 0));
        Instant now = Instant.now();

        boolean allowed;
        long retryAfterSeconds;
        synchronized (bucket) {
            if (Duration.between(bucket.windowStart(), now).compareTo(rule.window()) >= 0) {
                bucket.reset(now);
            }

            allowed = bucket.count() < rule.maxRequests();
            if (allowed) {
                bucket.increment();
                retryAfterSeconds = 0;
            } else {
                retryAfterSeconds = Math.max(
                        1,
                        rule.window().minus(Duration.between(bucket.windowStart(), now)).toSeconds()
                );
            }
        }

        if (!allowed) {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"message\":\"Too many requests. Please try again later.\"}");
            return;
        }

        if (buckets.size() > 10_000) {
            pruneExpiredBuckets(now);
        }

        filterChain.doFilter(request, response);
    }

    private Rule findRule(HttpServletRequest request) {
        String method = request.getMethod();
        // 컨트롤러는 디코딩한 경로로 찾아지므로 여기서도 같은 모양으로 맞춘다. (/api/auth/logi%6E 같은 우회 방지)
        String uri = ClientIp.normalizedPath(request);
        return RULES.stream()
                .filter(rule -> "*".equals(rule.method()) || rule.method().equalsIgnoreCase(method))
                .filter(rule -> rule.pathPattern().matcher(uri).matches())
                .findFirst()
                .orElse(null);
    }

    static boolean isInternalAddress(String ip) {
        return ClientIp.isInternalAddress(ip);
    }

    private void pruneExpiredBuckets(Instant now) {
        buckets.entrySet().removeIf(entry ->
                Duration.between(entry.getValue().windowStart(), now).compareTo(Duration.ofMinutes(15)) > 0
        );
    }

    private record Rule(String method, Pattern pathPattern, String key, int maxRequests, Duration window) {
    }

    private static final class Bucket {
        private Instant windowStart;
        private int count;

        private Bucket(Instant windowStart, int count) {
            this.windowStart = windowStart;
            this.count = count;
        }

        private Instant windowStart() {
            return windowStart;
        }

        private int count() {
            return count;
        }

        private void increment() {
            count++;
        }

        private void reset(Instant nextWindowStart) {
            windowStart = nextWindowStart;
            count = 0;
        }
    }
}
