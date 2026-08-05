package com.elmosanatearia.callcenter.user;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class PermissionTest {

    @Test void adminGetsEveryPermission() {
        assertEquals(EnumSet.allOf(Permission.class), Permission.defaultsFor(Role.ADMIN));
    }

    @Test void agentOnlySubmitsReports() {
        assertEquals(Set.of(Permission.SUBMIT_REPORTS), Permission.defaultsFor(Role.AGENT));
    }

    @Test void multipleRolesUnionTheirDefaults() {
        Set<Permission> combined = Permission.defaultsFor(List.of(Role.SUPERVISOR, Role.MANAGER));
        assertTrue(combined.contains(Permission.REVIEW_REPORTS), "from SUPERVISOR");
        assertTrue(combined.contains(Permission.VIEW_DASHBOARD), "from MANAGER");
        assertTrue(combined.contains(Permission.EXPORT_DATA), "from MANAGER");
        assertFalse(combined.contains(Permission.MANAGE_USERS), "neither role grants this");
    }

    @Test void grantAddsAPermissionTheRoleDoesNotInclude() {
        Set<Permission> effective = Permission.effective(
                List.of(Role.AGENT),
                List.of(new UserPermission(Permission.EXPORT_DATA, true)));
        assertEquals(Set.of(Permission.SUBMIT_REPORTS, Permission.EXPORT_DATA), effective);
    }

    @Test void revokeRemovesAPermissionTheRoleDoesInclude() {
        Set<Permission> effective = Permission.effective(
                List.of(Role.SUPERVISOR),
                List.of(new UserPermission(Permission.REVIEW_REPORTS, false)));
        // Asserts the revoked capability specifically, not that the set is empty — a role
        // gaining a second default (ARCHIVE_REPORTS did) must not break this test.
        assertFalse(effective.contains(Permission.REVIEW_REPORTS), "the revoked permission is gone");
        assertTrue(effective.containsAll(
                        Permission.defaultsFor(Role.SUPERVISOR).stream()
                                .filter(p -> p != Permission.REVIEW_REPORTS).toList()),
                "the role's other defaults are untouched");
    }

    @Test void revokeBeatsGrantForTheSamePermission() {
        // Applied last on purpose, so an admin can always take something back.
        Set<Permission> effective = Permission.effective(
                List.of(Role.AGENT),
                List.of(new UserPermission(Permission.EXPORT_DATA, true),
                        new UserPermission(Permission.EXPORT_DATA, false)));
        assertFalse(effective.contains(Permission.EXPORT_DATA));
    }

    @Test void revokingSomethingNeverGrantedChangesNothing() {
        Set<Permission> effective = Permission.effective(
                List.of(Role.AGENT),
                List.of(new UserPermission(Permission.MANAGE_USERS, false)));
        assertEquals(Set.of(Permission.SUBMIT_REPORTS), effective);
    }

    @Test void noOverridesLeavesRoleDefaultsIntact() {
        assertEquals(Permission.defaultsFor(Role.MANAGER),
                Permission.effective(List.of(Role.MANAGER), List.of()));
    }

    @Test void everyPermissionHasANonEmptyLabel() {
        for (Permission p : Permission.values())
            assertFalse(p.getLabel().isBlank(), p + " needs a Persian label for the admin UI");
    }
}
