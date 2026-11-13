package com.festflow.backend.init;

import com.festflow.backend.entity.AdminUser;
import com.festflow.backend.entity.Booth;
import com.festflow.backend.entity.BoothReservation;
import com.festflow.backend.entity.BoothReservationTable;
import com.festflow.backend.entity.FestivalEvent;
import com.festflow.backend.entity.GpsLog;
import com.festflow.backend.entity.LostItem;
import com.festflow.backend.entity.Notice;
import com.festflow.backend.entity.ReservationStatus;
import com.festflow.backend.entity.StaffMember;
import com.festflow.backend.entity.StaffStatus;
import com.festflow.backend.repository.AdminUserRepository;
import com.festflow.backend.repository.BoothRepository;
import com.festflow.backend.repository.BoothReservationRepository;
import com.festflow.backend.repository.BoothReservationTableRepository;
import com.festflow.backend.repository.EventRepository;
import com.festflow.backend.repository.GpsLogRepository;
import com.festflow.backend.repository.LostItemRepository;
import com.festflow.backend.repository.NoticeRepository;
import com.festflow.backend.repository.StaffMemberRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.UUID;

@Configuration
public class DataInitializer {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(DataInitializer.class);

    private static final List<String> STAFF_NAMES = List.of(
            "강승완",
            "고나연",
            "고명범",
            "곽유나",
            "박종현",
            "권도희",
            "권태완",
            "김규민",
            "김나윤",
            "김민서",
            "김정연",
            "김정우",
            "김찬호",
            "김하은",
            "늑구",
            "맹쥰성",
            "정재훈"
    );

    @Value("${app.init.admin.username:}")
    private String initialAdminUsername;

    @Value("${app.init.admin.password:}")
    private String initialAdminPassword;

    @Value("${app.init.simple-demo-credentials:false}")
    private boolean simpleDemoCredentials;

    /**
     * true 면 시연용 데이터(가짜 부스 48개 · 공지 · 분실물 · 테이블 · 예약 · 위치 기록)를 없으면 다시 채운다.
     * 운영(prod)에서는 끈다 — 지운 시연용 데이터가 다시 배포할 때 돌아오지 않게. 총학 주점 · 타임테이블 · 관리자 계정은 이 값과 상관없이 맞춘다.
     */
    @Value("${app.init.demo-data:true}")
    private boolean demoData;

    /** true 면 시연용 공연(지금 시각 기준으로 생기는 가짜 일정)을 같이 넣는다. 실제 축제에서는 끈다. */
    @Value("${app.init.demo-events:false}")
    private boolean demoEvents;

    /** 예전 시연용 공연 제목. 실제 타임테이블을 넣으면서 이 제목의 일정은 지운다. */
    private static final Set<String> DEMO_EVENT_TITLES = Set.of(
            "오프닝 공연", "밴드 라이브", "댄스팀 쇼케이스", "DJ 피날레",
            "오프닝 퍼레이드", "버스킹 릴레이", "응원단 합동 무대", "인디밴드 쇼케이스", "DJ 나이트", "폐막 불꽃 카운트다운",
            "재즈 버스킹", "댄스 배틀 예선", "동아리 랜덤 플레이댄스", "심야 어쿠스틱", "셔틀 막차 안내 방송",
            // 예전 시연용 라인업(오늘 날짜로 계속 밀리던 가짜 공연)
            "득근득근 포징 공연", "하츠투하트", "베이비몬스터", "데이식스", "이즈나", "에스파", "엔플라잉",
            "밴드 연습실", "DJ Awesome", "에일리", "싸이", "하이키"
    );

    @Bean
    public CommandLineRunner seedData(
            BoothRepository boothRepository,
            EventRepository eventRepository,
            AdminUserRepository adminUserRepository,
            NoticeRepository noticeRepository,
            LostItemRepository lostItemRepository,
            StaffMemberRepository staffMemberRepository,
            BoothReservationTableRepository reservationTableRepository,
            BoothReservationRepository reservationRepository,
            GpsLogRepository gpsLogRepository,
            PasswordEncoder passwordEncoder
    ) {
        return args -> {
            LocalDateTime now = LocalDateTime.now();

            if (demoData) {
                List<Booth> demoBooths = seedBooths(now);
                if (boothRepository.count() == 0) {
                    boothRepository.saveAll(demoBooths);
                } else {
                    seedMissingDemoBooths(boothRepository, demoBooths);
                }
                seedMissingDemoBooths(boothRepository, seedScenarioBooths(now));
                seedMissingDemoBooths(boothRepository, seedMoreScenarioBooths(now));
                normalizeCorruptedDemoBooths(boothRepository, now);
            }
            // 총학 주점 확정 정보(운영시간·위치·계좌·메뉴·테이블 1~60번). 처음 한 번은 그대로 넣고, 그 뒤로는 빈 칸만 채운다.
            syncCouncilBooth(boothRepository, reservationTableRepository, now);

            // 2026 가을축제 "바람" 타임테이블(총학 확정본). 시연용 공연은 지우고, 없는 일정만 채운다(제목+날짜 기준이라 다시 켜도 중복 없음).
            syncBaramSchedule(eventRepository);
            if (demoEvents) {
                seedMissingDemoEvents(eventRepository, seedScenarioEvents(now));
                seedMissingDemoEvents(eventRepository, seedMoreScenarioEvents(now));
                refreshStaleDemoEvents(eventRepository, now);
            } else {
                // 정리는 덤이다. 실패해도 서버는 떠야 한다.
                try {
                    purgeTestEvents(eventRepository);
                } catch (RuntimeException e) {
                    log.warn("Test event purge failed.", e);
                }
            }

            // 공지는 손님 첫 화면에 바로 뜨는 운영진 글이라 서버가 넣지 않는다. 시연 데이터를 켠 서버(운영 포함)에서도
            // 예전에 넣었던 시연용 공지는 지운다 — 운영진이 지워도 배포할 때마다 되살아나 첫 화면 공지 칸을 차지했다.
            try {
                purgeDemoNotices(noticeRepository);
            } catch (RuntimeException e) {
                log.warn("Demo notice purge failed.", e);
            }
            // 분실물은 손님이 보고 실제로 본부를 찾아오는 탭이라, 시연 데이터를 켠 서버(운영 포함)에서도 가짜 물건을 넣지 않고 남은 것은 지운다.
            try {
                purgeDemoLostItems(lostItemRepository);
            } catch (RuntimeException e) {
                log.warn("Demo lost item purge failed.", e);
            }

            seedInitialAdmin(adminUserRepository, passwordEncoder);

            List<Booth> booths = boothRepository.findAll().stream()
                    .sorted(Comparator.comparing(Booth::getDisplayOrder))
                    .toList();
            if (staffMemberRepository.count() == 0) {
                staffMemberRepository.saveAll(seedStaff(booths, passwordEncoder, simpleDemoCredentials));
            } else if (simpleDemoCredentials) {
                syncDemoStaff(staffMemberRepository, booths, passwordEncoder);
            } else {
                hardenSimpleStaffCredentials(staffMemberRepository, passwordEncoder);
            }
            if (demoData) {
                seedDemoReservationTables(reservationTableRepository, booths);
                seedDemoReservations(reservationRepository, reservationTableRepository, booths, now);
                seedDemoGpsLogs(gpsLogRepository, booths);
                seedMoreScenarioTables(reservationTableRepository, booths);
                normalizeDemoReservationTableNames(reservationTableRepository);
                seedMoreScenarioReservations(reservationRepository, reservationTableRepository, booths, now);
                seedMoreScenarioGpsLogs(gpsLogRepository, booths);
            }
        };
    }

