package com.festflow.backend.controller.ops;

import com.festflow.backend.dto.BoothLiveStatusRequestDto;
import com.festflow.backend.dto.BoothOrderConfigRequestDto;
import com.festflow.backend.dto.BoothOrderDto;
import com.festflow.backend.dto.OpsBoothOrdersDto;
import com.festflow.backend.dto.OrderStatusUpdateRequestDto;
import com.festflow.backend.dto.BoothReservationConfigRequestDto;
import com.festflow.backend.dto.BoothReservationDto;
import com.festflow.backend.dto.ReservationTableDto;
import com.festflow.backend.dto.BoothReservationStateDto;
import com.festflow.backend.dto.BoothReorderRequestDto;
import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.BoothUpsertRequestDto;
import com.festflow.backend.dto.AiAssistRequestDto;
import com.festflow.backend.dto.AiAssistResponseDto;
import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.dto.EventUpsertRequestDto;
import com.festflow.backend.dto.NoticeResponseDto;
import com.festflow.backend.dto.NoticeUpsertRequestDto;
import com.festflow.backend.dto.OpsBoothBootstrapDto;
import com.festflow.backend.dto.OpsMasterBootstrapDto;
import com.festflow.backend.dto.ReservationCheckInByTokenRequestDto;
import com.festflow.backend.dto.SimulationPatchRequestDto;
import com.festflow.backend.dto.SimulationStatusDto;
import com.festflow.backend.service.AdminActionService;
import com.festflow.backend.service.AdminDashboardService;
import com.festflow.backend.service.AuditLogService;
import com.festflow.backend.service.BoothService;
import com.festflow.backend.service.EventService;
import com.festflow.backend.service.NoticeService;
import com.festflow.backend.service.OpsAiService;
import com.festflow.backend.service.OrderService;
import com.festflow.backend.service.AiMatchService;
import com.festflow.backend.service.BoothSummaryService;
import com.festflow.backend.dto.EventBulkStatusRequestDto;
import com.festflow.backend.dto.OpsBoothSummaryDto;
import com.festflow.backend.service.ReservationService;
import com.festflow.backend.service.SimulationService;
import com.festflow.backend.service.UploadStorageService;
import com.festflow.backend.service.stream.StreamService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import static org.springframework.http.HttpStatus.FORBIDDEN;

@RestController
@RequestMapping("/api/ops")
public class OpsController {

    private final BoothService boothService;
    private final EventService eventService;
    private final NoticeService noticeService;
    private final AdminActionService adminActionService;
    private final AdminDashboardService adminDashboardService;
    private final AuditLogService auditLogService;
    private final StreamService streamService;
    private final ReservationService reservationService;
    private final UploadStorageService uploadStorageService;
    private final OpsAiService opsAiService;
    private final SimulationService simulationService;
    private final OrderService orderService;
    private final AiMatchService aiMatchService;
    private final BoothSummaryService boothSummaryService;

    public OpsController(
            BoothService boothService,
            EventService eventService,
            NoticeService noticeService,
            AdminActionService adminActionService,
            AdminDashboardService adminDashboardService,
            AuditLogService auditLogService,
            StreamService streamService,
            ReservationService reservationService,
            UploadStorageService uploadStorageService,
            OpsAiService opsAiService,
            SimulationService simulationService,
            OrderService orderService,
            AiMatchService aiMatchService,
            BoothSummaryService boothSummaryService
    ) {
        this.aiMatchService = aiMatchService;
        this.boothSummaryService = boothSummaryService;
        this.orderService = orderService;
        this.boothService = boothService;
        this.eventService = eventService;
        this.noticeService = noticeService;
        this.adminActionService = adminActionService;
        this.adminDashboardService = adminDashboardService;
        this.auditLogService = auditLogService;
        this.streamService = streamService;
        this.reservationService = reservationService;
        this.uploadStorageService = uploadStorageService;
        this.opsAiService = opsAiService;
        this.simulationService = simulationService;
    }

    @GetMapping("/master/bootstrap")
    public OpsMasterBootstrapDto masterBootstrap() {
        return new OpsMasterBootstrapDto(
                boothService.getAllBooths(),
                eventService.getAllEvents(),
                noticeService.getAllNotices(),
                adminDashboardService.getKpis(),
                auditLogService.getRecentLogs(),
                aiMatchService.getMasterSummary()
        );
    }

