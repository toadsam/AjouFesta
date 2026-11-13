package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDateTime;

@Entity
@Table(name = "staff_members")
public class StaffMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String staffNo;

    @Column(nullable = false)
    private String pinHash;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 40)
    private String team;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StaffStatus status;

    @Column(length = 250)
    private String currentTask;

    @Column(length = 1000)
    private String currentNote;

    @Column
    private Long assignedBoothId;

    @Column
    private Double latitude;

    @Column
    private Double longitude;

    @ColumnDefault("true")
    private Boolean locationSharingEnabled = true;

    @Column(nullable = false)
    private LocalDateTime lastUpdatedAt;

    protected StaffMember() {
    }

    public StaffMember(
            String staffNo,
            String pinHash,
            String name,
            String team,
            StaffStatus status,
            String currentTask,
            String currentNote,
            Long assignedBoothId,
            Double latitude,
            Double longitude,
            LocalDateTime lastUpdatedAt
    ) {
        this.staffNo = staffNo;
        this.pinHash = pinHash;
        this.name = name;
        this.team = team;
        this.status = status;
        this.currentTask = currentTask;
        this.currentNote = currentNote;
        this.assignedBoothId = assignedBoothId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.locationSharingEnabled = true;
        this.lastUpdatedAt = lastUpdatedAt;
    }

    public void updateRuntime(
            StaffStatus status,
            String currentTask,
            String currentNote,
            Double latitude,
            Double longitude,
            LocalDateTime now
    ) {
        this.status = status;
        this.currentTask = currentTask;
        this.currentNote = currentNote;
        this.latitude = latitude;
        this.longitude = longitude;
        this.lastUpdatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getStaffNo() {
        return staffNo;
    }

    public String getPinHash() {
        return pinHash;
    }

    public void updateCredentials(String staffNo, String pinHash) {
        this.staffNo = staffNo;
        this.pinHash = pinHash;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getTeam() {
        return team;
    }

    public void setTeam(String team) {
        this.team = team;
    }

    public StaffStatus getStatus() {
        return status;
    }

    public String getCurrentTask() {
        return currentTask;
    }

    public String getCurrentNote() {
        return currentNote;
    }

    public Long getAssignedBoothId() {
        return assignedBoothId;
    }

    public void setAssignedBoothId(Long assignedBoothId) {
        this.assignedBoothId = assignedBoothId;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public LocalDateTime getLastUpdatedAt() {
        return lastUpdatedAt;
    }

    public Boolean getLocationSharingEnabled() {
        return locationSharingEnabled == null ? true : locationSharingEnabled;
    }

    public void setLocationSharingEnabled(Boolean locationSharingEnabled) {
        this.locationSharingEnabled = locationSharingEnabled;
    }
}
