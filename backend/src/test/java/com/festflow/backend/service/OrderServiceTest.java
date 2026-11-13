package com.festflow.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.BoothOrderDto;
import com.festflow.backend.dto.OrderCreateItemDto;
import com.festflow.backend.dto.OrderCreateRequestDto;
import com.festflow.backend.dto.OrderMenuItemDto;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.BoothOrder;
import com.festflow.backend.entity.OrderStatus;
import com.festflow.backend.entity.PaymentMethod;
import com.festflow.backend.repository.BoothOrderRepository;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.repository.BoothReservationTableRepository;
import com.festflow.backend.service.stream.StreamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;

class OrderServiceTest {

    private static final String MENU = """
            [{"name":"대표 안주 세트","price":"12,000원","description":"2-3인","soldOut":false},
             {"name":"논알콜 음료","price":"3000원","description":"","soldOut":false},
             {"name":"감자튀김","price":"5000","description":"","soldOut":true}]
            """;

    private BoothRepository boothRepository;
    private BoothOrderRepository boothOrderRepository;
    private StreamService streamService;
    private OrderService orderService;
    private Booth booth;

    @BeforeEach
    void setUp() throws Exception {
        boothRepository = Mockito.mock(BoothRepository.class);
        boothOrderRepository = Mockito.mock(BoothOrderRepository.class);
        streamService = Mockito.mock(StreamService.class);
        BoothReservationTableRepository tableRepository = Mockito.mock(BoothReservationTableRepository.class);
        Mockito.when(tableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(anyLong())).thenReturn(List.of());
        orderService = new OrderService(boothRepository, tableRepository, boothOrderRepository, streamService, new ObjectMapper());

        booth = new Booth("소프트웨어학과 주점", 37.28, 127.04, "설명", 1, "/img.jpg", 5, 10, null, null);
        setId(booth, 7L);
        booth.setMenuBoardJson(MENU);
        booth.updateOrderConfig(true, "국민 000-00-0000", "홍길동");

        Mockito.when(boothRepository.findById(7L)).thenReturn(Optional.of(booth));
        Mockito.when(boothRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(booth));
        Mockito.when(boothOrderRepository.save(any(BoothOrder.class))).thenAnswer(invocation -> {
            BoothOrder saved = invocation.getArgument(0);
            if (saved.getId() == null) setId(saved, 42L);
            return saved;
        });
        Mockito.when(boothOrderRepository.findByBoothIdAndTableLabelAndStatusInOrderByCreatedAtAsc(eq(7L), any(), any())).thenReturn(List.of());
        Mockito.when(boothOrderRepository.countByBoothIdAndCreatedAtBetween(eq(7L), any(), any())).thenReturn(3L);
    }

    @Test
    void parsesPricesFromMenuBoardStrings() {
        assertThat(OrderService.parsePrice("12,000원")).isEqualTo(12000);
        assertThat(OrderService.parsePrice("3000원")).isEqualTo(3000);
        assertThat(OrderService.parsePrice("5000")).isEqualTo(5000);
        assertThat(OrderService.parsePrice("")).isZero();
        assertThat(OrderService.parsePrice(null)).isZero();

        List<OrderMenuItemDto> items = orderService.parseMenuBoard(MENU);
        assertThat(items).hasSize(3);
        assertThat(items.get(0).price()).isEqualTo(12000);
        assertThat(items.get(2).soldOut()).isTrue();
    }

