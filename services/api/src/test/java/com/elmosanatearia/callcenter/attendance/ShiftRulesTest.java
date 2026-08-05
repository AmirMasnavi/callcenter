package com.elmosanatearia.callcenter.attendance;

import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * The rules the front desk runs into. Every recording path — live clock-in, backdated manual
 * entry, and after-the-fact correction — goes through these, so a gap here is a gap in payroll.
 */
class ShiftRulesTest {
    /** A fixed "now" so the boundary cases are exact rather than racing the wall clock. */
    private static final Instant NOW = Instant.parse("2026-08-05T12:00:00Z");

    private String rejects(String entry, String exit) {
        return assertThrows(IllegalArgumentException.class,
                () -> ShiftRules.validate(Instant.parse(entry), exit == null ? null : Instant.parse(exit), NOW))
                .getMessage();
    }

    private void accepts(String entry, String exit) {
        assertDoesNotThrow(() ->
                ShiftRules.validate(Instant.parse(entry), exit == null ? null : Instant.parse(exit), NOW));
    }

    // --- the case that motivated manual entry: a day nobody was there to record ---

    @Test void acceptsAShiftRecordedDaysLater() {
        accepts("2026-08-02T11:30:00Z", "2026-08-02T16:22:00Z");
    }

    @Test void acceptsAnOvernightShiftCrossingMidnight() {
        // 22:00 to 02:00 the next morning is one shift on the paper form, not two.
        accepts("2026-08-04T18:30:00Z", "2026-08-04T22:30:00Z");
    }

    // --- entry time ---

    @Test void anOpenShiftNeedsNoExit() {
        accepts("2026-08-05T09:00:00Z", null);
    }

    @Test void entryIsRequired() {
        assertEquals("زمان ورود الزامی است", assertThrows(IllegalArgumentException.class,
                () -> ShiftRules.validate(null, Instant.parse("2026-08-05T10:00:00Z"), NOW)).getMessage());
    }

    @Test void entryCannotBeInTheFuture() {
        assertEquals("زمان ورود نمی‌تواند در آینده باشد", rejects("2026-08-06T09:00:00Z", null));
    }

    @Test void aFewMinutesEarlyIsFine() {
        // The desk clock runs a little fast; that is not an error worth blocking someone over.
        accepts("2026-08-05T12:04:00Z", null);
    }

    @Test void beyondTheSlackItIsTheFuture() {
        assertEquals("زمان ورود نمی‌تواند در آینده باشد", rejects("2026-08-05T12:06:00Z", null));
    }

    // --- exit time ---

    @Test void exitMustBeAfterEntry() {
        assertEquals("زمان خروج باید بعد از زمان ورود باشد",
                rejects("2026-08-05T10:00:00Z", "2026-08-05T09:00:00Z"));
    }

    @Test void exitEqualToEntryIsAZeroLengthShift() {
        assertEquals("زمان خروج باید بعد از زمان ورود باشد",
                rejects("2026-08-05T10:00:00Z", "2026-08-05T10:00:00Z"));
    }

    @Test void exitCannotBeInTheFutureEither() {
        // Entry is valid here; only the exit is ahead of the clock.
        assertEquals("زمان خروج نمی‌تواند در آینده باشد",
                rejects("2026-08-05T09:00:00Z", "2026-08-05T13:00:00Z"));
    }

    // --- length ---

    @Test void exactlyTwentyFourHoursIsAllowed() {
        accepts("2026-08-04T12:00:00Z", "2026-08-05T12:00:00Z");
    }

    @Test void pastTwentyFourHoursAMissingExitIsTheLikelierStory() {
        assertEquals("مدت یک شیفت نمی‌تواند بیش از ۲۴ ساعت باشد",
                rejects("2026-08-04T11:59:00Z", "2026-08-05T12:00:00Z"));
    }

    @Test void aOneMinuteShiftIsStillAShift() {
        accepts("2026-08-05T10:00:00Z", "2026-08-05T10:01:00Z");
    }
}
