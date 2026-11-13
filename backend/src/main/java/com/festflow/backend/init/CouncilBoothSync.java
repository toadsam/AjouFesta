package com.festflow.backend.init;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.BoothReservationTable;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 총학 주점 확정 정보(총학생회, 2026-09-30)를 서버 부스에 넣는다.
 * 운영시간 16:00~23:00 · 길찾기는 주점 본부(카페 안녕) · 테이블 1번~60번 · 입금 계좌 · 메뉴 4종(가격·구성·사진).
 *
 * 서버를 켤 때마다 불린다. 처음 한 번(테이블이 아직 1번~60번이 아니고 메뉴에 가격도 없을 때 · {@link #alreadyApplied})은 확정 정보를 그대로 넣고({@link #applyAll}),
 * 그 뒤로는 비어 있는 칸만 채운다({@link #fillBooth}). 그래서 운영 콘솔에서 고친 값(품절 표시, 바꾼 가격·사진, 시간, 계좌)은
 * 다시 배포해도 덮이지 않는다.
 * 화면 쪽 기본값은 frontend/src/config/festival.js 의 MAIN_BOOTH_FALLBACK — 바꿀 땐 양쪽을 같이 고친다.
 */
final class CouncilBoothSync {

    static final String NAME_KEYWORD = "총학";
    static final String DEFAULT_NAME = "총학생회 주점";
    static final String DESCRIPTION = "총학생회가 직접 여는 주점 · 주점 본부는 카페 안녕";
    /** 예전 기본 설명. 이 문구가 그대로면 새 설명으로 바꾼다. */
    static final String OLD_DESCRIPTION = "노천극장 옆, 총학생회가 직접 여는 주점";
    static final LocalTime OPEN_TIME = LocalTime.of(16, 0);
    static final LocalTime CLOSE_TIME = LocalTime.of(23, 0);
    /** 카페 안녕(수원시 영통구 월드컵로193번길 36). */
    static final double PLACE_LATITUDE = 37.27760004;
    static final double PLACE_LONGITUDE = 127.04439431;
    /** 시연용 부스가 쓰던 기본 좌표. 이 값이면 아직 위치를 안 잡은 것으로 본다. */
    static final double DEMO_LATITUDE = 37.2832;
    static final double DEMO_LONGITUDE = 127.0451;
    static final String BANK_ACCOUNT = "연습은행 000-0000-0000";
    static final String BANK_HOLDER = "예금주";
    static final int TABLE_COUNT = 60;
    /** 테이블당 자리 수는 전달받지 못해 4인으로 둔다. 운영 콘솔에서 고칠 수 있다. */
    static final int TABLE_SEATS = 4;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private CouncilBoothSync() {
    }

    static boolean isCouncilBooth(Booth booth) {
        return booth != null && booth.getName() != null && booth.getName().contains(NAME_KEYWORD);
    }

    static Booth newBooth(int displayOrder, LocalDateTime now) {
        Booth booth = new Booth(DEFAULT_NAME, PLACE_LATITUDE, PLACE_LONGITUDE, DESCRIPTION, displayOrder, "", 0, null, "", now);
        booth.updateContentInfo("주점", "야간", OPEN_TIME, CLOSE_TIME, null, null, true);
        return booth;
    }

    /**
     * 확정 정보를 그대로 넣는다(처음 한 번). 시험 삼아 넣어 둔 계좌·가격 없는 메뉴판·시연용 좌표를 모두 바꾼다.
     * 부스 이름·사진·대기 안내 문구는 건드리지 않는다.
     */
    static void applyAll(Booth booth) {
        booth.updateContentInfo(booth.getCategory(), booth.getDayPart(), OPEN_TIME, CLOSE_TIME,
                booth.getTags(), booth.getContentJson(), booth.getReservationEnabled());
        booth.update(
                booth.getName(),
                PLACE_LATITUDE,
                PLACE_LONGITUDE,
                DESCRIPTION,
                booth.getDisplayOrder(),
                booth.getImageUrl(),
                booth.getEstimatedWaitMinutes(),
                booth.getRemainingStock(),
                booth.getLiveStatusMessage(),
                booth.getLiveStatusUpdatedAt()
        );
        booth.updateOrderConfig(null, BANK_ACCOUNT, BANK_HOLDER);
        booth.setMenuBoardJson(menuBoardJson());
    }

    /** 테이블이 이미 1번~ 으로 맞춰져 있으면 확정 정보가 한 번 들어간 것이다. */
    static boolean isNumbered(List<BoothReservationTable> existing) {
        return existing.stream().anyMatch(table -> tableName(1).equals(table.getTableName()));
    }

    /**
     * 확정 정보가 이미 한 번 들어갔는지. 테이블 "1번" 만 보면, 운영 콘솔에서 1번 테이블 이름을 바꾸거나 지운 뒤
     * 다시 배포할 때 메뉴(품절 · 가격) · 계좌 · 테이블이 통째로 처음 값으로 돌아간다.
     * 가격이 적힌 메뉴판도 '이미 들어갔다'로 본다(처음 넣을 때 가격을 채우고, 그 뒤엔 운영진이 고친 값이다).
     */
    static boolean alreadyApplied(Booth booth, List<BoothReservationTable> existing) {
        return isNumbered(existing) || hasPricedMenu(booth.getMenuBoardJson());
    }

    /** 부스의 빈 칸을 확정 정보로 채운다(두 번째부터). 바뀐 게 있으면 true. */
    static boolean fillBooth(Booth booth) {
        boolean changed = false;

        if (booth.getOpenTime() == null && booth.getCloseTime() == null) {
            booth.updateContentInfo(booth.getCategory(), booth.getDayPart(), OPEN_TIME, CLOSE_TIME,
                    booth.getTags(), booth.getContentJson(), booth.getReservationEnabled());
            changed = true;
        }

        String description = booth.getDescription() == null ? "" : booth.getDescription().trim();
        boolean staleDescription = description.isEmpty() || description.equals(OLD_DESCRIPTION);
        boolean demoLocation = Math.abs(booth.getLatitude() - DEMO_LATITUDE) < 1e-6
                && Math.abs(booth.getLongitude() - DEMO_LONGITUDE) < 1e-6;
        if (staleDescription || demoLocation) {
            booth.update(
                    booth.getName(),
                    demoLocation ? PLACE_LATITUDE : booth.getLatitude(),
                    demoLocation ? PLACE_LONGITUDE : booth.getLongitude(),
                    staleDescription ? DESCRIPTION : booth.getDescription(),
                    booth.getDisplayOrder(),
                    booth.getImageUrl(),
                    booth.getEstimatedWaitMinutes(),
                    booth.getRemainingStock(),
                    booth.getLiveStatusMessage(),
                    booth.getLiveStatusUpdatedAt()
            );
            changed = true;
        }

        if (booth.getBankAccount() == null || booth.getBankAccount().isBlank()) {
            booth.updateOrderConfig(null, BANK_ACCOUNT, BANK_HOLDER);
            changed = true;
        }

        if (!hasPricedMenu(booth.getMenuBoardJson())) {
            booth.setMenuBoardJson(menuBoardJson());
            changed = true;
        }
        return changed;
    }

    /**
     * 테이블을 1번~60번으로 맞춘다. 이미 "1번" 이 있으면 손대지 않는다(운영진이 고친 뒤).
     * 지우면 옛 예약 기록이 걸리므로, 있던 테이블은 이름만 바꿔 다시 쓰고 모자란 만큼 새로 만든다.
     *
     * @return 저장할 테이블(바뀐 것 + 새로 만든 것). 할 일이 없으면 빈 목록.
     */
    static List<BoothReservationTable> numberedTables(Booth booth, List<BoothReservationTable> existing) {
        if (isNumbered(existing)) {
            return List.of();
        }
        List<BoothReservationTable> toSave = new ArrayList<>();
        for (int number = 1; number <= TABLE_COUNT; number++) {
            if (number <= existing.size()) {
                BoothReservationTable table = existing.get(number - 1);
                table.update(tableName(number), TABLE_SEATS, TABLE_SEATS, number);
                toSave.add(table);
            } else {
                toSave.add(new BoothReservationTable(booth, tableName(number), TABLE_SEATS, TABLE_SEATS, number));
            }
        }
        return toSave;
    }

    static String tableName(int number) {
        return number + "번";
    }

    /** 가격이 하나라도 적힌 메뉴판이면 운영진이 이미 채운 것으로 본다. */
    static boolean hasPricedMenu(String menuBoardJson) {
        if (menuBoardJson == null || menuBoardJson.isBlank()) {
            return false;
        }
        try {
            List<Map<String, Object>> rows = OBJECT_MAPPER.readValue(menuBoardJson, new TypeReference<>() {
            });
            return rows.stream().anyMatch(row -> row != null && row.get("price") != null
                    && !String.valueOf(row.get("price")).isBlank());
        } catch (Exception e) {
            // 읽을 수 없는 메뉴판은 고쳐 쓴다.
            return false;
        }
    }

    static String menuBoardJson() {
        List<Map<String, Object>> rows = List.of(
                menuItem("삼겹살/볶음김치 SET", "9,000원", "삼겹살 400g · 볶음김치 100g", "/images/booths/menu/samgyeopsal-kimchi.webp"),
                menuItem("두부김치", "7,000원", "두부 300g · 김치 400g", "/images/booths/menu/dubu-kimchi.webp"),
                menuItem("짜파게티/볶음김치 SET", "7,000원", "짜파게티 2개 · 볶음김치 100g", "/images/booths/menu/jjapaghetti-kimchi.webp"),
                menuItem("어묵탕", "5,000원", "어묵 336g · 물 500ml", "/images/booths/menu/eomuk-tang.webp")
        );
        try {
            return OBJECT_MAPPER.writeValueAsString(rows);
        } catch (Exception e) {
            throw new IllegalStateException("총학 주점 메뉴판을 만들지 못했습니다.", e);
        }
    }

    private static Map<String, Object> menuItem(String name, String price, String description, String imageUrl) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("price", price);
        row.put("description", description);
        row.put("soldOut", false);
        row.put("imageUrl", imageUrl);
        return row;
    }
}
