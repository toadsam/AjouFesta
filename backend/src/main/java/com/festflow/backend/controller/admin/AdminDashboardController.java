package com.festflow.backend.controller.admin;

import com.festflow.backend.dto.AdminDashboardKpiDto;
import com.festflow.backend.dto.AuditLogResponseDto;
import com.festflow.backend.service.AdminDashboardService;
import com.festflow.backend.service.AuditLogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;
    private final AuditLogService auditLogService;

    public AdminDashboardController(AdminDashboardService adminDashboardService, AuditLogService auditLogService) {
        this.adminDashboardService = adminDashboardService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/dashboard/kpis")
    public AdminDashboardKpiDto kpis() {
        return adminDashboardService.getKpis();
    }

    @GetMapping("/audit-logs")
    public List<AuditLogResponseDto> auditLogs() {
        return auditLogService.getRecentLogs();
    }
}
