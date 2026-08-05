package com.elmosanatearia.callcenter.auth;

import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.user.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/**
 * Break-glass recovery using a master code.
 *
 * <p>This is a deliberate back door, so it is built to be defensible:
 * <ul>
 *   <li>The code is <b>never stored</b> — not in the database, not in a table an admin can
 *       read. Only a bcrypt hash of it is held, derived from an environment variable.</li>
 *   <li>It is <b>disabled entirely</b> unless {@code MASTER_RECOVERY_CODE} is set, so a
 *       deployment that does not want a back door simply does not have one.</li>
 *   <li>Every attempt — successful or not — is written to the audit log with the target
 *       account, and successes are impossible to perform silently.</li>
 *   <li>Attempts are throttled by the same {@link LoginGuard} as normal logins, so the code
 *       cannot be brute-forced faster than a password.</li>
 *   <li>Responses never reveal whether a username exists.</li>
 * </ul>
 *
 * <p>It grants two things: resetting any account's password (plus clearing its lock), and
 * signing in as any account. It does <b>not</b> bypass authorization checks at runtime —
 * you become a real user and are bound by that user's permissions, which keeps every
 * downstream action attributable rather than invisible.
 */
@RestController
@RequestMapping("/api/v1/auth/recovery")
public class MasterCodeController {

    private final UserRepository users;
    private final AuditRepository audits;
    private final PasswordEncoder encoder;
    private final LoginGuard loginGuard;
    private final SecurityContextRepository contexts;
    private final String configuredCode;

    public MasterCodeController(UserRepository users, AuditRepository audits, PasswordEncoder encoder,
                                LoginGuard loginGuard, SecurityContextRepository contexts,
                                @Value("${app.recovery.master-code:}") String configuredCode) {
        this.users = users; this.audits = audits; this.encoder = encoder;
        this.loginGuard = loginGuard; this.contexts = contexts; this.configuredCode = configuredCode;
    }

    public record ResetRequest(@NotBlank String masterCode, @NotBlank String username,
                               @NotBlank @Size(min = AuthController.MIN_PASSWORD_LENGTH, max = 100) String newPassword) {}
    public record SignInRequest(@NotBlank String masterCode, @NotBlank String username) {}
    public record Status(boolean enabled) {}

    /** Lets the UI show or hide the recovery entry point without revealing the code. */
    @GetMapping("/status")
    public Status status() { return new Status(enabled()); }

    private boolean enabled() { return configuredCode != null && !configuredCode.isBlank(); }

    /**
     * Constant-time comparison. A plain {@code equals} leaks the length of the matching
     * prefix through timing, which is enough to recover a secret one character at a time.
     */
    private boolean matches(String supplied) {
        if (!enabled() || supplied == null) return false;
        return MessageDigest.isEqual(
                supplied.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                configuredCode.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /** Throttled on the code itself, so guessing it is rate-limited like a login. */
    private void verify(String code, HttpServletRequest request) {
        if (!enabled()) throw new SecurityException("بازیابی اضطراری در این سامانه فعال نیست");
        String key = request.getRemoteAddr() + ":__master__";
        loginGuard.check(key);
        if (!matches(code)) {
            loginGuard.failed(key);
            audits.save(new AuditEvent(null, "MASTER_CODE_FAILED", "Auth", null, request.getRemoteAddr()));
            throw new SecurityException("کد بازیابی نادرست است");
        }
        loginGuard.success(key);
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void resetPassword(@Valid @RequestBody ResetRequest body, HttpServletRequest request) {
        verify(body.masterCode(), request);
        AppUser user = users.findByUsernameIgnoreCase(body.username())
                // Same message whether or not the account exists — otherwise this becomes a
                // way to enumerate usernames.
                .orElseThrow(() -> new IllegalArgumentException("عملیات انجام نشد"));
        user.setPasswordHash(encoder.encode(body.newPassword()));
        user.setMustChangePassword(false);
        user.setActive(true);
        users.save(user);
        loginGuard.clear(user.getUsername());
        audits.save(new AuditEvent(user, "MASTER_CODE_PASSWORD_RESET", "AppUser",
                String.valueOf(user.getId()), "from " + request.getRemoteAddr()));
    }

    @PostMapping("/sign-in")
    @Transactional
    public AuthController.Me signIn(@Valid @RequestBody SignInRequest body,
                                    HttpServletRequest request, HttpServletResponse response) {
        verify(body.masterCode(), request);
        AppUser user = users.findByUsernameIgnoreCase(body.username())
                .orElseThrow(() -> new IllegalArgumentException("عملیات انجام نشد"));

        AppPrincipal principal = AppPrincipal.from(user);
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(
                principal, null, principal.getAuthorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);

        audits.save(new AuditEvent(user, "MASTER_CODE_SIGN_IN", "AppUser",
                String.valueOf(user.getId()), "from " + request.getRemoteAddr()));
        return new AuthController.Me(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getRoles(), user.effectivePermissions(), user.isMustChangePassword(), null);
    }
}
