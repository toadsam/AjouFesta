package com.festflow.backend.service;

import com.festflow.backend.dto.LostItemClaimRequestDto;
import com.festflow.backend.dto.LostItemResponseDto;
import com.festflow.backend.dto.LostItemStatusUpdateRequestDto;
import com.festflow.backend.dto.LostItemUpdateRequestDto;
import com.festflow.backend.entity.LostItem;
import com.festflow.backend.repository.LostItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class LostItemService {

    private final LostItemRepository lostItemRepository;

    public LostItemService(LostItemRepository lostItemRepository) {
        this.lostItemRepository = lostItemRepository;
    }

    @Transactional(readOnly = true)
    public List<LostItemResponseDto> getAll() {
        return getAll(false);
    }

    @Transactional(readOnly = true)
    public List<LostItemResponseDto> getAll(boolean maskContacts) {
        return lostItemRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(item -> toDto(item, maskContacts))
                .toList();
    }

    @Transactional
    public LostItemResponseDto create(
            String title,
            String description,
            String category,
            String foundLocation,
            String finderContact,
            String imageUrl,
            String reporterType,
            String reporterRef
    ) {
        LostItem saved = lostItemRepository.save(new LostItem(
                title,
                description,
                category,
                foundLocation,
                finderContact,
                imageUrl,
                "REGISTERED",
                reporterType,
                reporterRef
        ));
        return toDto(saved);
    }

    @Transactional
    public LostItemResponseDto updateStatus(Long id, LostItemStatusUpdateRequestDto requestDto) {
        LostItem item = lostItemRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Lost item not found."));
        String nextStatus = normalizeStatus(requestDto.status());
        String note = trimOrNull(requestDto.resolveNote());

        item.update(
                item.getTitle(),
                item.getDescription(),
                item.getCategory(),
                item.getFoundLocation(),
                item.getFinderContact(),
                item.getImageUrl(),
                nextStatus,
                note
        );
        LostItem saved = lostItemRepository.save(item);
        return toDto(saved);
    }

    @Transactional
    public LostItemResponseDto update(Long id, LostItemUpdateRequestDto requestDto) {
        LostItem item = lostItemRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Lost item not found."));

        String title = trimRequired(requestDto.title(), "title");
        String description = trimRequired(requestDto.description(), "description");
        String category = trimOrDefault(requestDto.category(), "ETC");
        String foundLocation = trimRequired(requestDto.foundLocation(), "foundLocation");
        String finderContact = trimOrNull(requestDto.finderContact());
        String imageUrl = trimOrNull(requestDto.imageUrl());
        String status = normalizeStatus(requestDto.status());
        String resolveNote = trimOrNull(requestDto.resolveNote());

        item.update(
                title,
                description,
                category,
                foundLocation,
                finderContact,
                imageUrl,
                status,
                resolveNote
        );
        LostItem saved = lostItemRepository.save(item);
        return toDto(saved);
    }

    @Transactional
    public LostItemResponseDto claim(Long id, LostItemClaimRequestDto requestDto) {
        LostItem item = lostItemRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Lost item not found."));
        if ("RETURNED".equals(item.getStatus())) {
            throw new ResponseStatusException(BAD_REQUEST, "이미 주인에게 돌아간 물건이에요.");
        }
        if ("OWNER_CLAIMED".equals(item.getStatus())) {
            // 먼저 온 요청을 다른 사람이 덮어쓰지 못하게 한다. 본부에서 확인 후 상태를 바꾸면 다시 열린다.
            throw new ResponseStatusException(CONFLICT, "이미 주인 확인 요청이 들어와 있어요. 본부에 직접 문의해 주세요.");
        }

        String claimantName = trimRequired(requestDto.claimantName(), "claimantName");
        String claimantContact = trimRequired(requestDto.claimantContact(), "claimantContact");
        String claimantNote = trimOrNull(requestDto.claimantNote());

        item.markClaim(claimantName, claimantContact, claimantNote, "OWNER_CLAIMED");
        LostItem saved = lostItemRepository.save(item);
        return toDto(saved, true);
    }

    @Transactional
    public void delete(Long id) {
        LostItem item = lostItemRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Lost item not found."));
        lostItemRepository.delete(item);
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "REGISTERED";
        }
        String normalized = status.trim().toUpperCase();
        if ("OWNER_CLAIMED".equals(normalized)) {
            return "OWNER_CLAIMED";
        }
        if ("RETURNED".equals(normalized)) {
            return "RETURNED";
        }
        return "REGISTERED";
    }

    private String trimRequired(String value, String field) {
        String trimmed = trimOrNull(value);
        if (trimmed == null) {
            throw new ResponseStatusException(BAD_REQUEST, field + " is required.");
        }
        return trimmed;
    }

    private String trimOrDefault(String value, String fallback) {
        String trimmed = trimOrNull(value);
        return trimmed == null ? fallback : trimmed;
    }

    private String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed;
    }

    private LostItemResponseDto toDto(LostItem item) {
        return toDto(item, false);
    }

    private LostItemResponseDto toDto(LostItem item, boolean maskContacts) {
        return new LostItemResponseDto(
                item.getId(),
                item.getTitle(),
                item.getDescription(),
                item.getCategory(),
                item.getFoundLocation(),
                maskContacts ? maskContact(item.getFinderContact()) : item.getFinderContact(),
                item.getImageUrl(),
                item.getStatus(),
                statusLabel(item.getStatus()),
                item.getReporterType(),
                item.getReporterRef(),
                item.getResolveNote(),
                // 신청자 정보는 본부(스태프·관리자)만 본다. 공개 응답에는 아예 싣지 않는다.
                maskContacts ? null : item.getClaimantName(),
                maskContacts ? null : item.getClaimantContact(),
                maskContacts ? null : item.getClaimantNote(),
                item.getClaimedAt(),
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }

    private String maskContact(String contact) {
        if (contact == null || contact.isBlank()) {
            return contact;
        }
        String trimmed = contact.trim();
        String digits = trimmed.replaceAll("[^0-9]", "");
        if (digits.length() >= 7) {
            return digits.substring(0, 3) + "-****-" + digits.substring(digits.length() - 4);
        }
        if (trimmed.length() <= 4) {
            return "****";
        }
        return trimmed.substring(0, 2) + "****" + trimmed.substring(trimmed.length() - 2);
    }

    private String statusLabel(String status) {
        if ("RETURNED".equals(status)) {
            return "Returned";
        }
        if ("OWNER_CLAIMED".equals(status)) {
            return "Owner Claimed";
        }
        return "Registered";
    }
}
