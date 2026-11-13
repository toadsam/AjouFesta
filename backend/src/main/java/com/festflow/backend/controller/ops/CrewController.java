package com.festflow.backend.controller.ops;

import com.festflow.backend.dto.CrewDtos;
import com.festflow.backend.service.CrewService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * /staff 화면(스태프 연락처 · 시간표 · 상태). 부스 암호(공용 부스 키 · 부스별 키)나 마스터 키로 연다 — SecurityConfig.
 * 고치는 요청의 by 는 "이 폰의 주인이라고 고른 이름". 확인하지 않는다(스태프끼리 믿고 쓰는 화면).
 */
@RestController
@RequestMapping("/api/ops/crew")
public class CrewController {

    private final CrewService crewService;

    public CrewController(CrewService crewService) {
        this.crewService = crewService;
    }

    @GetMapping
    public CrewDtos.State state(@RequestParam(value = "v", required = false) Long knownVersion) {
        return crewService.state(knownVersion);
    }

    @PutMapping("/members/{id}/status")
    public CrewDtos.Member updateStatus(@PathVariable Long id, @RequestBody CrewDtos.StatusUpdate request) {
        return crewService.updateStatus(id, request);
    }

    @PutMapping("/members/{id}/location")
    public CrewDtos.Member updateLocation(@PathVariable Long id, @RequestBody CrewDtos.LocationUpdate request) {
        return crewService.updateLocation(id, request);
    }

    @PostMapping("/slots")
    public CrewDtos.Slot createSlot(@RequestBody CrewDtos.SlotUpsert request) {
        return crewService.createSlot(request);
    }

    @PutMapping("/slots/{id}")
    public CrewDtos.Slot updateSlot(@PathVariable Long id, @RequestBody CrewDtos.SlotUpsert request) {
        return crewService.updateSlot(id, request);
    }

    @DeleteMapping("/slots/{id}")
    public void deleteSlot(@PathVariable Long id, @RequestParam(value = "by", required = false) String by) {
        crewService.deleteSlot(id, by);
    }

    @PostMapping("/members")
    public CrewDtos.Member createMember(@RequestBody CrewDtos.MemberUpsert request) {
        return crewService.createMember(request);
    }

    @PutMapping("/members/{id}")
    public CrewDtos.Member updateMember(@PathVariable Long id, @RequestBody CrewDtos.MemberUpsert request) {
        return crewService.updateMember(id, request);
    }

    @DeleteMapping("/members/{id}")
    public void deleteMember(@PathVariable Long id, @RequestParam(value = "by", required = false) String by) {
        crewService.deleteMember(id, by);
    }

    @PostMapping("/notices")
    public CrewDtos.Notice createNotice(@RequestBody CrewDtos.NoticeUpsert request) {
        return crewService.createNotice(request);
    }

    @PutMapping("/notices/{id}")
    public CrewDtos.Notice updateNotice(@PathVariable Long id, @RequestBody CrewDtos.NoticeUpsert request) {
        return crewService.updateNotice(id, request);
    }

    @DeleteMapping("/notices/{id}")
    public void deleteNotice(@PathVariable Long id, @RequestParam(value = "by", required = false) String by) {
        crewService.deleteNotice(id, by);
    }

    /** 명단 · 시간표(· 공지)를 통째로 바꾼다 — 처음 올리는 파일과 엑셀 올리기. 바꾸기 전 모습은 남겨 둔다. */
    @PostMapping("/import")
    public CrewDtos.State importAll(
            @RequestBody CrewDtos.Import request,
            @RequestParam(value = "by", required = false) String by
    ) {
        return crewService.replaceAll(request, by);
    }

    /** 가장 최근 '통째로 바꾸기' 직전 모습으로 되돌린다. */
    @PostMapping("/restore")
    public CrewDtos.State restore(@RequestParam(value = "by", required = false) String by) {
        return crewService.restoreLatest(by);
    }
}
