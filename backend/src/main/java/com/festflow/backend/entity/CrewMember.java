package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * 축제 스태프(총학생회 국원) 한 사람. /staff 화면의 연락처 · 상태 칸.
 * 예전 StaffMember(직원번호 + PIN 로그인)와는 따로 둔다 — 이쪽은 부스 암호 하나로 열고, 이름으로 서로를 알아본다.
 * 전화번호가 들어 있으니 운영 키 없이 내려가는 곳에서는 절대 쓰지 않는다.
 */
@Entity
@Table(name = "crew_members", uniqueConstraints = @UniqueConstraint(name = "uk_crew_member_name", columnNames = "name"))
public class CrewMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String name;

    @Column(nullable = false, length = 30)
    private String dept;

    @Column(nullable = false, length = 20)
    private String role;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** WORKING · EATING · CLASS · RESTING · OFF, 아직 안 골랐으면 null. */
    @Column(length = 20)
    private String status;

    @Column(name = "status_memo", length = 60)
    private String statusMemo;

    @Column(name = "status_at")
    private Instant statusAt;

    /** 밥 먹는 동안 내 자리를 대신 맡은 사람의 이름. 밥 먹는 중일 때만 있고, 상태를 바꾸면 지워진다. */
    @Column(name = "relief_name", length = 30)
    private String reliefName;

    /** 지금 있는 곳. 시간표 장소 이름이거나 직접 적은 곳(기타). 상태와 따로 두고, 퇴근하면 지운다. */
    @Column(name = "location_name", length = 40)
    private String location;

    @Column(name = "location_at")
    private Instant locationAt;

    protected CrewMember() {
    }

    public CrewMember(String name, String dept, String role, String phone, int sortOrder) {
        this.name = name;
        this.dept = dept;
        this.role = role;
        this.phone = phone;
        this.sortOrder = sortOrder;
    }

    public void updateProfile(String name, String dept, String role, String phone) {
        this.name = name;
        this.dept = dept;
        this.role = role;
        this.phone = phone;
    }

    public void updateSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public void updateStatus(String status, String statusMemo, String reliefName, Instant now) {
        this.status = status;
        this.statusMemo = statusMemo;
        this.reliefName = reliefName;
        this.statusAt = now;
    }

    /** 교대해 준 사람의 이름이 바뀌거나(새 이름) 명단에서 빠졌을 때(null). 상태 시각은 그대로 둔다. */
    public void changeReliefName(String reliefName) {
        this.reliefName = reliefName;
    }

    public void updateLocation(String location, Instant now) {
        this.location = location;
        this.locationAt = location == null ? null : now;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDept() {
        return dept;
    }

    public String getRole() {
        return role;
    }

    public String getPhone() {
        return phone;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public String getStatus() {
        return status;
    }

    public String getStatusMemo() {
        return statusMemo;
    }

    public Instant getStatusAt() {
        return statusAt;
    }

    public String getReliefName() {
        return reliefName;
    }

    public String getLocation() {
        return location;
    }

    public Instant getLocationAt() {
        return locationAt;
    }
}
