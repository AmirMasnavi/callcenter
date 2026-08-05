package com.elmosanatearia.callcenter.attendance;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.*;

/**
 * The denominator behind every target.
 *
 * <p>"۱۰ روز" means ten days someone was expected in, not ten squares on a calendar. Counting
 * Fridays into the window would quietly lower the target and make a short month look met.
 */
class WorkingDaysTest {

    // 2026-08-06 is a Thursday; 2026-08-07 is the Friday after it.
    private static final LocalDate THU = LocalDate.of(2026, 8, 6);
    private static final LocalDate FRI = LocalDate.of(2026, 8, 7);

    @Test void fridayIsNotCounted() {
        assertEquals(0, AttendanceService.workingDaysBetween(FRI, FRI));
    }

    @Test void bothEndsAreInclusive() {
        assertEquals(1, AttendanceService.workingDaysBetween(THU, THU), "today to today is one day");
    }

    @Test void aFullWeekHasSixWorkingDays() {
        LocalDate sat = LocalDate.of(2026, 8, 1);   // Saturday
        assertEquals(6, AttendanceService.workingDaysBetween(sat, sat.plusDays(6)));
    }

    @Test void aThirtyDayWindowSpansMoreThanThirtyCalendarDays() {
        LocalDate start = AttendanceService.startOfLastWorkingDays(THU, 30);
        assertEquals(30, AttendanceService.workingDaysBetween(start, THU));
        assertTrue(java.time.temporal.ChronoUnit.DAYS.between(start, THU) > 30,
                "the Fridays inside have to be skipped over, so the calendar span is longer");
    }

    @Test void tenWorkingDaysBackFromAThursday() {
        LocalDate start = AttendanceService.startOfLastWorkingDays(THU, 10);
        assertEquals(10, AttendanceService.workingDaysBetween(start, THU));
        assertNotEquals(java.time.DayOfWeek.FRIDAY, start.getDayOfWeek(),
                "the window must not open on a day nobody was due in");
    }

    @Test void aWindowEndingOnAFridayStillCountsTheRightNumber() {
        LocalDate start = AttendanceService.startOfLastWorkingDays(FRI, 5);
        assertEquals(5, AttendanceService.workingDaysBetween(start, FRI));
    }

    @Test void oneDayIsTheSmallestWindow() {
        assertEquals(THU, AttendanceService.startOfLastWorkingDays(THU, 1));
    }

    @Test void aNonsenseCountDoesNotLoopForever() {
        assertEquals(THU, AttendanceService.startOfLastWorkingDays(THU, 0));
    }
}
