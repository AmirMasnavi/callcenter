package com.elmosanatearia.callcenter.payroll;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/**
 * A cycle is thirty days somebody turned up, not thirty days on a calendar. These pin down
 * what that means for comparison and for settling.
 */
class PeriodMathTest {

    private static final int FIVE_HOURS = 300;

    private static List<LocalDate> days(String... iso) {
        return java.util.Arrays.stream(iso).map(LocalDate::parse).toList();
    }

    // --- the comparison window ---

    @Test void firstDaysTakesTheEarliestNotTheLatest() {
        // Someone well into a cycle must still be judged on the same stretch as a newcomer.
        var attended = days("2026-06-01", "2026-06-02", "2026-06-08", "2026-07-20", "2026-08-01");
        assertEquals(days("2026-06-01", "2026-06-02", "2026-06-08"),
                PeriodMath.firstDays(attended, 3));
    }

    @Test void firstDaysIgnoresTheOrderTheyArriveIn() {
        var jumbled = days("2026-08-01", "2026-06-02", "2026-07-20", "2026-06-01");
        assertEquals(days("2026-06-01", "2026-06-02"), PeriodMath.firstDays(jumbled, 2));
    }

    @Test void firstDaysCountsADayOnceHoweverManyShifts() {
        var withDuplicates = days("2026-06-01", "2026-06-01", "2026-06-02");
        assertEquals(2, PeriodMath.firstDays(withDuplicates, 5).size(),
                "two shifts in a day are still one day toward the cycle");
    }

    @Test void askingForMoreDaysThanWorkedGivesWhatThereIs() {
        assertEquals(2, PeriodMath.firstDays(days("2026-06-01", "2026-06-02"), 10).size());
    }

    @Test void aCycleSpanningMonthsIsStillJustItsDays() {
        // Four months apart, but only three attendance days — the calendar span is irrelevant.
        var sparse = days("2026-03-04", "2026-05-19", "2026-07-28");
        assertEquals(sparse, PeriodMath.firstDays(sparse, 10));
    }

    // --- settling ---

    @Test void targetIsDaysTimesTheDailyRate() {
        assertEquals(30 * 300, PeriodMath.targetMinutes(30, FIVE_HOURS, 0));
    }

    @Test void aCarriedDeficitRaisesTheNextTarget() {
        // 10 hours carried over means 10 hours more to work before this cycle is met.
        assertEquals(30 * 300 + 600, PeriodMath.targetMinutes(30, FIVE_HOURS, 600));
    }

    @Test void balanceIsNegativeWhenShort() {
        long worked = 30 * 300 - 600;            // ten hours short over thirty days
        assertEquals(-600, PeriodMath.balanceMinutes(worked, 30, FIVE_HOURS, 0));
    }

    @Test void tenHoursShortIsTwoDaysToMakeUp() {
        assertEquals(2, PeriodMath.daysToMakeUp(-600, FIVE_HOURS));
    }

    @Test void aPartialDayShortStillMeansComingBack() {
        assertEquals(1, PeriodMath.daysToMakeUp(-30, FIVE_HOURS), "half an hour short is still a day");
    }

    @Test void beingAheadOwesNothing() {
        assertEquals(0, PeriodMath.daysToMakeUp(120, FIVE_HOURS));
    }

    // --- readiness ---

    @Test void readyOnlyOnceTheDayCountIsReached() {
        assertFalse(PeriodMath.readyToSettle(29, 30));
        assertTrue(PeriodMath.readyToSettle(30, 30));
    }

    @Test void stayingReadyPastTheTargetMattersForTheExtendCase() {
        // Held open to work off a deficit, so the day count runs past the target.
        assertTrue(PeriodMath.readyToSettle(33, 30));
    }

    @Test void aShorterArrangementIsHonoured() {
        assertTrue(PeriodMath.readyToSettle(10, 10), "not everyone is on a thirty-day cycle");
    }
}
