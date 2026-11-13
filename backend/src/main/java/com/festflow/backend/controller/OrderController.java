package com.festflow.backend.controller;

import com.festflow.backend.dto.BoothOrderDto;
import com.festflow.backend.dto.OrderCreateRequestDto;
import com.festflow.backend.dto.OrderMenuDto;
import com.festflow.backend.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 손님 쪽 주문 API. 인증 없음 — 테이블 QR 을 찍은 사람이면 누구나 주문할 수 있고,
 * 자기 주문은 발급받은 clientKey 로만 다시 볼 수 있다.
 */
@RestController
@RequestMapping("/api")
public class OrderController {

    private static final int ORDER_QUEUE_WAIT_SECONDS = 15;

    private final OrderService orderService;
    private final Map<Long, ReentrantLock> boothLocks = new ConcurrentHashMap<>();

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping("/booths/{boothId}/order-menu")
    public OrderMenuDto getOrderMenu(
            @PathVariable Long boothId,
            @RequestParam(value = "table", required = false) String table
    ) {
        return orderService.getOrderMenu(boothId, table);
    }

    @PostMapping("/booths/{boothId}/orders")
    public BoothOrderDto createOrder(
            @PathVariable Long boothId,
            @Valid @RequestBody OrderCreateRequestDto requestDto
    ) {
        // 같은 부스의 주문은 서버 안에서 한 줄로 세운다. 줄을 서는 동안에는 DB 연결을 잡지 않으므로,
        // 주문이 한꺼번에 몰려도 다른 요청이 쓸 DB 연결이 남는다.
        ReentrantLock lock = boothLocks.computeIfAbsent(boothId, ignored -> new ReentrantLock(true));
        boolean locked;
        try {
            locked = lock.tryLock(ORDER_QUEUE_WAIT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            locked = false;
        }
        if (!locked) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "주문이 몰리고 있어요. 잠시 후 다시 눌러 주세요.");
        }
        try {
            // DB 가 잠금 충돌(교착)로 되돌린 주문은 통째로 취소된 것이라 다시 넣어도 안전하다.
            for (int attempt = 1; ; attempt++) {
                try {
                    return orderService.createOrder(boothId, requestDto);
                } catch (PessimisticLockingFailureException e) {
                    if (attempt >= 3) {
                        throw e;
                    }
                }
            }
        } finally {
            lock.unlock();
        }
    }

    @GetMapping("/orders/{orderId}")
    public BoothOrderDto getOrder(
            @PathVariable Long orderId,
            @RequestParam("key") String key
    ) {
        return orderService.getOrderForCustomer(orderId, key);
    }
}