    private List<Booth> seedBooths(LocalDateTime now) {
        return List.of(
                booth("공과대학 주점", 37.2832, 127.0451, "공과대학 학생회가 운영하는 야간 주점입니다.", 1, 7, 120, "대표 메뉴 판매 중", now, "주점", "야간", "18:00", "01:00", "주류, 안주, 야간", true),
                booth("소프트웨어학과 주점", 37.2822, 127.0455, "게임 콘셉트로 꾸민 주점입니다.", 2, 8, 70, "주문 처리 원활", now, "주점", "야간", "18:00", "01:00", "주류, 게임", true),
                booth("닭강정 푸드트럭", 37.2817, 127.0447, "닭강정과 감자튀김을 판매하는 먹거리 부스입니다.", 3, 4, 90, "바로 주문 가능", now, "푸드", "상시", "11:00", "23:30", "간식, 포장", false),
                booth("타코야키 스테이션", 37.2829, 127.0428, "따뜻한 타코야키와 음료를 제공합니다.", 4, 8, 55, "10분 단위 조리 중", now, "푸드", "야간", "17:00", "00:30", "일식, 인기", false),
                booth("VR 리듬 챌린지", 37.2830, 127.0441, "VR 리듬 게임을 체험하고 랭킹에 도전하는 부스입니다.", 5, 6, 30, "2인 체험 가능", now, "체험", "주간", "12:00", "20:00", "VR, 랭킹", false),
                booth("AI 캐리커처", 37.2822, 127.0449, "현장 사진으로 AI 캐리커처 이미지를 만드는 체험 부스입니다.", 6, 9, 40, "출력 대기 있음", now, "체험", "상시", "13:00", "22:00", "AI, 포토", false),
                booth("스탬프 미션 센터", 37.2819, 127.0436, "축제 구역을 돌며 스탬프를 모으는 이벤트 접수처입니다.", 7, 2, 200, "기념품 여유", now, "이벤트", "주간", "10:00", "19:00", "미션, 경품", false),
                booth("공식 굿즈샵", 37.2834, 127.0443, "티셔츠, 스티커, 응원봉 등 축제 공식 굿즈를 판매합니다.", 8, 3, 45, "인기 상품 재입고", now, "굿즈", "상시", "11:00", "22:00", "굿즈, 기념품", false),
                booth("종합 안내 데스크", 37.2816, 127.0440, "행사 위치, 분실물, 시간 변경을 안내하는 중앙 데스크입니다.", 9, 1, 999, "상시 안내 가능", now, "안내", "상시", "10:00", "01:00", "안내, 분실물", false),
                booth("응급 케어 스팟", 37.2820, 127.0427, "간단한 응급 처치와 휴식 공간을 제공하는 안전 부스입니다.", 10, 0, 999, "생수 및 휴식 가능", now, "응급", "상시", "10:00", "01:00", "응급, 휴식", false),
                booth("분실물 보관소", 37.2814, 127.0438, "습득물 접수, 보관, 본인 확인 후 반환을 처리하는 분실물 전용 부스입니다.", 11, 1, 999, "접수 및 반환 가능", now, "분실물", "상시", "10:00", "01:00", "분실물, 보관, 반환", false),
                booth("네컷 포토존", 37.2826, 127.0432, "축제 프레임으로 사진을 남길 수 있는 포토 부스입니다.", 12, 5, 80, "대기줄 짧음", now, "포토존", "상시", "11:00", "23:00", "사진, 추억, 포토카드", false),
                booth("야광 팔찌 만들기", 37.2828, 127.0447, "야간 공연 전 직접 야광 팔찌를 만드는 체험 부스입니다.", 13, 6, 65, "재료 여유", now, "체험", "야간", "16:00", "23:30", "공예, 야광, 체험", false),
                booth("청년 플리마켓", 37.2818, 127.0450, "학생 셀러가 직접 만든 소품과 중고 굿즈를 판매하는 마켓입니다.", 14, 3, 110, "셀러 8팀 운영 중", now, "플리마켓", "주간", "11:00", "18:00", "소품, 굿즈, 마켓", false),
                booth("모바일 충전 스테이션", 37.2831, 127.0435, "보조배터리 대여와 휴대폰 급속 충전을 지원하는 편의 부스입니다.", 15, 2, 24, "C타입 케이블 여유", now, "편의", "상시", "10:00", "01:00", "충전, 대여, 편의", false),
                booth("미니 게임 존", 37.2815, 127.0446, "다트, 링토스, 랜덤 미션을 즐기고 경품을 받을 수 있는 게임 부스입니다.", 16, 4, 150, "경품 지급 중", now, "게임", "상시", "12:00", "22:00", "게임, 경품, 미션", false)
        );
    }

