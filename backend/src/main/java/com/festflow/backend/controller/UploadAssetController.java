package com.festflow.backend.controller;

import com.festflow.backend.service.UploadStorageService;
import com.festflow.backend.service.UploadThumbnailService;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.time.Duration;

@RestController
public class UploadAssetController {

    private final UploadStorageService uploadStorageService;
    private final UploadThumbnailService uploadThumbnailService;

    public UploadAssetController(UploadStorageService uploadStorageService, UploadThumbnailService uploadThumbnailService) {
        this.uploadStorageService = uploadStorageService;
        this.uploadThumbnailService = uploadThumbnailService;
    }

    /** w(240 · 480 · 960)를 주면 그 폭으로 줄인 JPEG 를 내려준다. 목록 화면은 이쪽을 쓴다. */
    @GetMapping("/uploads/{filename:.+}")
    public ResponseEntity<Resource> getUpload(
            @PathVariable String filename,
            @RequestParam(value = "w", required = false) Integer width
    ) throws IOException {
        if (UploadThumbnailService.isAllowedWidth(width)) {
            byte[] thumbnail = uploadThumbnailService.thumbnail("/uploads/" + filename, width);
            if (thumbnail != null) {
                return ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_JPEG)
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                        .body(new ByteArrayResource(thumbnail));
            }
        }
        UploadStorageService.StoredObject object = uploadStorageService.loadStoredObject("/uploads/" + filename);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(object.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .body(object.resource());
    }
}
