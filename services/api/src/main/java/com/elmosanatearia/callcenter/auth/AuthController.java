package com.elmosanatearia.callcenter.auth;

import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.user.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.core.*;
import org.springframework.security.core.context.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.*;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    /** Minimum length for a user-chosen password. */
    public static final int MIN_PASSWORD_LENGTH = 8;

    private final AuthenticationManager authManager;
    private final SecurityContextRepository contexts;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final LoginGuard loginGuard;
    private final AuditRepository audits;

    public AuthController(AuthenticationManager authManager, SecurityContextRepository contexts,
                          UserRepository users, PasswordEncoder encoder, LoginGuard loginGuard,
                          AuditRepository audits) {
        this.authManager = authManager; this.contexts = contexts; this.users = users;
        this.encoder = encoder; this.loginGuard = loginGuard; this.audits = audits;
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    /**
     * {@code currentPassword} is optional while the account still carries a temporary password:
     * the user has just proven it at login, so asking for it again is pure friction.
     */
    public record ChangePasswordRequest(String currentPassword,
                                        @NotBlank @Size(min = MIN_PASSWORD_LENGTH, max = 100) String newPassword) {}

    /** {@code permissions} is what the UI should actually key off — roles are only their source. */
    public record Me(Long id, String username, String displayName, Set<Role> roles,
                     Set<Permission> permissions, boolean mustChangePassword, Long impersonatedBy) {}

    @GetMapping("/csrf") public void csrf(org.springframework.security.web.csrf.CsrfToken token) { token.getToken(); }

    @PostMapping("/login")
    public Me login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        String key = request.getRemoteAddr() + ":" + body.username().toLowerCase();
        loginGuard.check(key);
        Authentication auth;
        try {
            auth = authManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(body.username(), body.password()));
            loginGuard.success(key);
        } catch (AuthenticationException ex) {
            loginGuard.failed(key);
            throw ex;
        }
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        return me(auth);
    }

    @GetMapping("/me") public Me me(Authentication auth) {
        AppPrincipal p = (AppPrincipal) auth.getPrincipal();
        AppUser current = users.findById(p.id()).orElseThrow();
        return new Me(current.getId(), current.getUsername(), current.getDisplayName(),
                current.getRoles(), current.effectivePermissions(),
                current.isMustChangePassword(), p.impersonatedBy());
    }

    @PostMapping("/change-password") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void change(@Valid @RequestBody ChangePasswordRequest body, Authentication auth) {
        AppPrincipal p = (AppPrincipal) auth.getPrincipal();
        AppUser user = users.findById(p.id()).orElseThrow();
        // Only a voluntary change needs the old password re-typed.
        //
        // These deliberately throw IllegalArgumentException (-> 400) rather than
        // BadCredentialsException. A BadCredentialsException is mapped to 401 by the shared
        // AuthenticationException handler, and the SPA treats *any* 401 as an expired session
        // — so getting your current password wrong used to log you straight out, with the
        // misleading message "username or password is incorrect".
        if (!user.isMustChangePassword()) {
            if (body.currentPassword() == null || body.currentPassword().isBlank())
                throw new IllegalArgumentException("برای تغییر رمز، ابتدا رمز فعلی خود را وارد کنید");
            if (!encoder.matches(body.currentPassword(), user.getPasswordHash()))
                throw new IllegalArgumentException("رمز فعلی نادرست است");
        }
        if (encoder.matches(body.newPassword(), user.getPasswordHash()))
            throw new IllegalArgumentException("رمز جدید باید با رمز فعلی متفاوت باشد");
        user.setPasswordHash(encoder.encode(body.newPassword()));
        user.setMustChangePassword(false);
        users.save(user);
        audits.save(new AuditEvent(user, "CHANGE_PASSWORD", "AppUser", String.valueOf(user.getId()), null));
    }

    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response, Authentication auth) {
        new SecurityContextLogoutHandler().logout(request, response, auth);
        new CookieClearingLogoutHandler("JSESSIONID", "XSRF-TOKEN").logout(request, response, auth);
    }
}