    private List<Booth> seedScenarioBooths(LocalDateTime now) {
        return List.of(
                booth("청춘 분식 연구소", 37.2824, 127.0458, "떡볶이, 순대, 김말이처럼 회전율이 빠른 분식 메뉴를 판매합니다.", 17, 12, 85, "떡볶이 2판 조리 중", now.minusMinutes(4), "푸드", "상시", "11:00", "23:30", "분식, 떡볶이, 빠른주문", false),
                booth("달빛 칵테일 바", 37.2835, 127.0450, "무알콜 칵테일과 과일 에이드를 함께 판매하는 야간 부스입니다.", 18, 28, 32, "피크 시간 진입, 주문 대기 증가", now.minusMinutes(2), "주점", "야간", "18:00", "01:00", "주점, 무알콜, 에이드", true),
                booth("제로웨이스트 리필샵", 37.2812, 127.0449, "텀블러 세척, 생수 리필, 다회용기 대여를 지원하는 친환경 부스입니다.", 19, 3, 180, "텀블러 세척 가능", now.minusMinutes(8), "편의", "상시", "10:00", "23:00", "친환경, 리필, 텀블러", false),
                booth("동아리 굿즈 플리마켓", 37.2811, 127.0454, "동아리별 스티커, 키링, 포스터를 판매하는 플리마켓입니다.", 20, 16, 58, "인기 키링 재고 절반 이하", now.minusMinutes(6), "굿즈", "주간", "11:00", "19:00", "굿즈, 키링, 포스터", false),
                booth("향수 블렌딩 클래스", 37.2827, 127.0456, "취향 설문을 기반으로 나만의 향을 만드는 체험형 부스입니다.", 21, 22, 20, "예약자 우선 입장 중", now.minusMinutes(1), "체험", "상시", "12:00", "22:00", "체험, 향수, 클래스", true),
                booth("AI 운세 사진관", 37.2830, 127.0460, "사진과 짧은 문답을 바탕으로 오늘의 축제 운세 카드를 생성합니다.", 22, 18, 44, "이미지 생성 대기 3팀", now.minusMinutes(3), "체험", "상시", "13:00", "23:00", "AI, 사진, 카드", false),
                booth("캠퍼스 방탈출", 37.2819, 127.0459, "QR 단서를 따라 캠퍼스를 이동하며 문제를 해결하는 팀 미션입니다.", 23, 35, 12, "다음 회차 마감 임박", now.minusMinutes(5), "이벤트", "상시", "12:00", "21:00", "미션, 방탈출, QR", true),
                booth("심야 라면 포차", 37.2836, 127.0440, "공연 종료 후 몰리는 라면, 어묵, 주먹밥 야식 부스입니다.", 24, 40, 26, "라면 주문 집중, 30분 뒤 완화 예상", now.minusMinutes(2), "푸드", "야간", "20:00", "02:00", "야식, 라면, 어묵", true),
                booth("잔디광장 피크닉존", 37.2823, 127.0431, "돗자리 대여와 휴식 안내를 제공하는 피크닉 편의 구역입니다.", 25, 1, 90, "돗자리 여유 있음", now.minusMinutes(12), "편의", "상시", "10:00", "23:00", "휴식, 돗자리, 피크닉", false),
                booth("응원봉 대여소", 37.2833, 127.0437, "공연 관람용 응원봉과 야광 팔찌를 대여합니다.", 26, 14, 34, "공연 전 대여 수요 증가", now.minusMinutes(7), "굿즈", "야간", "16:00", "23:30", "공연, 응원봉, 대여", false),
                booth("글로벌 푸드트럭", 37.2820, 127.0462, "타코, 팟타이, 케밥을 한 곳에서 맛볼 수 있는 푸드트럭 라인입니다.", 27, 24, 60, "타코 라인 혼잡, 케밥 라인 여유", now.minusMinutes(4), "푸드", "상시", "11:30", "00:00", "타코, 팟타이, 케밥", true),
                booth("조용한 상담 텐트", 37.2813, 127.0434, "분실, 안전, 귀가 동선 상담을 조용히 받을 수 있는 운영 지원 텐트입니다.", 28, 0, 999, "상담 가능", now.minusMinutes(10), "안내", "상시", "10:00", "01:00", "상담, 귀가, 안전", false)
        );
    }

    private List<FestivalEvent> seedScenarioEvents(LocalDateTime now) {
        return List.of(
                event("오프닝 퍼레이드", now.plusMinutes(10), now.plusMinutes(35), "곧 시작", "정문에서 잔디광장까지 이동형 공연이 진행됩니다.", 0),
                event("버스킹 릴레이", now.plusMinutes(55), now.plusMinutes(95), "예정", "동아리 4팀이 이어서 공연합니다.", 0),
                event("응원단 합동 무대", now.plusHours(2), now.plusHours(2).plusMinutes(35), "예정", "무대 앞 혼잡이 예상되어 10분 전 입장을 권장합니다.", 0),
                event("인디밴드 쇼케이스", now.plusHours(3), now.plusHours(3).plusMinutes(50), "예정", "메인 스테이지 야간 공연입니다.", 0),
                event("DJ 나이트", now.plusHours(4).plusMinutes(30), now.plusHours(5).plusMinutes(20), "예정", "공연 종료 후 푸드존 혼잡이 증가할 수 있습니다.", 0),
                event("폐막 불꽃 카운트다운", now.plusHours(6), now.plusHours(6).plusMinutes(20), "예정", "잔디광장과 후문 방향 귀가 동선 분산이 필요합니다.", 0)
        );
    }

    private FestivalEvent event(String title, LocalDateTime startTime, LocalDateTime endTime, String status, String liveMessage, Integer delayMinutes) {
        FestivalEvent event = new FestivalEvent(title, startTime, endTime, status, null, null, "center");
        event.update(title, startTime, endTime, null, null, "center", status, liveMessage, delayMinutes);
        return event;
    }

    private void seedMissingDemoEvents(EventRepository eventRepository, List<FestivalEvent> demoEvents) {
        Set<String> existingTitles = eventRepository.findAll().stream()
                .map(FestivalEvent::getTitle)
                .collect(java.util.stream.Collectors.toSet());
        List<FestivalEvent> missingEvents = demoEvents.stream()
                .filter(event -> !existingTitles.contains(event.getTitle()))
                .toList();
        if (!missingEvents.isEmpty()) {
            eventRepository.saveAll(missingEvents);
        }
    }

    private void refreshStaleDemoEvents(EventRepository eventRepository, LocalDateTime now) {
        List<FestivalEvent> events = eventRepository.findAll().stream()
                .sorted(Comparator.comparing(FestivalEvent::getStartTime))
                .toList();
        if (events.isEmpty()) {
            return;
        }

        boolean hasActiveOrUpcomingEvent = events.stream()
                .anyMatch(event -> event.getEndTime() != null && !event.getEndTime().isBefore(now));
        if (hasActiveOrUpcomingEvent) {
            return;
        }

        LocalDateTime base = now.withSecond(0).withNano(0);
        int[] minuteOffsets = {10, 55, 120, 180, 270, 360, 25, 90, 150};
        List<FestivalEvent> refreshed = new ArrayList<>();
        for (int i = 0; i < events.size(); i++) {
            FestivalEvent event = events.get(i);
            if ("\uCDE8\uC18C".equals(event.getStatus()) || "\uCDE8\uC18C".equals(event.getStatusOverride())) {
                continue;
            }

            long durationMinutes = 40;
            if (event.getStartTime() != null && event.getEndTime() != null && event.getEndTime().isAfter(event.getStartTime())) {
                durationMinutes = Math.max(20, Math.min(90, Duration.between(event.getStartTime(), event.getEndTime()).toMinutes()));
            }
            int dayOffset = i / minuteOffsets.length;
            int minuteOffset = minuteOffsets[i % minuteOffsets.length];
            LocalDateTime startTime = base.plusDays(dayOffset).plusMinutes(minuteOffset);
            LocalDateTime endTime = startTime.plusMinutes(durationMinutes);
            event.update(
                    event.getTitle(),
                    startTime,
                    endTime,
                    event.getImageUrl(),
                    event.getImageCredit(),
                    event.getImageFocus(),
                    null,
                    event.getLiveMessage(),
                    event.getDelayMinutes()
            );
            event.setStatus("\uC608\uC815");
            refreshed.add(event);
        }

        if (!refreshed.isEmpty()) {
            eventRepository.saveAll(refreshed);
        }
    }

