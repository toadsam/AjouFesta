package com.festflow.backend.service;

import com.festflow.backend.entity.AppSetting;
import com.festflow.backend.repository.AppSettingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 운영 중에 재배포 없이 바꾸는 켜기/끄기 값. 없는 키는 기본값으로 본다. */
@Service
public class AppSettingService {

    private final AppSettingRepository repository;

    public AppSettingService(AppSettingRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public boolean getBoolean(String key, boolean defaultValue) {
        return repository.findById(key)
                .map(AppSetting::getValue)
                .map(value -> "true".equalsIgnoreCase(value.trim()))
                .orElse(defaultValue);
    }

    @Transactional
    public void setBoolean(String key, boolean value) {
        String text = Boolean.toString(value);
        AppSetting setting = repository.findById(key).orElse(null);
        if (setting == null) {
            repository.save(new AppSetting(key, text));
        } else {
            setting.setValue(text);
        }
    }
}
