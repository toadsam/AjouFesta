package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

/** 시간표 맨 위에 붙는 그날의 한 줄 공지(예: "노천극장 3시 조기 입장 기준…"). */
@Entity
@Table(name = "crew_notices")
public class CrewNotice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate day;

    @Column(nullable = false, length = 300)
    private String text;

    protected CrewNotice() {
    }

    public CrewNotice(LocalDate day, String text) {
        this.day = day;
        this.text = text;
    }

    public void update(LocalDate day, String text) {
        this.day = day;
        this.text = text;
    }

    public Long getId() {
        return id;
    }

    public LocalDate getDay() {
        return day;
    }

    public String getText() {
        return text;
    }
}
