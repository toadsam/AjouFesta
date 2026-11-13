package com.festflow.backend.service;

import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.CongestionResponseDto;
import com.festflow.backend.dto.SimulationFlowEventDto;
import com.festflow.backend.dto.SimulationBoothPatchDto;
import com.festflow.backend.dto.SimulationBoothStateDto;
import com.festflow.backend.dto.SimulationPatchRequestDto;
import com.festflow.backend.dto.SimulationStagePatchDto;
import com.festflow.backend.dto.SimulationStageStateDto;
import com.festflow.backend.dto.SimulationStatusDto;
import com.festflow.backend.entity.Booth;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class SimulationStateService {

    private static final int DEFAULT_TICK_SECONDS = 3;
    private static final int DEFAULT_JITTER_PERCENT = 12;
    private static final int MAX_PEOPLE_PER_BOOTH = 250;
    private static final int MAX_STAGE_PEOPLE = 4000;
    private static final int STAGE_CAPACITY_HINT = 4000;
    private static final int STAGE_RADIUS_METERS = 55;
    private static final int MAX_FLOW_EVENTS = 8;
    private static final String STAGE_ZONE_KEY = "open-air-theater";
    private static final String STAGE_ZONE_NAME = "아주대 노천극장";
    private static final double STAGE_LATITUDE = 37.281785;
    private static final double STAGE_LONGITUDE = 127.045501;

    private final Map<Long, MutableBoothState> states = new ConcurrentHashMap<>();
    private final Deque<SimulationFlowEventDto> flowEvents = new ArrayDeque<>();
    private MutableStageState stage = defaultStageState();

    private boolean running;
    private String scenario = "manual";
    private int tickSeconds = DEFAULT_TICK_SECONDS;
    private int jitterPercent = DEFAULT_JITTER_PERCENT;
    private LocalDateTime updatedAt = LocalDateTime.now();

    public synchronized SimulationStatusDto snapshot(List<BoothResponseDto> booths, boolean enabled) {
        seedMissing(booths);
        removeMissing(booths.stream().map(BoothResponseDto::id).toList());
        return toStatus(booths, enabled);
    }

    public synchronized SimulationStatusDto patch(List<BoothResponseDto> booths, SimulationPatchRequestDto request, boolean enabled) {
        seedMissing(booths);
        if (request != null) {
            if (request.tickSeconds() != null) {
                tickSeconds = clamp(request.tickSeconds(), 1, 30);
            }
            if (request.jitterPercent() != null) {
                jitterPercent = clamp(request.jitterPercent(), 0, 50);
            }
            if (request.stage() != null) {
                applyStagePatch(request.stage());
            }
            if (request.booths() != null) {
                for (SimulationBoothPatchDto patch : request.booths()) {
                    applyBoothPatch(patch);
                }
            }
            scenario = "manual";
            updatedAt = LocalDateTime.now();
        }
        return toStatus(booths, enabled);
    }

    public synchronized SimulationStatusDto applyScenario(List<BoothResponseDto> booths, String nextScenario, boolean enabled) {
        seedMissing(booths);
        String resolved = normalizeScenario(nextScenario);
        ThreadLocalRandom random = ThreadLocalRandom.current();
        Long surgeBoothId = booths.stream()
                .filter(this::isFoodBooth)
                .findFirst()
                .or(() -> booths.stream().findFirst())
                .map(BoothResponseDto::id)
                .orElse(null);

        for (BoothResponseDto booth : booths) {
            MutableBoothState state = states.get(booth.id());
            if (state == null) {
                continue;
            }
            switch (resolved) {
                case "lunch-peak" -> applyLunchPeak(state, booth, random);
                case "show-end" -> applyShowEnd(state, booth, random);
                case "single-booth-surge" -> applySingleBoothSurge(state, booth, surgeBoothId, random);
                case "emergency-flow" -> applyEmergencyFlow(state, booth, random);
                default -> applyCalm(state, booth, random);
            }
        }
        applyStageScenario(resolved, random);
        flowEvents.clear();

        scenario = resolved;
        updatedAt = LocalDateTime.now();
        return toStatus(booths, enabled);
    }

    public synchronized List<SimulationTickState> tick(List<BoothResponseDto> booths) {
        seedMissing(booths);
        if (!running) {
            return List.of();
        }

        ThreadLocalRandom random = ThreadLocalRandom.current();
        flowEvents.clear();
        stage.previousPeople = stage.currentPeople;
        for (BoothResponseDto booth : booths) {
            MutableBoothState state = states.get(booth.id());
            if (state == null) {
                continue;
            }
            state.previousPeople = state.currentPeople;
            double perMinuteDelta = state.incomingPerMinute - state.outgoingPerMinute - state.servicePerMinute;
            state.carry += perMinuteDelta * (tickSeconds / 60.0);
            int deterministicDelta = consumeWholeDelta(state);
            int jitterDelta = jitterDelta(state.currentPeople, random);
            state.currentPeople = clamp(state.currentPeople + deterministicDelta + jitterDelta, 0, MAX_PEOPLE_PER_BOOTH);
            state.remainingStock = booth.remainingStock();
        }

        moveBoothsToStage(booths, consumeStageIncoming(), random);
        moveStageToBooths(booths, consumeStageOutgoing(), random);
        moveBetweenBooths(booths, random);
        stage.currentPeople = clamp(stage.currentPeople + jitterDelta(stage.currentPeople, random), 0, MAX_STAGE_PEOPLE);

        updatedAt = LocalDateTime.now();
        return booths.stream()
                .map(booth -> {
                    MutableBoothState state = states.get(booth.id());
                    if (state == null) {
                        return null;
                    }
                    return new SimulationTickState(
                            booth.id(),
                            estimateWaitMinutes(state),
                            booth.remainingStock(),
                            "시뮬레이션: 현재 " + state.currentPeople + "명 · " + levelForPeople(state.currentPeople)
                    );
                })
                .filter(item -> item != null)
                .toList();
    }

    public synchronized void start(List<BoothResponseDto> booths) {
        seedMissing(booths);
        flowEvents.clear();
        running = true;
        updatedAt = LocalDateTime.now();
    }

    public synchronized void stop() {
        running = false;
        updatedAt = LocalDateTime.now();
    }

    public synchronized List<SimulationOriginalState> originalStates() {
        return states.values().stream()
                .sorted(Comparator.comparing(item -> item.boothId))
                .map(item -> new SimulationOriginalState(
                        item.boothId,
                        item.originalWaitMinutes,
                        item.originalRemainingStock,
                        item.originalLiveStatusMessage
                ))
                .toList();
    }

    public synchronized void clear(List<BoothResponseDto> booths) {
        states.clear();
        stage = defaultStageState();
        flowEvents.clear();
        running = false;
        scenario = "manual";
        tickSeconds = DEFAULT_TICK_SECONDS;
        jitterPercent = DEFAULT_JITTER_PERCENT;
        updatedAt = LocalDateTime.now();
        seedMissing(booths);
    }

    public synchronized Optional<CongestionResponseDto> simulatedCongestion(Long boothId, String boothName) {
        if (!running) {
            return Optional.empty();
        }
        MutableBoothState state = states.get(boothId);
        if (state == null) {
            return Optional.empty();
        }
        return Optional.of(new CongestionResponseDto(
                boothId,
                boothName,
                levelForPeople(state.currentPeople),
                state.currentPeople
        ));
    }

    public synchronized boolean isRunning() {
        return running;
    }

    public synchronized List<SimulationBoothSnapshot> boothSnapshots(List<Booth> booths) {
        if (!running) {
            return List.of();
        }
        seedMissingEntities(booths);
        return booths.stream()
                .map(booth -> {
                    MutableBoothState state = states.get(booth.getId());
                    if (state == null) {
                        return null;
                    }
                    return new SimulationBoothSnapshot(
                            booth.getId(),
                            booth.getName(),
                            booth.getLatitude(),
                            booth.getLongitude(),
                            state.currentPeople,
                            state.previousPeople,
                            estimateWaitMinutes(state),
                            levelForPeople(state.currentPeople)
                    );
                })
                .filter(item -> item != null)
                .toList();
    }

    public synchronized Optional<SimulationStageSnapshot> stageSnapshot() {
        if (!running) {
            return Optional.empty();
        }
        return Optional.of(new SimulationStageSnapshot(
                STAGE_ZONE_KEY,
                STAGE_ZONE_NAME,
                STAGE_LATITUDE,
                STAGE_LONGITUDE,
                STAGE_RADIUS_METERS,
                stage.currentPeople,
                stage.previousPeople,
                STAGE_CAPACITY_HINT,
                levelForStagePeople(stage.currentPeople)
        ));
    }

    private SimulationStatusDto toStatus(List<BoothResponseDto> booths, boolean enabled) {
        List<SimulationBoothStateDto> boothStates = booths.stream()
                .map(booth -> {
                    MutableBoothState state = states.get(booth.id());
                    if (state == null) {
                        return null;
                    }
                    return new SimulationBoothStateDto(
                            booth.id(),
                            booth.name(),
                            state.currentPeople,
                            state.previousPeople,
                            state.incomingPerMinute,
                            state.outgoingPerMinute,
                            state.servicePerMinute,
                            estimateWaitMinutes(state),
                            levelForPeople(state.currentPeople),
                            booth.remainingStock()
                    );
                })
                .filter(item -> item != null)
                .toList();
        int totalPeople = boothStates.stream().mapToInt(SimulationBoothStateDto::currentPeople).sum() + stage.currentPeople;
        return new SimulationStatusDto(
                enabled,
                running,
                scenario,
                tickSeconds,
                jitterPercent,
                updatedAt,
                totalPeople,
                boothStates,
                new SimulationStageStateDto(
                        STAGE_ZONE_KEY,
                        STAGE_ZONE_NAME,
                        stage.currentPeople,
                        stage.previousPeople,
                        stage.incomingPerMinute,
                        stage.outgoingPerMinute,
                        STAGE_CAPACITY_HINT,
                        levelForStagePeople(stage.currentPeople)
                ),
                List.copyOf(flowEvents)
        );
    }

    private void seedMissing(List<BoothResponseDto> booths) {
        for (BoothResponseDto booth : booths) {
            states.computeIfAbsent(booth.id(), ignored -> fromBooth(booth));
        }
    }

    private void seedMissingEntities(List<Booth> booths) {
        for (Booth booth : booths) {
            states.computeIfAbsent(booth.getId(), ignored -> fromBoothEntity(booth));
        }
    }

    private void removeMissing(List<Long> boothIds) {
        states.keySet().removeIf(id -> !boothIds.contains(id));
    }

    private MutableBoothState fromBooth(BoothResponseDto booth) {
        int service = defaultServicePerMinute(booth.category(), booth.name(), booth.tags());
        int wait = Math.max(0, booth.estimatedWaitMinutes() == null ? 0 : booth.estimatedWaitMinutes());
        int current = clamp(wait * service, 0, MAX_PEOPLE_PER_BOOTH);
        if (current == 0 && wait > 0) {
            current = Math.max(1, wait);
        }
        return new MutableBoothState(
                booth.id(),
                current,
                current,
                defaultIncomingPerMinute(wait),
                1,
                service,
                booth.estimatedWaitMinutes(),
                booth.remainingStock(),
                booth.liveStatusMessage(),
                booth.remainingStock()
        );
    }

    private MutableBoothState fromBoothEntity(Booth booth) {
        int service = defaultServicePerMinute(booth.getCategory(), booth.getName(), booth.getTags());
        int wait = Math.max(0, booth.getEstimatedWaitMinutes() == null ? 0 : booth.getEstimatedWaitMinutes());
        int current = clamp(wait * service, 0, MAX_PEOPLE_PER_BOOTH);
        return new MutableBoothState(
                booth.getId(),
                current,
                current,
                defaultIncomingPerMinute(wait),
                1,
                service,
                booth.getEstimatedWaitMinutes(),
                booth.getRemainingStock(),
                booth.getLiveStatusMessage(),
                booth.getRemainingStock()
        );
    }

    private void applyBoothPatch(SimulationBoothPatchDto patch) {
        if (patch == null || patch.boothId() == null) {
            return;
        }
        MutableBoothState state = states.get(patch.boothId());
        if (state == null) {
            return;
        }
        if (patch.currentPeople() != null) {
            state.currentPeople = clamp(patch.currentPeople(), 0, MAX_PEOPLE_PER_BOOTH);
        }
        if (patch.incomingPerMinute() != null) {
            state.incomingPerMinute = clamp(patch.incomingPerMinute(), 0, 120);
        }
        if (patch.outgoingPerMinute() != null) {
            state.outgoingPerMinute = clamp(patch.outgoingPerMinute(), 0, 120);
        }
        if (patch.servicePerMinute() != null) {
            state.servicePerMinute = clamp(patch.servicePerMinute(), 1, 120);
        }
        state.previousPeople = Math.min(state.previousPeople, MAX_PEOPLE_PER_BOOTH);
        state.carry = 0;
    }

    private void applyStagePatch(SimulationStagePatchDto patch) {
        if (patch == null) {
            return;
        }
        if (patch.currentPeople() != null) {
            stage.currentPeople = clamp(patch.currentPeople(), 0, MAX_STAGE_PEOPLE);
        }
        if (patch.incomingPerMinute() != null) {
            stage.incomingPerMinute = clamp(patch.incomingPerMinute(), 0, 800);
        }
        if (patch.outgoingPerMinute() != null) {
            stage.outgoingPerMinute = clamp(patch.outgoingPerMinute(), 0, 800);
        }
        stage.previousPeople = Math.min(stage.previousPeople, MAX_STAGE_PEOPLE);
        stage.incomingCarry = 0;
        stage.outgoingCarry = 0;
    }

    private void applyStageScenario(String resolved, ThreadLocalRandom random) {
        switch (resolved) {
            case "lunch-peak" -> {
                stage.currentPeople = random.nextInt(450, 900);
                stage.incomingPerMinute = random.nextInt(60, 130);
                stage.outgoingPerMinute = random.nextInt(120, 240);
            }
            case "show-end" -> {
                stage.currentPeople = random.nextInt(3000, 3900);
                stage.incomingPerMinute = random.nextInt(20, 80);
                stage.outgoingPerMinute = random.nextInt(360, 720);
            }
            case "single-booth-surge" -> {
                stage.currentPeople = random.nextInt(900, 1700);
                stage.incomingPerMinute = random.nextInt(80, 180);
                stage.outgoingPerMinute = random.nextInt(90, 210);
            }
            case "emergency-flow" -> {
                stage.currentPeople = random.nextInt(1200, 2600);
                stage.incomingPerMinute = random.nextInt(0, 50);
                stage.outgoingPerMinute = random.nextInt(280, 620);
            }
            default -> {
                stage.currentPeople = random.nextInt(180, 520);
                stage.incomingPerMinute = random.nextInt(20, 70);
                stage.outgoingPerMinute = random.nextInt(20, 70);
            }
        }
        stage.previousPeople = stage.currentPeople;
        stage.incomingCarry = 0;
        stage.outgoingCarry = 0;
    }

    private int consumeStageIncoming() {
        stage.incomingCarry += stage.incomingPerMinute * (tickSeconds / 60.0);
        int whole = (int) stage.incomingCarry;
        stage.incomingCarry -= whole;
        return Math.max(0, whole);
    }

    private int consumeStageOutgoing() {
        stage.outgoingCarry += stage.outgoingPerMinute * (tickSeconds / 60.0);
        int whole = (int) stage.outgoingCarry;
        stage.outgoingCarry -= whole;
        return Math.max(0, whole);
    }

    private void moveBoothsToStage(List<BoothResponseDto> booths, int requestedPeople, ThreadLocalRandom random) {
        if (requestedPeople <= 0 || booths.isEmpty()) {
            return;
        }
        int remaining = requestedPeople;
        List<BoothResponseDto> sources = booths.stream()
                .filter(booth -> states.containsKey(booth.id()))
                .sorted((left, right) -> Integer.compare(
                        states.get(right.id()).currentPeople,
                        states.get(left.id()).currentPeople
                ))
                .limit(4)
                .toList();

        for (BoothResponseDto source : sources) {
            if (remaining <= 0) {
                break;
            }
            MutableBoothState sourceState = states.get(source.id());
            if (sourceState == null || sourceState.currentPeople <= 2) {
                continue;
            }
            int moved = Math.min(remaining, Math.max(1, Math.min(sourceState.currentPeople / 8, random.nextInt(1, 5))));
            moved = Math.min(moved, sourceState.currentPeople);
            sourceState.currentPeople -= moved;
            stage.currentPeople = clamp(stage.currentPeople + moved, 0, MAX_STAGE_PEOPLE);
            remaining -= moved;
            addFlow(source.name(), STAGE_ZONE_NAME, moved, "공연 관람 이동");
        }
    }

    private void moveStageToBooths(List<BoothResponseDto> booths, int requestedPeople, ThreadLocalRandom random) {
        if (requestedPeople <= 0 || booths.isEmpty() || stage.currentPeople <= 0) {
            return;
        }
        int remaining = Math.min(requestedPeople, stage.currentPeople);
        List<BoothResponseDto> targets = new ArrayList<>(booths.stream()
                .filter(this::isFoodBooth)
                .filter(booth -> states.containsKey(booth.id()))
                .sorted(Comparator.comparingInt(booth -> states.get(booth.id()).currentPeople))
                .limit(5)
                .toList());
        if (targets.isEmpty()) {
            targets = booths.stream()
                    .filter(booth -> states.containsKey(booth.id()))
                    .sorted(Comparator.comparingInt(booth -> states.get(booth.id()).currentPeople))
                    .limit(5)
                    .toList();
        }

        for (BoothResponseDto target : targets) {
            if (remaining <= 0) {
                break;
            }
            MutableBoothState targetState = states.get(target.id());
            if (targetState == null) {
                continue;
            }
            int moved = Math.min(remaining, random.nextInt(1, Math.max(2, Math.min(8, remaining) + 1)));
            stage.currentPeople -= moved;
            targetState.currentPeople = clamp(targetState.currentPeople + moved, 0, MAX_PEOPLE_PER_BOOTH);
            remaining -= moved;
            addFlow(STAGE_ZONE_NAME, target.name(), moved, scenario.equals("show-end") ? "공연 종료 후 주점 이동" : "무대 이탈");
        }
    }

    private void moveBetweenBooths(List<BoothResponseDto> booths, ThreadLocalRandom random) {
        if (booths.size() < 2) {
            return;
        }
        BoothResponseDto source = booths.stream()
                .filter(booth -> states.containsKey(booth.id()))
                .filter(booth -> states.get(booth.id()).currentPeople >= 24)
                .max(Comparator.comparingInt(booth -> states.get(booth.id()).currentPeople))
                .orElse(null);
        BoothResponseDto target = booths.stream()
                .filter(booth -> states.containsKey(booth.id()))
                .filter(booth -> source == null || !booth.id().equals(source.id()))
                .min(Comparator.comparingInt(booth -> states.get(booth.id()).currentPeople))
                .orElse(null);
        if (source == null || target == null) {
            return;
        }
        MutableBoothState sourceState = states.get(source.id());
        MutableBoothState targetState = states.get(target.id());
        if (sourceState == null || targetState == null || sourceState.currentPeople <= targetState.currentPeople + 12) {
            return;
        }
        int moved = Math.min(sourceState.currentPeople - 10, random.nextInt(1, 5));
        if (moved <= 0) {
            return;
        }
        sourceState.currentPeople -= moved;
        targetState.currentPeople = clamp(targetState.currentPeople + moved, 0, MAX_PEOPLE_PER_BOOTH);
        addFlow(source.name(), target.name(), moved, "혼잡 분산 이동");
    }

    private void addFlow(String from, String to, int people, String reason) {
        if (people <= 0) {
            return;
        }
        flowEvents.addFirst(new SimulationFlowEventDto(from, to, people, reason));
        while (flowEvents.size() > MAX_FLOW_EVENTS) {
            flowEvents.removeLast();
        }
    }

    private void applyCalm(MutableBoothState state, BoothResponseDto booth, ThreadLocalRandom random) {
        state.currentPeople = random.nextInt(0, isFoodBooth(booth) ? 12 : 8);
        state.previousPeople = state.currentPeople;
        state.incomingPerMinute = random.nextInt(1, 5);
        state.outgoingPerMinute = random.nextInt(1, 4);
        state.servicePerMinute = defaultServicePerMinute(booth.category(), booth.name(), booth.tags()) + 2;
        state.carry = 0;
    }

    private void applyLunchPeak(MutableBoothState state, BoothResponseDto booth, ThreadLocalRandom random) {
        if (isFoodBooth(booth)) {
            state.currentPeople = random.nextInt(45, 86);
            state.incomingPerMinute = random.nextInt(18, 32);
            state.outgoingPerMinute = random.nextInt(2, 7);
            state.servicePerMinute = random.nextInt(4, 9);
        } else {
            state.currentPeople = random.nextInt(8, 28);
            state.incomingPerMinute = random.nextInt(4, 11);
            state.outgoingPerMinute = random.nextInt(1, 5);
            state.servicePerMinute = random.nextInt(7, 14);
        }
        state.previousPeople = state.currentPeople;
        state.carry = 0;
    }

    private void applyShowEnd(MutableBoothState state, BoothResponseDto booth, ThreadLocalRandom random) {
        boolean food = isFoodBooth(booth);
        state.currentPeople = food ? random.nextInt(34, 76) : random.nextInt(18, 46);
        state.incomingPerMinute = food ? random.nextInt(14, 28) : random.nextInt(9, 18);
        state.outgoingPerMinute = random.nextInt(2, 7);
        state.servicePerMinute = food ? random.nextInt(5, 10) : random.nextInt(8, 15);
        state.previousPeople = state.currentPeople;
        state.carry = 0;
    }

    private void applySingleBoothSurge(MutableBoothState state, BoothResponseDto booth, Long surgeBoothId, ThreadLocalRandom random) {
        if (booth.id().equals(surgeBoothId)) {
            state.currentPeople = random.nextInt(90, 141);
            state.incomingPerMinute = random.nextInt(26, 42);
            state.outgoingPerMinute = random.nextInt(1, 5);
            state.servicePerMinute = random.nextInt(3, 7);
        } else {
            state.currentPeople = random.nextInt(4, 24);
            state.incomingPerMinute = random.nextInt(2, 9);
            state.outgoingPerMinute = random.nextInt(1, 5);
            state.servicePerMinute = defaultServicePerMinute(booth.category(), booth.name(), booth.tags()) + 1;
        }
        state.previousPeople = state.currentPeople;
        state.carry = 0;
    }

    private void applyEmergencyFlow(MutableBoothState state, BoothResponseDto booth, ThreadLocalRandom random) {
        if (isSupportBooth(booth)) {
            state.currentPeople = random.nextInt(26, 58);
            state.incomingPerMinute = random.nextInt(10, 22);
            state.outgoingPerMinute = random.nextInt(3, 10);
            state.servicePerMinute = random.nextInt(10, 18);
        } else {
            state.currentPeople = random.nextInt(3, 22);
            state.incomingPerMinute = random.nextInt(1, 8);
            state.outgoingPerMinute = random.nextInt(1, 5);
            state.servicePerMinute = defaultServicePerMinute(booth.category(), booth.name(), booth.tags());
        }
        state.previousPeople = state.currentPeople;
        state.carry = 0;
    }

    private int estimateWaitMinutes(MutableBoothState state) {
        int service = Math.max(1, state.servicePerMinute);
        return clamp((int) Math.ceil(state.currentPeople / (double) service), 0, 180);
    }

    private String levelForPeople(int people) {
        if (people < 8) {
            return "여유";
        }
        if (people < 20) {
            return "보통";
        }
        if (people < 40) {
            return "혼잡";
        }
        return "매우 혼잡";
    }

    private String levelForStagePeople(int people) {
        double ratio = people / (double) STAGE_CAPACITY_HINT;
        if (ratio < 0.35) {
            return "여유";
        }
        if (ratio < 0.65) {
            return "보통";
        }
        if (ratio < 0.9) {
            return "혼잡";
        }
        return "매우 혼잡";
    }

    private int consumeWholeDelta(MutableBoothState state) {
        int whole = (int) state.carry;
        state.carry -= whole;
        return whole;
    }

    private int jitterDelta(int currentPeople, ThreadLocalRandom random) {
        if (jitterPercent <= 0 || currentPeople == 0) {
            return 0;
        }
        int max = Math.max(1, Math.min(80, (int) Math.round(currentPeople * (jitterPercent / 100.0) * 0.25)));
        return random.nextInt(-max, max + 1);
    }

    private int defaultServicePerMinute(String category, String name, String tags) {
        String text = normalize(category + " " + name + " " + tags);
        if (text.contains("응급") || text.contains("안내") || text.contains("본부")) {
            return 12;
        }
        if (text.contains("공연") || text.contains("무대")) {
            return 20;
        }
        if (text.contains("체험") || text.contains("이벤트")) {
            return 8;
        }
        return 5;
    }

    private int defaultIncomingPerMinute(int wait) {
        if (wait >= 30) {
            return 16;
        }
        if (wait >= 15) {
            return 10;
        }
        if (wait >= 5) {
            return 5;
        }
        return 2;
    }

    private MutableStageState defaultStageState() {
        return new MutableStageState(280, 280, 35, 35);
    }

    private boolean isFoodBooth(BoothResponseDto booth) {
        String text = normalize(booth.category() + " " + booth.name() + " " + booth.tags());
        return text.contains("주점")
                || text.contains("음식")
                || text.contains("푸드")
                || text.contains("메뉴")
                || text.contains("닭")
                || text.contains("치즈")
                || text.contains("카페");
    }

    private boolean isSupportBooth(BoothResponseDto booth) {
        String text = normalize(booth.category() + " " + booth.name() + " " + booth.tags());
        return text.contains("응급")
                || text.contains("안내")
                || text.contains("본부")
                || text.contains("케어")
                || text.contains("분실");
    }

    private String normalizeScenario(String value) {
        String normalized = normalize(value);
        return switch (normalized) {
            case "calm", "lunch-peak", "show-end", "single-booth-surge", "emergency-flow" -> normalized;
            default -> "calm";
        };
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static final class MutableBoothState {
        private final Long boothId;
        private int currentPeople;
        private int previousPeople;
        private int incomingPerMinute;
        private int outgoingPerMinute;
        private int servicePerMinute;
        private final Integer originalWaitMinutes;
        private final Integer originalRemainingStock;
        private final String originalLiveStatusMessage;
        private Integer remainingStock;
        private double carry;

        private MutableBoothState(
                Long boothId,
                int currentPeople,
                int previousPeople,
                int incomingPerMinute,
                int outgoingPerMinute,
                int servicePerMinute,
                Integer originalWaitMinutes,
                Integer originalRemainingStock,
                String originalLiveStatusMessage,
                Integer remainingStock
        ) {
            this.boothId = boothId;
            this.currentPeople = currentPeople;
            this.previousPeople = previousPeople;
            this.incomingPerMinute = incomingPerMinute;
            this.outgoingPerMinute = outgoingPerMinute;
            this.servicePerMinute = servicePerMinute;
            this.originalWaitMinutes = originalWaitMinutes;
            this.originalRemainingStock = originalRemainingStock;
            this.originalLiveStatusMessage = originalLiveStatusMessage;
            this.remainingStock = remainingStock;
        }
    }

    private static final class MutableStageState {
        private int currentPeople;
        private int previousPeople;
        private int incomingPerMinute;
        private int outgoingPerMinute;
        private double incomingCarry;
        private double outgoingCarry;

        private MutableStageState(
                int currentPeople,
                int previousPeople,
                int incomingPerMinute,
                int outgoingPerMinute
        ) {
            this.currentPeople = currentPeople;
            this.previousPeople = previousPeople;
            this.incomingPerMinute = incomingPerMinute;
            this.outgoingPerMinute = outgoingPerMinute;
        }
    }

    public record SimulationTickState(
            Long boothId,
            Integer estimatedWaitMinutes,
            Integer remainingStock,
            String liveStatusMessage
    ) {
    }

    public record SimulationOriginalState(
            Long boothId,
            Integer estimatedWaitMinutes,
            Integer remainingStock,
            String liveStatusMessage
    ) {
    }

    public record SimulationBoothSnapshot(
            Long boothId,
            String boothName,
            double latitude,
            double longitude,
            int currentPeople,
            int previousPeople,
            int estimatedWaitMinutes,
            String congestionLevel
    ) {
    }

    public record SimulationStageSnapshot(
            String zoneKey,
            String zoneName,
            double latitude,
            double longitude,
            int radiusMeters,
            int currentPeople,
            int previousPeople,
            int capacityHint,
            String congestionLevel
    ) {
    }
}