    @PostMapping("/master/notices")
    public NoticeResponseDto createNotice(@Valid @RequestBody NoticeUpsertRequestDto requestDto, Authentication authentication) {
        NoticeResponseDto created = noticeService.createNotice(requestDto);
        auditLogService.log(authentication.getName(), "OPS_MASTER_CREATE", "NOTICE", created.id(), created.title());
        return created;
    }

    @PutMapping("/master/notices/{id}")
    public NoticeResponseDto updateNotice(
            @PathVariable Long id,
            @Valid @RequestBody NoticeUpsertRequestDto requestDto,
            Authentication authentication
    ) {
        NoticeResponseDto updated = noticeService.updateNotice(id, requestDto);
        auditLogService.log(authentication.getName(), "OPS_MASTER_UPDATE", "NOTICE", id, updated.title());
        return updated;
    }

    @DeleteMapping("/master/notices/{id}")
    public void deleteNotice(@PathVariable Long id, Authentication authentication) {
        noticeService.deleteNotice(id);
        auditLogService.log(authentication.getName(), "OPS_MASTER_DELETE", "NOTICE", id, "delete notice");
    }

    @PostMapping("/master/events")
    public EventResponseDto createEvent(@Valid @RequestBody EventUpsertRequestDto requestDto, Authentication authentication) {
        EventResponseDto created = eventService.createEvent(requestDto);
        auditLogService.log(authentication.getName(), "OPS_MASTER_CREATE", "EVENT", created.id(), created.title());
        streamService.publishEvents(eventService.getAllEvents());
        return created;
    }

    @PutMapping("/master/events/{id}")
    public EventResponseDto updateEvent(
            @PathVariable Long id,
            @Valid @RequestBody EventUpsertRequestDto requestDto,
            Authentication authentication
    ) {
        EventResponseDto updated = eventService.updateEvent(id, requestDto);
        auditLogService.log(authentication.getName(), "OPS_MASTER_UPDATE", "EVENT", id, updated.title());
        streamService.publishEvents(eventService.getAllEvents());
        return updated;
    }

    @DeleteMapping("/master/events/{id}")
    public void deleteEvent(@PathVariable Long id, Authentication authentication) {
        eventService.deleteEvent(id);
        auditLogService.log(authentication.getName(), "OPS_MASTER_DELETE", "EVENT", id, "delete event");
        streamService.publishEvents(eventService.getAllEvents());
    }

    @PostMapping("/master/booths")
    public BoothResponseDto createBooth(@Valid @RequestBody BoothUpsertRequestDto requestDto, Authentication authentication) {
        BoothResponseDto created = boothService.createBooth(requestDto);
        auditLogService.log(authentication.getName(), "OPS_MASTER_CREATE", "BOOTH", created.id(), created.name());
        streamService.publishBooths(boothService.getAllBooths());
        return created;
    }

    @PutMapping("/master/booths/{id}")
    public BoothResponseDto updateBooth(
            @PathVariable Long id,
            @Valid @RequestBody BoothUpsertRequestDto requestDto,
            Authentication authentication
    ) {
        BoothResponseDto updated = boothService.updateBooth(id, requestDto);
        auditLogService.log(authentication.getName(), "OPS_MASTER_UPDATE", "BOOTH", id, updated.name());
        streamService.publishBooths(boothService.getAllBooths());
        return updated;
    }

    @PutMapping("/master/booths/reorder")
    public void reorderBooths(@RequestBody BoothReorderRequestDto requestDto, Authentication authentication) {
        boothService.reorderBooths(requestDto);
        auditLogService.log(authentication.getName(), "OPS_MASTER_REORDER", "BOOTH", null, "reorder booths");
        streamService.publishBooths(boothService.getAllBooths());
    }

    @DeleteMapping("/master/booths/{id}")
    public void deleteBooth(@PathVariable Long id, Authentication authentication) {
        boothService.deleteBooth(id);
        auditLogService.log(authentication.getName(), "OPS_MASTER_DELETE", "BOOTH", id, "delete booth");
        streamService.publishBooths(boothService.getAllBooths());
    }