    private List<Booth> seedMoreScenarioBooths(LocalDateTime now) {
        return List.of(
                booth("아이스티 리필 바", 37.28255, 127.04635, "더운 시간대에 빠르게 이용할 수 있는 음료 리필 부스입니다.", 29, 0, 250, "대기 거의 없음, 컵 재고 충분", now.minusMinutes(1), "푸드", "상시", "10:00", "23:00", "음료, 리필, 빠른회전", false),
                booth("치즈 닭갈비 화덕존", 37.28375, 127.04535, "화덕 조리 메뉴라 맛은 좋지만 피크 시간 대기가 길어지는 부스입니다.", 30, 45, 18, "조리 병목 발생, 2개 라인 중 1개만 운영", now.minusMinutes(2), "푸드", "야간", "17:00", "01:00", "닭갈비, 화덕, 야식", true),
                booth("비건 샌드위치 트럭", 37.28175, 127.04645, "비건 샌드위치와 샐러드를 판매하는 저혼잡 푸드트럭입니다.", 31, 4, 90, "샌드위치 즉시 제공 가능", now.minusMinutes(3), "푸드", "상시", "11:00", "22:00", "비건, 샌드위치, 샐러드", false),
                booth("크레페 디저트랩", 37.28295, 127.04655, "크레페와 아이스크림을 판매하지만 일부 메뉴 재고가 소진된 디저트 부스입니다.", 32, 20, 0, "딸기 크레페 품절, 재입고 대기", now.minusMinutes(4), "푸드", "상시", "12:00", "23:30", "디저트, 크레페, 품절", true),
                booth("타로 상담 부스", 37.28145, 127.04585, "짧은 타로 상담을 받을 수 있는 소규모 체험 부스입니다.", 33, 8, 70, "상담사 2명 운영, 회전 안정", now.minusMinutes(5), "체험", "상시", "12:00", "22:00", "타로, 상담, 체험", true),
                booth("페이스페인팅 스튜디오", 37.28215, 127.0466, "공연 전 얼굴 스티커와 페이스페인팅을 받을 수 있는 부스입니다.", 34, 15, 35, "공연 전 수요 증가", now.minusMinutes(2), "체험", "상시", "13:00", "23:00", "페이스페인팅, 스티커, 사진", false),
                booth("즉석 노래방 박스", 37.28315, 127.0459, "친구들과 1곡씩 부르는 미니 노래방 체험 부스입니다.", 35, 33, 22, "한 팀당 이용 시간이 길어 대기 증가", now.minusMinutes(1), "체험", "야간", "16:00", "01:00", "노래방, 체험, 친구", true),
                booth("보드게임 라운지", 37.28195, 127.04395, "대기 중 쉬면서 보드게임을 즐길 수 있는 실내형 체험 공간입니다.", 36, 9, 50, "2인 게임 테이블 여유", now.minusMinutes(7), "체험", "상시", "11:00", "23:00", "보드게임, 휴식, 실내", true),
                booth("캡스톤 전시관", 37.28095, 127.04465, "학생 프로젝트와 AI 데모를 둘러볼 수 있는 전시형 체험 부스입니다.", 37, 2, 120, "AI 데모 3종 상시 시연", now.minusMinutes(8), "체험", "주간", "10:00", "20:00", "AI, 전시, 캡스톤", false),
                booth("학생회 굿즈 럭키박스", 37.28355, 127.04325, "랜덤 굿즈 박스를 판매하는 인기 부스입니다. 재고가 빠르게 줄고 있습니다.", 38, 30, 6, "럭키박스 6개 남음, 구매 제한 필요", now.minusMinutes(2), "굿즈", "상시", "11:00", "22:00", "굿즈, 럭키박스, 재고부족", false),
                booth("포토카드 교환소", 37.28165, 127.04325, "축제 포토카드를 교환하고 인증 스탬프를 받을 수 있는 부스입니다.", 39, 11, 100, "교환 대기 보통", now.minusMinutes(6), "굿즈", "상시", "11:00", "23:00", "포토카드, 스탬프, 굿즈", false),
                booth("민속놀이 마당", 37.28085, 127.04535, "투호, 딱지, 윷놀이를 짧게 즐길 수 있는 가족형 이벤트 부스입니다.", 40, 5, 160, "경품 충분, 바로 참여 가능", now.minusMinutes(4), "이벤트", "주간", "10:00", "19:00", "민속놀이, 경품, 이벤트", false),
                booth("댄스 배틀존", 37.28385, 127.04375, "참가 신청자와 관객이 함께 몰리는 이벤트형 공연 구역입니다.", 41, 26, 80, "관객 밀집 증가, 스태프 유도 필요", now.minusMinutes(1), "공연", "야간", "18:00", "23:00", "댄스, 공연, 이벤트", false),
                booth("재즈 버스킹 코너", 37.28075, 127.04375, "소규모 버스킹 공연을 가까이서 볼 수 있는 여유 공연 구역입니다.", 42, 3, 999, "좌석 여유, 조용한 관람 가능", now.minusMinutes(9), "공연", "상시", "15:00", "22:00", "재즈, 버스킹, 공연", false),
                booth("소리없는 쉼터", 37.28055, 127.04425, "소음에 지친 방문객이 잠시 쉴 수 있는 저자극 휴식 공간입니다.", 43, 0, 999, "좌석 여유", now.minusMinutes(12), "편의", "상시", "10:00", "01:00", "휴식, 저자극, 쉼터", false),
                booth("의무실 응급처치", 37.28245, 127.04245, "간단한 응급 처치와 상태 확인을 받을 수 있는 안전 거점입니다.", 44, 0, 999, "응급 처치 가능, 대기 없음", now.minusMinutes(2), "응급", "상시", "10:00", "01:00", "응급, 안전, 의무실", false),
                booth("친구찾기 만남존", 37.28105, 127.04375, "일행을 잃어버렸을 때 재집결할 수 있는 만남 안내 구역입니다.", 45, 1, 999, "대기 인원 적음", now.minusMinutes(4), "안내", "상시", "10:00", "01:00", "만남, 안내, 재집결", false),
                booth("우천 대피 텐트", 37.2809, 127.04405, "비가 올 때 대피할 수 있는 임시 텐트와 우비 배부 지점입니다.", 46, 0, 300, "우비 300개 확보", now.minusMinutes(15), "편의", "상시", "10:00", "01:00", "우천, 대피, 우비", false),
                booth("후문 셔틀 안내소", 37.28065, 127.04605, "귀가 셔틀 시간과 대기열을 안내하는 후문 거점입니다.", 47, 2, 999, "22시 이후 혼잡 예상", now.minusMinutes(3), "안내", "야간", "18:00", "01:30", "셔틀, 귀가, 후문", false),
                booth("학과 홍보 퀴즈존", 37.28275, 127.04295, "학과별 퀴즈를 풀고 작은 기념품을 받는 홍보형 체험 부스입니다.", 48, 13, 75, "퀴즈 참여 안정, 기념품 충분", now.minusMinutes(6), "체험", "주간", "10:00", "19:00", "학과, 퀴즈, 홍보", false)
        );
    }

