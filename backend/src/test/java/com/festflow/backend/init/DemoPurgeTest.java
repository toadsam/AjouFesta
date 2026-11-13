package com.festflow.backend.init;

import com.festflow.backend.entity.FestivalEvent;
import com.festflow.backend.entity.LostItem;
import com.festflow.backend.entity.Notice;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** 운영 DB 에서 지우는 시연용 분실물 · 시험 일정이 정확히 그것들만 골라지는지. */
class DemoPurgeTest {

    private LostItem item(String imageUrl, String reporterType, String reporterRef) {
        return new LostItem("검은색 가죽 지갑", "", "지갑", "본부", "", imageUrl, "REGISTERED", reporterType, reporterRef);
    }

    @Test
    void onlySeededLostItemsWithStockPhotosArePurged() {
        assertThat(DataInitializer.isDemoLostItem(item("https://images.pexels.com/photos/7085781/a.jpeg", "STAFF", "seed"))).isTrue();
        // 스태프가 같은 이름으로 올린 진짜 물건(사진은 우리 저장소)
        assertThat(DataInitializer.isDemoLostItem(item("/uploads/lost-item-1.jpg", "STAFF", "seed"))).isFalse();
        assertThat(DataInitializer.isDemoLostItem(item("https://images.pexels.com/photos/7085781/a.jpeg", "STAFF", "3"))).isFalse();
        assertThat(DataInitializer.isDemoLostItem(item(null, "STAFF", "seed"))).isFalse();
    }

    @Test
    void onlyDemoNoticesWithTheSameTitleAndContentArePurged() {
        assertThat(DataInitializer.isDemoNotice(new Notice("심야 귀가 셔틀 안내", "23시 이후 후문, 정문, 기숙사 방향 셔틀 대기열을 분산 운영합니다.", "안전", true))).isTrue();
        assertThat(DataInitializer.isDemoNotice(new Notice("운영 안내", "축제 현장 상황에 따라 부스 운영 시간과 공연 시작 시간이 조정될 수 있습니다.", "안내", false))).isTrue();
        // 운영진이 같은 제목으로 직접 쓴 공지는 남긴다.
        assertThat(DataInitializer.isDemoNotice(new Notice("심야 귀가 셔틀 안내", "23시 셔틀은 정문에서만 탑니다.", "안전", true))).isFalse();
        assertThat(DataInitializer.isDemoNotice(new Notice("우천 안내", "비가 와도 공연은 진행합니다.", "안내", true))).isFalse();
    }

    @Test
    void onlyTheTestEventOnItsDateIsPurged() {
        assertThat(DataInitializer.isTestEvent(new FestivalEvent("키키", LocalDateTime.of(2026, 9, 22, 1, 39), null, "SCHEDULED"))).isTrue();
        assertThat(DataInitializer.isTestEvent(new FestivalEvent("키키", LocalDateTime.of(2026, 10, 7, 18, 0), null, "SCHEDULED"))).isFalse();
        assertThat(DataInitializer.isTestEvent(new FestivalEvent("총학 주점", LocalDateTime.of(2026, 9, 22, 1, 39), null, "SCHEDULED"))).isFalse();
    }
}