    @PutMapping("/master/booths/{id}/live-status")
    public BoothResponseDto updateMasterBoothLiveStatus(
            @PathVariable Long id,
            @RequestBody BoothLiveStatusRequestDto requestDto,
            Authentication authentication
    ) {
        BoothResponseDto updated = boothService.updateLiveStatus(id, requestDto);
        auditLogService.log(authentication.getName(), "OPS_MASTER_LIVE_STATUS", "BOOTH", id, "update live status");
        streamService.publishBooths(boothService.getAllBooths());
        return updated;
    }

    @PutMapping("/master/events/bulk-status")
    public java.util.List<EventResponseDto> bulkUpdateEventStatus(@RequestBody EventBulkStatusRequestDto requestDto, Authentication authentication) {
        java.util.List<EventResponseDto> updated = eventService.bulkUpdateStatus(requestDto);
        auditLogService.log(authentication.getName(), "OPS_MASTER_BULK_STATUS", "EVENT", null,
                (requestDto.statusOverride() == null ? "auto" : requestDto.statusOverride()) + " x" + updated.size());
        return updated;
    }

    @PostMapping("/master/actions/congestion-relief-notice")
    public NoticeResponseDto publishCongestionReliefNotice(Authentication authentication) {
        NoticeResponseDto created = adminActionService.publishCongestionReliefNotice();
        auditLogService.log(authentication.getName(), "OPS_MASTER_ACTION", "NOTICE", created.id(), "congestion relief notice");
        return created;
    }

    @PostMapping("/master/actions/events/{eventId}/start-notice")
    public NoticeResponseDto publishEventStartNotice(@PathVariable Long eventId, Authentication authentication) {
        NoticeResponseDto created = adminActionService.publishEventStartNotice(eventId);
        auditLogService.log(authentication.getName(), "OPS_MASTER_ACTION", "NOTICE", created.id(), "event start notice");
        return created;
    }

    @GetMapping("/booth/{id}/bootstrap")
    public OpsBoothBootstrapDto boothBootstrap(@PathVariable Long id, Authentication authentication) {
        ensureBoothAccess(authentication, id);
        return new OpsBoothBootstrapDto(
                boothService.getBoothById(id),
                boothService.getCongestionByBoothId(id),
                reservationService.getBoothReservationState(id, null)
        );
    }

    @PutMapping("/booth/{id}/live-status")
    public BoothResponseDto updateBoothLiveStatus(
            @PathVariable Long id,
            @RequestBody BoothLiveStatusRequestDto requestDto,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        BoothResponseDto updated = boothService.updateLiveStatus(id, requestDto);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_LIVE_STATUS", "BOOTH", id, "update own booth live status");
        streamService.publishBooths(boothService.getAllBooths());
        return updated;
    }

    @PostMapping("/master/ai/briefing")
    public AiAssistResponseDto masterAiBriefing() {
        return opsAiService.masterBriefing();
    }

    @PostMapping("/master/ai/notice-draft")
    public AiAssistResponseDto masterAiNoticeDraft(@RequestBody AiAssistRequestDto requestDto) {
        return opsAiService.masterNoticeDraft(requestDto);
    }

    @GetMapping("/master/simulation")
    public SimulationStatusDto simulationStatus() {
        return simulationService.status();
    }

    @PutMapping("/master/simulation")
    public SimulationStatusDto updateSimulation(@RequestBody SimulationPatchRequestDto requestDto) {
        return simulationService.patch(requestDto);
    }

    @PostMapping("/master/simulation/start")
    public SimulationStatusDto startSimulation(Authentication authentication) {
        SimulationStatusDto status = simulationService.start();
        auditLogService.log(authentication.getName(), "OPS_SIMULATION_START", "SIMULATION", null, status.scenario());
        return status;
    }

    @PostMapping("/master/simulation/stop")
    public SimulationStatusDto stopSimulation(Authentication authentication) {
        SimulationStatusDto status = simulationService.stop();
        auditLogService.log(authentication.getName(), "OPS_SIMULATION_STOP", "SIMULATION", null, status.scenario());
        return status;
    }

    @PostMapping("/master/simulation/reset")
    public SimulationStatusDto resetSimulation(Authentication authentication) {
        SimulationStatusDto status = simulationService.reset();
        auditLogService.log(authentication.getName(), "OPS_SIMULATION_RESET", "SIMULATION", null, "restore original booth live status");
        return status;
    }

