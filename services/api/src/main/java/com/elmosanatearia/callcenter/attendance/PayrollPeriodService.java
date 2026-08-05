package com.elmosanatearia.callcenter.attendance;

import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.auth.AppPrincipal;
import com.elmosanatearia.callcenter.user.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Wage cycles.
 *
 * <p>The payroll screen answers "what do the last thirty days look like right now", which is a
 * moving window — ask again next week and the answer differs. A period turns that into
 * something that can be settled: close it, and its figures are frozen and the next one opens
 * the day after.
 *
 * <p>Freezing is the whole point. Shifts stay correctable indefinitely, so a closed period
 * that recomputed itself would quietly change what somebody was paid for months ago.
 */
@Service
public class PayrollPeriodService {

    /** A wage cycle, in the working days the target is counted in. */
    private static final int DEFAULT_LENGTH_IN_WORKING_DAYS = 30;

    private final PayrollPeriodRepository periods;
    private final AttendanceService attendance;
    private final UserRepository users;
    private final AuditRepository audits;

    public PayrollPeriodService(PayrollPeriodRepository periods, AttendanceService attendance,
                                UserRepository users, AuditRepository audits) {
        this.periods = periods;
        this.attendance = attendance;
        this.users = users;
        this.audits = audits;
    }

    // ---------------------------------------------------------------- views

    /**
     * @param open       true while the period is still accumulating
     * @param totalMinutes across everyone — live for the open period, frozen for a closed one
     */
    public record PeriodView(Long id, LocalDate startsOn, LocalDate endsOn, boolean open,
                             Instant closedAt, String closedByName, String note,
                             int expectedDays, int people, long totalMinutes, long totalTargetMinutes) {}

    public record LineView(Long userId, String displayName, long workedMinutes, long targetMinutes,
                           long balanceMinutes, int daysPresent, int expectedDays, int shifts,
                           long reports, long contacted, long ok) {
        static LineView of(PayrollPeriodLine l) {
            return new LineView(l.getUser().getId(), l.getDisplayName(), l.getWorkedMinutes(),
                    l.getTargetMinutes(), l.balanceMinutes(), l.getDaysPresent(),
                    l.getExpectedDays(), l.getShifts(), l.getReports(), l.getContacted(), l.getOkCount());
        }
    }

    /**
     * The period currently accumulating, created on first use.
     *
     * <p>Lazily rather than on a schedule: a cron job that opened periods would keep minting
     * them in an installation nobody is using, and the first person to look is exactly when
     * the first period should begin.
     */
    @Transactional
    public PayrollPeriod current() {
        return periods.findByClosedAtIsNull().orElseGet(() -> {
            LocalDate today = LocalDate.now(AttendanceService.ZONE);
            LocalDate start = AttendanceService.startOfLastWorkingDays(today, DEFAULT_LENGTH_IN_WORKING_DAYS);
            return periods.save(new PayrollPeriod(start, today));
        });
    }

    @Transactional
    public List<PeriodView> list() {
        current();  // make sure there is always something to show
        return periods.newestFirst().stream().map(this::view).toList();
    }

    /** A closed period reads from its frozen lines; the open one is computed live. */
    @Transactional(readOnly = true)
    public List<LineView> lines(Long periodId) {
        PayrollPeriod p = periods.withLines(periodId)
                .orElseThrow(() -> new IllegalArgumentException("دوره یافت نشد"));
        if (p.isOpen()) {
            return attendance.report(p.getStartsOn(), effectiveEnd(p)).stream()
                    .map(s -> new LineView(s.userId(), s.displayName(), s.workedMinutes(),
                            s.targetMinutes(), s.workedMinutes() - s.targetMinutes(),
                            s.daysPresent(), s.expectedDays(), s.shifts(),
                            s.reports(), s.contacted(), s.ok()))
                    .toList();
        }
        return p.getLines().stream()
                .sorted(java.util.Comparator.comparing(PayrollPeriodLine::getDisplayName))
                .map(LineView::of).toList();
    }

    // ------------------------------------------------------------- closing

    /**
     * Settle the open period and open the next.
     *
     * @param endsOn last day the period covers; defaults to today. Cannot be in the future —
     *               there are no hours to settle for days that have not happened.
     */
    @Transactional
    public PeriodView close(LocalDate endsOn, String note, AppPrincipal actor) {
        PayrollPeriod open = current();
        LocalDate today = LocalDate.now(AttendanceService.ZONE);
        LocalDate end = endsOn != null ? endsOn : today;

        if (end.isAfter(today)) throw new IllegalArgumentException("پایان دوره نمی‌تواند در آینده باشد");
        if (end.isBefore(open.getStartsOn()))
            throw new IllegalArgumentException("پایان دوره نمی‌تواند قبل از شروع آن باشد");
        attendance.assertNoOpenShifts(open.getStartsOn(), end);

        open.setEndsOn(end);
        open.setNote(note == null || note.isBlank() ? null : note.trim());
        for (var s : attendance.report(open.getStartsOn(), end)) {
            users.findById(s.userId()).ifPresent(u ->
                    open.getLines().add(new PayrollPeriodLine(open, u, s)));
        }
        AppUser closer = users.findById(actor.id()).orElseThrow();
        open.setClosedBy(closer);
        open.setClosedAt(Instant.now());
        // Flushed before the next period is inserted. Hibernate orders inserts ahead of updates
        // within a flush, so without this the new row lands while the old one is still open and
        // idx_payroll_one_open_period rejects it.
        periods.saveAndFlush(open);

        audits.save(new AuditEvent(closer, "PAYROLL_CLOSE_PERIOD", "PayrollPeriod",
                String.valueOf(open.getId()), open.getStartsOn() + " تا " + end));

        // The next cycle begins the day after, so no day belongs to two periods or to none.
        LocalDate nextStart = end.plusDays(1);
        periods.save(new PayrollPeriod(nextStart,
                nextStart.isAfter(today) ? nextStart : today));
        return view(open);
    }

    /** Reopening is deliberately absent — a settled period is a record, not a draft. */

    // -------------------------------------------------------------- helper

    /** An open period runs to today, even if its nominal end has slipped past. */
    private LocalDate effectiveEnd(PayrollPeriod p) {
        LocalDate today = LocalDate.now(AttendanceService.ZONE);
        return p.isOpen() && p.getEndsOn().isBefore(today) ? today : p.getEndsOn();
    }

    private PeriodView view(PayrollPeriod p) {
        LocalDate end = effectiveEnd(p);
        long worked, target;
        int people;
        if (p.isOpen()) {
            var live = attendance.report(p.getStartsOn(), end);
            people = live.size();
            worked = live.stream().mapToLong(AttendanceService.StaffSummary::workedMinutes).sum();
            target = live.stream().mapToLong(AttendanceService.StaffSummary::targetMinutes).sum();
        } else {
            people = p.getLines().size();
            worked = p.getLines().stream().mapToLong(PayrollPeriodLine::getWorkedMinutes).sum();
            target = p.getLines().stream().mapToLong(PayrollPeriodLine::getTargetMinutes).sum();
        }
        return new PeriodView(p.getId(), p.getStartsOn(), end, p.isOpen(), p.getClosedAt(),
                p.getClosedBy() == null ? null : p.getClosedBy().getDisplayName(), p.getNote(),
                AttendanceService.workingDaysBetween(p.getStartsOn(), end),
                people, worked, target);
    }
}
