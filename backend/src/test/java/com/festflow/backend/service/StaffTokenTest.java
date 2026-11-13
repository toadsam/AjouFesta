package com.festflow.backend.service;

import com.festflow.backend.dto.StaffLoginRequestDto;
import com.festflow.backend.dto.StaffLoginResponseDto;
import com.festflow.backend.entity.StaffMember;
import com.festflow.backend.repository.StaffMemberRepository;
import com.festflow.backend.repository.StaffSessionRepository;
import com.festflow.backend.security.JwtService;
import com.festflow.backend.service.stream.StreamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;

class StaffTokenTest {

    private static final String TEST_SECRET = "test-only-secret-test-only-secret-0123456789";

    private StaffMemberRepository staffMemberRepository;
    private StaffService staffService;
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        staffMemberRepository = Mockito.mock(StaffMemberRepository.class);
        StaffSessionRepository sessionRepository = Mockito.mock(StaffSessionRepository.class);
        Mockito.when(sessionRepository.findByToken(anyString())).thenReturn(Optional.empty());
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        Mockito.when(passwordEncoder.matches("right-pin", "hash")).thenReturn(true);
        jwtService = new JwtService(TEST_SECRET, 3_600_000L);

        StaffMember member = Mockito.mock(StaffMember.class);
        Mockito.when(member.getId()).thenReturn(1L);
        Mockito.when(member.getStaffNo()).thenReturn("S01");
        Mockito.when(member.getPinHash()).thenReturn("hash");
        Mockito.when(staffMemberRepository.findById(1L)).thenReturn(Optional.of(member));
        Mockito.when(staffMemberRepository.findByStaffNoIgnoreCase("S01")).thenReturn(Optional.of(member));

        staffService = new StaffService(
                staffMemberRepository,
                sessionRepository,
                passwordEncoder,
                Mockito.mock(NoticeService.class),
                Mockito.mock(BoothService.class),
                Mockito.mock(StreamService.class),
                jwtService,
                false
        );
    }

    @Test
    void madeUpTokenInTheOldFormatIsRejected() {
        // 예전에는 "staff-{id}-{미래 숫자}-아무거나" 를 지어내면 통과했다.
        assertThatThrownBy(() -> staffService.authenticateByToken("staff-1-9999999999999-x"))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> staffService.authenticateByToken("demo-staff-1-9999999999999-x"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void tokenFromLoginIsAccepted() {
        StaffLoginResponseDto login = staffService.login(new StaffLoginRequestDto("S01", "right-pin"));

        assertThat(staffService.authenticateByToken(login.staffToken()).staffNo()).isEqualTo("S01");
    }

    @Test
    void tokenSignedForAnotherRoleOrAnotherSecretIsRejected() {
        String adminToken = jwtService.generateToken("1", "ADMIN");
        assertThatThrownBy(() -> staffService.authenticateByToken(adminToken))
                .isInstanceOf(ResponseStatusException.class);

        String foreign = new JwtService("another-secret-another-secret-0123456789abc", 3_600_000L)
                .generateToken("1", "STAFF", 3_600_000L);
        assertThatThrownBy(() -> staffService.authenticateByToken(foreign))
                .isInstanceOf(ResponseStatusException.class);
    }
}