    @PostMapping("/master/simulation/scenarios/{scenario}")
    public SimulationStatusDto applySimulationScenario(@PathVariable String scenario, Authentication authentication) {
        SimulationStatusDto status = simulationService.applyScenario(scenario);
        auditLogService.log(authentication.getName(), "OPS_SIMULATION_SCENARIO", "SIMULATION", null, scenario);
        return status;
    }

    @PostMapping(value = "/booth/{id}/menu-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BoothResponseDto uploadBoothMenuImage(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
        Authentication authentication
    ) throws IOException {
        ensureBoothAccess(authentication, id);
        String imageUrl = uploadStorageService.saveImage(file, "booth-menu-" + id);
        BoothResponseDto updated = boothService.updateBoothMenuImage(id, imageUrl);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_MENU_IMAGE", "BOOTH", id, imageUrl);
        streamService.publishBooths(boothService.getAllBooths());
        return updated;
    }

    @GetMapping("/booth/{id}/reservations")
    public BoothReservationStateDto getBoothReservations(@PathVariable Long id, Authentication authentication) {
        ensureBoothAccess(authentication, id);
        return reservationService.getBoothReservationState(id, null);
    }

    @PutMapping("/booth/{id}/reservations/config")
    public BoothReservationStateDto upsertBoothReservationConfig(
            @PathVariable Long id,
            @Valid @RequestBody BoothReservationConfigRequestDto requestDto,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        BoothReservationStateDto updated = reservationService.upsertBoothReservationConfig(id, requestDto);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_RESERVATION_CONFIG", "BOOTH", id, "update reservation config");
        return updated;
    }

    @PostMapping("/booth/{id}/reservations/{reservationId}/check-in")
    public BoothReservationDto checkInBoothReservation(
            @PathVariable Long id,
            @PathVariable Long reservationId,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        BoothReservationDto checkedIn = reservationService.checkIn(id, reservationId);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_RESERVATION_CHECKIN", "BOOTH", id, "reservation " + reservationId);
        return checkedIn;
    }

    @PostMapping("/booth/{id}/reservations/{reservationId}/call")
    public BoothReservationDto callBoothReservation(
            @PathVariable Long id,
            @PathVariable Long reservationId,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        return reservationService.call(id, reservationId);
    }

    @GetMapping("/booth/{id}/summary")
    public OpsBoothSummaryDto boothSummary(
            @PathVariable Long id,
            @RequestParam(required = false) String date,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        return boothSummaryService.summarize(id, date);
    }

    @PostMapping("/booth/{id}/reservations/{reservationId}/complete")
    public BoothReservationDto completeBoothReservation(
            @PathVariable Long id,
            @PathVariable Long reservationId,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        BoothReservationDto completed = reservationService.complete(id, reservationId);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_RESERVATION_COMPLETE", "BOOTH", id, "reservation " + reservationId);
        return completed;
    }

    @PostMapping("/booth/{id}/reservations/tables/{tableId}/release")
    public BoothReservationDto releaseBoothReservationTable(
            @PathVariable Long id,
            @PathVariable Long tableId,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        BoothReservationDto released = reservationService.releaseTable(id, tableId);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_RESERVATION_TABLE_RELEASE", "BOOTH", id, "table " + tableId);
        // 첫 화면 카드의 빈 테이블 수는 부스 스트림으로 받는다.
        streamService.publishBooths(boothService.getAllBooths());
        return released;
    }

    /** 워크인 손님을 앉힘. 자리 현황 화면의 큰 버튼에서 부른다. */
    @PostMapping("/booth/{id}/reservations/tables/{tableId}/occupy")
    public ReservationTableDto occupyBoothReservationTable(
            @PathVariable Long id,
            @PathVariable Long tableId,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        ReservationTableDto occupied = reservationService.occupyTable(id, tableId);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_RESERVATION_TABLE_OCCUPY", "BOOTH", id, "table " + tableId);
        streamService.publishBooths(boothService.getAllBooths());
        return occupied;
    }

    /** 메뉴 항목 사진. 저장만 하고 URL 을 돌려준다. 콘솔이 menuBoardJson 의 imageUrl 에 넣어 저장한다. */
    @PostMapping(value = "/booth/{id}/menu-item-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public java.util.Map<String, String> uploadBoothMenuItemImage(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) throws IOException {
        ensureBoothAccess(authentication, id);
        String imageUrl = uploadStorageService.saveImage(file, "booth-menu-item-" + id);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_MENU_ITEM_IMAGE", "BOOTH", id, imageUrl);
        return java.util.Map.of("imageUrl", imageUrl);
    }

