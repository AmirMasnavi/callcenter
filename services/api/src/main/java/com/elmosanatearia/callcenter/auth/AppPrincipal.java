package com.elmosanatearia.callcenter.auth;

import com.elmosanatearia.callcenter.user.*;
import org.springframework.security.core.*;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.*;

/**
 * @param impersonatedBy id of the admin viewing the app as this user, or null for a normal session.
 */
public record AppPrincipal(Long id, String username, String password, String displayName,
                           Set<Role> roles, boolean active, boolean mustChangePassword,
                           Long impersonatedBy) implements UserDetails {

    public AppPrincipal {
        roles = roles == null ? Set.of() : Set.copyOf(roles);
    }

    public static AppPrincipal from(AppUser u) {
        return new AppPrincipal(u.getId(), u.getUsername(), u.getPasswordHash(), u.getDisplayName(),
                u.getRoles(), u.isActive(), u.isMustChangePassword(), null);
    }

    /** The same principal, but marked as being viewed by {@code adminId}. */
    public AppPrincipal impersonatedBy(Long adminId) {
        return new AppPrincipal(id, username, password, displayName, roles, active, mustChangePassword, adminId);
    }

    public boolean hasRole(Role role) { return roles.contains(role); }

    public boolean hasAnyRole(Role... candidates) {
        for (Role r : candidates) if (roles.contains(r)) return true;
        return false;
    }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r.name())).toList();
    }
    @Override public String getPassword() { return password; }
    @Override public String getUsername() { return username; }
    @Override public boolean isEnabled() { return active; }
}
