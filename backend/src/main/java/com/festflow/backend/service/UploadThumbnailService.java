package com.festflow.backend.service;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

/**
 * 업로드 사진의 작은 판(JPEG). 소개팅 프로필 그림은 한 장이 2MB 가 넘어서, 목록에서 그대로 내려주면
 * 한 사람이 수백 MB 를 받는다. 폭을 줄인 JPEG 를 만들어 메모리에 잠깐 들고 있다가 돌려 쓴다.
 */
@Service
public class UploadThumbnailService {

    /** 받을 수 있는 폭. 아무 숫자나 받으면 캐시가 끝없이 늘어난다. */
    private static final Set<Integer> ALLOWED_WIDTHS = Set.of(240, 480, 960);
    private static final long MAX_CACHE_BYTES = 48L * 1024 * 1024;
    private static final float JPEG_QUALITY = 0.82f;

    private final UploadStorageService uploadStorageService;
    // 줄이는 일은 CPU 와 메모리를 많이 쓴다. 동시에 몇 개만 돌린다.
    private final Semaphore resizeSlots = new Semaphore(3);
    private final Map<String, CompletableFuture<byte[]>> inFlight = new ConcurrentHashMap<>();
    private final LinkedHashMap<String, byte[]> cache = new LinkedHashMap<>(256, 0.75f, true);
    private long cacheBytes;

    public UploadThumbnailService(UploadStorageService uploadStorageService) {
        this.uploadStorageService = uploadStorageService;
    }

    public static boolean isAllowedWidth(Integer width) {
        return width != null && ALLOWED_WIDTHS.contains(width);
    }

    /**
     * @return 줄인 JPEG. 줄일 수 없는 형식이면 null (부르는 쪽이 원본을 내려준다).
     */
    public byte[] thumbnail(String imageUrl, int width) throws IOException {
        String key = width + ":" + imageUrl;
        byte[] cached = getCached(key);
        if (cached != null) {
            return cached.length == 0 ? null : cached;
        }

        CompletableFuture<byte[]> mine = new CompletableFuture<>();
        CompletableFuture<byte[]> running = inFlight.putIfAbsent(key, mine);
        if (running != null) {
            // 같은 사진을 다른 요청이 줄이는 중이면 그 결과를 같이 쓴다.
            try {
                byte[] result = running.join();
                return result.length == 0 ? null : result;
            } catch (CompletionException e) {
                if (e.getCause() instanceof IOException io) {
                    throw io;
                }
                if (e.getCause() instanceof RuntimeException runtime) {
                    throw runtime;
                }
                throw e;
            }
        }
        try {
            byte[] result = resize(imageUrl, width);
            // 못 줄이는 사진은 빈 배열로 기억해 두고 매번 다시 시도하지 않는다.
            byte[] stored = result == null ? new byte[0] : result;
            putCached(key, stored);
            mine.complete(stored);
            return result;
        } catch (IOException | RuntimeException e) {
            mine.completeExceptionally(e);
            throw e;
        } finally {
            inFlight.remove(key, mine);
        }
    }

    private byte[] resize(String imageUrl, int width) throws IOException {
        byte[] original = uploadStorageService.loadStoredObject(imageUrl).bytes();
        resizeSlots.acquireUninterruptibly();
        try {
            byte[] resized = ImageResizer.toJpeg(original, width, JPEG_QUALITY);
            // 줄였는데 더 커졌으면(이미 작은 사진) 원본을 쓴다.
            return resized != null && resized.length < original.length ? resized : null;
        } finally {
            resizeSlots.release();
        }
    }

    private synchronized byte[] getCached(String key) {
        return cache.get(key);
    }

    private synchronized void putCached(String key, byte[] bytes) {
        byte[] previous = cache.put(key, bytes);
        cacheBytes += bytes.length - (previous == null ? 0 : previous.length);
        var iterator = cache.entrySet().iterator();
        while (cacheBytes > MAX_CACHE_BYTES && iterator.hasNext()) {
            Map.Entry<String, byte[]> eldest = iterator.next();
            if (eldest.getKey().equals(key)) {
                continue;
            }
            cacheBytes -= eldest.getValue().length;
            iterator.remove();
        }
    }
}
