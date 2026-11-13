package com.festflow.backend.concurrency;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.BoothOrderDto;
import com.festflow.backend.dto.OrderCreateItemDto;
import com.festflow.backend.dto.OrderCreateRequestDto;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.PaymentMethod;
import com.festflow.backend.repository.BoothOrderRepository;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.repository.BoothReservationTableRepository;
import com.festflow.backend.service.OrderService;
import com.festflow.backend.service.stream.StreamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 같은 부스로 주문이 한꺼번에 몰릴 때를 실제 PostgreSQL 에서 겹쳐 본다.
 *
 * <p>왜 지금 썼나: 2026-10-07 축제 첫날 주문은 142건이었고 번호가 0001~0142 로 빈 번호 없이 이어졌다(주문 내역 CSV).
 * 그런데 가장 몰린 순간이 1분에 4건, 같은 초에 2건이었다. 그 주문량으로는 부스 행 잠금이 시험받지 않았다.
 * 이 테스트는 축제 뒤(2026-11)에 추가했고, 그날보다 훨씬 몰린 상황을 만들어 잠금이 하는 일을 확인한다.
 *
 * <p>주문번호는 "오늘 이 부스의 주문 수"로 만든다({@code OrderService.buildOrderNo}). 두 주문이 동시에 세면 같은 번호가 나온다.
 * 그래서 {@code createOrder} 는 부스 행을 잠그고 읽는다({@code BoothRepository.findByIdForUpdate}).
 * 마지막 테스트는 그 잠금만 뺀 대조군이다. 잠금이 없으면 실제로 겹친다는 것을 같은 조건에서 보인다.
 *
 * <p>가짜 객체로는 잠금이 걸리지 않으므로 Testcontainers 로 PostgreSQL 을 띄운다(운영 DB 가 PostgreSQL). Docker 가 필요하다.
 * 컨트롤러의 부스별 줄({@code OrderController} 의 ReentrantLock)은 여기 없다. 서버가 여러 대여도 남는 DB 잠금만 본다.
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        // 운영 기본값은 최소 주문 14,000원이다. 여기서는 금액이 아니라 겹침을 보므로 끈다.
        "app.order.min-amount=0",
        "spring.datasource.hikari.maximum-pool-size=24"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
