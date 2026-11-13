package com.festflow.backend.service.stream;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 화면에 실시간으로 밀어 주는 SSE 통로.
 *
 * 수천 명이 붙어 있어도 요청을 처리하는 쪽이 느려지지 않게 한다.
 * - 보내는 일은 통로마다 따로 도는 스레드가 한다. 주문 · 예약을 처리하던 요청은 기다리지 않고, 보내다 난 오류가 그 요청으로 번지지 않는다.
 * - 트랜잭션 안에서 부르면 커밋된 뒤에 보낸다. (받은 화면이 다시 읽을 때 옛 값을 보지 않게)
 * - 내용은 한 번만 JSON 으로 바꿔서 모두에게 같은 글자를 보낸다.
 * - 20초마다 빈 신호를 보내서 끊긴 연결을 걷어내고, 중간 프록시가 조용한 연결을 끊지 않게 한다.
 * - 목록 전체를 보내는 통로(부스 · 혼잡도)는 잠깐 모았다가 마지막 것만 보내고, 직전과 같은 내용이면 1분 동안은 다시 보내지 않는다.
 */
@Service
public class StreamService {

    private static final Logger log = LoggerFactory.getLogger(StreamService.class);
    private static final long HEARTBEAT_SECONDS = 20;
    // 같은 내용이라도 이만큼 지나면 다시 보낸다. 잠깐 끊겼다 붙은 화면이 옛 값에 머물지 않게.
    private static final long RESEND_SAME_AFTER_MILLIS = 60_000;

    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "sse-timer");
        thread.setDaemon(true);
        return thread;
    });
    private final List<Channel> channels = new ArrayList<>();

    private final Channel orders = channel("orders", 0, false);
    private final Channel congestion = channel("congestion", 2_000, true);
    private final Channel events = channel("events", 0, true);
    private final Channel notices = channel("notices", 0, true);
    private final Channel booths = channel("booths", 1_500, true);
    private final Channel staff = channel("staff", 0, false);
    private final Channel lostItems = channel("lost-items", 0, false);
    private final Channel reservations = channel("reservations", 0, false);

    public StreamService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        timer.scheduleAtFixedRate(this::heartbeat, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
    }

    public SseEmitter subscribeOrders() {
        return orders.subscribe();
    }

    public void publishOrders(Object payload) {
        publish(orders, payload);
    }

    public SseEmitter subscribeCongestion() {
        return congestion.subscribe();
    }

    public SseEmitter subscribeEvents() {
        return events.subscribe();
    }

    public SseEmitter subscribeNotices() {
        return notices.subscribe();
    }

    public SseEmitter subscribeBooths() {
        return booths.subscribe();
    }

    public SseEmitter subscribeStaff() {
        return staff.subscribe();
    }

    public SseEmitter subscribeLostItems() {
        return lostItems.subscribe();
    }

    public SseEmitter subscribeReservations() {
        return reservations.subscribe();
    }

    public void publishCongestion(Object payload) {
        publish(congestion, payload);
    }

    public void publishEvents(Object payload) {
        publish(events, payload);
    }

    public void publishNotices(Object payload) {
        publish(notices, payload);
    }

    public void publishBooths(Object payload) {
        publish(booths, payload);
    }

    public void publishStaff(Object payload) {
        publish(staff, payload);
    }

    public void publishLostItems(Object payload) {
        publish(lostItems, payload);
    }

    public void publishReservations(Object payload) {
        publish(reservations, payload);
    }

    public int congestionSubscribers() {
        return congestion.emitters.size();
    }

    /** 지금 열려 있는 연결 수(통로 전체). 운영 중 상태를 볼 때 쓴다. */
    public int openConnections() {
        return channels.stream().mapToInt(channel -> channel.emitters.size()).sum();
    }

    @PreDestroy
    void shutdown() {
        timer.shutdownNow();
        channels.forEach(channel -> channel.worker.shutdownNow());
    }

    private Channel channel(String name, long throttleMillis, boolean skipSameAsLast) {
        Channel channel = new Channel(name, throttleMillis, skipSameAsLast);
        channels.add(channel);
        return channel;
    }

    private void publish(Channel channel, Object payload) {
        final String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            // 실시간 알림은 부가 기능이다. 실패해도 부른 쪽(주문 · 예약 저장)을 깨뜨리지 않는다.
            log.warn("SSE payload 직렬화 실패 ({}): {}", channel.name, e.toString());
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()
                && TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    channel.offer(json);
                }
            });
            return;
        }
        channel.offer(json);
    }

    private void heartbeat() {
        for (Channel channel : channels) {
            channel.submit(channel::sendHeartbeat);
        }
    }

    private final class Channel {
        private final String name;
        private final long throttleMillis;
        private final boolean skipSameAsLast;
        private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
        private final ExecutorService worker;
        private final AtomicReference<String> pending = new AtomicReference<>();
        private final AtomicBoolean flushScheduled = new AtomicBoolean(false);
        // worker 스레드에서만 읽고 쓴다.
        private String lastSent;
        private long lastSentAtMillis;

        private Channel(String name, long throttleMillis, boolean skipSameAsLast) {
            this.name = name;
            this.throttleMillis = throttleMillis;
            this.skipSameAsLast = skipSameAsLast;
            this.worker = Executors.newSingleThreadExecutor(runnable -> {
                Thread thread = new Thread(runnable, "sse-" + name);
                thread.setDaemon(true);
                return thread;
            });
        }

        private SseEmitter subscribe() {
            SseEmitter emitter = new SseEmitter(0L);
            emitters.add(emitter);
            emitter.onCompletion(() -> emitters.remove(emitter));
            emitter.onTimeout(() -> emitters.remove(emitter));
            emitter.onError(e -> emitters.remove(emitter));
            try {
                // 연결되자마자 한 줄을 보내 응답 머리말이 바로 나가게 한다. (안 보내면 첫 신호가 올 때까지 브라우저가 '연결 중'으로 남는다)
                emitter.send(SseEmitter.event().comment("ok"));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
            return emitter;
        }

        private void offer(String json) {
            if (throttleMillis <= 0) {
                submit(() -> send(json));
                return;
            }
            // 잠깐 모았다가 마지막 것만 보낸다.
            pending.set(json);
            if (flushScheduled.compareAndSet(false, true)) {
                try {
                    timer.schedule(() -> submit(this::flush), throttleMillis, TimeUnit.MILLISECONDS);
                } catch (RejectedExecutionException e) {
                    flushScheduled.set(false);
                }
            }
        }

        private void flush() {
            flushScheduled.set(false);
            String json = pending.getAndSet(null);
            if (json != null) {
                send(json);
            }
        }

        private void submit(Runnable task) {
            try {
                worker.execute(() -> {
                    try {
                        task.run();
                    } catch (RuntimeException e) {
                        log.warn("SSE 전송 중 오류 ({}): {}", name, e.toString());
                    }
                });
            } catch (RejectedExecutionException ignored) {
                // 서버가 내려가는 중.
            }
        }

        private void send(String json) {
            long now = System.currentTimeMillis();
            if (skipSameAsLast && json.equals(lastSent) && now - lastSentAtMillis < RESEND_SAME_AFTER_MILLIS) {
                return;
            }
            lastSent = json;
            lastSentAtMillis = now;
            deliver(emitter -> emitter.send(SseEmitter.event().name(name).data(json)));
        }

        private void sendHeartbeat() {
            deliver(emitter -> emitter.send(SseEmitter.event().comment("hb")));
        }

        private void deliver(EmitterAction action) {
            if (emitters.isEmpty()) {
                return;
            }
            List<SseEmitter> dead = new ArrayList<>();
            for (SseEmitter emitter : emitters) {
                try {
                    action.apply(emitter);
                } catch (Exception e) {
                    // 끊긴 연결(IOException), 이미 끝난 연결(IllegalStateException) 모두 목록에서 뺀다.
                    // 여기서 complete() 를 부르지 않는다 — 끊긴 연결은 서버(톰캣)가 알아서 정리하고, 또 부르면 같은 요청이 두 번 처리되어 오류가 난다.
                    dead.add(emitter);
                }
            }
            if (!dead.isEmpty()) {
                emitters.removeAll(dead);
            }
        }
    }

    @FunctionalInterface
    private interface EmitterAction {
        void apply(SseEmitter emitter) throws Exception;
    }
}
