package com.elmosanatearia.callcenter.user;

import jakarta.persistence.*;

/**
 * A per-user override of one {@link Permission}.
 *
 * <p>{@code granted = true} adds a capability the user's roles don't include;
 * {@code granted = false} takes away one they otherwise would. Storing revokes
 * explicitly (rather than only storing grants) means an admin can keep a user in a
 * role while removing a single ability, without inventing a new role for the exception.
 */
@Embeddable
public class UserPermission {
    @Enumerated(EnumType.STRING)
    @Column(name = "permission", nullable = false, length = 32)
    private Permission permission;

    @Column(name = "granted", nullable = false)
    private boolean granted;

    protected UserPermission() {}

    public UserPermission(Permission permission, boolean granted) {
        this.permission = permission;
        this.granted = granted;
    }

    public Permission getPermission() { return permission; }
    public boolean isGranted() { return granted; }

    @Override public boolean equals(Object o) {
        return o instanceof UserPermission other
                && permission == other.permission && granted == other.granted;
    }
    @Override public int hashCode() { return permission.hashCode() * 31 + Boolean.hashCode(granted); }
}
