package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 운영 중에 재배포 없이 켜고 끄는 값(예: 소개팅 새 가입 받기). 키 하나에 값 하나.
 * 환경변수로 두면 바꿀 때마다 서버가 1~2분 끊기므로 DB 에 둔다.
 */
@Entity
@Table(name = "app_settings")
public class AppSetting {

    @Id
    @Column(name = "setting_key", length = 80)
    private String key;

    @Column(name = "setting_value", length = 500)
    private String value;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected AppSetting() {
    }

    public AppSetting(String key, String value) {
        this.key = key;
        this.value = value;
        this.updatedAt = LocalDateTime.now();
    }

    public String getKey() {
        return key;
    }

    public String getValue() {
        return value;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setValue(String value) {
        this.value = value;
        this.updatedAt = LocalDateTime.now();
    }
}
