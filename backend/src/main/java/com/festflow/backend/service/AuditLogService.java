package com.festflow.backend.service;

import com.festflow.backend.dto.AuditLogResponseDto;
import com.festflow.backend.entity.AuditLog;
import com.festflow.backend.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void log(String adminUsername, String action, String targetType, Long targetId, String details) {
        auditLogRepository.save(new AuditLog(
                adminUsername != null ? adminUsername : "unknown",
                action,
                targetType,
                targetId,
                details
        ));
    }

    public List<AuditLogResponseDto> getRecentLogs() {
        return auditLogRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map(log -> new AuditLogResponseDto(
                        log.getId(),
                        log.getAdminUsername(),
                        log.getAction(),
                        log.getTargetType(),
                        log.getTargetId(),
                        log.getDetails(),
                        log.getCreatedAt()
                ))
                .toList();
    }
}
