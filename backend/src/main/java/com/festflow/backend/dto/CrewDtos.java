package com.festflow.backend.dto;

import java.util.List;

/**
 * /staff (스태프 명단 · 시간표 · 상태) 화면이 주고받는 모양을 한 파일에 모았다.
 * 날짜는 "2026-10-07" 글자, 시각은 그날 0시부터 센 분(자정 넘으면 1440 이상), 때는 epoch 밀리초.
 */
public final class CrewDtos {

    private CrewDtos() {
    }

    /** 화면 전체. unchanged 가 true 면 나머지는 비어 있고, 화면은 들고 있던 것을 그대로 쓴다. */
    public record State(
            long version,
            boolean unchanged,
            long serverTime,
            List<Member> members,
            List<Slot> slots,
            List<Notice> notices,
            List<Log> logs,
            Backup backup
    ) {
    }

    /** 가장 최근에 통째로 바꾸기 직전 모습. 있으면 화면에 '직전으로 되돌리기'가 뜬다. */
    public record Backup(long at, String actor, String reason) {
    }

    public record Member(
            Long id,
            String name,
            String dept,
            String role,
            String phone,
            int sortOrder,
            String status,
            String statusMemo,
            Long statusAt,
            String relief,
            String location,
            Long locationAt
    ) {
    }

    public record Slot(
            Long id,
            String day,
            String place,
            String booth,
            int startMin,
            int endMin,
            List<String> members,
            String note,
            int sortOrder,
            long updatedAt,
            String updatedBy
    ) {
    }

    public record Notice(Long id, String day, String text) {
    }

    public record Log(Long id, long at, String actor, String text) {
    }

    /** relief: 밥 먹는 동안 대신 맡은 사람 이름(밥 먹는 중일 때만, 없으면 비움). */
    public record StatusUpdate(String status, String memo, String relief, String by) {
    }

    /** location: 지금 있는 곳(시간표 장소 또는 직접 적은 곳). 비우면 지운다. */
    public record LocationUpdate(String location, String by) {
    }

    /** baseUpdatedAt: 화면이 보고 있던 칸의 updatedAt. 그 사이 누가 고쳤으면 덮어쓰지 않는다(새 칸이면 비움). */
    public record SlotUpsert(
            String day,
            String place,
            String booth,
            Integer startMin,
            Integer endMin,
            List<String> members,
            String note,
            Long baseUpdatedAt,
            String by
    ) {
    }

    public record MemberUpsert(String name, String dept, String role, String phone, String by) {
    }

    public record NoticeUpsert(String day, String text, String by) {
    }

    /** 명단 · 시간표 · 공지를 통째로 올릴 때(처음 파일 · 엑셀). notices 가 null 이면 공지는 그대로 둔다. */
    public record Import(List<ImportMember> members, List<ImportSlot> slots, List<ImportNotice> notices) {
    }

    public record ImportMember(String name, String dept, String role, String phone, Integer sortOrder) {
    }

    public record ImportSlot(
            String day,
            String place,
            String booth,
            Integer startMin,
            Integer endMin,
            List<String> members,
            String note,
            Integer sortOrder
    ) {
    }

    public record ImportNotice(String day, String text) {
    }
}
