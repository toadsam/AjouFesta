package com.festflow.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class RequestGuardsTest {

    private static MockHttpServletRequest request(String method, String uri, String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRequestURI(uri);
        request.setRemoteAddr(ip);
        return request;
    }

    @Test
    void normalizedPathDecodesAndCleansThePath() {
        assertThat(ClientIp.normalizedPath(request("POST", "/api/auth/logi%6E", "1.1.1.1"))).isEqualTo("/api/auth/login");
        assertThat(ClientIp.normalizedPath(request("POST", "/api/%63hat", "1.1.1.1"))).isEqualTo("/api/chat");
        assertThat(ClientIp.normalizedPath(request("GET", "/api/ops;x=1/booth/3/bootstrap", "1.1.1.1")))
                .isEqualTo("/api/ops/booth/3/bootstrap");
        assertThat(ClientIp.normalizedPath(request("GET", "/api//booths", "1.1.1.1"))).isEqualTo("/api/booths");
        // 잘못된 인코딩은 원문 그대로.
        assertThat(ClientIp.normalizedPath(request("GET", "/api/%zz", "1.1.1.1"))).isEqualTo("/api/%zz");
    }

    @Test
    void rateLimitAppliesToPercentEncodedPaths() throws Exception {
        PublicApiRateLimitFilter filter = new PublicApiRateLimitFilter();
        int lastStatus = 0;
        // admin-login 한도는 10회/10분. 한 글자를 인코딩해도 같은 규칙에 걸려야 한다.
        for (int i = 0; i < 11; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request("POST", i % 2 == 0 ? "/api/auth/logi%6E" : "/api/auth/login", "203.0.113.9"),
                    response, new MockFilterChain());
            lastStatus = response.getStatus();
        }
        assertThat(lastStatus).isEqualTo(429);
    }

    @Test
    void failureLockoutLocksAfterLimitAndReleasesAfterWindow() {
        FailureLockout lockout = new FailureLockout(3, Duration.ofMinutes(10));
        long t0 = 1_000_000L;
        assertThat(lockout.retryAfterSeconds("ip", t0)).isZero();
        lockout.recordFailure("ip", t0);
        lockout.recordFailure("ip", t0 + 1);
        assertThat(lockout.retryAfterSeconds("ip", t0 + 2)).isZero();
        lockout.recordFailure("ip", t0 + 2);

        assertThat(lockout.retryAfterSeconds("ip", t0 + 3)).isPositive();
        assertThat(lockout.retryAfterSeconds("other", t0 + 3)).isZero();
        assertThat(lockout.retryAfterSeconds("ip", t0 + Duration.ofMinutes(10).toMillis())).isZero();
    }

    @Test
    void opsKeyGuessingIsLockedEvenForTheRightKey() throws Exception {
        String goodKey = "test-only-master-key-not-a-real-one";
        OpsKeyAuthenticationFilter filter = new OpsKeyAuthenticationFilter(new OpsKeyService(goodKey, "", ""));

        for (int i = 0; i < OpsKeyAuthenticationFilter.MAX_FAILURES; i++) {
            MockHttpServletRequest wrong = request("GET", "/api/ops/master/bootstrap", "198.51.100.7");
            wrong.addHeader("X-OPS-KEY", "guess-" + i);
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(wrong, response, new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(401);
        }

        // 한도를 넘긴 IP 는 맞는 키로도 통과하지 못한다(통과시키면 대입이 계속된다).
        MockHttpServletRequest right = request("GET", "/api/ops/master/bootstrap", "198.51.100.7");
        right.addHeader("X-OPS-KEY", goodKey);
        MockHttpServletResponse locked = new MockHttpServletResponse();
        filter.doFilter(right, locked, new MockFilterChain());
        assertThat(locked.getStatus()).isEqualTo(429);

        // 다른 IP 는 영향이 없다.
        MockHttpServletRequest elsewhere = request("GET", "/api/ops/master/bootstrap", "198.51.100.8");
        elsewhere.addHeader("X-OPS-KEY", goodKey);
        MockHttpServletResponse ok = new MockHttpServletResponse();
        filter.doFilter(elsewhere, ok, new MockFilterChain());
        assertThat(ok.getStatus()).isEqualTo(200);
    }

    @Test
    void deviceThatAlreadyUsedTheKeyKeepsWorkingWhileItsIpIsLocked() throws Exception {
        String goodKey = "test-only-master-key-not-a-real-one";
        String staffDevice = "0123456789abcdef0123456789abcdef";
        String ip = "198.51.100.20";
        OpsKeyAuthenticationFilter filter = new OpsKeyAuthenticationFilter(new OpsKeyService(goodKey, "", ""));

        // 스태프 기기가 먼저 맞는 키로 들어온다.
        MockHttpServletRequest staff = request("GET", "/api/ops/master/bootstrap", ip);
        staff.addHeader("X-OPS-KEY", goodKey);
        staff.addHeader("X-OPS-DEVICE", staffDevice);
        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(staff, first, new MockFilterChain());
        assertThat(first.getStatus()).isEqualTo(200);

        // 같은 와이파이(IP)에서 누가 틀린 키를 한도까지 보낸다.
        for (int i = 0; i < OpsKeyAuthenticationFilter.MAX_FAILURES; i++) {
            MockHttpServletRequest wrong = request("GET", "/api/ops/master/bootstrap", ip);
            wrong.addHeader("X-OPS-KEY", "guess-" + i);
            wrong.addHeader("X-OPS-DEVICE", "ffffffffffffffffffffffffffffffff");
            filter.doFilter(wrong, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 스태프 기기는 계속 쓴다.
        MockHttpServletRequest staffAgain = request("GET", "/api/ops/master/bootstrap", ip);
        staffAgain.addHeader("X-OPS-KEY", goodKey);
        staffAgain.addHeader("X-OPS-DEVICE", staffDevice);
        MockHttpServletResponse stillOk = new MockHttpServletResponse();
        filter.doFilter(staffAgain, stillOk, new MockFilterChain());
        assertThat(stillOk.getStatus()).isEqualTo(200);

        // 처음 보는 기기는 맞는 키를 대도, 남의 기기 번호를 흉내 내도(키가 다르면) 통과하지 못한다.
        MockHttpServletRequest stranger = request("GET", "/api/ops/master/bootstrap", ip);
        stranger.addHeader("X-OPS-KEY", goodKey);
        stranger.addHeader("X-OPS-DEVICE", "ffffffffffffffffffffffffffffffff");
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilter(stranger, blocked, new MockFilterChain());
        assertThat(blocked.getStatus()).isEqualTo(429);

        MockHttpServletRequest spoof = request("GET", "/api/ops/master/bootstrap", ip);
        spoof.addHeader("X-OPS-KEY", "another-guess");
        spoof.addHeader("X-OPS-DEVICE", staffDevice);
        MockHttpServletResponse spoofed = new MockHttpServletResponse();
        filter.doFilter(spoof, spoofed, new MockFilterChain());
        assertThat(spoofed.getStatus()).isEqualTo(429);
    }

    @Test
    void requestsWithoutAKeyAreNotCountedAsGuesses() throws Exception {
        OpsKeyAuthenticationFilter filter = new OpsKeyAuthenticationFilter(
                new OpsKeyService("test-only-master-key-not-a-real-one", "", ""));
        for (int i = 0; i < OpsKeyAuthenticationFilter.MAX_FAILURES + 5; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request("GET", "/api/ops/master/bootstrap", "198.51.100.9"), response, new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(401);
        }
    }
}
