package com.festflow.backend.service;

import com.festflow.backend.dto.NoticeResponseDto;
import com.festflow.backend.dto.NoticeUpsertRequestDto;
import com.festflow.backend.entity.Notice;
import com.festflow.backend.repository.NoticeRepository;
import com.festflow.backend.service.stream.StreamService;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class NoticeService {

    private final NoticeRepository noticeRepository;
    private final StreamService streamService;

    public NoticeService(NoticeRepository noticeRepository, StreamService streamService) {
        this.noticeRepository = noticeRepository;
        this.streamService = streamService;
    }

    public List<NoticeResponseDto> getActiveNotices() {
        return noticeRepository.findByActiveTrueOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .toList();
    }

    public List<NoticeResponseDto> getAllNotices() {
        return noticeRepository.findAll().stream()
                .sorted(Comparator.comparing(Notice::getCreatedAt).reversed())
                .map(this::toDto)
                .toList();
    }

    public NoticeResponseDto createNotice(NoticeUpsertRequestDto requestDto) {
        Notice saved = noticeRepository.save(new Notice(
                requestDto.title(),
                requestDto.content(),
                requestDto.category(),
                requestDto.active()
        ));

        broadcastActiveNotices();
        return toDto(saved);
    }

    public NoticeResponseDto updateNotice(Long noticeId, NoticeUpsertRequestDto requestDto) {
        Notice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "공지를 찾을 수 없습니다."));

        notice.update(requestDto.title(), requestDto.content(), requestDto.category(), requestDto.active());
        Notice saved = noticeRepository.save(notice);
        broadcastActiveNotices();

        return toDto(saved);
    }

    /** 손님이 공지를 펼쳤다. 기기당 한 번만 보내도록 프런트가 거른다. */
    @org.springframework.transaction.annotation.Transactional
    public void recordView(Long noticeId) {
        noticeRepository.incrementViewCount(noticeId);
    }

    public void deleteNotice(Long noticeId) {
        if (!noticeRepository.existsById(noticeId)) {
            throw new ResponseStatusException(NOT_FOUND, "공지를 찾을 수 없습니다.");
        }

        noticeRepository.deleteById(noticeId);
        broadcastActiveNotices();
    }

    public void broadcastActiveNotices() {
        streamService.publishNotices(getActiveNotices());
    }

    private NoticeResponseDto toDto(Notice notice) {
        return new NoticeResponseDto(
                notice.getId(),
                notice.getTitle(),
                notice.getContent(),
                notice.getCategory(),
                notice.isActive(),
                notice.getCreatedAt(),
                notice.getUpdatedAt(),
                notice.getViewCount()
        );
    }
}
