package com.festflow.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.OrderCreateItemDto;
import com.festflow.backend.dto.OrderCreateRequestDto;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.BoothOrder;
import com.festflow.backend.entity.BoothReservationTable;
import com.festflow.backend.entity.PaymentMethod;
import com.festflow.backend.repository.BoothOrderRepository;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.repository.BoothReservationTableRepository;
import com.festflow.backend.service.stream.StreamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** 테이블 QR 로 주문이 들어오면 그 테이블이 '이용 중'이 되는지. */
class OrderTableOccupancyTest {

    private static final String MENU = """
            [{"name":"논알콜 음료","price":"3000원","description":"","soldOut":false}]
            """;

    private BoothReservationTableRepository tableRepository;
    private BoothOrderRepository boothOrderRepository;
    private StreamService streamService;
    private OrderService orderService;
    private BoothReservationTable tableOne;
    private BoothReservationTable tableTwo;

    @BeforeEach
    void setUp() throws Exception {
        Booth booth = new Booth("총학생회 주점", 37.28, 127.04, "설명", 1, "/img.jpg", 5, 10, null, null);
        setId(booth, 7L);
        booth.setMenuBoardJson(MENU);
        booth.updateOrderConfig(true, "국민 000-00-0000", "홍길동");

        // 부스를 찾는 방법(findById · 잠금 조회)이 바뀌어도 같은 부스를 돌려준다.
        BoothRepository boothRepository = Mockito.mock(BoothRepository.class, invocation ->
                invocation.getMethod().getName().startsWith("findById")
                        ? Optional.of(booth)
                        : Mockito.RETURNS_DEFAULTS.answer(invocation));
        boothOrderRepository = Mockito.mock(BoothOrderRepository.class);
        streamService = Mockito.mock(StreamService.class);
        tableRepository = Mockito.mock(BoothReservationTableRepository.class);

        tableOne = new BoothReservationTable(booth, "1번", 4, 4, 1);
        tableTwo = new BoothReservationTable(booth, "2번", 4, 4, 2);
        setId(tableOne, 101L);
        setId(tableTwo, 102L);
        Mockito.when(tableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(anyLong())).thenReturn(List.of(tableOne, tableTwo));
        Mockito.when(boothOrderRepository.save(any(BoothOrder.class))).thenAnswer(invocation -> {
            BoothOrder saved = invocation.getArgument(0);
            if (saved.getId() == null) setId(saved, 42L);
            return saved;
        });
        Mockito.when(boothOrderRepository.findByBoothIdAndStatusInOrderByCreatedAtAsc(eq(7L), any())).thenReturn(List.of());
        Mockito.when(boothOrderRepository.countByBoothIdAndCreatedAtBetween(eq(7L), any(), any())).thenReturn(1L);

        orderService = new OrderService(boothRepository, tableRepository, boothOrderRepository, streamService, new ObjectMapper());
    }

    @Test
    void 주문이_들어오면_그_테이블만_이용_중이_된다() {
        orderService.createOrder(7L, order("1번", "재훈"));

        assertThat(tableOne.isWalkInOccupied()).isTrue();
        assertThat(tableOne.getWalkInSince()).isNotNull();
        assertThat(tableTwo.isWalkInOccupied()).isFalse();
        verify(tableRepository).save(tableOne);
        verify(streamService).publishReservations(any());
    }

    @Test
    void 이미_이용_중이면_앉은_시각을_바꾸지_않는다() {
        LocalDateTime seatedAt = LocalDateTime.now().minusMinutes(40);
        tableOne.occupyWalkIn(seatedAt);

        orderService.createOrder(7L, order("1번", "재훈"));

        assertThat(tableOne.getWalkInSince()).isEqualTo(seatedAt);
        verify(tableRepository, never()).save(any(BoothReservationTable.class));
        verify(streamService, never()).publishReservations(any());
    }

    @Test
    void 포장_주문은_테이블_목록에_없어도_받고_자리를_차지하지_않는다() {
        assertThat(orderService.createOrder(7L, order("포장", "재훈")).tableLabel()).isEqualTo("포장");

        assertThat(tableOne.isWalkInOccupied()).isFalse();
        verify(tableRepository, never()).save(any(BoothReservationTable.class));
        assertThatThrownBy(() -> orderService.createOrder(7L, order("99번", "재훈")))
                .hasMessageContaining("없는 테이블");
    }

    @Test
    void 포장_주문은_처리_중인_주문이_많아도_막지_않는다() {
        List<BoothOrder> busy = java.util.stream.IntStream.range(0, 8)
                .mapToObj(index -> Mockito.mock(BoothOrder.class))
                .toList();
        Mockito.when(boothOrderRepository.findByBoothIdAndTableLabelAndStatusInOrderByCreatedAtAsc(eq(7L), any(), any()))
                .thenReturn(busy);

        assertThat(orderService.createOrder(7L, order("포장", "재훈")).tableLabel()).isEqualTo("포장");
        assertThatThrownBy(() -> orderService.createOrder(7L, order("1번", "재훈")))
                .hasMessageContaining("처리 중인 주문이 너무 많습니다");
    }

    private static OrderCreateRequestDto order(String tableLabel, String depositor) {
        return new OrderCreateRequestDto(
                tableLabel, List.of(new OrderCreateItemDto("논알콜 음료", 1)), depositor, null, null, PaymentMethod.BANK_TRANSFER);
    }

    private static void setId(Object target, Long id) throws Exception {
        Field field = target.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(target, id);
    }
}
