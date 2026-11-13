package com.festflow.backend.controller.stream;

import com.festflow.backend.service.StaffService;
import com.festflow.backend.service.stream.StreamService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/stream")
public class StreamController {

    private final StreamService streamService;
    private final StaffService staffService;

    public StreamController(StreamService streamService, StaffService staffService) {
        this.streamService = streamService;
        this.staffService = staffService;
    }

    @GetMapping(value = "/congestion", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter congestion() {
        return streamService.subscribeCongestion();
    }

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() {
        return streamService.subscribeEvents();
    }

    @GetMapping(value = "/notices", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter notices() {
        return streamService.subscribeNotices();
    }

    @GetMapping(value = "/booths", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter booths() {
        return streamService.subscribeBooths();
    }

    @GetMapping(value = "/staff", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter staff(@RequestParam(value = "token", required = false) String staffToken) {
        // 스태프 이름 · 메모 · 위치가 실려 가므로 로그인한 스태프만 구독한다. (EventSource 는 헤더를 못 보내 쿼리로 받는다.)
        staffService.authenticateByToken(staffToken);
        return streamService.subscribeStaff();
    }

    @GetMapping(value = "/lost-items", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter lostItems() {
        return streamService.subscribeLostItems();
    }

    @GetMapping(value = "/reservations", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter reservations() {
        return streamService.subscribeReservations();
    }

    @GetMapping(value = "/orders", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter orders() {
        return streamService.subscribeOrders();
    }
}
