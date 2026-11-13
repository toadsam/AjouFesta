package com.festflow.backend.controller.admin;

import com.festflow.backend.dto.AdminStaffUpdateRequestDto;
import com.festflow.backend.dto.StaffMemberResponseDto;
import com.festflow.backend.service.AuditLogService;
import com.festflow.backend.service.StaffService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/staff")
public class AdminStaffController {

    private final StaffService staffService;
    private final AuditLogService auditLogService;

    public AdminStaffController(StaffService staffService, AuditLogService auditLogService) {
        this.staffService = staffService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<StaffMemberResponseDto> getStaffList() {
        return staffService.getAllStaffMembers();
    }

    @PutMapping("/{id}")
    public StaffMemberResponseDto updateStaff(
            @PathVariable Long id,
            @RequestBody AdminStaffUpdateRequestDto requestDto,
            Authentication authentication
    ) {
        StaffMemberResponseDto updated = staffService.updateByAdmin(id, requestDto);
        auditLogService.log(authentication.getName(), "UPDATE", "STAFF", id, updated.staffNo());
        return updated;
    }
}

