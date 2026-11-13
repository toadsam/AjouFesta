package com.festflow.backend.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * 잠깐 같은 결과를 돌려 쓰는 작은 캐시. 만드는 데 오래 걸리는 공개 응답(AI 안내 · 혼잡 예측)에 쓴다.
 * 같은 키를 여러 요청이 동시에 찾으면 한 요청만 만들고 나머지는 그 결과를 기다린다.
 * 키 종류가 몇 개로 정해진 곳에만 쓴다(키가 끝없이 늘어나는 곳에는 쓰지 않는다).
 */
public final class TtlCache<K, V> {

    private record Entry<V>(V value, long loadedAtMillis) {
    }

    private final long ttlMillis;
    private final Map<K, Entry<V>> entries = new ConcurrentHashMap<>();

    public TtlCache(long ttlMillis) {
        this.ttlMillis = ttlMillis;
    }

    public V get(K key, Supplier<V> loader) {
        Entry<V> entry = entries.get(key);
        long now = System.currentTimeMillis();
        if (entry != null && now - entry.loadedAtMillis() < ttlMillis) {
            return entry.value();
        }
        return entries.compute(key, (ignored, current) -> {
            long computeNow = System.currentTimeMillis();
            if (current != null && computeNow - current.loadedAtMillis() < ttlMillis) {
                return current;
            }
            return new Entry<>(loader.get(), System.currentTimeMillis());
        }).value();
    }
}
