package com.festflow.backend.service;

import com.festflow.backend.dto.GpsLogRequestDto;
import com.festflow.backend.dto.GpsLogResponseDto;
import com.festflow.backend.entity.GpsLog;
import com.festflow.backend.repository.GpsLogRepository;
import com.festflow.backend.service.stream.StreamService;
import org.springframework.stereotype.Service;

@Service
public class GpsService {

    private final GpsLogRepository gpsLogRepository;
    private final BoothService boothService;
    private final StreamService streamService;
    private static final long CONGESTION_PUBLISH_INTERVAL_MILLIS = 5_000;
    private final java.util.concurrent.atomic.AtomicLong lastCongestionPublishMillis = new java.util.concurrent.atomic.AtomicLong();

    public GpsService(GpsLogRepository gpsLogRepository, BoothService boothService, StreamService streamService) {
        this.gpsLogRepository = gpsLogRepository;
        this.boothService = boothService;
        this.streamService = streamService;
    }

    public GpsLogResponseDto saveGpsLog(GpsLogRequestDto requestDto) {
        GpsLog saved = gpsLogRepository.save(new GpsLog(requestDto.latitude(), requestDto.longitude()));
        // 전체 혼잡도 계산은 무겁다. 보는 화면이 있을 때만, 많아야 5초에 한 번 다시 계산해 보낸다.
        long now = System.currentTimeMillis();
        long last = lastCongestionPublishMillis.get();
        if (streamService.congestionSubscribers() > 0
                && now - last >= CONGESTION_PUBLISH_INTERVAL_MILLIS
                && lastCongestionPublishMillis.compareAndSet(last, now)) {
            streamService.publishCongestion(boothService.getAllCongestions());
        }
        return new GpsLogResponseDto(saved.getId(), saved.getCreatedAt(), "GPS \uB85C\uADF8\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    }
}
