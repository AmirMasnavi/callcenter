package com.elmosanatearia.callcenter.attendance;

import java.time.Duration;
import java.time.Instant;

/**
 * What makes a shift valid, however it was recorded — clocked live, backdated by the front
 * desk, or corrected afterwards.
 *
 * <p>These rules live apart from the service so all three paths share one definition and can
 * be tested without a database. Payroll is computed from these timestamps, so a rule that
 * applies on one path but not another means hours that do not add up.
 */
final class ShiftRules {
    private ShiftRules() {}

    /**
     * The desk clock and the wall clock are never quite the same, so "now" gets a little slack
     * rather than rejecting a shift someone recorded a moment early.
     */
    static final Duration CLOCK_SLACK = Duration.ofMinutes(5);

    /** Nobody works a day and a half straight; past this, a missing exit is the likelier story. */
    static final Duration MAX_SHIFT = Duration.ofHours(24);

    /**
     * @param exitAt null for a shift that is still running
     * @param now    injected so the boundary cases are testable rather than timing-dependent
     * @throws IllegalArgumentException with a message meant for the person at the desk
     */
    static void validate(Instant entryAt, Instant exitAt, Instant now) {
        Instant latest = now.plus(CLOCK_SLACK);
        if (entryAt == null) throw new IllegalArgumentException("زمان ورود الزامی است");
        if (entryAt.isAfter(latest)) throw new IllegalArgumentException("زمان ورود نمی‌تواند در آینده باشد");
        if (exitAt == null) return;
        if (!exitAt.isAfter(entryAt)) throw new IllegalArgumentException("زمان خروج باید بعد از زمان ورود باشد");
        if (exitAt.isAfter(latest)) throw new IllegalArgumentException("زمان خروج نمی‌تواند در آینده باشد");
        if (Duration.between(entryAt, exitAt).compareTo(MAX_SHIFT) > 0)
            throw new IllegalArgumentException("مدت یک شیفت نمی‌تواند بیش از ۲۴ ساعت باشد");
    }
}
