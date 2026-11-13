package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** 시간표 · 명단을 누가 언제 어떻게 바꿨는지 한 줄씩. 서로 믿고 고치되, 잘못 고친 걸 되짚을 수 있게 남긴다. */
@Entity
@Table(name = "crew_logs")
public class CrewLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant at;

    @Column(nullable = false, length = 30)
    private String actor;

    @Column(nullable = false, length = 300)
    private String text;

    protected CrewLog() {
    }

    public CrewLog(Instant at, String actor, String text) {
        this.at = at;
        this.actor = actor;
        this.text = text;
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

    public String getText() {
        return text;
    }
}
