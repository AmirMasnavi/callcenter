package com.elmosanatearia.callcenter.attendance;

import com.elmosanatearia.callcenter.user.AppUser;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Worked time is derived from the two timestamps rather than stored, so these cases pin
 * down the arithmetic payroll depends on.
 */
class AttendanceEntryTest {
    private static final ZoneId TEHRAN = AttendanceService.ZONE;

    private AttendanceEntry shift(String entry, String exit) {
        AppUser user = new AppUser();
        AttendanceEntry e = new AttendanceEntry(user, Instant.parse(entry), user);
        if (exit != null) e.setExitAt(Instant.parse(exit));
        return e;
    }

    @Test void openShiftContributesNothingYet() {
        AttendanceEntry e = shift("2026-08-05T10:00:00Z", null);
        assertTrue(e.isOpen());
        assertEquals(0, e.workedMinutes(), "an unfinished shift cannot count toward hours");
    }

    @Test void countsWholeMinutesBetweenEntryAndExit() {
        assertEquals(292, shift("2026-08-05T10:30:00Z", "2026-08-05T15:22:00Z").workedMinutes());
    }

    @Test void matchesThePaperFormExample() {
        // 15:00 -> 19:52 on the sheet was recorded as 4:52.
        long minutes = shift("2026-08-05T11:30:00Z", "2026-08-05T16:22:00Z").workedMinutes();
        assertEquals(4, minutes / 60);
        assertEquals(52, minutes % 60);
    }

    @Test void theDayComesFromTehranTimeNotUtc() {
        // 21:00 UTC is 00:30 the NEXT day in Tehran (+03:30). Bucketing by UTC would file
        // this shift under the wrong date, which is why the service uses the Tehran zone.
        AttendanceEntry e = shift("2026-08-05T21:00:00Z", "2026-08-06T02:30:00Z");
        assertEquals(330, e.workedMinutes());
        assertEquals(LocalDate.of(2026, 8, 5), LocalDate.ofInstant(e.getEntryAt(), ZoneOffset.UTC),
                "sanity: it really is the 5th in UTC");
        assertEquals(LocalDate.of(2026, 8, 6), LocalDate.ofInstant(e.getEntryAt(), TEHRAN),
                "but the 6th locally — the local date is the one that matters");
    }

    @Test void severalShiftsInADaySumTogether() {
        long morning = shift("2026-08-05T05:00:00Z", "2026-08-05T08:00:00Z").workedMinutes();
        long evening = shift("2026-08-05T12:00:00Z", "2026-08-05T14:30:00Z").workedMinutes();
        assertEquals(330, morning + evening, "a split day still totals its parts");
    }

    @Test void aMinuteIsStillCounted() {
        assertEquals(1, shift("2026-08-05T10:00:00Z", "2026-08-05T10:01:00Z").workedMinutes());
    }
}
