package com.festflow.backend.service;

import com.festflow.backend.repository.BoothReservationTableRepository;
import com.festflow.backend.entity.BoothReservationTable;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.BoothOrderConfigRequestDto;
import com.festflow.backend.dto.BoothOrderDto;
import com.festflow.backend.dto.BoothOrderItemDto;
import com.festflow.backend.dto.OpsBoothOrdersDto;
import com.festflow.backend.dto.OrderCreateItemDto;
import com.festflow.backend.dto.OrderCreateRequestDto;
import com.festflow.backend.dto.OrderMenuDto;
import com.festflow.backend.dto.OrderMenuItemDto;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.BoothOrder;
import com.festflow.backend.entity.BoothOrderItem;
import com.festflow.backend.entity.OrderStatus;
import com.festflow.backend.entity.PaymentMethod;
import com.festflow.backend.repository.BoothOrderRepository;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.service.stream.StreamService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * 테이블 QR 주문.
 *
 * 흐름: 손님이 /order/{booth}/{table} 에서 메뉴를 담아 주문 → PENDING_PAYMENT 로 저장, clientKey 발급
 *      → 스태프가 입금을 확인하고 PAID → PREPARING → READY → COMPLETED 로 올린다.
 * 가격은 절대 클라이언트 값을 믿지 않고 부스 메뉴판(menuBoardJson)에서 다시 읽는다.
 *
 * 포장: 테이블 이름 자리에 "포장"이 오면 포장 주문이다(/order/{booth}/포장). 흐름은 같고,
 * 앉는 자리가 없으니 테이블 목록 검사 · 테이블당 주문 수 한도 · 자리 '이용 중' 표시만 건너뛴다.
 */
@Service
public class OrderService {

    /** 포장 주문의 테이블 이름. 화면(utils/orderCart.js 의 TAKEOUT_TABLE)과 같은 글자여야 한다. */
    public static final String TAKEOUT_LABEL = "포장";
    private static final int MAX_ITEMS_PER_ORDER = 20;
    private static final int MAX_ACTIVE_ORDERS_PER_TABLE = 5;
    private static final int DUPLICATE_WINDOW_SECONDS = 20;
    private static final String KEY_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

    private final BoothRepository boothRepository;
    private final BoothReservationTableRepository boothReservationTableRepository;
    private final BoothOrderRepository boothOrderRepository;
    private final StreamService streamService;
    private final ObjectMapper objectMapper;
    private final SecureRandom random = new SecureRandom();
    /** 최소 주문 금액(원). app.order.min-amount. 0 이면 제한 없음. */
    @Value("${app.order.min-amount:0}")
    private int minOrderAmount;

    public OrderService(
            BoothRepository boothRepository,
            BoothReservationTableRepository boothReservationTableRepository,
            BoothOrderRepository boothOrderRepository,
            StreamService streamService,
            ObjectMapper objectMapper
    ) {
        this.boothRepository = boothRepository;
        this.boothReservationTableRepository = boothReservationTableRepository;
        this.boothOrderRepository = boothOrderRepository;
        this.streamService = streamService;
        this.objectMapper = objectMapper;
    }

    void setMinOrderAmount(int minOrderAmount) {
        this.minOrderAmount = minOrderAmount;
    }

    // ---------- 손님 ----------

    @Transactional(readOnly = true)
    public OrderMenuDto getOrderMenu(Long boothId, String tableLabel) {
        Booth booth = findBooth(boothId);
        return new OrderMenuDto(
                booth.getId(),
                booth.getName(),
                booth.getCategory(),
                booth.getImageUrl(),
                booth.getBoothIntro(),
                booth.getOpenTime() == null ? null : booth.getOpenTime().toString(),
                booth.getCloseTime() == null ? null : booth.getCloseTime().toString(),
                normalizeTableLabel(tableLabel),
                booth.isOrderEnabled(),
                booth.getBankAccount(),
                booth.getBankHolder(),
                parseMenuBoard(booth.getMenuBoardJson()),
                minOrderAmount
        );
    }

