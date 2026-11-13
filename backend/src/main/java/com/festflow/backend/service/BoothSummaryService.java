package com.festflow.backend.service;

import com.festflow.backend.dto.OpsBoothSummaryDto;
import com.festflow.backend.dto.OpsBoothSummaryItemDto;
import com.festflow.backend.entity.BoothOrder;
import com.festflow.backend.entity.BoothOrderItem;
import com.festflow.backend.entity.BoothReservation;
import com.festflow.backend.entity.OrderStatus;
import com.festflow.backend.entity.ReservationStatus;
import com.festflow.backend.repository.BoothOrderRepository;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.repository.BoothReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * 부스 마감 정산. 하루 장사가 끝난 뒤 판매·예약 숫자를 한 번에 본다.
 * 주점은 자정을 넘겨 열므로 '영업일'은 그날 06:00 부터 다음 날 06:00 까지로 잡는다.
 */
@Service
public class BoothSummaryService {

    private static final int BUSINESS_DAY_START_HOUR = 6;

    private final BoothRepository boothRepository;
    private final BoothOrderRepository boothOrderRepository;
    private final BoothReservationRepository boothReservationRepository;

    public BoothSummaryService(
            BoothRepository boothRepository,
            BoothOrderRepository boothOrderRepository,
            BoothReservationRepository boothReservationRepository
    ) {
        this.boothRepository = boothRepository;
        this.boothOrderRepository = boothOrderRepository;
        this.boothReservationRepository = boothReservationRepository;
    }

    @Transactional(readOnly = true)
    public OpsBoothSummaryDto summarize(Long boothId, String dateText) {
        if (!boothRepository.existsById(boothId)) {
            throw new ResponseStatusException(NOT_FOUND, "부스를 찾을 수 없습니다.");
        }
        LocalDate date = resolveBusinessDate(dateText);
        LocalDateTime from = date.atTime(BUSINESS_DAY_START_HOUR, 0);
        LocalDateTime to = from.plusDays(1);

        List<BoothOrder> orders = boothOrderRepository
                .findByBoothIdAndCreatedAtAfterOrderByCreatedAtDesc(boothId, from.minusMinutes(1))
                .stream()
                .filter(order -> order.getCreatedAt() != null && order.getCreatedAt().isBefore(to))
                .toList();
        List<BoothOrder> completed = orders.stream().filter(order -> order.getStatus() == OrderStatus.COMPLETED).toList();
        List<BoothOrder> canceled = orders.stream().filter(order -> order.getStatus() == OrderStatus.CANCELED).toList();
        List<BoothOrder> paidLike = orders.stream()
                .filter(order -> order.getStatus() != OrderStatus.CANCELED && order.getStatus() != OrderStatus.PENDING_PAYMENT)
                .toList();
        long revenue = paidLike.stream().mapToLong(order -> order.getTotalAmount() == null ? 0 : order.getTotalAmount()).sum();
        long completedRevenue = completed.stream().mapToLong(order -> order.getTotalAmount() == null ? 0 : order.getTotalAmount()).sum();

        // 메뉴별 판매량(취소 제외)
        Map<String, long[]> byItem = new LinkedHashMap<>();
        for (BoothOrder order : paidLike) {
            for (BoothOrderItem item : order.getItems()) {
                long[] acc = byItem.computeIfAbsent(item.getName(), key -> new long[2]);
                int quantity = item.getQuantity() == null ? 0 : item.getQuantity();
                int unitPrice = item.getUnitPrice() == null ? 0 : item.getUnitPrice();
                acc[0] += quantity;
                acc[1] += (long) quantity * unitPrice;
            }
        }
        List<OpsBoothSummaryItemDto> topItems = byItem.entrySet().stream()
                .map(entry -> new OpsBoothSummaryItemDto(entry.getKey(), entry.getValue()[0], entry.getValue()[1]))
                .sorted(Comparator.comparingLong(OpsBoothSummaryItemDto::quantity).reversed())
                .limit(8)
                .toList();

        List<BoothReservation> reservations = boothReservationRepository.findByBoothIdAndReservedAtBetween(boothId, from, to);
        long checkedIn = reservations.stream()
                .filter(reservation -> reservation.getStatus() == ReservationStatus.CHECKED_IN || reservation.getStatus() == ReservationStatus.COMPLETED)
                .count();
        long noShow = reservations.stream().filter(reservation -> reservation.getStatus() == ReservationStatus.EXPIRED).count();
        long turns = reservations.stream().filter(reservation -> reservation.getStatus() == ReservationStatus.COMPLETED).count();
        double avgWait = reservations.stream()
                .filter(reservation -> reservation.getCheckedInAt() != null && reservation.getReservedAt() != null)
                .mapToLong(reservation -> Duration.between(reservation.getReservedAt(), reservation.getCheckedInAt()).toMinutes())
                .average()
                .orElse(0);

        // 시간대별 주문 수(피크 확인용)
        Map<String, Long> byHour = new LinkedHashMap<>();
        for (int hour = 0; hour < 24; hour++) {
            LocalDateTime slot = from.plusHours(hour);
            byHour.put(String.format("%02d", slot.getHour()), 0L);
        }
        for (BoothOrder order : orders) {
            String hour = String.format("%02d", order.getCreatedAt().getHour());
            byHour.merge(hour, 1L, Long::sum);
        }
        String peakHour = byHour.entrySet().stream()
                .filter(entry -> entry.getValue() > 0)
                .max(Map.Entry.comparingByValue())
                .map(entry -> entry.getKey() + "시")
                .orElse("");

        return new OpsBoothSummaryDto(
                date.toString(),
                from,
                to,
                orders.size(),
                completed.size(),
                canceled.size(),
                revenue,
                completedRevenue,
                topItems,
                reservations.size(),
                checkedIn,
                noShow,
                turns,
                Math.round(avgWait * 10) / 10.0,
                peakHour,
                byHour
        );
    }

    private LocalDate resolveBusinessDate(String dateText) {
        if (dateText != null && !dateText.isBlank()) {
            try {
                return LocalDate.parse(dateText.trim());
            } catch (DateTimeParseException ignored) {
                // 아래에서 오늘로
            }
        }
        LocalDateTime now = LocalDateTime.now();
        return now.getHour() < BUSINESS_DAY_START_HOUR ? now.toLocalDate().minusDays(1) : now.toLocalDate();
    }
}
