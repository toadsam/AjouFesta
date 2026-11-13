package com.festflow.backend.service;

import com.festflow.backend.dto.CrewDtos;
import com.festflow.backend.entity.CrewMember;
import com.festflow.backend.entity.CrewSlot;
import com.festflow.backend.repository.CrewLogRepository;
import com.festflow.backend.repository.CrewMemberRepository;
import com.festflow.backend.repository.CrewNoticeRepository;
import com.festflow.backend.repository.CrewSlotRepository;
import com.festflow.backend.repository.CrewSnapshotRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.security.OpsKeyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CrewServiceTest {

    private CrewMemberRepository memberRepository;
    private CrewSlotRepository slotRepository;
    private CrewSnapshotRepository snapshotRepository;
    private CrewService crewService;
    private CrewSlot slot;
    private CrewMember seeun;

    @Test
    void 통째로_바꾸면_직전_모습을_남기고_남는_사람의_상태는_지킨다() {
        seeun.updateStatus("EATING", "학식", null, Instant.now());
        Mockito.when(memberRepository.count()).thenReturn(2L);
        CrewDtos.Import excel = new CrewDtos.Import(
                List.of(new CrewDtos.ImportMember("김시은", "미디어홍보국", "국장", "01011112222", null)),
                List.of(new CrewDtos.ImportSlot("2026-10-08", "가온마당", "낮잠 콘테스트", 570, 620, List.of("김시은"), null, null)),
                null
        );

        crewService.replaceAll(excel, "정재훈");

        Mockito.verify(snapshotRepository).save(Mockito.any());
        Mockito.verify(slotRepository).deleteAllInBatch();
        assertThat(seeun.getStatus()).isEqualTo("EATING");
        assertThat(seeun.getRole()).isEqualTo("국장");
    }

    @Test
    void 엑셀에_명단에_없는_이름이_있으면_몇_번째_칸인지_알리고_아무것도_안_바꾼다() {
        CrewDtos.Import excel = new CrewDtos.Import(
                List.of(new CrewDtos.ImportMember("김시은", "미디어홍보국", "차장", "01011112222", null)),
                List.of(
                        new CrewDtos.ImportSlot("2026-10-08", "가온마당", "낮잠 콘테스트", 570, 620, List.of("김시은"), null, null),
                        new CrewDtos.ImportSlot("2026-10-08", "가온마당", "낮잠 콘테스트", 620, 710, List.of("양손훈"), null, null)
                ),
                null
        );

        assertThatThrownBy(() -> crewService.replaceAll(excel, "정재훈"))
                .hasMessageContaining("시간표 2번째 칸")
                .hasMessageContaining("양손훈");
        Mockito.verify(slotRepository, Mockito.never()).deleteAllInBatch();
    }

    @BeforeEach
    void setUp() {
        memberRepository = Mockito.mock(CrewMemberRepository.class);
        slotRepository = Mockito.mock(CrewSlotRepository.class);
        snapshotRepository = Mockito.mock(CrewSnapshotRepository.class);
        crewService = new CrewService(memberRepository, slotRepository,
                Mockito.mock(CrewNoticeRepository.class), Mockito.mock(CrewLogRepository.class),
                snapshotRepository, new ObjectMapper());
        seeun = new CrewMember("김시은", "미디어홍보국", "차장", "010-1111-2222", 0);
        Mockito.when(memberRepository.findAll()).thenReturn(List.of(
                seeun,
                new CrewMember("이윤아", "중앙조정국", "국원", "010-3333-4444", 1)
        ));
        slot = new CrewSlot(LocalDate.parse("2026-10-07"), "성호관 앞 잔디밭", "총학생회 메인부스",
                570, 620, List.of("김시은"), null, 0, Instant.ofEpochMilli(1_000L), "처음 올림");
        Mockito.when(slotRepository.findById(7L)).thenReturn(Optional.of(slot));
    }

    @Test
    void 화면이_보던_칸을_그사이_누가_고쳤으면_덮어쓰지_않는다() {
        CrewDtos.SlotUpsert stale = new CrewDtos.SlotUpsert("2026-10-07", "성호관 앞 잔디밭", "총학생회 메인부스",
                570, 620, List.of("이윤아"), null, 999L, "정재훈");

        assertThatThrownBy(() -> crewService.updateSlot(7L, stale))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("방금 이 칸을 고쳤어요");
        assertThat(slot.memberList()).containsExactly("김시은");
    }

    @Test
    void 보던_그대로면_사람을_바꾸고_고친_사람을_남긴다() {
        CrewDtos.SlotUpsert fresh = new CrewDtos.SlotUpsert("2026-10-07", "성호관 앞 잔디밭", "총학생회 메인부스",
                570, 620, List.of("이윤아", "김시은", "이윤아"), null, 1_000L, "정재훈");

        CrewDtos.Slot saved = crewService.updateSlot(7L, fresh);

        assertThat(saved.members()).containsExactly("이윤아", "김시은");
        assertThat(saved.updatedBy()).isEqualTo("정재훈");
    }

    @Test
    void 명단에_없는_이름이나_거꾸로된_시간은_받지_않는다() {
        assertThatThrownBy(() -> crewService.updateSlot(7L, new CrewDtos.SlotUpsert("2026-10-07", "a", "b",
                570, 620, List.of("양손훈"), null, null, "x")))
                .hasMessageContaining("명단에 없는 이름");
        assertThatThrownBy(() -> crewService.updateSlot(7L, new CrewDtos.SlotUpsert("2026-10-07", "a", "b",
                620, 570, List.of(), null, null, "x")))
                .hasMessageContaining("시간을 다시");
    }

    @Test
    void 모르는_상태는_거절하고_빈_상태는_지운다() {
        CrewMember member = new CrewMember("김시은", "미디어홍보국", "차장", "010-1111-2222", 0);
        Mockito.when(memberRepository.findById(1L)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> crewService.updateStatus(1L, new CrewDtos.StatusUpdate("SLEEPING", null, null, "김시은")))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(crewService.updateStatus(1L, new CrewDtos.StatusUpdate("EATING", " 학식 ", null, "김시은")).statusMemo())
                .isEqualTo("학식");
        assertThat(crewService.updateStatus(1L, new CrewDtos.StatusUpdate("", "남은 메모", null, "김시은")).status()).isNull();
    }

    @Test
    void 밥_먹는_동안만_교대한_사람을_남기고_상태를_바꾸면_지운다() {
        CrewMember member = new CrewMember("김시은", "미디어홍보국", "차장", "010-1111-2222", 0);
        Mockito.when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
        Mockito.when(memberRepository.findByName("이윤아"))
                .thenReturn(Optional.of(new CrewMember("이윤아", "중앙조정국", "국원", "010-3333-4444", 1)));

        assertThat(crewService.updateStatus(1L, new CrewDtos.StatusUpdate("EATING", null, "이윤아", "김시은")).relief())
                .isEqualTo("이윤아");
        assertThat(crewService.updateStatus(1L, new CrewDtos.StatusUpdate("WORKING", null, "이윤아", "김시은")).relief())
                .isNull();
        assertThatThrownBy(() -> crewService.updateStatus(1L, new CrewDtos.StatusUpdate("EATING", null, "김시은", "김시은")))
                .hasMessageContaining("나와 교대");
        assertThatThrownBy(() -> crewService.updateStatus(1L, new CrewDtos.StatusUpdate("EATING", null, "양손훈", "김시은")))
                .hasMessageContaining("명단에 없는 이름");
    }

    @Test
    void 있는_곳은_상태를_바꿔도_남고_퇴근하면_지운다() {
        CrewMember member = new CrewMember("김시은", "미디어홍보국", "차장", "010-1111-2222", 0);
        Mockito.when(memberRepository.findById(1L)).thenReturn(Optional.of(member));

        assertThat(crewService.updateLocation(1L, new CrewDtos.LocationUpdate(" 학생회관 2층 ", "김시은")).location())
                .isEqualTo("학생회관 2층");
        assertThat(crewService.updateStatus(1L, new CrewDtos.StatusUpdate("EATING", null, null, "김시은")).location())
                .isEqualTo("학생회관 2층");
        CrewDtos.Member off = crewService.updateStatus(1L, new CrewDtos.StatusUpdate("OFF", null, null, "김시은"));
        assertThat(off.location()).isNull();
        assertThat(off.locationAt()).isNull();
        assertThat(crewService.updateLocation(1L, new CrewDtos.LocationUpdate("가온마당", "김시은")).location()).isEqualTo("가온마당");
        assertThat(crewService.updateLocation(1L, new CrewDtos.LocationUpdate("", "김시은")).location()).isNull();
    }

    @Test
    void 번호와_자정_넘는_시각을_사람이_읽는_모양으로() {
        assertThat(CrewService.normalizePhone("010 9876 5432")).isEqualTo("010-9876-5432");
        assertThatThrownBy(() -> CrewService.normalizePhone("1234")).isInstanceOf(ResponseStatusException.class);
        assertThat(CrewService.clock(570)).isEqualTo("9:30");
        assertThat(CrewService.clock(1440)).isEqualTo("자정");
        assertThat(CrewService.clock(1500)).isEqualTo("새벽 1:00");
    }

    @Test
    void 공용_부스_키는_스태프_화면만_연다() {
        OpsKeyService keys = new OpsKeyService("master", "booth-shared", "");

        assertThat(keys.authenticate("booth-shared", "/api/ops/crew")).get()
                .extracting("role").isEqualTo("OPS_CREW");
        assertThat(keys.authenticate("booth-shared", "/api/ops/crew/slots/3")).isPresent();
        assertThat(keys.authenticate("booth-shared", "/api/ops/crewx")).isEmpty();
        assertThat(keys.authenticate("booth-shared", "/api/ops/master/bootstrap")).isEmpty();
        assertThat(keys.authenticate("wrong", "/api/ops/crew")).isEmpty();
    }
}