    @PostMapping("/booth/{id}/reservations/check-in/by-token")
    public BoothReservationDto checkInBoothReservationByToken(
            @PathVariable Long id,
            @Valid @RequestBody ReservationCheckInByTokenRequestDto requestDto,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        BoothReservationDto checkedIn = reservationService.checkInByToken(id, requestDto.token());
        auditLogService.log(authentication.getName(), "OPS_BOOTH_RESERVATION_CHECKIN_TOKEN", "BOOTH", id, "token check-in");
        return checkedIn;
    }

    // ---------- 테이블 QR 주문 ----------

    @GetMapping("/booth/{id}/orders")
    public OpsBoothOrdersDto getBoothOrders(@PathVariable Long id, Authentication authentication) {
        ensureBoothAccess(authentication, id);
        return orderService.getOpsBoothOrders(id);
    }

    /** 지난 주문 내역(영업일 하나). date 가 없으면 오늘 영업일. */
    @GetMapping("/booth/{id}/orders/history")
    public com.festflow.backend.dto.OpsBoothOrderHistoryDto getBoothOrderHistory(
            @PathVariable Long id,
            @RequestParam(required = false) String date,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        return orderService.getOpsBoothOrderHistory(id, date);
    }

    /** 같은 내역을 CSV 파일로. 엑셀에서 바로 열린다. */
    @GetMapping(value = "/booth/{id}/orders/history.csv")
    public org.springframework.http.ResponseEntity<byte[]> downloadBoothOrderHistoryCsv(
            @PathVariable Long id,
            @RequestParam(required = false) String date,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        String csv = orderService.exportOpsBoothOrderHistoryCsv(id, date);
        String safeDate = date == null ? "" : date.replaceAll("[^0-9-]", "");
        return org.springframework.http.ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"orders-" + (safeDate.isEmpty() ? "today" : safeDate) + ".csv\"")
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .body(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @PutMapping("/booth/{id}/orders/config")
    public OpsBoothOrdersDto updateBoothOrderConfig(
            @PathVariable Long id,
            @Valid @RequestBody BoothOrderConfigRequestDto requestDto,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        OpsBoothOrdersDto updated = orderService.updateOrderConfig(id, requestDto);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_ORDER_CONFIG", "BOOTH", id, "update order config");
        return updated;
    }

    @PutMapping("/booth/{id}/orders/{orderId}/status")
    public BoothOrderDto updateBoothOrderStatus(
            @PathVariable Long id,
            @PathVariable Long orderId,
            @Valid @RequestBody OrderStatusUpdateRequestDto requestDto,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        BoothOrderDto updated = orderService.updateStatus(id, orderId, requestDto.status());
        auditLogService.log(authentication.getName(), "OPS_BOOTH_ORDER_STATUS", "BOOTH", id,
                "order " + orderId + " -> " + requestDto.status());
        return updated;
    }

    /** 메뉴별 요리사 창: 주문 한 줄(메뉴)을 다 만들었음. 모든 줄이 끝나면 서버가 주문을 READY 로 올린다. */
    @PutMapping("/booth/{id}/orders/{orderId}/items/{lineNo}/done")
    public BoothOrderDto markBoothOrderItemDone(
            @PathVariable Long id,
            @PathVariable Long orderId,
            @PathVariable int lineNo,
            Authentication authentication
    ) {
        ensureBoothAccess(authentication, id);
        BoothOrderDto updated = orderService.markItemDone(id, orderId, lineNo);
        auditLogService.log(authentication.getName(), "OPS_BOOTH_ORDER_ITEM_DONE", "BOOTH", id,
                "order " + orderId + " line " + lineNo + " done -> " + updated.status());
        return updated;
    }

    private void ensureBoothAccess(Authentication authentication, Long requestedBoothId) {
        boolean isMaster = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_OPS_MASTER".equals(a.getAuthority()));
        if (isMaster) {
            return;
        }

        Object detail = authentication.getDetails();
        if (!(detail instanceof Long allowedBoothId) || !allowedBoothId.equals(requestedBoothId)) {
            throw new ResponseStatusException(FORBIDDEN, "No permission for this booth.");
        }
    }
}