    /**
     * 주문이 들어온 테이블은 손님이 앉아 있는 것이다. 자리 현황에서 '이용 중'으로 바꾼다.
     * 이미 이용 중이면 앉은 시각을 그대로 둔다. 빈 자리로 돌리는 것은 스태프가 직접 한다(주문이 끝나도 자동으로 비우지 않는다).
     */
    private void markTableInUse(Long boothId, String tableLabel, LocalDateTime now) {
        boothReservationTableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(boothId).stream()
                .filter(table -> tableLabel.equals(table.getTableName()))
                .findFirst()
                .filter(table -> !table.isWalkInOccupied())
                .ifPresent(table -> {
                    table.occupyWalkIn(now);
                    boothReservationTableRepository.save(table);
                    streamService.publishReservations(Map.of("boothId", boothId, "tableId", table.getId(), "status", "WALK_IN"));
                });
    }

    @Transactional
    public BoothOrderDto createOrder(Long boothId, OrderCreateRequestDto requestDto) {
        // 같은 부스의 주문은 한 번에 하나씩 처리한다(부스 행 잠금). 동시에 들어와도 주문번호가 겹치지 않고 테이블 한도가 새지 않는다.
        Booth booth = boothRepository.findByIdForUpdate(boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다."));
        if (!booth.isOrderEnabled()) {
            throw new ResponseStatusException(CONFLICT, "이 부스는 지금 주문을 받지 않습니다.");
        }

        PaymentMethod method = requestDto.paymentMethod() == null ? PaymentMethod.BANK_TRANSFER : requestDto.paymentMethod();
        if (method != PaymentMethod.BANK_TRANSFER) {
            throw new ResponseStatusException(BAD_REQUEST, "지금은 계좌이체만 가능합니다.");
        }

        String tableLabel = normalizeTableLabel(requestDto.tableLabel());
        if (tableLabel.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "테이블 번호가 없습니다.");
        }
        List<String> tableNames = boothReservationTableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(boothId).stream()
                .map(BoothReservationTable::getTableName)
                .filter(Objects::nonNull)
                .toList();
        boolean takeout = TAKEOUT_LABEL.equals(tableLabel);
        if (!takeout && !tableNames.isEmpty() && !tableNames.contains(tableLabel)) {
            throw new ResponseStatusException(BAD_REQUEST, "없는 테이블 번호입니다. 테이블의 QR을 다시 찍어 주세요.");
        }

        List<OrderMenuItemDto> menu = parseMenuBoard(booth.getMenuBoardJson());
        Map<String, OrderMenuItemDto> byName = new HashMap<>();
        for (OrderMenuItemDto item : menu) {
            byName.put(item.name(), item);
        }

        // 같은 메뉴가 여러 줄로 오면 합친다.
        Map<String, Integer> quantities = new HashMap<>();
        List<String> orderOfAppearance = new ArrayList<>();
        for (OrderCreateItemDto line : requestDto.items()) {
            String name = line.name() == null ? "" : line.name().trim();
            if (name.isEmpty()) continue;
            if (!quantities.containsKey(name)) orderOfAppearance.add(name);
            quantities.merge(name, Math.max(1, line.quantity() == null ? 1 : line.quantity()), Integer::sum);
        }
        if (orderOfAppearance.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "담긴 메뉴가 없습니다.");
        }
        int totalQuantity = quantities.values().stream().mapToInt(Integer::intValue).sum();
        if (totalQuantity > MAX_ITEMS_PER_ORDER) {
            throw new ResponseStatusException(BAD_REQUEST, "한 번에 " + MAX_ITEMS_PER_ORDER + "개까지 주문할 수 있습니다.");
        }

        List<BoothOrder> activeOnThisTable = boothOrderRepository
                .findByBoothIdAndTableLabelAndStatusInOrderByCreatedAtAsc(boothId, tableLabel, activeStatuses());

