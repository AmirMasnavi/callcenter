package com.elmosanatearia.callcenter.settings;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Runtime settings, read on nearly every login, so they are cached in memory and the
 * cache is invalidated on write rather than hitting the database each time.
 */
@Service
public class SettingsService {
    public static final String LOGIN_GUARD_ENABLED = "login.guard.enabled";
    public static final String LOGIN_GUARD_MAX_ATTEMPTS = "login.guard.max-attempts";
    public static final String LOGIN_GUARD_LOCKOUT_MINUTES = "login.guard.lockout-minutes";

    private final AppSettingRepository repository;
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    public SettingsService(AppSettingRepository repository) { this.repository = repository; }

    @Transactional(readOnly = true)
    public String get(String key, String fallback) {
        return cache.computeIfAbsent(key, k ->
                repository.findById(k).map(AppSetting::getValue).orElse(fallback));
    }

    public boolean getBoolean(String key, boolean fallback) {
        return Boolean.parseBoolean(get(key, String.valueOf(fallback)));
    }

    public int getInt(String key, int fallback) {
        try { return Integer.parseInt(get(key, String.valueOf(fallback))); }
        catch (NumberFormatException e) { return fallback; }
    }

    @Transactional
    public void set(String key, String value) {
        repository.save(new AppSetting(key, value));
        cache.put(key, value);
    }

    @Transactional(readOnly = true)
    public Map<String, String> all() {
        Map<String, String> result = new LinkedHashMap<>();
        repository.findAll().forEach(s -> result.put(s.getKey(), s.getValue()));
        return result;
    }
}
