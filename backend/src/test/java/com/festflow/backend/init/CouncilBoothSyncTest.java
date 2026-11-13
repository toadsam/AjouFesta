package com.festflow.backend.init;

import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.BoothReservationTable;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CouncilBoothSyncTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 1, 9, 0);

    /** 운영 서버에 있던 모습: 시간 없음, 시연용 좌표, 가격 없는 메뉴 5개, 계좌 없음. */
    private Booth unfilledBooth() {
        Booth booth = new Booth("총학생회 주점", CouncilBoothSync.DEMO_LATITUDE, CouncilBoothSync.DEMO_LONGITUDE,
                CouncilBoothSync.OLD_DESCRIPTION, 63, "", 10, null, "", NOW);
        booth.updateContentInfo("주점", "야간", null, null, null, null, true);
        booth.setMenuBoardJson("[{\"name\":\"삼겹살 볶음김치 쌈장\",\"price\":\"\",\"description\":\"삼겹살 400g\",\"soldOut\":false,\"imageUrl\":\"\"}]");
        return booth;
    }

    @Test
    void fillsEveryEmptyFieldWithCouncilInfo() {
        Booth booth = unfilledBooth();

        assertThat(CouncilBoothSync.fillBooth(booth)).isTrue();

        assertThat(booth.getOpenTime()).isEqualTo(LocalTime.of(16, 0));
        assertThat(booth.getCloseTime()).isEqualTo(LocalTime.of(23, 0));
        assertThat(booth.getLatitude()).isEqualTo(CouncilBoothSync.PLACE_LATITUDE);
        assertThat(booth.getLongitude()).isEqualTo(CouncilBoothSync.PLACE_LONGITUDE);
        assertThat(booth.getDescription()).isEqualTo(CouncilBoothSync.DESCRIPTION);
        assertThat(booth.getBankAccount()).isEqualTo(CouncilBoothSync.BANK_ACCOUNT);
        assertThat(booth.getBankHolder()).isEqualTo(CouncilBoothSync.BANK_HOLDER);
        assertThat(booth.getMenuBoardJson())
                .contains("삼겹살/볶음김치 SET", "9,000원", "두부김치", "7,000원", "짜파게티/볶음김치 SET", "어묵탕", "5,000원")
                .contains("/images/booths/menu/eomuk-tang.webp")
                .doesNotContain("쌈장", "묵 김치");
    }

    @Test
    void firstRunOverwritesPlaceholdersWithCouncilInfo() {
        // 운영 서버에 시험 삼아 넣어 둔 계좌·시간이 있어도 처음 한 번은 확정 정보가 그대로 들어간다.
        Booth booth = unfilledBooth();
        booth.updateContentInfo("주점", "야간", LocalTime.of(18, 0), LocalTime.of(1, 0), null, null, true);
        booth.updateOrderConfig(true, "지호 1234-1234", "아주대총학생회");

        CouncilBoothSync.applyAll(booth);

        assertThat(booth.getName()).isEqualTo("총학생회 주점");
        assertThat(booth.getOpenTime()).isEqualTo(LocalTime.of(16, 0));
        assertThat(booth.getCloseTime()).isEqualTo(LocalTime.of(23, 0));
        assertThat(booth.getLatitude()).isEqualTo(CouncilBoothSync.PLACE_LATITUDE);
        assertThat(booth.getDescription()).isEqualTo(CouncilBoothSync.DESCRIPTION);
        assertThat(booth.getBankAccount()).isEqualTo(CouncilBoothSync.BANK_ACCOUNT);
        assertThat(booth.getBankHolder()).isEqualTo(CouncilBoothSync.BANK_HOLDER);
        assertThat(booth.isOrderEnabled()).isTrue();
        assertThat(booth.getMenuBoardJson()).contains("삼겹살/볶음김치 SET", "9,000원", "어묵탕", "5,000원");
        // 넣은 뒤에는 더 채울 칸이 없다.
        assertThat(CouncilBoothSync.fillBooth(booth)).isFalse();
    }

    @Test
    void numberedTablesMarkTheFirstRunAsDone() {
        Booth booth = unfilledBooth();
        assertThat(CouncilBoothSync.isNumbered(List.of(new BoothReservationTable(booth, "입구 4인석", 4, 4, 1)))).isFalse();
        assertThat(CouncilBoothSync.isNumbered(CouncilBoothSync.numberedTables(booth, List.of()))).isTrue();
    }

    @Test
    void secondRunChangesNothing() {
        Booth booth = unfilledBooth();
        CouncilBoothSync.fillBooth(booth);

        assertThat(CouncilBoothSync.fillBooth(booth)).isFalse();
    }

    @Test
    void keepsWhatStaffAlreadySet() {
        Booth booth = unfilledBooth();
        booth.updateContentInfo("주점", "야간", LocalTime.of(17, 0), LocalTime.of(22, 0), null, null, true);
        booth.updateOrderConfig(true, "신한 110-000-000000", "총학생회");
        String staffMenu = "[{\"name\":\"어묵탕\",\"price\":\"6,000원\",\"description\":\"\",\"soldOut\":true,\"imageUrl\":\"\"}]";
        booth.setMenuBoardJson(staffMenu);

        CouncilBoothSync.fillBooth(booth);

        assertThat(booth.getOpenTime()).isEqualTo(LocalTime.of(17, 0));
        assertThat(booth.getCloseTime()).isEqualTo(LocalTime.of(22, 0));
        assertThat(booth.getBankAccount()).isEqualTo("신한 110-000-000000");
        assertThat(booth.getBankHolder()).isEqualTo("총학생회");
        assertThat(booth.getMenuBoardJson()).isEqualTo(staffMenu);
    }

    @Test
    void renamesExistingTablesAndAddsUpToSixty() {
        Booth booth = unfilledBooth();
        BoothReservationTable first = new BoothReservationTable(booth, "입구 4인석", 4, 4, 1);
        BoothReservationTable second = new BoothReservationTable(booth, "단체석", 6, 2, 2);

        List<BoothReservationTable> tables = CouncilBoothSync.numberedTables(booth, List.of(first, second));

        assertThat(tables).hasSize(60);
        assertThat(tables.get(0)).isSameAs(first);
        assertThat(tables.get(1)).isSameAs(second);
        assertThat(second.getTableName()).isEqualTo("2번");
        assertThat(second.getTotalSeats()).isEqualTo(4);
        assertThat(second.getAvailableSeats()).isEqualTo(4);
        assertThat(tables).extracting(BoothReservationTable::getTableName)
                .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, 60).mapToObj(n -> n + "번").toList());
        assertThat(tables).extracting(BoothReservationTable::getDisplayOrder)
                .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, 60).boxed().toList());
    }

    @Test
    void staffRenamingTableOneDoesNotRestartTheFirstRun() {
        Booth booth = unfilledBooth();
        CouncilBoothSync.applyAll(booth);
        List<BoothReservationTable> renamed = List.of(
                new BoothReservationTable(booth, "A-1", 4, 4, 1),
                new BoothReservationTable(booth, "2번", 4, 4, 2)
        );

        assertThat(CouncilBoothSync.alreadyApplied(booth, renamed)).isTrue();
        assertThat(CouncilBoothSync.alreadyApplied(booth, List.of())).isTrue();
        assertThat(CouncilBoothSync.alreadyApplied(unfilledBooth(), List.of())).isFalse();
    }

    @Test
    void leavesTablesAloneOnceNumbered() {
        Booth booth = unfilledBooth();
        List<BoothReservationTable> existing = List.of(
                new BoothReservationTable(booth, "1번", 6, 6, 1),
                new BoothReservationTable(booth, "2번", 4, 4, 2)
        );

        assertThat(CouncilBoothSync.numberedTables(booth, existing)).isEmpty();
    }

    @Test
    void newBoothStartsWithCouncilHoursAndPlace() {
        Booth booth = CouncilBoothSync.newBooth(50, NOW);

        assertThat(CouncilBoothSync.isCouncilBooth(booth)).isTrue();
        assertThat(booth.getOpenTime()).isEqualTo(LocalTime.of(16, 0));
        assertThat(booth.getLatitude()).isEqualTo(CouncilBoothSync.PLACE_LATITUDE);
        assertThat(CouncilBoothSync.fillBooth(booth)).isTrue();
        assertThat(booth.getBankAccount()).isEqualTo(CouncilBoothSync.BANK_ACCOUNT);
    }
}
