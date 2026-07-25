package com.elmosanatearia.callcenter.auth;

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

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthenticationManager authManager;
    private final SecurityContextRepository contexts;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final LoginGuard loginGuard;
    public AuthController(AuthenticationManager authManager, SecurityContextRepository contexts,
                          UserRepository users, PasswordEncoder encoder, LoginGuard loginGuard) {
        this.authManager = authManager; this.contexts = contexts; this.users = users; this.encoder = encoder; this.loginGuard=loginGuard;
    }
    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @Size(min=10,max=100) String newPassword) {}
    public record Me(Long id, String username, String displayName, Role role, boolean mustChangePassword) {}

    @GetMapping("/csrf") public void csrf(org.springframework.security.web.csrf.CsrfToken token) { token.getToken(); }
    @PostMapping("/login")
    public Me login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        String key=request.getRemoteAddr()+":"+body.username().toLowerCase();loginGuard.check(key);Authentication auth;
        try{auth=authManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(body.username(), body.password()));loginGuard.success(key);}
        catch(AuthenticationException ex){loginGuard.failed(key);throw ex;}
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
                current.getRole(), current.isMustChangePassword());
    }
    @PostMapping("/change-password") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void change(@Valid @RequestBody ChangePasswordRequest body, Authentication auth) {
        AppPrincipal p = (AppPrincipal) auth.getPrincipal();
        AppUser user = users.findById(p.id()).orElseThrow();
        if (!encoder.matches(body.currentPassword(), user.getPasswordHash()))
            throw new BadCredentialsException("رمز فعلی نادرست است");
        user.setPasswordHash(encoder.encode(body.newPassword()));
        user.setMustChangePassword(false);
        users.save(user);
    }
    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response, Authentication auth) {
        new SecurityContextLogoutHandler().logout(request, response, auth);
        new CookieClearingLogoutHandler("JSESSIONID", "XSRF-TOKEN").logout(request, response, auth);
    }
}
