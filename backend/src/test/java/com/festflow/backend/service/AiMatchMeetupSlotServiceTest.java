package com.festflow.backend.service;

import com.festflow.backend.dto.AiMatchMeetupSlotDto;
import com.festflow.backend.dto.AiMatchMeetupSlotsDto;
import com.festflow.backend.entity.AiMatchMeetupSlot;
import com.festflow.backend.repository.AiMatchMeetupSlotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiMatchMeetupSlotServiceTest {

    // 늘 미래가 되도록 넉넉히 먼 날짜를 축제 날짜로 쓴다.
    private static final LocalDate DAY = LocalDate.now().plusYears(1);

    @Mock
    private AiMatchMeetupSlotRepository slotRepository;

    private AiMatchMeetupSlotService service;

    @BeforeEach
    void setUp() {
        service = new AiMatchMeetupSlotService(slotRepository, DAY + "," + DAY.plusDays(1), 30, 30, "");
    }

    @Test
    void 하루는_09시부터_21시40분까지_20분_슬롯_39개() {
        when(slotRepository.findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(any(), any())).thenReturn(List.of());

        AiMatchMeetupSlotsDto slots = service.getSlots(DAY.toString(), null);

        assertEquals(39, slots.slots().size());
        assertEquals(DAY.atTime(9, 0), slots.slots().get(0).startAt());
        assertEquals(DAY.atTime(21, 40), slots.slots().get(38).startAt());
        assertTrue(slots.slots().stream().allMatch(slot -> "FREE".equals(slot.status())));
    }

    @Test
    void 날짜별_운영_시간이_다르면_그_시간_안의_칸만_연다() {
        LocalDate day2 = DAY.plusDays(1);
        // 10/7 10:00~16:30 · 10/8 09:00~17:30 처럼 날짜마다 다르게. 마지막 칸은 닫는 시각 안에 끝나야 한다.
        AiMatchMeetupSlotService hours = new AiMatchMeetupSlotService(
                slotRepository, DAY + "," + day2, 30, 30, "", DAY + "=10:00-16:30," + day2 + "=09:00-17:30");
        when(slotRepository.findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(any(), any())).thenReturn(List.of());

        AiMatchMeetupSlotsDto first = hours.getSlots(DAY.toString(), null);
        assertEquals(19, first.slots().size());
        assertEquals(DAY.atTime(10, 0), first.slots().get(0).startAt());
        assertEquals(DAY.atTime(16, 0), first.slots().get(18).startAt()); // 16:20 칸은 16:40 에 끝나 못 연다
        assertEquals(19, hours.slotsPerDay(DAY));
        assertEquals(25, hours.slotsPerDay(day2));
        assertEquals(day2.atTime(17, 0).toLocalTime(), hours.lastSlotTime(day2));

        // 잡을 때도 같은 규칙
        when(slotRepository.findBySlotAt(any())).thenReturn(Optional.empty());
        when(slotRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        assertEquals(DAY.atTime(16, 0), hours.hold(7L, DAY.atTime(16, 0)).getSlotAt());
        ResponseStatusException late = assertThrows(ResponseStatusException.class, () -> hours.hold(7L, DAY.atTime(16, 20)));
        assertEquals(HttpStatus.BAD_REQUEST, late.getStatusCode());
        assertTrue(late.getReason().contains("10:00부터 16:00까지"));
        ResponseStatusException early = assertThrows(ResponseStatusException.class, () -> hours.hold(7L, DAY.atTime(9, 40)));
        assertEquals(HttpStatus.BAD_REQUEST, early.getStatusCode());

        // 잘못 적은 항목은 건너뛰고 기본 시간(09:00~22:00)
        assertEquals(39, new AiMatchMeetupSlotService(slotRepository, DAY.toString(), 30, 30, "", DAY + "=10시-16시").slotsPerDay(DAY));
    }

    @Test
    void 날짜별_남은_칸을_같이_준다() {
        AiMatchMeetupSlot held = new AiMatchMeetupSlot(DAY.atTime(14, 20), 7L, LocalDateTime.now().plusMinutes(20));
        AiMatchMeetupSlot taken = new AiMatchMeetupSlot(DAY.atTime(14, 40), 8L, null);
        when(slotRepository.findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(DAY.atTime(9, 0), DAY.atTime(22, 0)))
                .thenReturn(List.of(held, taken));
        when(slotRepository.findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(DAY.plusDays(1).atTime(9, 0), DAY.plusDays(1).atTime(22, 0)))
                .thenReturn(List.of());

        AiMatchMeetupSlotsDto slots = service.getSlots(DAY.toString(), null);

        assertEquals(30, slots.leadMinutes());
        assertEquals(2, slots.days().size());
        assertEquals(DAY.toString(), slots.days().get(0).date());
        assertEquals(39, slots.days().get(0).totalSlots());
        assertEquals(37, slots.days().get(0).freeSlots());
        assertEquals(1, slots.days().get(0).confirmedSlots());
        assertEquals(1, slots.days().get(0).heldSlots());
        assertEquals(39, slots.days().get(1).freeSlots());
    }

    @Test
    void 리허설_날짜는_지나면_빠지고_축제_날짜는_운영진_시간표에_남는다() {
        LocalDate today = LocalDate.now();
        LocalDate pastFestival = today.minusDays(3);
        LocalDate pastRehearsal = today.minusDays(5);
        LocalDate nextRehearsal = today.plusDays(2);
        AiMatchMeetupSlotService mixed = new AiMatchMeetupSlotService(
                slotRepository, pastFestival + "," + DAY, 30, 30, pastRehearsal + "," + nextRehearsal);
        when(slotRepository.findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(any(), any())).thenReturn(List.of());

        // 운영진: 지난 축제 날짜는 남고, 지난 리허설 날짜는 빠진다.
        assertEquals(List.of(pastFestival.toString(), nextRehearsal.toString(), DAY.toString()), mixed.getDates());
        // 참가자: 오늘부터만. 남은 칸도 그 날짜만 센다.
        AiMatchMeetupSlotsDto slots = mixed.getSlots("", null);
        assertEquals(List.of(nextRehearsal.toString(), DAY.toString()), slots.dates());
        assertEquals(nextRehearsal.toString(), slots.date());
        assertEquals(2, slots.days().size());
        // 리허설 날짜도 같은 규칙으로 잡힌다.
        when(slotRepository.findBySlotAt(any())).thenReturn(Optional.empty());
        when(slotRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        assertEquals(nextRehearsal.atTime(10, 0), mixed.hold(7L, nextRehearsal.atTime(10, 0)).getSlotAt());
    }

    @Test
    void 날짜가_모두_지났으면_참가자에게도_축제_날짜를_보여_준다() {
        LocalDate past = LocalDate.now().minusDays(3);
        AiMatchMeetupSlotService over = new AiMatchMeetupSlotService(slotRepository, past.toString(), 30, 30, past.minusDays(2).toString());

        assertEquals(List.of(past.toString()), over.getUpcomingDates());
    }

    @Test
    void 곧_시작하는_칸은_못_고른다() {
        LocalDateTime now = DAY.atTime(14, 5);

        assertTrue(AiMatchMeetupSlotService.isTooSoon(DAY.atTime(14, 0), now, 30));   // 지난 칸
        assertTrue(AiMatchMeetupSlotService.isTooSoon(DAY.atTime(14, 20), now, 30));  // 15분 뒤
        assertFalse(AiMatchMeetupSlotService.isTooSoon(DAY.atTime(14, 40), now, 30)); // 35분 뒤
        assertFalse(AiMatchMeetupSlotService.isTooSoon(DAY.atTime(14, 20), now, 0));  // 여유 시간을 끄면 바로 뒤 칸도 가능
    }

    @Test
    void 오늘_곧_시작하는_시간을_잡으면_400() {
        // 오늘을 축제 날짜로 두고, 지금 시각이 든 칸의 다음 칸(20분 안에 시작)을 잡아 본다.
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime nextCell = now.withSecond(0).withNano(0).withMinute(now.getMinute() / 20 * 20).plusMinutes(20);
        org.junit.jupiter.api.Assumptions.assumeTrue(
                nextCell.toLocalDate().equals(now.toLocalDate())
                        && !nextCell.toLocalTime().isBefore(AiMatchMeetupSlotService.OPEN_TIME)
                        && nextCell.toLocalTime().isBefore(AiMatchMeetupSlotService.CLOSE_TIME));
        AiMatchMeetupSlotService today = new AiMatchMeetupSlotService(slotRepository, now.toLocalDate().toString(), 30, 30, "");

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> today.hold(7L, nextCell));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(exception.getReason().contains("30분 뒤"));
        verify(slotRepository, never()).saveAndFlush(any());
    }

    @Test
    void 약속이_가까우면_임시_잠금이_약속_15분_전에_풀린다() {
        LocalDateTime now = DAY.atTime(14, 0);

        // 넉넉히 먼 약속: 30분 잠금
        assertEquals(DAY.atTime(14, 30), AiMatchMeetupSlotService.holdDeadline(now, DAY.atTime(18, 0), 30, 30));
        // 40분 뒤 약속: 30분을 다 기다리면 시작 10분 전이라, 15분 전(14:25)에 풀린다
        assertEquals(DAY.atTime(14, 25), AiMatchMeetupSlotService.holdDeadline(now, DAY.atTime(14, 40), 30, 30));
    }

    @Test
    void 임시_잠금은_HELD_확정은_TAKEN_내_슬롯은_mine() {
        AiMatchMeetupSlot held = new AiMatchMeetupSlot(DAY.atTime(14, 20), 7L, LocalDateTime.now().plusMinutes(20));
        AiMatchMeetupSlot taken = new AiMatchMeetupSlot(DAY.atTime(14, 40), 8L, null);
        when(slotRepository.findAllBySlotAtGreaterThanEqualAndSlotAtLessThanOrderBySlotAtAsc(any(), any())).thenReturn(List.of(held, taken));

        List<AiMatchMeetupSlotDto> slots = service.getSlots(DAY.toString(), 7L).slots();

        AiMatchMeetupSlotDto first = slots.stream().filter(slot -> slot.startAt().equals(DAY.atTime(14, 20))).findFirst().orElseThrow();
        AiMatchMeetupSlotDto second = slots.stream().filter(slot -> slot.startAt().equals(DAY.atTime(14, 40))).findFirst().orElseThrow();
        assertEquals("HELD", first.status());
        assertTrue(first.mine());
        assertEquals("TAKEN", second.status());
        assertFalse(second.mine());
    }

    @Test
    void 이미_잡힌_시간이면_409() {
        when(slotRepository.findBySlotAt(DAY.atTime(14, 20))).thenReturn(Optional.of(new AiMatchMeetupSlot(DAY.atTime(14, 20), 9L, null)));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.hold(7L, DAY.atTime(14, 20)));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(slotRepository, never()).saveAndFlush(any());
    }

    @Test
    void 확인과_저장_사이에_끼어들면_유니크_제약이_막고_409() {
        when(slotRepository.findBySlotAt(any())).thenReturn(Optional.empty());
        when(slotRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uk_ai_match_meetup_slot_at"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.hold(7L, DAY.atTime(14, 20)));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void 잡기_전에_만료된_잠금과_내_옛_슬롯을_치운다() {
        when(slotRepository.findBySlotAt(any())).thenReturn(Optional.empty());
        when(slotRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AiMatchMeetupSlot slot = service.hold(7L, DAY.atTime(10, 0));

        verify(slotRepository).deleteExpiredHolds(any());
        verify(slotRepository).deleteOrphans();
        verify(slotRepository).deleteByRequestIdNow(7L);
        assertFalse(slot.isConfirmed());
        assertTrue(slot.getHeldUntil().isAfter(LocalDateTime.now().plusMinutes(29)));
    }

    @Test
    void 슬롯이_아닌_시간은_400() {
        assertBadRequest(DAY.atTime(14, 15));          // 20분 단위 아님
        assertBadRequest(DAY.atTime(8, 40));           // 열기 전
        assertBadRequest(DAY.atTime(22, 0));           // 닫은 뒤
        assertBadRequest(DAY.plusDays(5).atTime(10, 0)); // 축제 날짜 아님
        assertBadRequest(null);
    }

    @Test
    void 잠금이_이미_풀렸으면_확정할_슬롯이_없다() {
        when(slotRepository.findByRequestId(7L)).thenReturn(Optional.empty());

        assertTrue(service.confirm(7L).isEmpty());
    }

    @Test
    void 확정하면_잠금_시각이_사라진다() {
        AiMatchMeetupSlot held = new AiMatchMeetupSlot(DAY.atTime(14, 20), 7L, LocalDateTime.now().plusMinutes(10));
        when(slotRepository.findByRequestId(7L)).thenReturn(Optional.of(held));

        assertTrue(service.confirm(7L).orElseThrow().isConfirmed());
    }

    private void assertBadRequest(LocalDateTime slotAt) {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.hold(7L, slotAt));
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }
}
