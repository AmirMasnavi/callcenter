package com.elmosanatearia.callcenter.auth;

import com.elmosanatearia.callcenter.user.*;
import org.springframework.security.core.*;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.*;
import java.util.stream.Stream;

/**
 * @param permissions   effective capabilities (role defaults + grants − revokes), resolved at login
 * @param impersonatedBy id of the admin viewing the app as this user, or null for a normal session
 */
public record AppPrincipal(Long id, String username, String password, String displayName,
                           Set<Role> roles, Set<Permission> permissions,
                           boolean active, boolean mustChangePassword,
                           Long impersonatedBy) implements UserDetails {

    public AppPrincipal {
        roles = roles == null ? Set.of() : Set.copyOf(roles);
        permissions = permissions == null ? Set.of() : Set.copyOf(permissions);
    }

    public static AppPrincipal from(AppUser u) {
        return new AppPrincipal(u.getId(), u.getUsername(), u.getPasswordHash(), u.getDisplayName(),
                u.getRoles(), u.effectivePermissions(), u.isActive(), u.isMustChangePassword(), null);
    }

    /** The same principal, but marked as being viewed by {@code adminId}. */
    public AppPrincipal impersonatedBy(Long adminId) {
        return new AppPrincipal(id, username, password, displayName, roles, permissions,
                active, mustChangePassword, adminId);
    }

    public boolean hasRole(Role role) { return roles.contains(role); }

    public boolean hasAnyRole(Role... candidates) {
        for (Role r : candidates) if (roles.contains(r)) return true;
        return false;
    }

    public boolean can(Permission permission) { return permissions.contains(permission); }

    /**
     * Both role and permission authorities are published, so security rules can be written
     * against either: {@code hasRole('ADMIN')} or {@code hasAuthority('PERM_EXPORT_DATA')}.
     */
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return Stream.concat(
                roles.stream().map(r -> "ROLE_" + r.name()),
                permissions.stream().map(p -> "PERM_" + p.name())
        ).map(SimpleGrantedAuthority::new).toList();
    }
    @Override public String getPassword() { return password; }
    @Override public String getUsername() { return username; }
    @Override public boolean isEnabled() { return active; }
}