        // 방금(20초 안) 같은 테이블 · 같은 입금자 · 같은 메뉴로 들어온 주문이 있으면 새로 만들지 않고 그 주문을 돌려준다.
        // 통신이 끊겨 응답을 못 받고 다시 누른 경우다.
        String depositorName = requestDto.depositorName().trim();
        LocalDateTime duplicateSince = LocalDateTime.now().minusSeconds(DUPLICATE_WINDOW_SECONDS);
        for (BoothOrder existing : activeOnThisTable) {
            if (existing.getCreatedAt() != null && existing.getCreatedAt().isAfter(duplicateSince)
                    && depositorName.equals(existing.getDepositorName())
                    // 포장은 여러 손님이 "포장" 한 이름을 같이 쓴다. 이름 · 메뉴가 우연히 같은 다른 손님을 한 주문으로 묶지 않게 번호까지 본다.
                    && (!takeout || Objects.equals(digitsOf(existing.getPhoneNumber()), digitsOf(requestDto.phoneNumber())))
                    && sameItems(existing, quantities)) {
                return toDto(existing);
            }
        }

        long activeOnTable = activeOnThisTable.size();
        // 포장은 여러 손님이 한 이름("포장")을 같이 쓰므로 한도를 두지 않는다.
        if (!takeout && activeOnTable >= MAX_ACTIVE_ORDERS_PER_TABLE) {
            throw new ResponseStatusException(CONFLICT, "이 테이블에 처리 중인 주문이 너무 많습니다. 스태프에게 말씀해 주세요.");
        }

        LocalDateTime now = LocalDateTime.now();
        BoothOrder order = new BoothOrder(
                booth,
                tableLabel,
                randomKey(24),
                depositorName,
                normalizeBlank(requestDto.phoneNumber()),
                normalizeBlank(requestDto.request()),
                method,
                now
        );

        for (String name : orderOfAppearance) {
            OrderMenuItemDto menuItem = byName.get(name);
            if (menuItem == null) {
                throw new ResponseStatusException(BAD_REQUEST, "메뉴판에 없는 메뉴입니다: " + name);
            }
            if (Boolean.TRUE.equals(menuItem.soldOut())) {
                throw new ResponseStatusException(CONFLICT, "품절된 메뉴입니다: " + name);
            }
            order.addItem(name, menuItem.price() == null ? 0 : menuItem.price(), quantities.get(name));
        }
        if (minOrderAmount > 0 && order.getTotalAmount() < minOrderAmount) {
            throw new ResponseStatusException(BAD_REQUEST, String.format("주문은 %,d원부터 가능합니다. %,d원 더 담아 주세요.",
                    minOrderAmount, minOrderAmount - order.getTotalAmount()));
        }

        BoothOrder saved = boothOrderRepository.save(order);
        saved.assignOrderNo(buildOrderNo(booth.getId(), now, saved.getId()));
        if (!takeout) {
            markTableInUse(boothId, tableLabel, now);
        }

