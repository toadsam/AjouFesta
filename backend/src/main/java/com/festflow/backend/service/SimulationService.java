package com.festflow.backend.service;

import com.festflow.backend.dto.BoothLiveStatusRequestDto;
import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.SimulationPatchRequestDto;
import com.festflow.backend.dto.SimulationStatusDto;
import com.festflow.backend.service.SimulationStateService.SimulationOriginalState;
import com.festflow.backend.service.SimulationStateService.SimulationTickState;
import com.festflow.backend.service.stream.StreamService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.springframework.http.HttpStatus.FORBIDDEN;

@Service
public class SimulationService {

    private final boolean enabled;
    private final BoothService boothService;
    private final SimulationStateService simulationStateService;
    private final StreamService streamService;

    private Instant lastTickAt = Instant.EPOCH;

    public SimulationService(
            @Value("${app.simulation.enabled:true}") boolean enabled,
            BoothService boothService,
            SimulationStateService simulationStateService,
            StreamService streamService
    ) {
        this.enabled = enabled;
        this.boothService = boothService;
        this.simulationStateService = simulationStateService;
        this.streamService = streamService;
    }

    public SimulationStatusDto status() {
        return simulationStateService.snapshot(boothService.getAllBooths(), enabled);
    }

    public SimulationStatusDto patch(SimulationPatchRequestDto requestDto) {
        ensureEnabled();
        return simulationStateService.patch(boothService.getAllBooths(), requestDto, enabled);
    }

    public SimulationStatusDto applyScenario(String scenario) {
        ensureEnabled();
        return simulationStateService.applyScenario(boothService.getAllBooths(), scenario, enabled);
    }

    public SimulationStatusDto start() {
        ensureEnabled();
        simulationStateService.start(boothService.getAllBooths());
        lastTickAt = Instant.EPOCH;
        tick();
        return status();
    }

    public SimulationStatusDto stop() {
        ensureEnabled();
        simulationStateService.stop();
        publishCurrentState();
        return status();
    }

    public SimulationStatusDto reset() {
        ensureEnabled();
        List<SimulationOriginalState> originals = simulationStateService.originalStates();
        simulationStateService.stop();
        for (SimulationOriginalState original : originals) {
            boothService.updateLiveStatus(
                    original.boothId(),
                    new BoothLiveStatusRequestDto(
                            original.estimatedWaitMinutes(),
                            original.remainingStock(),
                            original.liveStatusMessage(),
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null
                    )
            );
        }
        simulationStateService.clear(boothService.getAllBooths());
        publishCurrentState();
        return status();
    }

    @Scheduled(fixedDelay = 1000)
    public void tick() {
        if (!enabled || !simulationStateService.isRunning()) {
            return;
        }
        SimulationStatusDto current = status();
        Instant now = Instant.now();
        if (now.isBefore(lastTickAt.plusSeconds(current.tickSeconds()))) {
            return;
        }
        lastTickAt = now;

        List<BoothResponseDto> booths = boothService.getAllBooths();
        List<SimulationTickState> updates = simulationStateService.tick(booths);
        for (SimulationTickState update : updates) {
            boothService.updateLiveStatus(
                    update.boothId(),
                    new BoothLiveStatusRequestDto(
                            update.estimatedWaitMinutes(),
                            update.remainingStock(),
                            update.liveStatusMessage(),
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null
                    )
            );
        }
        publishCurrentState();
    }

    private void publishCurrentState() {
        streamService.publishBooths(boothService.getAllBooths());
        streamService.publishCongestion(boothService.getAllCongestions());
    }

    private void ensureEnabled() {
        if (!enabled) {
            throw new ResponseStatusException(FORBIDDEN, "Simulation mode is disabled.");
        }
    }
}
