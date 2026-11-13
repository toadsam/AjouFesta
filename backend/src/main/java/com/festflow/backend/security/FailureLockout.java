package com.festflow.backend.security;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 같은 키(IP 등)에서 실패가 창 안에 한도를 넘으면 창이 끝날 때까지 잠근다. 메모리에만 둔다. */
final class FailureLockout {

    private static final int PRUNE_THRESHOLD = 5_000;

    private final int maxFailures;
    private final long windowMillis;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    FailureLockout(int maxFailures, Duration window) {
        this.maxFailures = maxFailures;
        this.windowMillis = window.toMillis();
    }

    /** 잠겨 있으면 풀릴 때까지 남은 초(1 이상), 아니면 0. */
    long retryAfterSeconds(String key, long nowMillis) {
        Window window = windows.get(key);
        if (window == null) {
            return 0;
        }
        synchronized (window) {
            long elapsed = nowMillis - window.startMillis;
            if (elapsed >= windowMillis) {
                windows.remove(key, window);
                return 0;
            }
            if (window.failures < maxFailures) {
                return 0;
            }
            return Math.max(1, (windowMillis - elapsed + 999) / 1000);
        }
    }

    void recordFailure(String key, long nowMillis) {
        if (windows.size() > PRUNE_THRESHOLD) {
            windows.entrySet().removeIf(entry -> nowMillis - entry.getValue().startMillis >= windowMillis);
        }
        Window window = windows.computeIfAbsent(key, ignored -> new Window(nowMillis));
        synchronized (window) {
            if (nowMillis - window.startMillis >= windowMillis) {
                window.startMillis = nowMillis;
                window.failures = 0;
            }
            window.failures++;
        }
    }

    private static final class Window {
        private long startMillis;
        private int failures;

        private Window(long startMillis) {
            this.startMillis = startMillis;
        }
    }
}
