package com.festflow.backend.service;

import com.festflow.backend.dto.CrewDtos;
import com.festflow.backend.entity.CrewLog;
import com.festflow.backend.entity.CrewMember;
import com.festflow.backend.entity.CrewNotice;
import com.festflow.backend.entity.CrewSlot;
import com.festflow.backend.entity.CrewSnapshot;
import com.festflow.backend.repository.CrewLogRepository;
import com.festflow.backend.repository.CrewMemberRepository;
import com.festflow.backend.repository.CrewNoticeRepository;
import com.festflow.backend.repository.CrewSlotRepository;
import com.festflow.backend.repository.CrewSnapshotRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * /staff 화면: 스태프 연락처 · 축제 시간표 · 각자의 상태.
 * 부스 암호를 아는 스태프는 모두 시간표를 고칠 수 있다(서로 믿는다). 대신 고친 것은 CrewLog 에 남긴다.
 *
 * 화면은 몇 초마다 version 을 들고 물어본다. 아무것도 안 바뀌었으면 빈 응답(unchanged)만 돌려줘
 * 스태프 수십 명이 폰을 켜 둬도 전화번호 · 시간표 전체를 매번 보내지 않는다.
 * version 은 메모리에 둔다 — 서버가 다시 뜨면 새 값이 되어 모든 화면이 한 번 전체를 다시 받는다.
 */
@Service
public class CrewService {

    public static final Set<String> STATUSES = Set.of("WORKING", "EATING", "CLASS", "RESTING", "OFF");
    static final int MAX_MINUTE = 27 * 60; // 다음 날 새벽 3시까지
    private static final int SNAPSHOT_KEEP = 5;

    private final CrewMemberRepository memberRepository;
    private final CrewSlotRepository slotRepository;
    private final CrewNoticeRepository noticeRepository;
    private final CrewLogRepository logRepository;
    private final CrewSnapshotRepository snapshotRepository;
    private final ObjectMapper objectMapper;
    private final AtomicLong version = new AtomicLong(System.currentTimeMillis());

