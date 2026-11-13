package com.festflow.backend.service;

import com.festflow.backend.dto.TranslateMetricsDto;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicLong;

@Service
public class TranslateMetricsService {

    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong successCount = new AtomicLong(0);
    private final AtomicLong failCount = new AtomicLong(0);
    private final AtomicLong latencySumMs = new AtomicLong(0);

    public void recordSuccess(long latencyMs) {
        totalRequests.incrementAndGet();
        successCount.incrementAndGet();
        latencySumMs.addAndGet(Math.max(0, latencyMs));
    }

    public void recordFailure() {
        totalRequests.incrementAndGet();
        failCount.incrementAndGet();
    }

    public TranslateMetricsDto snapshot() {
        long total = totalRequests.get();
        long success = successCount.get();
        long fail = failCount.get();
        long latencySum = latencySumMs.get();
        double successRate = total == 0 ? 0.0 : (double) success / total;
        double avgLatency = success == 0 ? 0.0 : (double) latencySum / success;
        return new TranslateMetricsDto(total, success, fail, successRate, avgLatency);
    }
}