    private List<FestivalEvent> seedMoreScenarioEvents(LocalDateTime now) {
        return List.of(
                event("재즈 버스킹", now.plusMinutes(25), now.plusMinutes(55), "예정", "잔디광장 옆 소규모 공연이라 혼잡도가 낮습니다.", 0),
                event("댄스 배틀 예선", now.plusHours(1), now.plusHours(1).plusMinutes(45), "예정", "관객이 배틀존으로 몰릴 수 있어 주변 동선 관리가 필요합니다.", 0),
                event("동아리 랜덤 플레이댄스", now.plusHours(2).plusMinutes(20), now.plusHours(3), "예정", "참여형 공연으로 스테이지 전면 체류 시간이 길어질 수 있습니다.", 0),
                event("심야 어쿠스틱", now.plusHours(5).plusMinutes(40), now.plusHours(6).plusMinutes(10), "예정", "DJ 이후 분산 관람을 유도하는 저혼잡 공연입니다.", 0),
                event("셔틀 막차 안내 방송", now.plusHours(6).plusMinutes(30), now.plusHours(6).plusMinutes(40), "예정", "후문 셔틀 안내소 주변 일시 혼잡이 예상됩니다.", 0)
        );
    }

    private void seedInitialAdmin(AdminUserRepository adminUserRepository, PasswordEncoder passwordEncoder) {
        if (initialAdminUsername == null
                || initialAdminPassword == null
                || initialAdminUsername.isBlank()
                || initialAdminPassword.isBlank()) {
            return;
        }

        String username = initialAdminUsername.trim();
        String encodedPassword = passwordEncoder.encode(initialAdminPassword);
        adminUserRepository.findByUsername(username).ifPresentOrElse(
                admin -> {
                    admin.updatePassword(encodedPassword);
                    adminUserRepository.save(admin);
                },
                () -> adminUserRepository.save(new AdminUser(username, encodedPassword, "ADMIN"))
        );
    }

