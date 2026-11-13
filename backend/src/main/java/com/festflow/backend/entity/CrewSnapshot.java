package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 엑셀로 명단 · 시간표를 통째로 바꾸기 직전의 모습(JSON). 잘못 올렸으면 이걸로 '직전으로 되돌리기'를 한다.
 * 몇 개만 남기고 오래된 것은 지운다.
 */
@Entity
@Table(name = "crew_snapshots")
public class CrewSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant at;

    @Column(nullable = false, length = 30)
    private String actor;

    @Column(nullable = false, length = 100)
    private String reason;

    // 명단 55명 + 시간표 160칸 ≈ 40KB. 큰 길이를 주면 Postgres 는 varchar, MySQL 은 longtext 로 잡힌다.
    @Column(nullable = false, length = 2_000_000)
    private String payload;

    protected CrewSnapshot() {
    }

    public CrewSnapshot(Instant at, String actor, String reason, String payload) {
        this.at = at;
        this.actor = actor;
        this.reason = reason;
        this.payload = payload;
    }

    public Long getId() {
        return id;
    }

    public Instant getAt() {
        return at;
    }

    public String getActor() {
        return actor;
    }

    public String getReason() {
        return reason;
    }

    public String getPayload() {
        return payload;
    }
}