@Import({OrderService.class, OrderConcurrencyTest.Beans.class})
// @DataJpaTest 는 테스트마다 트랜잭션을 걸고 되돌린다. 여기서는 스레드마다 진짜로 커밋해야 하므로 끈다.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class OrderConcurrencyTest {

    private static final int THREADS = 20;
    private static final String MENU = """
            [{"name":"대표 안주 세트","price":"12,000원","description":"","soldOut":false},
             {"name":"논알콜 음료","price":"3000원","description":"","soldOut":false}]
            """;

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @TestConfiguration
    static class Beans {
        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }

    @MockBean
    StreamService streamService;

    @Autowired
    OrderService orderService;
    @Autowired
    BoothRepository boothRepository;
    @Autowired
    BoothOrderRepository boothOrderRepository;
    @Autowired
    BoothReservationTableRepository tableRepository;
    @Autowired
    PlatformTransactionManager transactionManager;

    private Long boothId;

    @BeforeEach
    void setUp() {
        boothOrderRepository.deleteAll();
        boothRepository.deleteAll();
        Booth booth = new Booth("동시 주문 시험 주점", 37.28, 127.04, "시험", 1, "/img.jpg", 5, 10, null, null);
        booth.setMenuBoardJson(MENU);
        booth.updateOrderConfig(true, "국민 000-00-0000", "시험");
        boothId = boothRepository.save(booth).getId();
    }

    @Test
    void 주문_100건이_동시에_와도_주문번호가_겹치지_않는다() throws Exception {
        int orders = 100;
        List<Outcome> outcomes = runTogether(orders, i -> () -> orderService.createOrder(boothId, takeout(i)));

        List<String> numbers = outcomes.stream().filter(Outcome::ok).map(o -> o.dto().orderNo()).toList();
        Set<String> distinct = new HashSet<>(numbers);
        record("locked-100", orders, numbers.size(), distinct.size(), numbers.size() - distinct.size());

        assertThat(numbers).hasSize(orders);
        assertThat(distinct).hasSize(orders);
        // 빈 번호 없이 0001 ~ 0100
        assertThat(distinct).containsExactlyInAnyOrderElementsOf(
                IntStream.rangeClosed(1, orders).mapToObj(n -> String.format("%04d", n)).collect(Collectors.toSet()));
    }

    @Test
    void 한_테이블에_20건이_동시에_와도_처리_중인_주문은_다섯을_넘지_않는다() throws Exception {
        int orders = 20;
        List<Outcome> outcomes = runTogether(orders, i -> () -> orderService.createOrder(boothId, table("7번", i)));

        long accepted = outcomes.stream().filter(Outcome::ok).count();
        long refused = outcomes.stream().filter(o -> o.status() == 409).count();
        record("locked-table-cap", orders, (int) accepted, (int) accepted, 0);

        assertThat(accepted).isEqualTo(5);
        assertThat(refused).isEqualTo(orders - 5);
        assertThat(boothOrderRepository.count()).isEqualTo(5);
    }

    @Test
    void 같은_주문을_10번_동시에_눌러도_주문은_하나다() throws Exception {
        int presses = 10;
        OrderCreateRequestDto same = table("3번", 0);
        List<Outcome> outcomes = runTogether(presses, i -> () -> orderService.createOrder(boothId, same));

        Set<Long> ids = outcomes.stream().filter(Outcome::ok).map(o -> o.dto().id()).collect(Collectors.toSet());
        record("locked-double-press", presses, (int) outcomes.stream().filter(Outcome::ok).count(), ids.size(), 0);

        assertThat(outcomes).allMatch(Outcome::ok);
        assertThat(ids).hasSize(1);
        assertThat(boothOrderRepository.count()).isEqualTo(1);
    }

    /**
     * 대조군. 서비스 코드는 그대로 두고 부스 행 잠금만 뺀다({@code findByIdForUpdate} 를 {@code findById} 로 돌린다).
     * 잠금이 하는 일이 없다면 이 테스트도 번호가 겹치지 않아야 한다.
     */
    @Test
    void 대조군_잠금을_빼면_주문번호가_겹친다() throws Exception {
        int orders = 100;
        OrderService unlocked = new OrderService(withoutRowLock(boothRepository), tableRepository, boothOrderRepository,
                Mockito.mock(StreamService.class), new ObjectMapper());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        List<Outcome> outcomes = runTogether(orders,
                i -> () -> tx.execute(status -> unlocked.createOrder(boothId, takeout(i))));

        List<String> numbers = outcomes.stream().filter(Outcome::ok).map(o -> o.dto().orderNo()).toList();
        Set<String> distinct = new HashSet<>(numbers);
        int duplicated = numbers.size() - distinct.size();
        record("unlocked-100", orders, numbers.size(), distinct.size(), duplicated);

        assertThat(numbers).hasSize(orders);
        assertThat(duplicated).as("잠금 없이 동시에 세면 같은 번호가 나온다").isGreaterThan(0);
    }

    // ---------- 도구 ----------

    private record Outcome(BoothOrderDto dto, int status) {
        boolean ok() {
            return dto != null;
        }
    }

    private interface Job {
        Callable<BoothOrderDto> at(int index);
    }

    /** 스레드 20개가 같은 순간에 출발해 count 건을 넣는다. */
    private List<Outcome> runTogether(int count, Job job) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Outcome>> futures = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                Callable<BoothOrderDto> call = job.at(i);
                futures.add(pool.submit(() -> {
                    start.await();
                    try {
                        return new Outcome(call.call(), 200);
                    } catch (ResponseStatusException e) {
                        return new Outcome(null, e.getStatusCode().value());
                    }
                }));
            }
            start.countDown();
            List<Outcome> outcomes = new ArrayList<>();
            for (Future<Outcome> future : futures) {
                outcomes.add(future.get(60, TimeUnit.SECONDS));
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    /** 포장 주문. 테이블 한도가 없고, 입금자와 번호가 달라 서로 다른 주문으로 들어간다. */
    private static OrderCreateRequestDto takeout(int i) {
        return new OrderCreateRequestDto(OrderService.TAKEOUT_LABEL,
                List.of(new OrderCreateItemDto("대표 안주 세트", 1)),
                "손님" + i, String.format("010-0000-%04d", i), null, PaymentMethod.BANK_TRANSFER);
    }

    private static OrderCreateRequestDto table(String label, int i) {
        return new OrderCreateRequestDto(label,
                List.of(new OrderCreateItemDto("논알콜 음료", 2)),
                "손님" + i, String.format("010-0000-%04d", i), null, PaymentMethod.BANK_TRANSFER);
    }

    /** 잠그고 읽는 메서드만 잠그지 않는 조회로 돌린 저장소. 나머지는 그대로 넘긴다. */
    private static BoothRepository withoutRowLock(BoothRepository real) {
        return (BoothRepository) Proxy.newProxyInstance(
                BoothRepository.class.getClassLoader(),
                new Class<?>[]{BoothRepository.class},
                (proxy, method, args) -> {
                    try {
                        if (method.getName().equals("findByIdForUpdate")) {
                            return real.findById((Long) args[0]);
                        }
                        return method.invoke(real, args);
                    } catch (InvocationTargetException e) {
                        throw e.getCause();
                    }
                });
    }

    /** 결과를 한 줄씩 남긴다. 포트폴리오에 적는 숫자는 이 파일에서만 가져온다. */
    private static void record(String name, int sent, int accepted, int distinctNumbers, int duplicated) throws Exception {
        Path file = Path.of("build", "concurrency-results.tsv");
        Files.createDirectories(file.getParent());
        if (!Files.exists(file)) {
            Files.writeString(file, "case\tsent\taccepted\tdistinct\tduplicated\tthreads\n", StandardCharsets.UTF_8);
        }
        Files.writeString(file, String.join("\t", name, String.valueOf(sent), String.valueOf(accepted),
                String.valueOf(distinctNumbers), String.valueOf(duplicated), String.valueOf(THREADS)) + "\n",
                StandardCharsets.UTF_8, StandardOpenOption.APPEND);
    }
}
