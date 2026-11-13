package com.festflow.backend.dto;

import java.util.List;

public record StaffBootstrapDto(
        StaffMemberResponseDto me,
        List<StaffMemberResponseDto> staff,
        List<NoticeResponseDto> notices,
        List<BoothResponseDto> booths
) {
}

