package com.elmosanatearia.callcenter.auth;

import com.elmosanatearia.callcenter.user.*;
import org.springframework.security.core.*;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.*;

public record AppPrincipal(Long id, String username, String password, String displayName,
                           Role role, boolean active, boolean mustChangePassword) implements UserDetails {
    public static AppPrincipal from(AppUser u) {
        return new AppPrincipal(u.getId(), u.getUsername(), u.getPasswordHash(), u.getDisplayName(),
                u.getRole(), u.isActive(), u.isMustChangePassword());
    }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }
    @Override public String getPassword() { return password; }
    @Override public String getUsername() { return username; }
    @Override public boolean isEnabled() { return active; }
}
