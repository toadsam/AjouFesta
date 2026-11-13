package com.festflow.backend.dto;

import java.util.List;

public record OpsMasterBootstrapDto(
        List<BoothResponseDto> booths,
        List<EventResponseDto> events,
        List<NoticeResponseDto> notices,
        AdminDashboardKpiDto kpi,
        List<AuditLogResponseDto> auditLogs,
        AiMatchMasterSummaryDto aiMatch
) {
}