        BoothOrderDto dto = toDto(saved);
        streamService.publishOrders(dto.forPublicStream());
        return dto;
    }

    @Transactional(readOnly = true)
    public BoothOrderDto getOrderForCustomer(Long orderId, String clientKey) {
        BoothOrder order = boothOrderRepository.findWithItemsById(orderId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "주문을 찾을 수 없습니다."));
        if (clientKey == null || !Objects.equals(order.getClientKey(), clientKey.trim())) {
            throw new ResponseStatusException(FORBIDDEN, "주문 조회 키가 맞지 않습니다.");
        }
        return toDto(order);
    }

    // ---------- 운영 콘솔 ----------

    /** 영업일은 06:00 부터 다음 날 06:00 까지(마감 정산과 같은 기준). 새벽 장사가 전날로 잡힌다. */
    private static final int BUSINESS_DAY_START_HOUR = 6;

    private static LocalDate businessDateOf(LocalDateTime at) {
        return at.getHour() < BUSINESS_DAY_START_HOUR ? at.toLocalDate().minusDays(1) : at.toLocalDate();
    }

    private static LocalDate resolveBusinessDate(String dateText) {
        if (dateText != null && !dateText.isBlank()) {
            try {
                return LocalDate.parse(dateText.trim());
            } catch (java.time.format.DateTimeParseException ignored) {
                // 아래에서 오늘로
            }
        }
        return businessDateOf(LocalDateTime.now());
    }

    /**
     * 지난 주문 내역 한 영업일치. 축제가 끝난 뒤 날짜별로 되돌아보거나 정산을 맞출 때 쓴다.
     * 주문이 있었던 영업일 목록(최근 순)도 같이 줘서 화면이 날짜 칩을 그린다.
     */
    @Transactional(readOnly = true)
    public com.festflow.backend.dto.OpsBoothOrderHistoryDto getOpsBoothOrderHistory(Long boothId, String dateText) {
        findBooth(boothId);
        LocalDate date = resolveBusinessDate(dateText);
        LocalDateTime from = date.atTime(BUSINESS_DAY_START_HOUR, 0);
        LocalDateTime to = from.plusDays(1);
        List<BoothOrder> dayOrders = boothOrderRepository
                .findByBoothIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(boothId, from, to);
        java.util.Map<LocalDate, long[]> byDay = new java.util.TreeMap<>(java.util.Comparator.reverseOrder());
        for (BoothOrder order : boothOrderRepository.findByBoothId(boothId)) {
            if (order.getCreatedAt() == null) continue;
            long[] acc = byDay.computeIfAbsent(businessDateOf(order.getCreatedAt()), ignored -> new long[2]);
            acc[0] += 1;
            if (order.getStatus() != OrderStatus.PENDING_PAYMENT && order.getStatus() != OrderStatus.CANCELED) {
                acc[1] += order.getTotalAmount() == null ? 0 : order.getTotalAmount();
            }
        }
        List<com.festflow.backend.dto.OpsBoothOrderHistoryDto.OpsBoothOrderHistoryDayDto> days = byDay.entrySet().stream()
                .map(entry -> new com.festflow.backend.dto.OpsBoothOrderHistoryDto.OpsBoothOrderHistoryDayDto(
                        entry.getKey().toString(), entry.getValue()[0], entry.getValue()[1]))
                .toList();
        long paidRevenue = dayOrders.stream()
                .filter(order -> order.getStatus() != OrderStatus.PENDING_PAYMENT && order.getStatus() != OrderStatus.CANCELED)
                .mapToLong(order -> order.getTotalAmount() == null ? 0 : order.getTotalAmount())
                .sum();
        return new com.festflow.backend.dto.OpsBoothOrderHistoryDto(
                date.toString(),
                from,
                to,
                days,
                dayOrders.size(),
                dayOrders.stream().filter(order -> order.getStatus() == OrderStatus.COMPLETED).count(),
                dayOrders.stream().filter(order -> order.getStatus() == OrderStatus.CANCELED).count(),
                paidRevenue,
                dayOrders.stream().map(this::toDto).map(BoothOrderDto::withoutClientKey).toList()
        );
    }

    /**
     * 한 영업일 주문을 CSV 로. 메뉴 줄마다 한 행(주문 합계는 줄마다 반복). 엑셀이 바로 열게 BOM 을 붙인다.
     * 개인정보: 손님 전화번호 · 요청사항은 싣지 않고, 입금자명은 첫 글자만 남기고 가린다(통장과 맞출 때 첫 글자 + 금액이면 된다).
     * 날짜 · 시각은 "26.10.07(수)" · "17:02:03" 처럼 엑셀이 날짜로 바꾸지 않는 짧은 글자로 쓴다(날짜로 바뀌면 칸이 좁아 #### 로 보인다).
     */
    @Transactional(readOnly = true)
    public String exportOpsBoothOrderHistoryCsv(Long boothId, String dateText) {
        com.festflow.backend.dto.OpsBoothOrderHistoryDto history = getOpsBoothOrderHistory(boothId, dateText);
        StringBuilder out = new StringBuilder("\uFEFF");
        String[] head = {"영업일", "주문 시각", "주문번호", "테이블", "상태", "결제", "메뉴", "수량", "단가", "줄 금액", "주문 합계", "입금 확인", "완료", "취소", "입금자(가림)"};
        out.append(String.join(",", head)).append("\r\n");
        for (BoothOrderDto order : history.orders()) {
            String status = switch (order.status()) {
                case PENDING_PAYMENT -> "입금 대기";
                case PAID -> "입금 확인";
                case PREPARING -> "조리 중";
                case READY -> "서빙할 것";
                case COMPLETED -> "완료";
                case CANCELED -> "취소";
            };
            List<com.festflow.backend.dto.BoothOrderItemDto> items = order.items() == null || order.items().isEmpty()
                    ? List.of()
                    : order.items();
            if (items.isEmpty()) {
                csvLine(out, history.date(), order, status, "", "", "", "");
                continue;
            }
            for (com.festflow.backend.dto.BoothOrderItemDto item : items) {
                int qty = item.quantity() == null ? 0 : item.quantity();
                int unit = item.unitPrice() == null ? 0 : item.unitPrice();
                csvLine(out, history.date(), order, status, item.name(), String.valueOf(qty), String.valueOf(unit), String.valueOf((long) qty * unit));
            }
        }
        return out.toString();
    }

    private static void csvLine(StringBuilder out, String date, BoothOrderDto order, String status,
                                String name, String qty, String unit, String lineAmount) {
        LocalDate orderDay = order.createdAt() == null ? null : order.createdAt().toLocalDate();
        String[] cells = {
                csvDate(date),
                csvClock(order.createdAt(), orderDay),
                order.orderNo(),
                order.tableLabel(),
                status,
                order.paymentMethod() == null ? "" : switch (order.paymentMethod()) {
                    case BANK_TRANSFER -> "계좌이체";
                    case CARD -> "카드";
                    case EASY_PAY -> "간편결제";
                },
                name,
                qty,
                unit,
                lineAmount,
                order.totalAmount() == null ? "" : String.valueOf(order.totalAmount()),
                csvClock(order.paidAt(), orderDay),
                csvClock(order.completedAt(), orderDay),
                csvClock(order.canceledAt(), orderDay),
                maskName(order.depositorName()),
        };
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) out.append(',');
            out.append(csvCell(cells[i]));
        }
        out.append("\r\n");
    }

    private static final String[] CSV_DAY_NAMES = {"월", "화", "수", "목", "금", "토", "일"};

    /** "2026-10-07" → "26.10.07(수)". 점으로 구분해 엑셀이 날짜로 바꾸지 않는다. */
    private static String csvDate(String isoDate) {
        try {
            LocalDate d = LocalDate.parse(isoDate);
            return String.format("%02d.%02d.%02d(%s)", d.getYear() % 100, d.getMonthValue(), d.getDayOfMonth(),
                    CSV_DAY_NAMES[d.getDayOfWeek().getValue() - 1]);
        } catch (java.time.format.DateTimeParseException e) {
            return isoDate;
        }
    }

    /** 주문 날과 같은 날이면 "17:02:03", 자정을 넘겼으면 "10.08 00:12:30". */
    private static String csvClock(LocalDateTime at, LocalDate orderDay) {
        if (at == null) return "";
        String clock = String.format("%02d:%02d:%02d", at.getHour(), at.getMinute(), at.getSecond());
        if (orderDay != null && !at.toLocalDate().equals(orderDay)) {
            return String.format("%02d.%02d %s", at.getMonthValue(), at.getDayOfMonth(), clock);
        }
        return clock;
    }

    /** "정재훈" → "정**". 한 글자면 "*". */
    private static String maskName(String name) {
        if (name == null || name.isBlank()) return "";
        String text = name.trim();
        return text.charAt(0) + "*".repeat(Math.max(1, text.length() - 1));
    }

    private static String csvCell(String value) {
        if (value == null) return "";
        String text = value.replace("\r", " ").replace("\n", " ");
        if (text.contains(",") || text.contains("\"")) {
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }

    @Transactional(readOnly = true)
    public OpsBoothOrdersDto getOpsBoothOrders(Long boothId) {
        Booth booth = findBooth(boothId);
        LocalDateTime since = LocalDate.now().atStartOfDay().minusHours(6);
        List<BoothOrderDto> orders = boothOrderRepository
                .findByBoothIdAndCreatedAtAfterOrderByCreatedAtDesc(boothId, since)
                .stream()
                .map(this::toDto)
                .map(BoothOrderDto::withoutClientKey)
                .toList();
        return new OpsBoothOrdersDto(booth.isOrderEnabled(), booth.getBankAccount(), booth.getBankHolder(), orders);
    }

    @Transactional
    public OpsBoothOrdersDto updateOrderConfig(Long boothId, BoothOrderConfigRequestDto requestDto) {
        Booth booth = findBooth(boothId);
        booth.updateOrderConfig(requestDto.orderEnabled(), requestDto.bankAccount(), requestDto.bankHolder());
        boothRepository.save(booth);
        return getOpsBoothOrders(boothId);
    }

    @Transactional
    public BoothOrderDto updateStatus(Long boothId, Long orderId, OrderStatus next) {
        BoothOrder order = boothOrderRepository.findByIdAndBoothIdForUpdate(orderId, boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "주문을 찾을 수 없습니다."));
        OrderStatus current = order.getStatus();

        if (current.isTerminal()) {
            throw new ResponseStatusException(CONFLICT, "이미 끝난 주문입니다.");
        }
        if (next != OrderStatus.CANCELED && next.ordinal() <= current.ordinal()) {
            throw new ResponseStatusException(CONFLICT, "주문 상태는 뒤로 돌릴 수 없습니다.");
        }

        order.transitionTo(next, LocalDateTime.now());
        BoothOrder saved = boothOrderRepository.save(order);
        BoothOrderDto dto = toDto(saved).withoutClientKey();
        streamService.publishOrders(dto.forPublicStream());
        return dto;
    }

    /**
     * 메뉴별 요리사 창에서 한 줄(메뉴)을 '완료'. 입금이 확인된 주문(PAID · PREPARING)만 받는다.
     * 첫 줄이 끝나면 PREPARING(조리 중), 모든 줄이 끝나면 READY(서빙할 것). 이미 끝난 줄을 다시 눌러도 그대로 둔다.
     */
    @Transactional
    public BoothOrderDto markItemDone(Long boothId, Long orderId, int lineNo) {
        BoothOrder order = boothOrderRepository.findByIdAndBoothIdForUpdate(orderId, boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "주문을 찾을 수 없습니다."));
        BoothOrderItem item = order.getItems().stream()
                .filter(line -> line.getLineNo() != null && line.getLineNo() == lineNo)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "주문에 없는 메뉴입니다."));
        OrderStatus current = order.getStatus();
        if (current.isTerminal()) {
            throw new ResponseStatusException(CONFLICT, "이미 끝난 주문입니다.");
        }
        if (current == OrderStatus.PENDING_PAYMENT) {
            throw new ResponseStatusException(CONFLICT, "아직 입금 확인 전 주문입니다.");
        }
        if (item.isDone()) {
            return toDto(order).withoutClientKey();
        }
        LocalDateTime now = LocalDateTime.now();
        item.markDone(now);
        if (order.allItemsDone()) {
            order.transitionTo(OrderStatus.READY, now);
        } else if (current == OrderStatus.PAID) {
            order.transitionTo(OrderStatus.PREPARING, now);
        }
        BoothOrder saved = boothOrderRepository.save(order);
        BoothOrderDto dto = toDto(saved).withoutClientKey();
        streamService.publishOrders(dto.forPublicStream());
        return dto;
    }

    // ---------- 내부 ----------

    private Booth findBooth(Long boothId) {
        return boothRepository.findById(boothId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다."));
    }

    private List<OrderStatus> activeStatuses() {
        return List.of(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.READY);
    }

    /**
     * menuBoardJson: [{"name","price","description","soldOut","imageUrl"}] — price 는 "12,000원" 같은 문자열이라 숫자만 뽑는다.
     */
    List<OrderMenuItemDto> parseMenuBoard(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        List<Map<String, Object>> rows;
        try {
            rows = objectMapper.readValue(raw, new TypeReference<List<Map<String, Object>>>() {
            });
        } catch (Exception e) {
            return List.of();
        }
        List<OrderMenuItemDto> items = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            if (row == null) continue;
            String name = stringOf(row.get("name")).trim();
            if (name.isEmpty()) continue;
            String priceLabel = stringOf(row.get("price")).trim();
            Object soldOutRaw = row.get("soldOut");
            boolean soldOut = soldOutRaw instanceof Boolean b ? b : "true".equalsIgnoreCase(stringOf(soldOutRaw));
            items.add(new OrderMenuItemDto(
                    name,
                    stringOf(row.get("description")).trim(),
                    priceLabel,
                    parsePrice(priceLabel),
                    soldOut,
                    stringOf(row.get("imageUrl")).trim()
            ));
        }
        return items;
    }

    static Integer parsePrice(String label) {
        if (label == null) return 0;
        String digits = label.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return 0;
        // "1.5만" 같은 표기는 지원하지 않는다. 운영 콘솔에는 숫자 그대로 적으라고 안내한다.
        try {
            long value = Long.parseLong(digits);
            return (int) Math.min(value, Integer.MAX_VALUE);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String stringOf(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String normalizeBlank(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String digitsOf(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    private static boolean sameItems(BoothOrder order, Map<String, Integer> quantities) {
        if (order.getItems().size() != quantities.size()) {
            return false;
        }
        return order.getItems().stream()
                .allMatch(item -> Objects.equals(quantities.get(item.getName()), item.getQuantity()));
    }

    private static String normalizeTableLabel(String label) {
        if (label == null) return "";
        String trimmed = label.trim();
        return trimmed.length() > 40 ? trimmed.substring(0, 40) : trimmed;
    }

    private String buildOrderNo(Long boothId, LocalDateTime now, Long id) {
        // 하루 안에서 부스별 순번. 스태프가 부르기 쉽게 4자리.
        long seq = boothOrderRepository.countByBoothIdAndCreatedAtBetween(
                boothId, now.toLocalDate().atStartOfDay(), now.toLocalDate().plusDays(1).atStartOfDay());
        long number = seq <= 0 ? (id % 10000) : seq;
        return String.format(Locale.ROOT, "%04d", number % 10000);
    }

    private String randomKey(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(KEY_ALPHABET.charAt(random.nextInt(KEY_ALPHABET.length())));
        }
        return sb.toString();
    }

    private BoothOrderDto toDto(BoothOrder order) {
        List<BoothOrderItemDto> items = order.getItems().stream()
                .map(item -> new BoothOrderItemDto(item.getLineNo(), item.getName(), item.getUnitPrice(), item.getQuantity(),
                        item.lineTotal(), item.getDoneAt()))
                .toList();
        return new BoothOrderDto(
                order.getId(),
                order.getOrderNo(),
                order.getBooth().getId(),
                order.getBooth().getName(),
                order.getTableLabel(),
                order.getDepositorName(),
                order.getPhoneNumber(),
                order.getRequest(),
                order.getPaymentMethod(),
                order.getStatus(),
                order.getTotalAmount(),
                order.getCreatedAt(),
                order.getPaidAt(),
                order.getReadyAt(),
                order.getCompletedAt(),
                order.getCanceledAt(),
                items,
                order.getClientKey()
        );
    }
}
