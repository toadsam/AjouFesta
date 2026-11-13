package com.festflow.backend.repository;

import com.festflow.backend.entity.BoothOrder;
import com.festflow.backend.entity.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BoothOrderRepository extends JpaRepository<BoothOrder, Long> {

    @EntityGraph(attributePaths = "items")
    List<BoothOrder> findByBoothIdAndCreatedAtAfterOrderByCreatedAtDesc(Long boothId, LocalDateTime after);

    /** 지난 주문 내역: 한 영업일(from 이상 to 미만) 주문을 시간순으로. */
    List<BoothOrder> findByBoothIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
            Long boothId, LocalDateTime from, LocalDateTime to);

    @EntityGraph(attributePaths = "items")
    List<BoothOrder> findByBoothIdAndStatusInOrderByCreatedAtAsc(Long boothId, List<OrderStatus> statuses);

    /** 한 테이블의 처리 중 주문만 읽는다. (부스 전체를 읽으면 주문이 쌓일수록 주문 한 건이 느려진다) */
    @EntityGraph(attributePaths = "items")
    List<BoothOrder> findByBoothIdAndTableLabelAndStatusInOrderByCreatedAtAsc(Long boothId, String tableLabel, List<OrderStatus> statuses);

    @EntityGraph(attributePaths = "items")
    Optional<BoothOrder> findWithItemsById(Long id);

    Optional<BoothOrder> findByIdAndBoothId(Long id, Long boothId);

    /**
     * 주문 행을 잠그고 읽는다. 주방 여럿이 같은 주문의 다른 줄을 동시에 '완료'해도 한 줄로 세워,
     * 마지막 줄이 끝나는 순간을 놓치지 않고 READY 로 올린다. 줄(items)은 잠근 뒤에 읽혀 최신이다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from BoothOrder o where o.id = :id and o.booth.id = :boothId")
    Optional<BoothOrder> findByIdAndBoothIdForUpdate(@Param("id") Long id, @Param("boothId") Long boothId);

    List<BoothOrder> findByBoothId(Long boothId);

    long countByBoothIdAndCreatedAtBetween(Long boothId, LocalDateTime from, LocalDateTime to);
}
