package com.elmosanatearia.callcenter.settings;

import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.auth.AppPrincipal;
import com.elmosanatearia.callcenter.auth.LoginGuard;
import com.elmosanatearia.callcenter.user.UserRepository;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/**
 * Runtime security settings. These exist so an admin can relax or disable the login
 * throttle from the UI — being locked out of your own system with no way back in is worse
 * than the brute-force risk the throttle guards against.
 */
@RestController
@RequestMapping("/api/v1/admin/settings")
public class SettingsController {
    private final SettingsService settings;
    private final LoginGuard loginGuard;
    private final AuditRepository audits;
    private final UserRepository users;

    public SettingsController(SettingsService settings, LoginGuard loginGuard,
                              AuditRepository audits, UserRepository users) {
        this.settings = settings; this.loginGuard = loginGuard; this.audits = audits; this.users = users;
    }

    public record SecuritySettings(boolean loginGuardEnabled, int maxAttempts, int lockoutMinutes, int currentlyLocked) {}
    public record SecurityUpdate(boolean loginGuardEnabled,
                                 @Min(1) @Max(50) int maxAttempts,
                                 @Min(1) @Max(1440) int lockoutMinutes) {}

    @GetMapping("/security")
    public SecuritySettings read() {
        return new SecuritySettings(
                settings.getBoolean(SettingsService.LOGIN_GUARD_ENABLED, true),
                settings.getInt(SettingsService.LOGIN_GUARD_MAX_ATTEMPTS, 5),
                settings.getInt(SettingsService.LOGIN_GUARD_LOCKOUT_MINUTES, 15),
                loginGuard.lockedCount());
    }

    @PutMapping("/security")
    public SecuritySettings update(@RequestBody SecurityUpdate body, @AuthenticationPrincipal AppPrincipal actor) {
        settings.set(SettingsService.LOGIN_GUARD_ENABLED, String.valueOf(body.loginGuardEnabled()));
        settings.set(SettingsService.LOGIN_GUARD_MAX_ATTEMPTS, String.valueOf(body.maxAttempts()));
        settings.set(SettingsService.LOGIN_GUARD_LOCKOUT_MINUTES, String.valueOf(body.lockoutMinutes()));
        audit(actor, "UPDATE_SECURITY_SETTINGS",
                "enabled=" + body.loginGuardEnabled() + " max=" + body.maxAttempts() + " minutes=" + body.lockoutMinutes());
        return read();
    }

    /** Frees an account (or everyone) that is currently locked out. */
    @PostMapping("/security/unlock")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Integer> unlock(@RequestParam(required = false) String username,
                                       @AuthenticationPrincipal AppPrincipal actor) {
        int cleared = loginGuard.clear(username);
        audit(actor, "UNLOCK_LOGIN", username == null || username.isBlank() ? "all" : username);
        return Map.of("cleared", cleared);
    }

    private void audit(AppPrincipal actor, String action, String meta) {
        audits.save(new AuditEvent(users.findById(actor.id()).orElseThrow(), action, "Settings", null, meta));
    }
}
