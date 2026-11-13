package com.festflow.backend.controller.admin;

import com.festflow.backend.dto.BoothLiveStatusRequestDto;
import com.festflow.backend.dto.BoothReorderRequestDto;
import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.BoothUpsertRequestDto;
import com.festflow.backend.service.AuditLogService;
import com.festflow.backend.service.BoothService;
import com.festflow.backend.service.UploadStorageService;
import com.festflow.backend.service.stream.StreamService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
@RestController
@RequestMapping("/api/admin/booths")
public class AdminBoothController {

    private final BoothService boothService;
    private final AuditLogService auditLogService;
    private final StreamService streamService;
    private final UploadStorageService uploadStorageService;

    public AdminBoothController(
            BoothService boothService,
            AuditLogService auditLogService,
            StreamService streamService,
            UploadStorageService uploadStorageService
    ) {
        this.boothService = boothService;
        this.auditLogService = auditLogService;
        this.streamService = streamService;
        this.uploadStorageService = uploadStorageService;
    }

    @PostMapping
    public BoothResponseDto createBooth(@Valid @RequestBody BoothUpsertRequestDto requestDto, Authentication authentication) {
        BoothResponseDto created = boothService.createBooth(requestDto);
        auditLogService.log(authentication.getName(), "CREATE", "BOOTH", created.id(), created.name());
        streamService.publishBooths(boothService.getAllBooths());
        return created;
    }

    @PutMapping("/{id}")
    public BoothResponseDto updateBooth(@PathVariable Long id, @Valid @RequestBody BoothUpsertRequestDto requestDto, Authentication authentication) {
        BoothResponseDto updated = boothService.updateBooth(id, requestDto);
        auditLogService.log(authentication.getName(), "UPDATE", "BOOTH", id, updated.name());
        streamService.publishBooths(boothService.getAllBooths());
        return updated;
    }

    @PutMapping("/{id}/live-status")
    public BoothResponseDto updateLiveStatus(@PathVariable Long id, @RequestBody BoothLiveStatusRequestDto requestDto, Authentication authentication) {
        BoothResponseDto updated = boothService.updateLiveStatus(id, requestDto);
        auditLogService.log(authentication.getName(), "LIVE_STATUS", "BOOTH", id, "대기/잔여/운영메모 갱신");
        streamService.publishBooths(boothService.getAllBooths());
        return updated;
    }

    @PostMapping(value = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BoothResponseDto uploadImage(@PathVariable Long id, @RequestParam("file") MultipartFile file, Authentication authentication) throws IOException {
        String imageUrl = uploadStorageService.saveImage(file, "booth-" + id);
        BoothResponseDto updated = boothService.updateBoothImage(id, imageUrl);
        auditLogService.log(authentication.getName(), "UPLOAD_IMAGE", "BOOTH", id, imageUrl);
        streamService.publishBooths(boothService.getAllBooths());
        return updated;
    }

    @PutMapping("/reorder")
    public void reorderBooths(@Valid @RequestBody BoothReorderRequestDto requestDto, Authentication authentication) {
        boothService.reorderBooths(requestDto);
        auditLogService.log(authentication.getName(), "REORDER", "BOOTH", null, "총 " + requestDto.boothIds().size() + "개 정렬");
        streamService.publishBooths(boothService.getAllBooths());
    }

    @DeleteMapping("/{id}")
    public void deleteBooth(@PathVariable Long id, Authentication authentication) {
        boothService.deleteBooth(id);
        auditLogService.log(authentication.getName(), "DELETE", "BOOTH", id, "부스 삭제");
        streamService.publishBooths(boothService.getAllBooths());
    }
}
