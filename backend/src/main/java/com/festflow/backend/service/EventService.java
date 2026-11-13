package com.festflow.backend.service;

import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.dto.EventBulkStatusRequestDto;
import com.festflow.backend.dto.EventUpsertRequestDto;
import com.festflow.backend.entity.FestivalEvent;
import com.festflow.backend.repository.EventRepository;
import com.festflow.backend.service.stream.StreamService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final StreamService streamService;

    public EventService(EventRepository eventRepository, StreamService streamService) {
        this.eventRepository = eventRepository;
        this.streamService = streamService;
    }

    public List<EventResponseDto> getAllEvents() {
        LocalDateTime now = LocalDateTime.now();

        return eventRepository.findAll().stream()
                .sorted(Comparator.comparing(FestivalEvent::getStartTime))
                .map(event -> {
                    String status = resolveStatus(event, now);
                    return toDto(event, status);
                })
                .toList();
    }

    public EventResponseDto createEvent(EventUpsertRequestDto requestDto) {
        FestivalEvent event = new FestivalEvent(
                requestDto.title(),
                requestDto.startTime(),
                requestDto.endTime(),
                "\uC608\uC815",
                requestDto.imageUrl(),
                requestDto.imageCredit(),
                requestDto.imageFocus()
        );
        event.setStatusOverride(requestDto.statusOverride());
        event.update(
                requestDto.title(),
                requestDto.startTime(),
                requestDto.endTime(),
                requestDto.imageUrl(),
                requestDto.imageCredit(),
                requestDto.imageFocus(),
                requestDto.statusOverride(),
                requestDto.liveMessage(),
                requestDto.delayMinutes()
        );
        FestivalEvent saved = eventRepository.save(event);
        return toDto(saved, resolveStatus(saved, LocalDateTime.now()));
    }

    public EventResponseDto getEventById(Long eventId) {
        FestivalEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "공연을 찾을 수 없습니다."));
        return toDto(event, resolveStatus(event, LocalDateTime.now()));
    }

    public EventResponseDto updateEvent(Long eventId, EventUpsertRequestDto requestDto) {
        FestivalEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "공연을 찾을 수 없습니다."));

        event.update(
                requestDto.title(),
                requestDto.startTime(),
                requestDto.endTime(),
                requestDto.imageUrl(),
                requestDto.imageCredit(),
                requestDto.imageFocus(),
                requestDto.statusOverride(),
                requestDto.liveMessage(),
                requestDto.delayMinutes()
        );
        FestivalEvent saved = eventRepository.save(event);
        return toDto(saved, resolveStatus(saved, LocalDateTime.now()));
    }

    /** 여러 공연의 현장 상태를 한 번에. 비가 오면 야외 일정 전부를 "지연 30분"으로 미는 용도. */
    public List<EventResponseDto> bulkUpdateStatus(EventBulkStatusRequestDto requestDto) {
        if (requestDto == null || requestDto.eventIds() == null || requestDto.eventIds().isEmpty()) {
            return List.of();
        }
        String statusOverride = requestDto.statusOverride() == null || requestDto.statusOverride().isBlank() ? null : requestDto.statusOverride().trim();
        LocalDateTime now = LocalDateTime.now();
        List<FestivalEvent> events = eventRepository.findAllById(requestDto.eventIds());
        for (FestivalEvent event : events) {
            event.update(
                    event.getTitle(),
                    event.getStartTime(),
                    event.getEndTime(),
                    event.getImageUrl(),
                    event.getImageCredit(),
                    event.getImageFocus(),
                    statusOverride,
                    requestDto.liveMessage() == null ? event.getLiveMessage() : requestDto.liveMessage(),
                    requestDto.delayMinutes() == null ? event.getDelayMinutes() : requestDto.delayMinutes()
            );
        }
        List<FestivalEvent> saved = eventRepository.saveAll(events);
        List<EventResponseDto> result = saved.stream().map(event -> toDto(event, resolveStatus(event, now))).toList();
        streamService.publishEvents(getAllEvents());
        return result;
    }

    public void deleteEvent(Long eventId) {
        if (!eventRepository.existsById(eventId)) {
            throw new ResponseStatusException(NOT_FOUND, "공연을 찾을 수 없습니다.");
        }
        eventRepository.deleteById(eventId);
    }

    @Scheduled(fixedDelay = 30000)
    public void broadcastEventUpdates() {
        streamService.publishEvents(getAllEvents());
    }

    private EventResponseDto toDto(FestivalEvent event, String status) {
        return new EventResponseDto(
                event.getId(),
                event.getTitle(),
                event.getStartTime(),
                event.getEndTime(),
                status,
                event.getImageUrl(),
                event.getImageCredit(),
                event.getImageFocus(),
                event.getStatusOverride(),
                event.getLiveMessage(),
                event.getDelayMinutes(),
                event.getStatusUpdatedAt()
        );
    }

    private String resolveStatus(FestivalEvent event, LocalDateTime now) {
        String override = normalizeStatus(event.getStatusOverride());
        if ("\uCDE8\uC18C".equals(override)) {
            return persistStatus(event, override);
        }

        boolean clearedOverride = false;
        if (event.getEndTime() != null && now.isAfter(event.getEndTime())) {
            if (override != null) {
                event.setStatusOverride(null);
                clearedOverride = true;
            }
            return persistStatus(event, "\uC885\uB8CC", clearedOverride);
        }

        if (override != null) {
            return persistStatus(event, override);
        }

        if (event.getStartTime() != null && now.isBefore(event.getStartTime())) {
            return persistStatus(event, "\uC608\uC815");
        }

        return persistStatus(event, "\uC9C4\uD589\uC911");
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        return status.trim();
    }

    private String persistStatus(FestivalEvent event, String status) {
        return persistStatus(event, status, false);
    }

    private String persistStatus(FestivalEvent event, String status, boolean forceSave) {
        if (!status.equals(event.getStatus())) {
            event.setStatus(status);
            forceSave = true;
        }
        if (forceSave) {
            eventRepository.save(event);
        }
        return status;
    }
}