    public CrewService(
            CrewMemberRepository memberRepository,
            CrewSlotRepository slotRepository,
            CrewNoticeRepository noticeRepository,
            CrewLogRepository logRepository,
            CrewSnapshotRepository snapshotRepository,
            ObjectMapper objectMapper
    ) {
        this.memberRepository = memberRepository;
        this.slotRepository = slotRepository;
        this.noticeRepository = noticeRepository;
        this.logRepository = logRepository;
        this.snapshotRepository = snapshotRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public CrewDtos.State state(Long knownVersion) {
        long current = version.get();
        long now = System.currentTimeMillis();
        if (knownVersion != null && knownVersion == current) {
            return new CrewDtos.State(current, true, now, List.of(), List.of(), List.of(), List.of(), null);
        }
        return new CrewDtos.State(
                current,
                false,
                now,
                memberRepository.findAllByOrderBySortOrderAscIdAsc().stream().map(CrewService::toDto).toList(),
                slotRepository.findAllByOrderByDayAscSortOrderAscIdAsc().stream().map(CrewService::toDto).toList(),
                noticeRepository.findAllByOrderByDayAscIdAsc().stream()
                        .map(notice -> new CrewDtos.Notice(notice.getId(), notice.getDay().toString(), notice.getText()))
                        .toList(),
                logRepository.findTop40ByOrderByIdDesc().stream()
                        .map(log -> new CrewDtos.Log(log.getId(), log.getAt().toEpochMilli(), log.getActor(), log.getText()))
                        .toList(),
                snapshotRepository.findTopByOrderByIdDesc()
                        .map(snapshot -> new CrewDtos.Backup(snapshot.getAt().toEpochMilli(), snapshot.getActor(), snapshot.getReason()))
                        .orElse(null)
        );
    }

    /* ---------- 상태 ---------- */

    @Transactional
    public CrewDtos.Member updateStatus(Long memberId, CrewDtos.StatusUpdate request) {
        CrewMember member = findMember(memberId);
        String status = request == null ? null : clean(request.status(), 20);
        if (status != null && !STATUSES.contains(status)) {
            throw new ResponseStatusException(BAD_REQUEST, "모르는 상태입니다.");
        }
        String memo = status == null ? null : clean(request.memo(), 60);
        // 교대는 밥 먹는 중일 때만 남긴다. 다른 상태로 바꾸면 자연스럽게 지워진다.
        String relief = "EATING".equals(status) ? clean(request.relief(), 30) : null;
        if (relief != null) {
            if (relief.equals(member.getName())) {
                throw new ResponseStatusException(BAD_REQUEST, "나와 교대할 수는 없어요.");
            }
            if (memberRepository.findByName(relief).isEmpty()) {
                throw new ResponseStatusException(BAD_REQUEST, "명단에 없는 이름이에요: " + relief);
            }
        }
        Instant now = Instant.now();
        member.updateStatus(status, memo, relief, now);
        if ("OFF".equals(status)) {
            member.updateLocation(null, now); // 퇴근하면 '지금 있는 곳'도 지운다
        }
        bump();
        return toDto(member);
    }

    /** 지금 있는 곳. 상태와 따로 바꾼다(상태 시각은 그대로). */
    @Transactional
    public CrewDtos.Member updateLocation(Long memberId, CrewDtos.LocationUpdate request) {
        CrewMember member = findMember(memberId);
        member.updateLocation(request == null ? null : clean(request.location(), 40), Instant.now());
        bump();
        return toDto(member);
    }

    /* ---------- 시간표 칸 ---------- */

    @Transactional
    public CrewDtos.Slot createSlot(CrewDtos.SlotUpsert request) {
        SlotFields fields = slotFields(request);
        int sortOrder = slotRepository.findAll().stream().mapToInt(CrewSlot::getSortOrder).max().orElse(0) + 1;
        CrewSlot slot = slotRepository.save(new CrewSlot(
                fields.day, fields.place, fields.booth, fields.startMin, fields.endMin,
                fields.members, fields.note, sortOrder, Instant.now(), actor(request.by())
        ));
        log(request.by(), "칸 추가 · " + label(slot) + " · " + names(fields.members));
        bump();
        return toDto(slot);
    }

    @Transactional
    public CrewDtos.Slot updateSlot(Long slotId, CrewDtos.SlotUpsert request) {
        CrewSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "이 칸은 이미 지워졌어요."));
        if (request != null && request.baseUpdatedAt() != null
                && request.baseUpdatedAt() != slot.getUpdatedAt().toEpochMilli()) {
            String who = slot.getUpdatedBy() == null ? "다른 스태프" : slot.getUpdatedBy();
            throw new ResponseStatusException(CONFLICT, who + "님이 방금 이 칸을 고쳤어요. 새로 읽은 내용을 보고 다시 고쳐 주세요.");
        }
        SlotFields fields = slotFields(request);
        String before = label(slot);
        List<String> previous = slot.memberList();
        slot.update(fields.day, fields.place, fields.booth, fields.startMin, fields.endMin,
                fields.members, fields.note, Instant.now(), actor(request.by()));
        String after = label(slot);
        StringBuilder text = new StringBuilder(after);
        if (!before.equals(after)) {
            text = new StringBuilder(before + " → " + after);
        }
        List<String> added = fields.members.stream().filter(name -> !previous.contains(name)).toList();
        List<String> removed = previous.stream().filter(name -> !fields.members.contains(name)).toList();
        if (!added.isEmpty()) {
            text.append(" · 들어옴 ").append(String.join(", ", added));
        }
        if (!removed.isEmpty()) {
            text.append(" · 빠짐 ").append(String.join(", ", removed));
        }
        log(request.by(), text.toString());
        bump();
        return toDto(slot);
    }

    @Transactional
    public void deleteSlot(Long slotId, String by) {
        CrewSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "이 칸은 이미 지워졌어요."));
        log(by, "칸 삭제 · " + label(slot) + " · " + names(slot.memberList()));
        slotRepository.delete(slot);
        bump();
    }

    /* ---------- 명단 ---------- */

    @Transactional
    public CrewDtos.Member createMember(CrewDtos.MemberUpsert request) {
        MemberFields fields = memberFields(request);
        if (memberRepository.findByName(fields.name).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "같은 이름이 이미 명단에 있어요.");
        }
        int sortOrder = memberRepository.findAll().stream().mapToInt(CrewMember::getSortOrder).max().orElse(0) + 1;
        CrewMember member = memberRepository.save(
                new CrewMember(fields.name, fields.dept, fields.role, fields.phone, sortOrder));
        log(request.by(), "명단 추가 · " + fields.name + (fields.dept.isEmpty() ? "" : " (" + fields.dept + ")"));
        bump();
        return toDto(member);
    }

    @Transactional
    public CrewDtos.Member updateMember(Long memberId, CrewDtos.MemberUpsert request) {
        CrewMember member = findMember(memberId);
        MemberFields fields = memberFields(request);
        String oldName = member.getName();
        if (!oldName.equals(fields.name)) {
            if (memberRepository.findByName(fields.name).isPresent()) {
                throw new ResponseStatusException(CONFLICT, "같은 이름이 이미 명단에 있어요.");
            }
            // 이름을 바꾸면 시간표에 적힌 이름과 '누구랑 교대' 이름도 같이 바꾼다.
            memberRepository.findAll().stream()
                    .filter(other -> oldName.equals(other.getReliefName()))
                    .forEach(other -> other.changeReliefName(fields.name));
            Instant now = Instant.now();
            for (CrewSlot slot : slotRepository.findAll()) {
                List<String> current = slot.memberList();
                if (current.contains(oldName)) {
                    slot.replaceMembers(current.stream().map(name -> name.equals(oldName) ? fields.name : name).toList(),
                            now, actor(request.by()));
                }
            }
        }
        member.updateProfile(fields.name, fields.dept, fields.role, fields.phone);
        log(request.by(), "명단 수정 · " + (oldName.equals(fields.name) ? oldName : oldName + " → " + fields.name));
        bump();
        return toDto(member);
    }

    @Transactional
    public void deleteMember(Long memberId, String by) {
        CrewMember member = findMember(memberId);
        String name = member.getName();
        int removedFrom = 0;
        Instant now = Instant.now();
        for (CrewSlot slot : slotRepository.findAll()) {
            List<String> current = slot.memberList();
            if (current.contains(name)) {
                slot.replaceMembers(current.stream().filter(other -> !other.equals(name)).toList(), now, actor(by));
                removedFrom++;
            }
        }
        memberRepository.findAll().stream()
                .filter(other -> name.equals(other.getReliefName()))
                .forEach(other -> other.changeReliefName(null));
        memberRepository.delete(member);
        log(by, "명단에서 뺌 · " + name + (removedFrom > 0 ? " (시간표 " + removedFrom + "칸에서도 빠짐)" : ""));
        bump();
    }

    /* ---------- 공지 ---------- */

    @Transactional
    public CrewDtos.Notice createNotice(CrewDtos.NoticeUpsert request) {
        LocalDate day = parseDay(request == null ? null : request.day());
        String text = required(request.text(), 300, "공지 내용을 적어 주세요.");
        CrewNotice notice = noticeRepository.save(new CrewNotice(day, text));
        log(request.by(), "공지 추가 · " + shortDay(day) + " · " + text);
        bump();
        return new CrewDtos.Notice(notice.getId(), day.toString(), text);
    }

    @Transactional
    public CrewDtos.Notice updateNotice(Long noticeId, CrewDtos.NoticeUpsert request) {
        CrewNotice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "이 공지는 이미 지워졌어요."));
        LocalDate day = parseDay(request == null ? null : request.day());
        String text = required(request.text(), 300, "공지 내용을 적어 주세요.");
        notice.update(day, text);
        log(request.by(), "공지 수정 · " + shortDay(day) + " · " + text);
        bump();
        return new CrewDtos.Notice(notice.getId(), day.toString(), text);
    }

    @Transactional
    public void deleteNotice(Long noticeId, String by) {
        CrewNotice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "이 공지는 이미 지워졌어요."));
        log(by, "공지 삭제 · " + shortDay(notice.getDay()) + " · " + notice.getText());
        noticeRepository.delete(notice);
        bump();
    }

    /* ---------- 통째로 바꾸기(처음 파일 · 엑셀) · 직전으로 되돌리기 ---------- */

    /**
     * 명단 · 시간표(· 공지)를 한꺼번에 바꾼다. 부스 암호를 아는 스태프면 누구나 할 수 있어서,
     * 바꾸기 직전 모습을 crew_snapshots 에 남겨 두고 '직전으로 되돌리기'로 돌아갈 수 있게 한다.
     * 명단은 이름으로 맞춰 남는 사람의 상태(일하는 중 등)는 그대로 둔다.
     * 전화번호가 저장소에 남지 않도록 명단 파일은 코드에 두지 않고 이 길로만 넣는다.
     */
    @Transactional
    public CrewDtos.State replaceAll(CrewDtos.Import request, String by) {
        if (request == null || request.members() == null || request.members().isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "명단이 비어 있는 파일이에요.");
        }
        boolean first = memberRepository.count() == 0 && slotRepository.count() == 0;
        if (!first) {
            saveSnapshot(by, "통째로 바꾸기 전");
        }
        Counts counts = apply(request, by);
        log(by, (first ? "명단 · 시간표를 처음 올림" : "명단 · 시간표를 통째로 바꿈")
                + " (" + counts.members + "명 · " + counts.slots + "칸)");
        bump();
        return state(null);
    }

    @Transactional
    public CrewDtos.State restoreLatest(String by) {
        CrewSnapshot snapshot = snapshotRepository.findTopByOrderByIdDesc()
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "되돌릴 이전 모습이 없어요."));
        CrewDtos.Import previous;
        try {
            previous = objectMapper.readValue(snapshot.getPayload(), CrewDtos.Import.class);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(CONFLICT, "저장해 둔 이전 모습을 읽지 못했어요.");
        }
        Counts counts = apply(previous, by);
        snapshotRepository.delete(snapshot);
        log(by, "직전으로 되돌림 (" + counts.members + "명 · " + counts.slots + "칸)");
        bump();
        return state(null);
    }

    private record Counts(int members, int slots) {
    }

    private Counts apply(CrewDtos.Import request, String by) {
        // 명단: 이름으로 맞춘다. 남는 사람은 상태를 지키고, 빠진 사람은 지우고, 새 사람은 더한다.
        Map<String, CrewMember> existing = new HashMap<>();
        memberRepository.findAll().forEach(member -> existing.put(member.getName(), member));
        Set<String> names = new HashSet<>();
        List<CrewMember> toSave = new ArrayList<>();
        int order = 0;
        for (CrewDtos.ImportMember item : request.members()) {
            MemberFields fields = memberFields(new CrewDtos.MemberUpsert(item.name(), item.dept(), item.role(), item.phone(), by));
            if (!names.add(fields.name)) {
                throw new ResponseStatusException(BAD_REQUEST, "명단에 이름이 두 번 있어요: " + fields.name);
            }
            int sortOrder = item.sortOrder() == null ? order : item.sortOrder();
            CrewMember member = existing.remove(fields.name);
            if (member == null) {
                member = new CrewMember(fields.name, fields.dept, fields.role, fields.phone, sortOrder);
            } else {
                member.updateProfile(fields.name, fields.dept, fields.role, fields.phone);
                member.updateSortOrder(sortOrder);
            }
            toSave.add(member);
            order++;
        }

        // 시간표 칸을 먼저 다 검사한 뒤에 지우고 넣는다(중간에 틀린 줄이 있으면 아무것도 안 바뀐다).
        Instant now = Instant.now();
        List<CrewSlot> slots = new ArrayList<>();
        order = 0;
        for (CrewDtos.ImportSlot item : request.slots() == null ? List.<CrewDtos.ImportSlot>of() : request.slots()) {
            SlotFields fields;
            try {
                fields = slotFields(new CrewDtos.SlotUpsert(item.day(), item.place(), item.booth(),
                        item.startMin(), item.endMin(), item.members(), item.note(), null, by), names);
            } catch (ResponseStatusException exception) {
                throw new ResponseStatusException(BAD_REQUEST, "시간표 " + (order + 1) + "번째 칸: " + exception.getReason());
            }
            slots.add(new CrewSlot(fields.day, fields.place, fields.booth, fields.startMin, fields.endMin,
                    fields.members, fields.note, item.sortOrder() == null ? order : item.sortOrder(), now, actor(by)));
            order++;
        }
        List<CrewNotice> notices = null;
        if (request.notices() != null) {
            notices = new ArrayList<>();
            for (CrewDtos.ImportNotice item : request.notices()) {
                notices.add(new CrewNotice(parseDay(item.day()), required(item.text(), 300, "공지 내용이 비어 있어요.")));
            }
        }

        slotRepository.deleteAllInBatch();
        memberRepository.deleteAll(existing.values());
        memberRepository.saveAll(toSave);
        slotRepository.saveAll(slots);
        if (notices != null) {
            noticeRepository.deleteAllInBatch();
            noticeRepository.saveAll(notices);
        }
        return new Counts(toSave.size(), slots.size());
    }

    private void saveSnapshot(String by, String reason) {
        CrewDtos.Import current = new CrewDtos.Import(
                memberRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                        .map(member -> new CrewDtos.ImportMember(member.getName(), member.getDept(), member.getRole(),
                                member.getPhone(), member.getSortOrder()))
                        .toList(),
                slotRepository.findAllByOrderByDayAscSortOrderAscIdAsc().stream()
                        .map(slot -> new CrewDtos.ImportSlot(slot.getDay().toString(), slot.getPlace(), slot.getBooth(),
                                slot.getStartMin(), slot.getEndMin(), slot.memberList(), slot.getNote(), slot.getSortOrder()))
                        .toList(),
                noticeRepository.findAllByOrderByDayAscIdAsc().stream()
                        .map(notice -> new CrewDtos.ImportNotice(notice.getDay().toString(), notice.getText()))
                        .toList()
        );
        try {
            snapshotRepository.save(new CrewSnapshot(Instant.now(), actor(by), reason, objectMapper.writeValueAsString(current)));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(exception);
        }
        List<CrewSnapshot> all = snapshotRepository.findAllByOrderByIdDesc();
        if (all.size() > SNAPSHOT_KEEP) {
            snapshotRepository.deleteAll(all.subList(SNAPSHOT_KEEP, all.size()));
        }
    }

    /* ---------- 도우미 ---------- */

    private record SlotFields(LocalDate day, String place, String booth, int startMin, int endMin,
                              List<String> members, String note) {
    }

    private record MemberFields(String name, String dept, String role, String phone) {
    }

    private SlotFields slotFields(CrewDtos.SlotUpsert request) {
        Set<String> roster = new HashSet<>();
        memberRepository.findAll().forEach(member -> roster.add(member.getName()));
        return slotFields(request, roster);
    }

    private SlotFields slotFields(CrewDtos.SlotUpsert request, Set<String> roster) {
        if (request == null) {
            throw new ResponseStatusException(BAD_REQUEST, "고칠 내용이 없어요.");
        }
        LocalDate day = parseDay(request.day());
        String place = required(request.place(), 40, "장소를 적어 주세요.");
        String booth = required(request.booth(), 40, "부스(맡은 일)를 적어 주세요.");
        int start = request.startMin() == null ? -1 : request.startMin();
        int end = request.endMin() == null ? -1 : request.endMin();
        if (start < 0 || end > MAX_MINUTE || end <= start) {
            throw new ResponseStatusException(BAD_REQUEST, "시간을 다시 봐 주세요. 끝나는 시간이 시작보다 늦어야 해요.");
        }
        LinkedHashSet<String> members = new LinkedHashSet<>();
        for (String raw : request.members() == null ? List.<String>of() : request.members()) {
            String name = clean(raw, 30);
            if (name == null) {
                continue;
            }
            if (!roster.contains(name)) {
                throw new ResponseStatusException(BAD_REQUEST, "명단에 없는 이름이에요: " + name);
            }
            members.add(name);
        }
        String joined = String.join(",", members);
        if (joined.length() > 1000) {
            throw new ResponseStatusException(BAD_REQUEST, "한 칸에 사람이 너무 많아요.");
        }
        return new SlotFields(day, place, booth, start, end, List.copyOf(members), clean(request.note(), 200));
    }

    private MemberFields memberFields(CrewDtos.MemberUpsert request) {
        if (request == null) {
            throw new ResponseStatusException(BAD_REQUEST, "고칠 내용이 없어요.");
        }
        String name = required(request.name(), 30, "이름을 적어 주세요.");
        if (name.contains(",")) {
            throw new ResponseStatusException(BAD_REQUEST, "이름에 쉼표는 쓸 수 없어요.");
        }
        String dept = Objects.requireNonNullElse(clean(request.dept(), 30), "");
        String role = Objects.requireNonNullElse(clean(request.role(), 20), "");
        return new MemberFields(name, dept, role, normalizePhone(request.phone()));
    }

    static String normalizePhone(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("\\D", "");
        if (digits.length() == 11 && digits.startsWith("01")) {
            return digits.substring(0, 3) + "-" + digits.substring(3, 7) + "-" + digits.substring(7);
        }
        if (digits.length() == 10 && digits.startsWith("01")) {
            return digits.substring(0, 3) + "-" + digits.substring(3, 6) + "-" + digits.substring(6);
        }
        throw new ResponseStatusException(BAD_REQUEST, "휴대폰 번호를 다시 봐 주세요 (예: 010-1234-5678).");
    }

    private static LocalDate parseDay(String raw) {
        try {
            return LocalDate.parse(raw == null ? "" : raw.trim());
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "날짜를 다시 봐 주세요.");
        }
    }

    private static String clean(String raw, int max) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim().replaceAll("\\s+", " ");
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }

    private static String required(String raw, int max, String message) {
        String value = clean(raw, max);
        if (value == null) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return value;
    }

    private static String actor(String by) {
        String name = clean(by, 30);
        return name == null ? "누군가" : name;
    }

    private CrewMember findMember(Long memberId) {
        return memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "명단에 없는 사람이에요."));
    }

    private void log(String by, String text) {
        String trimmed = text.length() > 300 ? text.substring(0, 299) + "…" : text;
        logRepository.save(new CrewLog(Instant.now(), actor(by), trimmed));
    }

    /** 저장이 끝난(커밋된) 뒤에 올린다. 먼저 올리면 그 사이 물어본 화면이 새 번호와 옛 내용을 같이 받아 멈춰 버린다. */
    private void bump() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    version.incrementAndGet();
                }
            });
            return;
        }
        version.incrementAndGet();
    }

    static String clock(int minute) {
        int hour = minute / 60;
        int min = minute % 60;
        if (hour >= 24) {
            return hour == 24 && min == 0 ? "자정" : String.format("새벽 %d:%02d", hour - 24, min);
        }
        return String.format("%d:%02d", hour, min);
    }

    private static String shortDay(LocalDate day) {
        return String.format("%d.%02d", day.getMonthValue(), day.getDayOfMonth());
    }

    private static String label(CrewSlot slot) {
        return shortDay(slot.getDay()) + " " + slot.getBooth() + " " + clock(slot.getStartMin()) + "–" + clock(slot.getEndMin());
    }

    private static String names(List<String> members) {
        return members.isEmpty() ? "사람 없음" : String.join(", ", members);
    }

    private static CrewDtos.Member toDto(CrewMember member) {
        return new CrewDtos.Member(
                member.getId(),
                member.getName(),
                member.getDept(),
                member.getRole(),
                member.getPhone(),
                member.getSortOrder(),
                member.getStatus(),
                member.getStatusMemo(),
                member.getStatusAt() == null ? null : member.getStatusAt().toEpochMilli(),
                member.getReliefName(),
                member.getLocation(),
                member.getLocationAt() == null ? null : member.getLocationAt().toEpochMilli()
        );
    }

    private static CrewDtos.Slot toDto(CrewSlot slot) {
        return new CrewDtos.Slot(
                slot.getId(),
                slot.getDay().toString(),
                slot.getPlace(),
                slot.getBooth(),
                slot.getStartMin(),
                slot.getEndMin(),
                slot.memberList(),
                slot.getNote(),
                slot.getSortOrder(),
                slot.getUpdatedAt().toEpochMilli(),
                slot.getUpdatedBy()
        );
    }
}
