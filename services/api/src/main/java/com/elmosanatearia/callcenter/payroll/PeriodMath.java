package com.elmosanatearia.callcenter.payroll;

import java.time.LocalDate;
import java.util.*;

/**
 * The arithmetic a work cycle is made of, kept free of Spring and the database so it can be
 * tested directly.
 *
 * <p>Everything here works on <em>attendance days</em> — the distinct dates a person actually
 * turned up. Calendar spans are irrelevant: what ends a cycle is the count reaching its
 * target, whether that takes one month or four.
 */
public final class PeriodMath {
    private PeriodMath() {}

    /**
     * The first {@code n} days someone attended.
     *
     * <p>This is what makes people comparable. Asking for "the last ten days" compares whoever
     * happened to be in this fortnight; asking for each person's <em>first</em> ten days of
     * their own cycle compares like with like, however far apart those days fell. Someone
     * twenty-five days into a cycle is judged on the same stretch as someone on day ten.
     *
     * @return the dates in order, or all of them when fewer than {@code n} have been worked
     */
    public static List<LocalDate> firstDays(Collection<LocalDate> attendanceDays, int n) {
        return attendanceDays.stream().distinct().sorted().limit(Math.max(0, n)).toList();
    }

    /**
     * Hours owed against hours expected.
     *
     * @param targetDays          days the cycle is worth
     * @param dailyTargetMinutes  expected minutes per attended day
     * @param carriedOverMinutes  deficit inherited from the previous cycle, worked off here
     * @return positive when ahead, negative when short
     */
    public static long balanceMinutes(long workedMinutes, int targetDays,
                                      int dailyTargetMinutes, long carriedOverMinutes) {
        return workedMinutes - targetMinutes(targetDays, dailyTargetMinutes, carriedOverMinutes);
    }

    public static long targetMinutes(int targetDays, int dailyTargetMinutes, long carriedOverMinutes) {
        return (long) targetDays * dailyTargetMinutes + carriedOverMinutes;
    }

    /**
     * A shortfall expressed in days, which is how it gets discussed: "you are ten hours short,
     * so come back for about two more days".
     *
     * <p>Rounds up, because a partial day short still means turning up again.
     */
    public static int daysToMakeUp(long balanceMinutes, int dailyTargetMinutes) {
        if (balanceMinutes >= 0 || dailyTargetMinutes <= 0) return 0;
        return (int) Math.ceil(-balanceMinutes / (double) dailyTargetMinutes);
    }

    /** A cycle is ready to settle once the day count is reached; the manager still confirms. */
    public static boolean readyToSettle(int daysAttended, int targetDays) {
        return daysAttended >= targetDays;
    }
}
