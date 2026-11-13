package com.festflow.backend.service;

import com.festflow.backend.dto.AdminStaffUpdateRequestDto;
import com.festflow.backend.dto.StaffBootstrapDto;
import com.festflow.backend.dto.StaffLoginRequestDto;
import com.festflow.backend.dto.StaffLoginResponseDto;
import com.festflow.backend.dto.StaffMemberResponseDto;
import com.festflow.backend.dto.StaffStatusUpdateRequestDto;
import com.festflow.backend.entity.StaffMember;
import com.festflow.backend.entity.StaffSession;
import com.festflow.backend.entity.StaffStatus;
import com.festflow.backend.repository.StaffMemberRepository;
import com.festflow.backend.repository.StaffSessionRepository;
import com.festflow.backend.security.JwtService;
import com.festflow.backend.service.stream.StreamService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class StaffService {

    private static final List<String> DEMO_STAFF_NAMES = List.of(
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

    // 스태프 토큰은 서버 비밀값으로 서명한다. 예전 "staff-{id}-{만료}-{uuid}" 는 누구나 지어낼 수 있었다.
    private static final Duration TOKEN_TTL = Duration.ofHours(12);
    private static final String STAFF_ROLE = "STAFF";
    private static final String DEMO_STAFF_ROLE = "STAFF_DEMO";

    private final StaffMemberRepository staffMemberRepository;
    private final StaffSessionRepository staffSessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final NoticeService noticeService;
    private final BoothService boothService;
    private final StreamService streamService;
    private final JwtService jwtService;
    private final boolean demoLoginEnabled;

    public StaffService(
            StaffMemberRepository staffMemberRepository,
            StaffSessionRepository staffSessionRepository,
            PasswordEncoder passwordEncoder,
            NoticeService noticeService,
            BoothService boothService,
            StreamService streamService,
            JwtService jwtService,
            @Value("${app.staff.demo-login.enabled:false}") boolean demoLoginEnabled
    ) {
        this.staffMemberRepository = staffMemberRepository;
        this.staffSessionRepository = staffSessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.noticeService = noticeService;
        this.boothService = boothService;
        this.streamService = streamService;
        this.jwtService = jwtService;
        this.demoLoginEnabled = demoLoginEnabled;
    }

    @Transactional
    public StaffLoginResponseDto login(StaffLoginRequestDto requestDto) {
        String normalizedNo = requestDto.staffNo().trim().toUpperCase();
        String pin = requestDto.pin().trim();
        DemoStaff demoStaff = resolveDemoStaffCredentials(normalizedNo, pin);
        if (demoStaff != null) {
            LocalDateTime expiresAt = LocalDateTime.now().plus(TOKEN_TTL);
            return new StaffLoginResponseDto(createDemoStaffToken(demoStaff.number()), expiresAt, toDemoDto(demoStaff));
        }

        StaffMember member = staffMemberRepository.findByStaffNoIgnoreCase(normalizedNo)
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Invalid staff credentials."));

        if (!matchesStaffPin(pin, member)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid staff credentials.");
        }

        LocalDateTime expiresAt = LocalDateTime.now().plus(TOKEN_TTL);
        String token = createStaffToken(member);

        return new StaffLoginResponseDto(token, expiresAt, toDto(member));
    }

    @Transactional
    public StaffBootstrapDto bootstrap(String staffToken) {
        DemoStaff demoStaff = resolveDemoStaffToken(staffToken);
        if (demoStaff != null) {
            return new StaffBootstrapDto(
                    toDemoDto(demoStaff),
                    getDemoStaffMembers(),
                    noticeService.getActiveNotices(),
                    boothService.getAllBooths()
            );
        }

        StaffMember me = requireStaffByToken(staffToken);
        return new StaffBootstrapDto(
                toDto(me),
                getAllStaffMembers(),
                noticeService.getActiveNotices(),
                boothService.getAllBooths()
        );
    }

    @Transactional(readOnly = true)
    public List<StaffMemberResponseDto> getAllStaffMembers() {
        return staffMemberRepository.findAll().stream()
                .sorted(Comparator.comparing(StaffMember::getStaffNo))
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public StaffMemberResponseDto updateMyStatus(String staffToken, StaffStatusUpdateRequestDto requestDto) {
        DemoStaff demoStaff = resolveDemoStaffToken(staffToken);
        if (demoStaff != null) {
            StaffStatus status = parseStatus(requestDto.status(), StaffStatus.ON_DUTY);
            return toDemoDto(demoStaff, status, normalizeText(requestDto.currentTask(), 250, "입구 동선 안내"));
        }

        StaffMember me = requireStaffByToken(staffToken);
        StaffStatus nextStatus = parseStatus(requestDto.status(), me.getStatus());
        String nextTask = normalizeText(requestDto.currentTask(), 250, me.getCurrentTask());
        String nextNote = normalizeText(requestDto.currentNote(), 1000, me.getCurrentNote());
        boolean nextLocationSharingEnabled = requestDto.locationSharingEnabled() != null
                ? requestDto.locationSharingEnabled()
                : Boolean.TRUE.equals(me.getLocationSharingEnabled());
        Double nextLatitude = requestDto.latitude() != null ? requestDto.latitude() : me.getLatitude();
        Double nextLongitude = requestDto.longitude() != null ? requestDto.longitude() : me.getLongitude();
        if (!nextLocationSharingEnabled) {
            nextLatitude = null;
            nextLongitude = null;
        }

        me.setLocationSharingEnabled(nextLocationSharingEnabled);
        me.updateRuntime(nextStatus, nextTask, nextNote, nextLatitude, nextLongitude, LocalDateTime.now());
        StaffMember saved = staffMemberRepository.save(me);
        streamService.publishStaff(getAllStaffMembers());
        return toDto(saved);
    }

    @Transactional
    public StaffMemberResponseDto updateByAdmin(Long staffId, AdminStaffUpdateRequestDto requestDto) {
        StaffMember member = staffMemberRepository.findById(staffId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Staff member not found."));

        String nextName = normalizeText(requestDto.name(), 80, member.getName());
        String nextTeam = normalizeText(requestDto.team(), 40, member.getTeam());
        StaffStatus nextStatus = parseStatus(requestDto.status(), member.getStatus());
        String nextTask = normalizeText(requestDto.currentTask(), 250, member.getCurrentTask());
        String nextNote = normalizeText(requestDto.currentNote(), 1000, member.getCurrentNote());
        Double nextLatitude = requestDto.latitude() != null ? requestDto.latitude() : member.getLatitude();
        Double nextLongitude = requestDto.longitude() != null ? requestDto.longitude() : member.getLongitude();

        member.setName(nextName == null || nextName.isBlank() ? member.getName() : nextName);
        member.setTeam(nextTeam == null || nextTeam.isBlank() ? member.getTeam() : nextTeam);
        member.setAssignedBoothId(requestDto.assignedBoothId());
        member.updateRuntime(nextStatus, nextTask, nextNote, nextLatitude, nextLongitude, LocalDateTime.now());

        StaffMember saved = staffMemberRepository.save(member);
        streamService.publishStaff(getAllStaffMembers());
        return toDto(saved);
    }

    @Transactional
    public void logout(String staffToken) {
        if (staffToken == null || staffToken.isBlank()) {
            return;
        }
        if (resolveDemoStaffToken(staffToken) != null) {
            return;
        }
        staffSessionRepository.findByToken(staffToken).ifPresent(staffSessionRepository::delete);
    }

    @Transactional
    public StaffMemberResponseDto authenticateByToken(String staffToken) {
        DemoStaff demoStaff = resolveDemoStaffToken(staffToken);
        if (demoStaff != null) {
            return toDemoDto(demoStaff);
        }
        return toDto(requireStaffByToken(staffToken));
    }

    private StaffMember requireStaffByToken(String staffToken) {
        if (staffToken == null || staffToken.isBlank()) {
            throw new ResponseStatusException(UNAUTHORIZED, "Staff token is required.");
        }

        StaffMember signedMember = resolveSignedStaffToken(staffToken);
        if (signedMember != null) {
            return signedMember;
        }

        LocalDateTime now = LocalDateTime.now();
        StaffSession session = staffSessionRepository.findByToken(staffToken)
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Invalid staff token."));
        if (session.getExpiresAt().isBefore(now)) {
            staffSessionRepository.delete(session);
            throw new ResponseStatusException(UNAUTHORIZED, "Staff session expired.");
        }

        session.touch(now);
        staffSessionRepository.save(session);
        return session.getStaffMember();
    }

    private boolean matchesStaffPin(String rawPin, StaffMember member) {
        try {
            return passwordEncoder.matches(rawPin, member.getPinHash());
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private DemoStaff resolveDemoStaffCredentials(String staffNo, String pin) {
        if (!demoLoginEnabled || staffNo == null || pin == null || !staffNo.equals(pin)) {
            return null;
        }
        return parseDemoStaffNumber(staffNo);
    }

    private DemoStaff resolveDemoStaffToken(String token) {
        if (!demoLoginEnabled) {
            return null;
        }
        String subject = signedSubject(token, DEMO_STAFF_ROLE);
        return subject == null ? null : parseDemoStaffNumber(subject);
    }

    private DemoStaff parseDemoStaffNumber(String rawNumber) {
        try {
            int number = Integer.parseInt(rawNumber);
            if (number < 1 || number > DEMO_STAFF_NAMES.size()) {
                return null;
            }
            return new DemoStaff(number, DEMO_STAFF_NAMES.get(number - 1));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String createDemoStaffToken(int staffNo) {
        return jwtService.generateToken(String.valueOf(staffNo), DEMO_STAFF_ROLE, TOKEN_TTL.toMillis());
    }

    private List<StaffMemberResponseDto> getDemoStaffMembers() {
        return java.util.stream.IntStream.rangeClosed(1, DEMO_STAFF_NAMES.size())
                .mapToObj(number -> toDemoDto(new DemoStaff(number, DEMO_STAFF_NAMES.get(number - 1))))
                .toList();
    }

    private StaffMemberResponseDto toDemoDto(DemoStaff staff) {
        StaffStatus status = staff.number() % 5 == 1 ? StaffStatus.URGENT
                : staff.number() % 3 == 1 ? StaffStatus.MOVING
                : StaffStatus.ON_DUTY;
        return toDemoDto(staff, status, staff.number() % 2 == 1 ? "입구 동선 안내" : "현장 순찰");
    }

    private StaffMemberResponseDto toDemoDto(DemoStaff staff, StaffStatus status, String task) {
        return new StaffMemberResponseDto(
                (long) staff.number(),
                String.valueOf(staff.number()),
                staff.name(),
                staff.number() % 2 == 1 ? "운영" : "안전",
                status.name(),
                toStatusLabel(status),
                task,
                "",
                null,
                null,
                null,
                true,
                LocalDateTime.now()
        );
    }

    private String createStaffToken(StaffMember member) {
        return jwtService.generateToken(String.valueOf(member.getId()), STAFF_ROLE, TOKEN_TTL.toMillis());
    }

    private StaffMember resolveSignedStaffToken(String token) {
        String subject = signedSubject(token, STAFF_ROLE);
        if (subject == null) {
            return null;
        }
        try {
            return staffMemberRepository.findById(Long.parseLong(subject))
                    .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Invalid staff token."));
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid staff token.");
        }
    }

    /** 서명이 맞고 만료되지 않았으며 역할이 같은 토큰이면 subject, 아니면 null. */
    private String signedSubject(String token, String role) {
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            Claims claims = jwtService.parse(token.trim());
            return role.equals(String.valueOf(claims.get("role"))) ? claims.getSubject() : null;
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    private StaffStatus parseStatus(String input, StaffStatus fallback) {
        if (input == null || input.isBlank()) {
            return fallback;
        }

        String normalized = input.trim().toUpperCase();
        return switch (normalized) {
            case "STANDBY", "대기" -> StaffStatus.STANDBY;
            case "MOVING", "이동" -> StaffStatus.MOVING;
            case "ON_DUTY", "업무중", "업무", "WORKING" -> StaffStatus.ON_DUTY;
            case "URGENT", "긴급" -> StaffStatus.URGENT;
            default -> fallback;
        };
    }

    private String normalizeText(String input, int maxLength, String fallback) {
        if (input == null) {
            return fallback;
        }
        String trimmed = input.trim();
        if (trimmed.isBlank()) {
            return "";
        }
        if (trimmed.length() > maxLength) {
            return trimmed.substring(0, maxLength);
        }
        return trimmed;
    }

    private StaffMemberResponseDto toDto(StaffMember member) {
        StaffStatus status = member.getStatus() != null ? member.getStatus() : StaffStatus.STANDBY;
        return new StaffMemberResponseDto(
                member.getId(),
                member.getStaffNo(),
                member.getName() != null ? member.getName() : "스태프",
                member.getTeam() != null ? member.getTeam() : "운영",
                status.name(),
                toStatusLabel(status),
                member.getCurrentTask(),
                member.getCurrentNote(),
                member.getAssignedBoothId(),
                member.getLatitude(),
                member.getLongitude(),
                Boolean.TRUE.equals(member.getLocationSharingEnabled()),
                member.getLastUpdatedAt()
        );
    }

    private String toStatusLabel(StaffStatus status) {
        return switch (status) {
            case STANDBY -> "대기";
            case MOVING -> "이동";
            case ON_DUTY -> "업무중";
            case URGENT -> "긴급";
        };
    }

    private record DemoStaff(int number, String name) {
    }
}
