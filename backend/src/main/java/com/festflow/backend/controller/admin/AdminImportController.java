package com.festflow.backend.controller.admin;

import com.festflow.backend.service.AdminImportService;
import com.festflow.backend.service.AuditLogService;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/import")
public class AdminImportController {

    private final AdminImportService adminImportService;
    private final AuditLogService auditLogService;

    public AdminImportController(AdminImportService adminImportService, AuditLogService auditLogService) {
        this.adminImportService = adminImportService;
        this.auditLogService = auditLogService;
    }

    @PostMapping(value = "/booths", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> importBooths(@RequestParam("file") MultipartFile file, Authentication authentication) throws IOException {
        int count = adminImportService.importBoothsCsv(file);
        auditLogService.log(authentication.getName(), "IMPORT", "BOOTH", null, "CSV 업로드 " + count + "건");
        return Map.of("imported", count);
    }

    @PostMapping(value = "/events", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> importEvents(@RequestParam("file") MultipartFile file, Authentication authentication) throws IOException {
        int count = adminImportService.importEventsCsv(file);
        auditLogService.log(authentication.getName(), "IMPORT", "EVENT", null, "CSV 업로드 " + count + "건");
        return Map.of("imported", count);
    }
}
