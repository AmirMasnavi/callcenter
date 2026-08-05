package com.elmosanatearia.callcenter.user;

import java.util.*;

/**
 * A single capability. Roles bundle these into sensible defaults; an admin can then
 * grant or revoke individual ones per user (see {@link UserPermission}).
 *
 * <p>Roles answer "what kind of user is this"; permissions answer "what may they do".
 * Endpoints are gated on permissions so a capability can be handed out without also
 * handing over everything else the role implies — an operator who may export data does
 * not thereby become a manager.
 */
public enum Permission {
    SUBMIT_REPORTS("ثبت و ارسال گزارش"),
    REVIEW_REPORTS("بررسی و تأیید گزارش‌ها"),
    VIEW_ALL_REPORTS("مشاهده گزارش همه تیم‌ها"),
    VIEW_DASHBOARD("مشاهده داشبورد تحلیلی"),
    EXPORT_DATA("گرفتن خروجی Excel و CSV"),
    MANAGE_USERS("افزودن و ویرایش کاربران"),
    MANAGE_ROLES("تغییر نقش‌ها و دسترسی‌ها"),
    VIEW_AUDIT("مشاهده تاریخچه فعالیت‌ها"),
    VOID_REPORT("ابطال و بازگردانی گزارش"),
    REOPEN_REPORT("بازگشایی گزارش تأییدشده"),
    IMPERSONATE("مشاهده سامانه به‌جای کاربر دیگر");

    private final String label;
    Permission(String label) { this.label = label; }
    /** Persian label, shown in the admin UI. */
    public String getLabel() { return label; }

    /** What each role grants out of the box. */
    public static Set<Permission> defaultsFor(Role role) {
        return switch (role) {
            case AGENT -> EnumSet.of(SUBMIT_REPORTS);
            case SUPERVISOR -> EnumSet.of(REVIEW_REPORTS);
            case MANAGER -> EnumSet.of(VIEW_DASHBOARD, EXPORT_DATA, VIEW_ALL_REPORTS);
            case ADMIN -> EnumSet.allOf(Permission.class);
        };
    }

    public static Set<Permission> defaultsFor(Collection<Role> roles) {
        Set<Permission> result = EnumSet.noneOf(Permission.class);
        roles.forEach(r -> result.addAll(defaultsFor(r)));
        return result;
    }

    /**
     * Effective permissions: what the roles give, plus explicit grants, minus explicit
     * revokes. Revokes are applied last so an admin can always take something back.
     */
    public static Set<Permission> effective(Collection<Role> roles, Collection<UserPermission> overrides) {
        Set<Permission> result = defaultsFor(roles);
        overrides.stream().filter(UserPermission::isGranted).forEach(o -> result.add(o.getPermission()));
        overrides.stream().filter(o -> !o.isGranted()).forEach(o -> result.remove(o.getPermission()));
        return result;
    }
}
