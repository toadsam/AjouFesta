package com.festflow.backend.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class OpsKeyService {

    private static final Pattern BOOTH_URI_PATTERN = Pattern.compile("/api/ops/booth/(\\d+)(?:/.*)?");
    // 스태프 화면(/staff). 공용 부스 키를 아는 스태프면 누구나 연다.
    private static final Pattern CREW_URI_PATTERN = Pattern.compile("/api/ops/crew(?:/.*)?");

    private final String masterKey;
    private final String sharedBoothKey;
    private final Map<String, Long> boothKeyToBoothId;

    public OpsKeyService(
            @Value("${app.ops.master-key:}") String masterKey,
            @Value("${app.ops.shared-booth-key:}") String sharedBoothKey,
            @Value("${app.ops.booth-keys:}") String boothKeyPairs
    ) {
        this.masterKey = masterKey != null ? masterKey.trim() : "";
        this.sharedBoothKey = sharedBoothKey != null ? sharedBoothKey.trim() : "";
        this.boothKeyToBoothId = parseBoothKeys(boothKeyPairs);
    }

    public Optional<OpsIdentity> authenticate(String key, String requestUri) {
        if (key == null || key.isBlank()) {
            return Optional.empty();
        }

        String trimmed = key.trim();
        if (!masterKey.isBlank() && masterKey.equals(trimmed)) {
            return Optional.of(new OpsIdentity("ops-master", "OPS_MASTER", null));
        }

        if (!sharedBoothKey.isBlank() && sharedBoothKey.equals(trimmed)) {
            if (requestUri != null && CREW_URI_PATTERN.matcher(requestUri).matches()) {
                return Optional.of(new OpsIdentity("ops-crew", "OPS_CREW", null));
            }
            return boothIdFromUri(requestUri)
                    .map(boothId -> new OpsIdentity("ops-booth-" + boothId, "OPS_BOOTH", boothId));
        }

        Long boothId = boothKeyToBoothId.get(trimmed);
        if (boothId != null) {
            return Optional.of(new OpsIdentity("ops-booth-" + boothId, "OPS_BOOTH", boothId));
        }

        return Optional.empty();
    }

    private Optional<Long> boothIdFromUri(String requestUri) {
        if (requestUri == null || requestUri.isBlank()) {
            return Optional.empty();
        }

        Matcher matcher = BOOTH_URI_PATTERN.matcher(requestUri);
        if (!matcher.matches()) {
            return Optional.empty();
        }

        try {
            return Optional.of(Long.parseLong(matcher.group(1)));
        } catch (NumberFormatException ignored) {
            return Optional.empty();
        }
    }

    private Map<String, Long> parseBoothKeys(String pairs) {
        Map<String, Long> map = new HashMap<>();
        if (pairs == null || pairs.isBlank()) {
            return map;
        }

        String[] entries = pairs.split(",");
        for (String entry : entries) {
            String trimmed = entry.trim();
            if (trimmed.isBlank() || !trimmed.contains(":")) {
                continue;
            }
            String[] split = trimmed.split(":", 2);
            try {
                Long boothId = Long.parseLong(split[0].trim());
                String key = split[1].trim();
                if (!key.isBlank()) {
                    map.put(key, boothId);
                }
            } catch (NumberFormatException ignored) {
                // ignore malformed entries
            }
        }
        return map;
    }
}
