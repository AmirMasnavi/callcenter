package com.elmosanatearia.callcenter.auth;

import com.elmosanatearia.callcenter.settings.SettingsService;
import org.springframework.stereotype.Component;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

/**
 * Brute-force throttle for logins, keyed on IP + username.
 *
 * <p>The thresholds are runtime settings rather than constants, and the whole guard can be
 * switched off, because an admin locked out of their own system has no way back in — which
 * is precisely the situation this used to create. An admin can also clear a specific lock.
 *
 * <p>Still in-memory, so it does not survive a restart and is per-instance. That is a
 * deliberate limitation at this scale; behind more than one replica it needs Redis.
 */
@Component
public class LoginGuard {
    private record Attempt(int count, Instant since) {}

    private final ConcurrentMap<String, Attempt> attempts = new ConcurrentHashMap<>();
    private final SettingsService settings;

    public LoginGuard(SettingsService settings) { this.settings = settings; }

    private boolean enabled() { return settings.getBoolean(SettingsService.LOGIN_GUARD_ENABLED, true); }
    private int maxAttempts() { return Math.max(1, settings.getInt(SettingsService.LOGIN_GUARD_MAX_ATTEMPTS, 5)); }
    private Duration lockout() { return Duration.ofMinutes(Math.max(1, settings.getInt(SettingsService.LOGIN_GUARD_LOCKOUT_MINUTES, 15))); }

    public void check(String key) {
        if (!enabled()) return;
        Attempt a = attempts.get(key);
        if (a == null) return;
        Instant expiry = a.since.plus(lockout());
        if (expiry.isBefore(Instant.now())) { attempts.remove(key); return; }
        if (a.count >= maxAttempts()) {
            long minutesLeft = Math.max(1, Duration.between(Instant.now(), expiry).toMinutes() + 1);
            throw new TooManyAttemptsException(
                    "تلاش‌های ورود بیش از حد است؛ " + minutesLeft + " دقیقه بعد دوباره امتحان کنید");
        }
    }

    public void failed(String key) {
        if (!enabled()) return;
        attempts.compute(key, (k, a) -> a == null ? new Attempt(1, Instant.now()) : new Attempt(a.count + 1, a.since));
    }

    public void success(String key) { attempts.remove(key); }

    /** Admin escape hatch: clear every lock, or just those for one username. */
    public int clear(String username) {
        if (username == null || username.isBlank()) {
            int n = attempts.size();
            attempts.clear();
            return n;
        }
        String suffix = ":" + username.toLowerCase();
        List<String> hits = attempts.keySet().stream().filter(k -> k.endsWith(suffix)).toList();
        hits.forEach(attempts::remove);
        return hits.size();
    }

    public int lockedCount() {
        if (!enabled()) return 0;
        int max = maxAttempts();
        Duration window = lockout();
        return (int) attempts.values().stream()
                .filter(a -> a.count >= max && a.since.plus(window).isAfter(Instant.now()))
                .count();
    }

    /** Mapped to 429 rather than the generic 409 an IllegalStateException would produce. */
    public static class TooManyAttemptsException extends RuntimeException {
        public TooManyAttemptsException(String message) { super(message); }
    }
}