    @Test
    void createsOrderWithServerSidePricesAndMergesDuplicateLines() {
        OrderCreateRequestDto request = new OrderCreateRequestDto(
                "7",
                List.of(
                        new OrderCreateItemDto("대표 안주 세트", 1),
                        new OrderCreateItemDto("논알콜 음료", 2),
                        new OrderCreateItemDto("논알콜 음료", 1)
                ),
                "재훈",
                "010-0000-0000",
                "덜 맵게",
                PaymentMethod.BANK_TRANSFER
        );

        BoothOrderDto created = orderService.createOrder(7L, request);

        assertThat(created.status()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(created.totalAmount()).isEqualTo(12000 + 3000 * 3);
        assertThat(created.items()).hasSize(2);
        assertThat(created.items().get(1).quantity()).isEqualTo(3);
        assertThat(created.orderNo()).isEqualTo("0003");
        assertThat(created.clientKey()).hasSize(24);
        assertThat(created.tableLabel()).isEqualTo("7");
        Mockito.verify(streamService).publishOrders(any());
    }

    @Test
    void rejectsSoldOutUnknownAndNonBankPayments() {
        assertThatThrownBy(() -> orderService.createOrder(7L, new OrderCreateRequestDto(
                "7", List.of(new OrderCreateItemDto("감자튀김", 1)), "재훈", null, null, PaymentMethod.BANK_TRANSFER)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("품절");

        assertThatThrownBy(() -> orderService.createOrder(7L, new OrderCreateRequestDto(
                "7", List.of(new OrderCreateItemDto("없는 메뉴", 1)), "재훈", null, null, PaymentMethod.BANK_TRANSFER)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("메뉴판에 없는");

        assertThatThrownBy(() -> orderService.createOrder(7L, new OrderCreateRequestDto(
                "7", List.of(new OrderCreateItemDto("논알콜 음료", 1)), "재훈", null, null, PaymentMethod.CARD)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("계좌이체");
    }

    @Test
    void statusMovesForwardOnlyAndCustomerKeyIsChecked() throws Exception {
        BoothOrder order = new BoothOrder(booth, "7", "secretkey", "재훈", null, null, PaymentMethod.BANK_TRANSFER, LocalDateTime.now());
        order.addItem("논알콜 음료", 3000, 1);
        setId(order, 42L);
        Mockito.when(boothOrderRepository.findByIdAndBoothIdForUpdate(42L, 7L)).thenReturn(Optional.of(order));
        Mockito.when(boothOrderRepository.findWithItemsById(42L)).thenReturn(Optional.of(order));

        assertThat(orderService.updateStatus(7L, 42L, OrderStatus.PAID).status()).isEqualTo(OrderStatus.PAID);
        assertThat(orderService.updateStatus(7L, 42L, OrderStatus.READY).status()).isEqualTo(OrderStatus.READY);
        assertThatThrownBy(() -> orderService.updateStatus(7L, 42L, OrderStatus.PAID))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(orderService.updateStatus(7L, 42L, OrderStatus.CANCELED).status()).isEqualTo(OrderStatus.CANCELED);
        assertThatThrownBy(() -> orderService.updateStatus(7L, 42L, OrderStatus.COMPLETED))
                .isInstanceOf(ResponseStatusException.class);

        assertThat(orderService.getOrderForCustomer(42L, "secretkey").id()).isEqualTo(42L);
        assertThatThrownBy(() -> orderService.getOrderForCustomer(42L, "wrong"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void sameOrderSentAgainRightAwayReturnsTheFirstOneInsteadOfDuplicating() {
        OrderCreateRequestDto request = new OrderCreateRequestDto(
                "7",
                List.of(new OrderCreateItemDto("논알콜 음료", 2)),
                "재훈",
                null,
                null,
                PaymentMethod.BANK_TRANSFER
        );
        org.mockito.ArgumentCaptor<BoothOrder> saved = org.mockito.ArgumentCaptor.forClass(BoothOrder.class);

        BoothOrderDto first = orderService.createOrder(7L, request);
        Mockito.verify(boothOrderRepository).save(saved.capture());
        // 통신이 끊겨 응답을 못 받고 다시 누른 경우: 방금 만든 주문이 처리 중 목록에 있다.
        Mockito.when(boothOrderRepository.findByBoothIdAndTableLabelAndStatusInOrderByCreatedAtAsc(eq(7L), eq("7"), any()))
                .thenReturn(List.of(saved.getValue()));

        BoothOrderDto again = orderService.createOrder(7L, request);

        assertThat(again.id()).isEqualTo(first.id());
        assertThat(again.clientKey()).isEqualTo(first.clientKey());
        Mockito.verify(boothOrderRepository, Mockito.times(1)).save(any(BoothOrder.class));

        // 메뉴가 다르면 새 주문이다.
        OrderCreateRequestDto different = new OrderCreateRequestDto(
                "7",
                List.of(new OrderCreateItemDto("논알콜 음료", 1)),
                "재훈",
                null,
                null,
                PaymentMethod.BANK_TRANSFER
        );
        orderService.createOrder(7L, different);
        Mockito.verify(boothOrderRepository, Mockito.times(2)).save(any(BoothOrder.class));
    }

    @Test
    void 포장은_이름과_메뉴가_같아도_번호가_다르면_다른_손님의_주문이다() {
        org.mockito.ArgumentCaptor<BoothOrder> saved = org.mockito.ArgumentCaptor.forClass(BoothOrder.class);
        List<OrderCreateItemDto> items = List.of(new OrderCreateItemDto("논알콜 음료", 1));
        OrderCreateRequestDto first = new OrderCreateRequestDto("포장", items, "김민수", "010-1111-2222", null, PaymentMethod.BANK_TRANSFER);
        orderService.createOrder(7L, first);
        Mockito.verify(boothOrderRepository).save(saved.capture());
        Mockito.when(boothOrderRepository.findByBoothIdAndTableLabelAndStatusInOrderByCreatedAtAsc(eq(7L), eq("포장"), any()))
                .thenReturn(List.of(saved.getValue()));

        // 같은 손님이 다시 누른 것(번호 표기만 다름): 새로 만들지 않는다.
        orderService.createOrder(7L, new OrderCreateRequestDto("포장", items, "김민수", "01011112222", null, PaymentMethod.BANK_TRANSFER));
        Mockito.verify(boothOrderRepository, Mockito.times(1)).save(any(BoothOrder.class));

        // 이름 · 메뉴가 우연히 같은 다른 손님: 새 주문이다.
        orderService.createOrder(7L, new OrderCreateRequestDto("포장", items, "김민수", "010-3333-4444", null, PaymentMethod.BANK_TRANSFER));
        Mockito.verify(boothOrderRepository, Mockito.times(2)).save(any(BoothOrder.class));
    }

    @Test
    void 메뉴별_주방이_줄마다_완료하면_첫_줄에_조리중_마지막_줄에_서빙할것이_된다() throws Exception {
        BoothOrder order = new BoothOrder(booth, "12", "k", "재훈", "010-1234-5678", null, PaymentMethod.BANK_TRANSFER, LocalDateTime.now());
        order.addItem("대표 안주 세트", 12000, 2);
        order.addItem("논알콜 음료", 3000, 1);
        setId(order, 42L);
        Mockito.when(boothOrderRepository.findByIdAndBoothIdForUpdate(42L, 7L)).thenReturn(Optional.of(order));

        // 입금 확인 전에는 주방이 완료할 수 없다.
        assertThatThrownBy(() -> orderService.markItemDone(7L, 42L, 1))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("입금 확인 전");

        orderService.updateStatus(7L, 42L, OrderStatus.PAID);

        BoothOrderDto first = orderService.markItemDone(7L, 42L, 1);
        assertThat(first.status()).isEqualTo(OrderStatus.PREPARING);
        assertThat(first.items().get(0).doneAt()).isNotNull();
        assertThat(first.items().get(1).doneAt()).isNull();
        assertThat(first.items().get(0).lineNo()).isEqualTo(1);

        // 같은 줄을 다시 눌러도 그대로(두 번 눌러도 시각이 안 바뀌고 상태도 그대로).
        BoothOrderDto again = orderService.markItemDone(7L, 42L, 1);
        assertThat(again.status()).isEqualTo(OrderStatus.PREPARING);
        assertThat(again.items().get(0).doneAt()).isEqualTo(first.items().get(0).doneAt());

        BoothOrderDto last = orderService.markItemDone(7L, 42L, 2);
        assertThat(last.status()).isEqualTo(OrderStatus.READY);
        assertThat(last.readyAt()).isNotNull();
        assertThat(last.items()).allMatch(item -> item.doneAt() != null);

        // 없는 줄 번호.
        assertThatThrownBy(() -> orderService.markItemDone(7L, 42L, 9))
                .isInstanceOf(ResponseStatusException.class);
        // 서빙이 끝난 뒤에는 거절.
        orderService.updateStatus(7L, 42L, OrderStatus.COMPLETED);
        assertThatThrownBy(() -> orderService.markItemDone(7L, 42L, 2))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("이미 끝난");
    }

    @Test
    void 콘솔에서_준비완료를_대신_누르면_남은_줄도_모두_완료로_적힌다() throws Exception {
        BoothOrder order = new BoothOrder(booth, "3", "k", "재훈", "010-1234-5678", null, PaymentMethod.BANK_TRANSFER, LocalDateTime.now());
        order.addItem("대표 안주 세트", 12000, 1);
        order.addItem("논알콜 음료", 3000, 2);
        setId(order, 42L);
        Mockito.when(boothOrderRepository.findByIdAndBoothIdForUpdate(42L, 7L)).thenReturn(Optional.of(order));

        orderService.updateStatus(7L, 42L, OrderStatus.PAID);
        orderService.markItemDone(7L, 42L, 2);
        BoothOrderDto ready = orderService.updateStatus(7L, 42L, OrderStatus.READY);
        assertThat(ready.status()).isEqualTo(OrderStatus.READY);
        assertThat(ready.items()).allMatch(item -> item.doneAt() != null);
    }

    @Test
    void 최소_주문_금액보다_적으면_거절하고_얼마_더_담아야_하는지_알려준다() {
        orderService.setMinOrderAmount(14000);
        assertThat(orderService.getOrderMenu(7L, "3").minOrderAmount()).isEqualTo(14000);

        OrderCreateRequestDto small = new OrderCreateRequestDto("3", List.of(new OrderCreateItemDto("논알콜 음료", 3)),
                "재훈", "010-1234-5678", null, PaymentMethod.BANK_TRANSFER);
        assertThatThrownBy(() -> orderService.createOrder(7L, small))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("14,000원부터")
                .hasMessageContaining("5,000원 더");

        OrderCreateRequestDto enough = new OrderCreateRequestDto("3", List.of(new OrderCreateItemDto("대표 안주 세트", 1), new OrderCreateItemDto("논알콜 음료", 1)),
                "재훈", "010-1234-5678", null, PaymentMethod.BANK_TRANSFER);
        assertThat(orderService.createOrder(7L, enough).totalAmount()).isEqualTo(15000);
    }

    @Test
    void 메뉴가_하나뿐인_주문은_완료_한_번에_서빙할것이_된다() throws Exception {
        BoothOrder order = new BoothOrder(booth, "포장", "k", "재훈", "010-1234-5678", null, PaymentMethod.BANK_TRANSFER, LocalDateTime.now());
        order.addItem("논알콜 음료", 3000, 3);
        setId(order, 42L);
        Mockito.when(boothOrderRepository.findByIdAndBoothIdForUpdate(42L, 7L)).thenReturn(Optional.of(order));

        orderService.updateStatus(7L, 42L, OrderStatus.PAID);
        assertThat(orderService.markItemDone(7L, 42L, 1).status()).isEqualTo(OrderStatus.READY);
    }

    private static void setId(Object entity, Long id) throws Exception {
        Field field = entity.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(entity, id);
    }
}
