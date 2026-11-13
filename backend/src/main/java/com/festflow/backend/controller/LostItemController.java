package com.festflow.backend.controller;

import com.festflow.backend.dto.LostItemClaimRequestDto;
import com.festflow.backend.dto.LostItemResponseDto;
import com.festflow.backend.dto.LostItemStatusUpdateRequestDto;
import com.festflow.backend.dto.LostItemUpdateRequestDto;
import com.festflow.backend.dto.StaffMemberResponseDto;
import com.festflow.backend.service.LostItemService;
import com.festflow.backend.service.StaffService;
import com.festflow.backend.service.UploadStorageService;
import com.festflow.backend.service.stream.StreamService;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

import static org.springframework.http.HttpStatus.FORBIDDEN;

@RestController
@RequestMapping("/api/lost-items")
public class LostItemController {

    private final LostItemService lostItemService;
    private final StaffService staffService;
    private final StreamService streamService;
    private final UploadStorageService uploadStorageService;

    public LostItemController(
            LostItemService lostItemService,
            StaffService staffService,
            StreamService streamService,
            UploadStorageService uploadStorageService
    ) {
        this.lostItemService = lostItemService;
        this.staffService = staffService;
        this.streamService = streamService;
        this.uploadStorageService = uploadStorageService;
    }

    @GetMapping
    public List<LostItemResponseDto> getAll(
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken,
            Authentication authentication
    ) {
        boolean canSeePrivateContacts = hasAdminRole(authentication) || isValidStaffToken(staffToken);
        return lostItemService.getAll(!canSeePrivateContacts);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LostItemResponseDto create(
            @RequestParam("title") String title,
            @RequestParam("description") String description,
            @RequestParam("category") String category,
            @RequestParam("foundLocation") String foundLocation,
            @RequestParam(value = "finderContact", required = false) String finderContact,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken,
            Authentication authentication
        ) throws IOException {
        // 이번 축제는 본부 스태프·관리자만 등록한다. 손님은 목록을 보고 '내 물건이에요' 만 보낸다.
        Reporter reporter = resolveReporter(authentication, staffToken);
        String imageUrl = file == null || file.isEmpty() ? null : uploadStorageService.saveImage(file, "lost-item");
        LostItemResponseDto created = lostItemService.create(
                title,
                description,
                category,
                foundLocation,
                finderContact,
                imageUrl,
                reporter.type(),
                reporter.ref()
        );
        streamService.publishLostItems(lostItemService.getAll(true));
        return created;
    }

    @PutMapping("/{id}/status")
    public LostItemResponseDto updateStatus(
            @PathVariable Long id,
            @RequestBody LostItemStatusUpdateRequestDto requestDto,
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken,
            Authentication authentication
    ) {
        resolveReporter(authentication, staffToken);
        LostItemResponseDto updated = lostItemService.updateStatus(id, requestDto);
        streamService.publishLostItems(lostItemService.getAll(true));
        return updated;
    }

    @PutMapping("/{id}")
    public LostItemResponseDto update(
            @PathVariable Long id,
            @RequestBody LostItemUpdateRequestDto requestDto,
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken,
            Authentication authentication
    ) {
        resolveReporter(authentication, staffToken);
        LostItemResponseDto updated = lostItemService.update(id, requestDto);
        streamService.publishLostItems(lostItemService.getAll(true));
        return updated;
    }

    @PutMapping("/{id}/claim")
    public LostItemResponseDto claim(
            @PathVariable Long id,
            @RequestBody LostItemClaimRequestDto requestDto
    ) {
        // 손님에게 돌아가는 응답이라 연락처를 가린 형태로 준다.
        LostItemResponseDto updated = lostItemService.claim(id, requestDto);
        streamService.publishLostItems(lostItemService.getAll(true));
        return updated;
    }

    @DeleteMapping("/{id}")
    public void delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-Staff-Token", required = false) String staffToken,
            Authentication authentication
    ) {
        resolveReporter(authentication, staffToken);
        lostItemService.delete(id);
        streamService.publishLostItems(lostItemService.getAll(true));
    }

    private Reporter resolveReporter(Authentication authentication, String staffToken) {
        if (hasAdminRole(authentication)) {
            return new Reporter("ADMIN", authentication.getName());
        }
        if (staffToken != null && !staffToken.isBlank()) {
            StaffMemberResponseDto staff = staffService.authenticateByToken(staffToken);
            return new Reporter("STAFF", staff.staffNo());
        }
        throw new ResponseStatusException(FORBIDDEN, "Only admin or staff can modify lost items.");
    }

    private boolean hasAdminRole(Authentication authentication) {
        return authentication != null && authentication.getAuthorities() != null
                && authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    private boolean isValidStaffToken(String staffToken) {
        if (staffToken == null || staffToken.isBlank()) {
            return false;
        }
        try {
            staffService.authenticateByToken(staffToken);
            return true;
        } catch (ResponseStatusException ignored) {
            return false;
        }
    }

    private record Reporter(String type, String ref) {
    }
}