    private void syncCouncilBooth(BoothRepository boothRepository, BoothReservationTableRepository tableRepository, LocalDateTime now) {
        Booth booth = boothRepository.findAll().stream()
                .filter(CouncilBoothSync::isCouncilBooth)
                .min(Comparator.comparing(Booth::getDisplayOrder, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
        if (booth == null) {
            int nextOrder = boothRepository.findTopByOrderByDisplayOrderDesc()
                    .map(Booth::getDisplayOrder)
                    .orElse(0) + 1;
            booth = boothRepository.save(CouncilBoothSync.newBooth(nextOrder, now));
        }
        List<BoothReservationTable> existingTables = tableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(booth.getId());
        if (CouncilBoothSync.alreadyApplied(booth, existingTables)) {
            // 두 번째부터는 빈 칸만 채운다. 테이블(이름 · 개수)은 운영진이 고친 그대로 둔다.
            if (CouncilBoothSync.fillBooth(booth)) {
                boothRepository.save(booth);
            }
            return;
        }
        CouncilBoothSync.applyAll(booth);
        boothRepository.save(booth);
        List<BoothReservationTable> tables = CouncilBoothSync.numberedTables(booth, existingTables);
        if (!tables.isEmpty()) {
            tableRepository.saveAll(tables);
        }
    }

    private void seedMissingDemoBooths(BoothRepository boothRepository, List<Booth> demoBooths) {
        Set<String> existingNames = boothRepository.findAll().stream()
                .map(Booth::getName)
                .collect(java.util.stream.Collectors.toSet());
        int nextOrder = boothRepository.findTopByOrderByDisplayOrderDesc()
                .map(Booth::getDisplayOrder)
                .orElse(0) + 1;

        for (Booth booth : demoBooths) {
            if (!existingNames.contains(booth.getName())) {
                booth.setDisplayOrder(nextOrder++);
                boothRepository.save(booth);
            }
        }
    }

    private void normalizeCorruptedDemoBooths(BoothRepository boothRepository, LocalDateTime now) {
        List<Booth> corruptedBooths = boothRepository.findAll().stream()
                .filter(booth -> isUnreadableText(booth.getName()) || isUnreadableText(booth.getDescription()))
                .toList();
        if (corruptedBooths.isEmpty()) {
            return;
        }
        for (Booth booth : corruptedBooths) {
            String category = booth.getCategory() == null ? "" : booth.getCategory();
            String liveMessage = isUnreadableText(booth.getLiveStatusMessage())
                    ? "샘플 데이터 복구 완료, 정상 운영 중"
                    : booth.getLiveStatusMessage();
            booth.update(
                    replacementBoothName(category, booth.getDisplayOrder()),
                    booth.getLatitude(),
                    booth.getLongitude(),
                    replacementBoothDescription(category),
                    booth.getDisplayOrder(),
                    booth.getImageUrl(),
                    booth.getEstimatedWaitMinutes(),
                    booth.getRemainingStock(),
                    liveMessage,
                    now
            );
        }
        boothRepository.saveAll(corruptedBooths);
    }

    private boolean isUnreadableText(String value) {
        if (value == null) {
            return false;
        }
        String trimmed = value.trim();
        return trimmed.matches("\\?{2,}") || trimmed.contains("????");
    }

    private String replacementBoothName(String category, Integer displayOrder) {
        if (category.contains("주점")) {
            return "캠퍼스 야간주점";
        }
        if (category.contains("푸드") || category.contains("음식")) {
            return "캠퍼스 푸드부스";
        }
        if (category.contains("체험")) {
            return "캠퍼스 체험부스";
        }
        return "축제 부스 " + (displayOrder == null ? "" : displayOrder);
    }

    private String replacementBoothDescription(String category) {
        if (category.contains("주점")) {
            return "축제 야간 시간대에 운영되는 주점 부스입니다.";
        }
        if (category.contains("푸드") || category.contains("음식")) {
            return "빠르게 식사와 간식을 이용할 수 있는 먹거리 부스입니다.";
        }
        if (category.contains("체험")) {
            return "방문객이 짧게 참여할 수 있는 체험형 부스입니다.";
        }
        return "축제 현장에서 운영 중인 샘플 부스입니다.";
    }

    private Booth booth(String name, double latitude, double longitude, String description, Integer displayOrder,
                        Integer estimatedWaitMinutes, Integer remainingStock, String liveStatusMessage,
                        LocalDateTime liveStatusUpdatedAt, String category, String dayPart, String openTime,
                        String closeTime, String tags, Boolean reservationEnabled) {
        Booth booth = new Booth(
                name,
                latitude,
                longitude,
                description,
                displayOrder,
                "https://picsum.photos/seed/festflow-" + displayOrder + "/800/450",
                estimatedWaitMinutes,
                remainingStock,
                liveStatusMessage,
                liveStatusUpdatedAt
        );
        booth.updateContentInfo(category, dayPart, LocalTime.parse(openTime), LocalTime.parse(closeTime), tags, null, reservationEnabled);
        booth.setBoothIntro(description + " 운영시간은 " + openTime + "부터 " + closeTime + "까지입니다.");
        booth.setMenuBoardJson(seedMenuBoardJson(category, displayOrder));
        return booth;
    }

    private String seedMenuBoardJson(String category, Integer displayOrder) {
        return switch (category) {
            case "주점" -> """
                    [{"name":"대표 안주 세트","price":"12000원","description":"현장 인기 메뉴 조합","soldOut":false},{"name":"논알콜 음료","price":"3000원","description":"누구나 주문 가능","soldOut":false},{"name":"오늘의 한정 메뉴","price":"9000원","description":"재고 소진 시 마감","soldOut":false}]
                    """.trim();
            case "푸드", "음식" -> """
                    [{"name":"대표 메뉴","price":"7000원","description":"빠르게 받을 수 있는 기본 메뉴","soldOut":false},{"name":"사이드 메뉴","price":"4000원","description":"간단히 나눠 먹기 좋음","soldOut":false},{"name":"세트 메뉴","price":"10000원","description":"음료 포함","soldOut":false}]
                    """.trim();
            case "굿즈", "플리마켓" -> """
                    [{"name":"기념 스티커","price":"2000원","description":"축제 한정 디자인","soldOut":false},{"name":"랜덤 굿즈","price":"5000원","description":"현장 수량 한정","soldOut":false},{"name":"패키지 세트","price":"12000원","description":"인기 상품 묶음","soldOut":false}]
                    """.trim();
            case "체험", "게임", "포토존" -> """
                    [{"name":"기본 체험권","price":"3000원","description":"1회 참여","soldOut":false},{"name":"2인 체험권","price":"5000원","description":"친구와 함께 참여","soldOut":false},{"name":"기념 출력","price":"2000원","description":"결과물 추가 출력","soldOut":false}]
                    """.trim();
            default -> "[{\"name\":\"현장 안내\",\"price\":\"무료\",\"description\":\"스태프에게 문의하세요\",\"soldOut\":false},{\"name\":\"긴급 도움\",\"price\":\"무료\",\"description\":\"필요 시 즉시 지원\",\"soldOut\":false},{\"name\":\"위치 문의\",\"price\":\"무료\",\"description\":\"주요 부스와 공연장 안내\",\"soldOut\":false}]";
        };
    }

    /**
     * 시연용 공연은 지우고, 타임테이블({@link BaramSchedule})에 맞춘다.
     * 확정 내용이 바뀐 일정은 예전 기본값 그대로인 것만 고치고, DB 에 없는 일정(제목 + 날짜)만 새로 넣는다. 운영진이 고친 값은 건드리지 않는다.
     */
    private void syncBaramSchedule(EventRepository eventRepository) {
        List<FestivalEvent> existing = eventRepository.findAll();
        // 시연용 공연과, 손님 일정에서 뺀 것("주간부스 세팅" · 안 하기로 한 "체육대회")은 지운다.
        List<FestivalEvent> demo = existing.stream()
                .filter(item -> DEMO_EVENT_TITLES.contains(item.getTitle()) || BaramSchedule.isDropped(item))
                .toList();
        if (!demo.isEmpty()) {
            eventRepository.deleteAll(demo);
        }
        List<FestivalEvent> current = existing.stream()
                .filter(item -> !demo.contains(item))
                .toList();
        List<FestivalEvent> changed = BaramSchedule.applyConfirmedChanges(current);
        if (!changed.isEmpty()) {
            eventRepository.saveAll(changed);
        }
        List<FestivalEvent> missing = BaramSchedule.missing(current);
        if (!missing.isEmpty()) {
            eventRepository.saveAll(missing);
        }
    }

    /** 예전 시연 데이터가 넣던 공지. 제목과 내용이 둘 다 똑같은 것만 시연용으로 본다(운영진이 같은 제목으로 다시 쓴 공지는 남긴다). */
    private static final List<Notice> DEMO_NOTICES = List.of(
            new Notice("운영 안내", "축제 현장 상황에 따라 부스 운영 시간과 공연 시작 시간이 조정될 수 있습니다.", "안내", true),
                new Notice("AI 혼잡 예측 안내", "현재 푸드존과 심야 라면 포차 주변 혼잡 위험이 높습니다. 30분 뒤 방문하거나 글로벌 푸드트럭 케밥 라인을 이용해 주세요.", "혼잡", true),
                new Notice("공연 전 동선 분산 요청", "응원단 합동 무대 시작 20분 전부터 메인 스테이지 앞 진입이 제한될 수 있습니다.", "공연", true),
                new Notice("분실물 센터 위치 안내", "분실물 접수와 반환은 종합 안내 데스크와 조용한 상담 텐트에서 가능합니다.", "분실물", true),
                new Notice("우천 대비 운영 변경", "비가 오면 향수 블렌딩 클래스와 AI 운세 사진관은 학생회관 1층으로 이동합니다.", "안내", true),
            new Notice("심야 귀가 셔틀 안내", "23시 이후 후문, 정문, 기숙사 방향 셔틀 대기열을 분산 운영합니다.", "안전", true)
    );

    private void purgeDemoNotices(NoticeRepository noticeRepository) {
        List<Notice> demo = noticeRepository.findAll().stream()
                .filter(DataInitializer::isDemoNotice)
                .toList();
        if (!demo.isEmpty()) {
            noticeRepository.deleteAll(demo);
            log.info("Demo notices purged: {}", demo.size());
        }
    }

    static boolean isDemoNotice(Notice notice) {
        return DEMO_NOTICES.stream().anyMatch(demo ->
                demo.getTitle().equals(notice.getTitle()) && demo.getContent().equals(notice.getContent()));
    }

    private void seedDemoReservationTables(BoothReservationTableRepository tableRepository, List<Booth> booths) {
        if (tableRepository.count() > 0) {
            return;
        }
        List<BoothReservationTable> tables = new ArrayList<>();
        booths.stream()
                .filter(booth -> Boolean.TRUE.equals(booth.getReservationEnabled()))
                .limit(10)
                .forEach(booth -> {
                    int base = booth.getDisplayOrder() == null ? 0 : booth.getDisplayOrder();
                    tables.add(new BoothReservationTable(booth, demoTableName(1, 4), 4, base % 3 == 0 ? 0 : 4, 1));
                    tables.add(new BoothReservationTable(booth, demoTableName(2, 4), 4, base % 4 == 0 ? 1 : 4, 2));
                    tables.add(new BoothReservationTable(booth, demoTableName(3, 2), 2, base % 5 == 0 ? 0 : 2, 3));
                });
        if (!tables.isEmpty()) {
            tableRepository.saveAll(tables);
        }
    }

    private void seedDemoReservations(
            BoothReservationRepository reservationRepository,
            BoothReservationTableRepository tableRepository,
            List<Booth> booths,
            LocalDateTime now
    ) {
        if (reservationRepository.count() > 0) {
            return;
        }
        List<BoothReservation> reservations = new ArrayList<>();
        int userNo = 1;
        // 총학 주점은 실제 운영 부스라 시연용 예약을 넣지 않는다.
        for (Booth booth : booths.stream().filter(booth -> Boolean.TRUE.equals(booth.getReservationEnabled()) && !CouncilBoothSync.isCouncilBooth(booth)).limit(8).toList()) {
            List<BoothReservationTable> tables = tableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(booth.getId());
            for (int i = 0; i < Math.min(2, tables.size()); i++) {
                BoothReservation reservation = new BoothReservation(
                        booth,
                        tables.get(i),
                        "demo-user-" + userNo++,
                        i == 0 ? 4 : 2,
                        ReservationStatus.RESERVED,
                        now.minusMinutes(5 + userNo * 2L),
                        now.plusMinutes(10 + userNo * 3L)
                );
                if ((booth.getDisplayOrder() + i) % 4 == 0) {
                    reservation.markCheckedIn(now.minusMinutes(2 + i));
                }
                reservations.add(reservation);
            }
            if (tables.size() > 2 && booth.getDisplayOrder() % 3 == 0) {
                BoothReservation completed = new BoothReservation(
                        booth,
                        tables.get(2),
                        "demo-history-" + userNo++,
                        2,
                        ReservationStatus.RESERVED,
                        now.minusMinutes(70),
                        now.minusMinutes(50)
                );
                completed.markCompleted();
                reservations.add(completed);
            }
        }
        if (!reservations.isEmpty()) {
            reservationRepository.saveAll(reservations);
        }
    }

    private void seedDemoGpsLogs(GpsLogRepository gpsLogRepository, List<Booth> booths) {
        if (gpsLogRepository.count() > 0) {
            return;
        }
        List<GpsLog> logs = new ArrayList<>();
        booths.stream()
                .filter(booth -> booth.getDisplayOrder() != null)
                .filter(booth -> booth.getDisplayOrder() <= 28)
                .forEach(booth -> {
                    int weight = switch (booth.getDisplayOrder() % 6) {
                        case 0 -> 9;
                        case 1 -> 5;
                        case 2 -> 7;
                        case 3 -> 2;
                        case 4 -> 11;
                        default -> 4;
                    };
                    for (int i = 0; i < weight; i++) {
                        double offset = (i % 5 - 2) * 0.000025;
                        logs.add(new GpsLog(booth.getLatitude() + offset, booth.getLongitude() - offset));
                    }
                });
        if (!logs.isEmpty()) {
            gpsLogRepository.saveAll(logs);
        }
    }

    private void seedMoreScenarioTables(BoothReservationTableRepository tableRepository, List<Booth> booths) {
        booths.stream()
                .filter(booth -> Boolean.TRUE.equals(booth.getReservationEnabled()))
                .forEach(booth -> {
                    if (!tableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(booth.getId()).isEmpty()) {
                        return;
                    }
                    int order = booth.getDisplayOrder() == null ? 1 : booth.getDisplayOrder();
                    int availabilityPattern = order % 5;
                    tableRepository.saveAll(List.of(
                            new BoothReservationTable(booth, demoTableName(1, 4), 4, availabilityPattern == 0 ? 0 : 4, 1),
                            new BoothReservationTable(booth, demoTableName(2, 4), 4, availabilityPattern <= 1 ? 1 : 4, 2),
                            new BoothReservationTable(booth, demoTableName(3, 2), 2, availabilityPattern == 2 ? 0 : 2, 3),
                            new BoothReservationTable(booth, demoTableName(4, 6), 6, availabilityPattern == 3 ? 2 : 6, 4)
                    ));
                });
    }

    private void normalizeDemoReservationTableNames(BoothReservationTableRepository tableRepository) {
        List<BoothReservationTable> generatedTables = tableRepository.findAll().stream()
                .filter(table -> isGeneratedTableName(table.getTableName()))
                .toList();
        if (generatedTables.isEmpty()) {
            return;
        }
        generatedTables.forEach(table -> table.update(
                demoTableName(table.getDisplayOrder(), table.getTotalSeats()),
                table.getTotalSeats(),
                table.getAvailableSeats(),
                table.getDisplayOrder()
        ));
        tableRepository.saveAll(generatedTables);
    }

    private boolean isGeneratedTableName(String tableName) {
        return tableName != null
                && (tableName.matches("[ABC]-\\d+")
                || tableName.matches("T-\\d+-\\d+")
                || tableName.matches("Table \\d+")
                || tableName.matches("테이블 \\d+")
                || tableName.equals("단체 단체석"));
    }

    private String demoTableName(int displayOrder, int seats) {
        String zone = switch (displayOrder) {
            case 1 -> "입구";
            case 2 -> "중앙";
            case 3 -> "안쪽";
            default -> "단체";
        };
        if (seats >= 6) {
            return "단체".equals(zone) ? "단체석" : zone + " 단체석";
        }
        return zone + " " + seats + "인석";
    }

    private void seedMoreScenarioReservations(
            BoothReservationRepository reservationRepository,
            BoothReservationTableRepository tableRepository,
            List<Booth> booths,
            LocalDateTime now
    ) {
        if (reservationRepository.count() >= 55) {
            return;
        }
        List<BoothReservation> reservations = new ArrayList<>();
        int userNo = 100;
        for (Booth booth : booths.stream().filter(booth -> Boolean.TRUE.equals(booth.getReservationEnabled()) && !CouncilBoothSync.isCouncilBooth(booth)).toList()) {
            List<BoothReservationTable> tables = tableRepository.findByBoothIdOrderByDisplayOrderAscIdAsc(booth.getId());
            if (tables.isEmpty()) {
                continue;
            }
            int order = booth.getDisplayOrder() == null ? 0 : booth.getDisplayOrder();
            int activeCount = switch (order % 6) {
                case 0 -> 4;
                case 1 -> 1;
                case 2 -> 3;
                case 3 -> 0;
                case 4 -> 2;
                default -> 5;
            };
            for (int i = 0; i < Math.min(activeCount, tables.size()); i++) {
                BoothReservation reservation = new BoothReservation(
                        booth,
                        tables.get(i),
                        "scenario-user-" + userNo++,
                        i % 2 == 0 ? 4 : 2,
                        ReservationStatus.RESERVED,
                        now.minusMinutes(3 + i * 6L + order),
                        now.plusMinutes(8 + i * 5L)
                );
                if ((order + i) % 3 == 0) {
                    reservation.markCheckedIn(now.minusMinutes(1 + i));
                }
                reservations.add(reservation);
            }
            if (order % 4 == 0 && tables.size() > 1) {
                BoothReservation cancelled = new BoothReservation(
                        booth,
                        tables.get(1),
                        "scenario-cancelled-" + userNo++,
                        2,
                        ReservationStatus.RESERVED,
                        now.minusMinutes(45),
                        now.minusMinutes(25)
                );
                cancelled.markCancelled(now.minusMinutes(20));
                reservations.add(cancelled);
            }
        }
        if (!reservations.isEmpty()) {
            reservationRepository.saveAll(reservations);
        }
    }

    private void seedMoreScenarioGpsLogs(GpsLogRepository gpsLogRepository, List<Booth> booths) {
        int recentLogCount = gpsLogRepository.findByCreatedAtAfter(LocalDateTime.now().minusMinutes(15)).size();
        if (recentLogCount >= 240) {
            return;
        }
        List<GpsLog> logs = new ArrayList<>();
        booths.stream()
                .filter(booth -> booth.getDisplayOrder() != null)
                .forEach(booth -> {
                    int weight = gpsScenarioWeight(booth.getDisplayOrder());
                    for (int i = 0; i < weight; i++) {
                        double spread = ((i % 9) - 4) * 0.000018;
                        double ring = ((i / 9) % 4) * 0.000012;
                        logs.add(new GpsLog(booth.getLatitude() + spread + ring, booth.getLongitude() - spread + ring));
                    }
                });
        if (!logs.isEmpty()) {
            gpsLogRepository.saveAll(logs);
        }
    }

    private int gpsScenarioWeight(int displayOrder) {
        return switch (displayOrder % 12) {
            case 0 -> 18;
            case 1 -> 1;
            case 2 -> 5;
            case 3 -> 12;
            case 4 -> 0;
            case 5 -> 8;
            case 6 -> 15;
            case 7 -> 3;
            case 8 -> 10;
            case 9 -> 6;
            case 10 -> 22;
            default -> 2;
        };
    }

    /**
     * 운영 DB 에 남은 시연용 분실물을 지운다(손님 분실물 화면에 가짜 물건이 보이면 실제로 본부를 찾아온다).
     * 예전 시연 데이터가 넣은 것만 — 등록자 표시가 "seed" 이고 사진이 인터넷 사진(pexels)인 것. 스태프가 올린 물건은 사진이 우리 저장소라 걸리지 않는다.
     */
    private void purgeDemoLostItems(LostItemRepository lostItemRepository) {
        List<LostItem> demo = lostItemRepository.findAll().stream()
                .filter(DataInitializer::isDemoLostItem)
                .toList();
        if (!demo.isEmpty()) {
            lostItemRepository.deleteAll(demo);
            log.info("Demo lost items purged: {}", demo.size());
        }
    }

    /** 관리자 화면을 시험하며 넣었던 일정(2026-09-22 "키키"). 제목과 날짜가 둘 다 맞는 것만 지운다. */
    private void purgeTestEvents(EventRepository eventRepository) {
        List<FestivalEvent> test = eventRepository.findAll().stream()
                .filter(DataInitializer::isTestEvent)
                .toList();
        if (!test.isEmpty()) {
            eventRepository.deleteAll(test);
            log.info("Test events purged: {}", test.size());
        }
    }

    static boolean isDemoLostItem(LostItem item) {
        return "seed".equals(item.getReporterRef())
                && item.getImageUrl() != null
                && item.getImageUrl().startsWith("https://images.pexels.com/");
    }

    static boolean isTestEvent(FestivalEvent item) {
        return "키키".equals(item.getTitle())
                && item.getStartTime() != null
                && item.getStartTime().toLocalDate().equals(java.time.LocalDate.of(2026, 9, 22));
    }

    private List<StaffMember> seedStaff(List<Booth> booths, PasswordEncoder passwordEncoder, boolean useSimpleCredentials) {
        return java.util.stream.IntStream.range(0, STAFF_NAMES.size())
                .mapToObj(i -> createStaff(i, booths, passwordEncoder, useSimpleCredentials))
                .toList();
    }

    private StaffMember createStaff(int index, List<Booth> booths, PasswordEncoder passwordEncoder, boolean useSimpleCredentials) {
        Booth booth = booths.isEmpty() ? null : booths.get(index % booths.size());
        StaffStatus status = index % 5 == 0 ? StaffStatus.URGENT : index % 3 == 0 ? StaffStatus.MOVING : StaffStatus.ON_DUTY;
        String number = String.valueOf(index + 1);
        String rawPin = useSimpleCredentials ? number : UUID.randomUUID().toString();
        return new StaffMember(
                number,
                passwordEncoder.encode(rawPin),
                STAFF_NAMES.get(index),
                index % 2 == 0 ? "운영" : "안전",
                status,
                index % 2 == 0 ? "입구 동선 안내" : "현장 순찰",
                "",
                booth != null ? booth.getId() : null,
                booth != null ? booth.getLatitude() : null,
                booth != null ? booth.getLongitude() : null,
                LocalDateTime.now().minusMinutes(index)
        );
    }

    private void simplifyStaffCredentials(
            StaffMemberRepository staffMemberRepository,
            PasswordEncoder passwordEncoder
    ) {
        List<StaffMember> staff = staffMemberRepository.findAll().stream()
                .sorted(Comparator.comparing(StaffMember::getId))
                .toList();
        for (int i = 0; i < staff.size(); i++) {
            String number = String.valueOf(i + 1);
            StaffMember member = staff.get(i);
            member.updateCredentials(number, passwordEncoder.encode(number));
            member.setName(i < STAFF_NAMES.size() ? STAFF_NAMES.get(i) : "스태프 " + number);
            member.setTeam(i % 2 == 0 ? "운영" : "안전");
        }
        staffMemberRepository.saveAll(staff);
    }

    private void syncDemoStaff(
            StaffMemberRepository staffMemberRepository,
            List<Booth> booths,
            PasswordEncoder passwordEncoder
    ) {
        for (int i = 0; i < STAFF_NAMES.size(); i++) {
            String number = String.valueOf(i + 1);
            int index = i;
            StaffMember member = staffMemberRepository.findByStaffNoIgnoreCase(number)
                    .orElseGet(() -> createStaff(index, booths, passwordEncoder, true));
            member.updateCredentials(number, passwordEncoder.encode(number));
            member.setName(STAFF_NAMES.get(i));
            member.setTeam(i % 2 == 0 ? "운영" : "안전");
            staffMemberRepository.save(member);
        }
    }

    private void hardenSimpleStaffCredentials(
            StaffMemberRepository staffMemberRepository,
            PasswordEncoder passwordEncoder
    ) {
        List<StaffMember> staff = staffMemberRepository.findAll();
        List<StaffMember> updated = new ArrayList<>();
        for (StaffMember member : staff) {
            String staffNo = member.getStaffNo();
            if (staffNo == null || staffNo.isBlank() || member.getPinHash() == null || member.getPinHash().isBlank()) {
                continue;
            }
            if (passwordEncoder.matches(staffNo, member.getPinHash())) {
                member.updateCredentials(staffNo, passwordEncoder.encode(UUID.randomUUID().toString()));
                updated.add(member);
            }
        }
        if (!updated.isEmpty()) {
            staffMemberRepository.saveAll(updated);
        }
    }
}
