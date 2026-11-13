package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

/**
 * 스태프 시간표의 한 칸: 어느 날 · 어디(장소 · 부스) · 몇 시부터 몇 시까지 · 누가.
 * 시각은 그날 0시부터 센 분. 자정을 넘기면 24:00 = 1440, 새벽 1시 = 1500 처럼 그대로 이어 센다(표가 그렇게 생겼다).
 * 사람은 이름을 쉼표로 이어 한 칸에 둔다 — 한 칸을 통째로 고치는 화면이라 따로 표를 둘 까닭이 없다.
 */
@Entity
@Table(name = "crew_slots")
public class CrewSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate day;

    @Column(nullable = false, length = 40)
    private String place;

    @Column(nullable = false, length = 40)
    private String booth;

    @Column(name = "start_min", nullable = false)
    private int startMin;

    @Column(name = "end_min", nullable = false)
    private int endMin;

    @Column(nullable = false, length = 1000)
    private String members;

    @Column(length = 200)
    private String note;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", length = 30)
    private String updatedBy;

    protected CrewSlot() {
    }

    public CrewSlot(LocalDate day, String place, String booth, int startMin, int endMin,
                    List<String> members, String note, int sortOrder, Instant now, String updatedBy) {
        this.sortOrder = sortOrder;
        update(day, place, booth, startMin, endMin, members, note, now, updatedBy);
    }

    public void update(LocalDate day, String place, String booth, int startMin, int endMin,
                       List<String> members, String note, Instant now, String updatedBy) {
        this.day = day;
        this.place = place;
        this.booth = booth;
        this.startMin = startMin;
        this.endMin = endMin;
        this.members = String.join(",", members);
        this.note = note;
        this.updatedAt = now;
        this.updatedBy = updatedBy;
    }

    public void replaceMembers(List<String> members, Instant now, String updatedBy) {
        this.members = String.join(",", members);
        this.updatedAt = now;
        this.updatedBy = updatedBy;
    }

    public List<String> memberList() {
        if (members == null || members.isBlank()) {
            return List.of();
        }
        return Arrays.stream(members.split(",")).map(String::trim).filter(name -> !name.isEmpty()).toList();
    }

    public Long getId() {
        return id;
    }

    public LocalDate getDay() {
        return day;
    }

    public String getPlace() {
        return place;
    }

    public String getBooth() {
        return booth;
    }

    public int getStartMin() {
        return startMin;
    }

    public int getEndMin() {
        return endMin;
    }

    public String getNote() {
        return note;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }
}
