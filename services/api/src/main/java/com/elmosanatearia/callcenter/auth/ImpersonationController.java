package com.elmosanatearia.callcenter.auth;

import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.user.*;
import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * Lets an admin view the app exactly as another user sees it.
 * <p>
 * Starting is ADMIN-only (enforced by the {@code /api/v1/admin/**} rule in SecurityConfig).
 * Stopping deliberately lives under {@code /api/v1/auth/**}, because while impersonating, the
 * session no longer carries ADMIN authority and could not reach an admin route to get back.
 */
@RestController
public class ImpersonationController {
    private final UserRepository users;
    private final AuditRepository audits;
    private final SecurityContextRepository contexts;

    public ImpersonationController(UserRepository users, AuditRepository audits, SecurityContextRepository contexts) {
        this.users = users; this.audits = audits; this.contexts = contexts;
    }

    @PostMapping("/api/v1/admin/impersonate/{userId}") @Transactional
    public AuthController.Me start(@PathVariable Long userId, @AuthenticationPrincipal AppPrincipal admin,
                                   HttpServletRequest request, HttpServletResponse response) {
        if (admin.impersonatedBy() != null) throw new IllegalStateException("هم‌اکنون در حال مشاهده به‌جای کاربر دیگری هستید");
        if (userId.equals(admin.id())) throw new IllegalArgumentException("نمی‌توانید به‌جای خودتان وارد شوید");
        AppUser target = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("کاربر یافت نشد"));
        if (!target.isActive()) throw new IllegalArgumentException("کاربر غیرفعال است");

        AppPrincipal viewAs = AppPrincipal.from(target).impersonatedBy(admin.id());
        replaceSession(viewAs, request, response);
        audits.save(new AuditEvent(users.findById(admin.id()).orElseThrow(), "IMPERSONATE_START",
                "AppUser", userId.toString(), target.getUsername()));
        return new AuthController.Me(target.getId(), target.getUsername(), target.getDisplayName(),
                target.getRoles(), target.effectivePermissions(), target.isMustChangePassword(), admin.id());
    }

    @PostMapping("/api/v1/auth/stop-impersonating") @Transactional
    public AuthController.Me stop(@AuthenticationPrincipal AppPrincipal current,
                                  HttpServletRequest request, HttpServletResponse response) {
        Long adminId = current.impersonatedBy();
        if (adminId == null) throw new IllegalStateException("جلسه جاری مشاهده به‌جای کاربر دیگر نیست");
        AppUser admin = users.findById(adminId).orElseThrow();

        AppPrincipal restored = AppPrincipal.from(admin);
        replaceSession(restored, request, response);
        audits.save(new AuditEvent(admin, "IMPERSONATE_STOP", "AppUser", String.valueOf(current.id()), current.username()));
        return new AuthController.Me(admin.getId(), admin.getUsername(), admin.getDisplayName(),
                admin.getRoles(), admin.effectivePermissions(), admin.isMustChangePassword(), null);
    }

    private void replaceSession(AppPrincipal principal, HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
    }
}
