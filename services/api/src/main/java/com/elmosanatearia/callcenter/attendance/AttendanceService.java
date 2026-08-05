package com.elmosanatearia.callcenter.attendance;

import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.auth.AppPrincipal;
import com.elmosanatearia.callcenter.report.*;
import com.elmosanatearia.callcenter.settings.SettingsService;
import com.elmosanatearia.callcenter.user.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

/**
 * Worked hours, and the performance that sits beside them.
 *
 * <p>All arithmetic is in whole minutes, because payroll totals have to add up exactly;
 * summing fractional hours drifts. Hours are only formatted for display.
 *
 * <p>Days are bounded in Tehran time, not UTC — a shift that ends at 00:30 belongs to the
 * day it started, and using UTC boundaries would file it under the wrong date.
 */
@Service
public class AttendanceService {
    public static final ZoneId ZONE = ZoneId.of("Asia/Tehran");

    /** Five hours a working day — 30 × 5 is the same 150 hours the month was always worth. */
    private static final int DEFAULT_DAILY_TARGET_MINUTES = 300;

    /** Friday is the weekend here; nobody is expected in, so it is not a day they are short. */
    private static final DayOfWeek WEEKEND = DayOfWeek.FRIDAY;

    private final AttendanceRepository attendance;
    private final UserRepository users;
    private final DailyReportRepository reports;
    private final AuditRepository audits;
    private final SettingsService settings;

    public AttendanceService(AttendanceRepository attendance, UserRepository users,
                             DailyReportRepository reports, AuditRepository audits,
                             SettingsService settings) {
        this.attendance = attendance; this.users = users; this.reports = reports;
        this.audits = audits; this.settings = settings;
    }

    // ---------------------------------------------------------------- views

    /** @param openEntryId non-null when the person is currently in the building */
    public record StaffState(Long userId, String displayName, String username, boolean hasAvatar,
                             Long openEntryId, Instant openSince,
                             long todayMinutes, int shiftsToday) {}

    public record EntryView(Long id, Long userId, String displayName, Instant entryAt, Instant exitAt,
                            long workedMinutes, String note, String recordedByName) {
        static EntryView of(AttendanceEntry e) {
            return new EntryView(e.getId(), e.getUser().getId(), e.getUser().getDisplayName(),
                    e.getEntryAt(), e.getExitAt(), e.workedMinutes(), e.getNote(),
                    e.getRecordedBy().getDisplayName());
        }
    }

    /**
     * The front-desk screen: every operator with their current state and today's total,
     * so one glance says who is in and who has already left.
     */
    @Transactional(readOnly = true)
    public List<StaffState> today() {
        LocalDate today = LocalDate.now(ZONE);
        Instant from = today.atStartOfDay(ZONE).toInstant();
        Instant to = today.plusDays(1).atStartOfDay(ZONE).toInstant();

        Map<Long, List<AttendanceEntry>> byUser = new HashMap<>();
        attendance.between(from, to).forEach(e ->
                byUser.computeIfAbsent(e.getUser().getId(), k -> new ArrayList<>()).add(e));

        // Only operators are tracked, per the agreed scope.
        return users.findActiveByRole(Role.AGENT).stream().map(u -> {
            List<AttendanceEntry> mine = byUser.getOrDefault(u.getId(), List.of());
            AttendanceEntry open = mine.stream().filter(AttendanceEntry::isOpen).findFirst()
                    .orElseGet(() -> attendance.findByUserIdAndExitAtIsNull(u.getId()).orElse(null));
            long minutes = mine.stream().mapToLong(AttendanceEntry::workedMinutes).sum();
            return new StaffState(u.getId(), u.getDisplayName(), u.getUsername(), u.getAvatarBytes() != null,
                    open == null ? null : open.getId(),
                    open == null ? null : open.getEntryAt(),
                    minutes, mine.size());
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<EntryView> entriesFor(Long userId, LocalDate from, LocalDate to) {
        return attendance.forUserBetween(userId, from.atStartOfDay(ZONE).toInstant(),
                        to.plusDays(1).atStartOfDay(ZONE).toInstant())
                .stream().map(EntryView::of).toList();
    }

    // ------------------------------------------------------------ recording

    /**
     * @param at the exact moment, which the front desk may nudge a few minutes either way —
     *           the clock rarely matches when someone actually walked in.
     */
    @Transactional
    public EntryView clockIn(Long userId, Instant at, AppPrincipal actor) {
        AppUser user = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("کاربر یافت نشد"));
        if (!user.isActive()) throw new IllegalArgumentException("این کاربر غیرفعال است");
        attendance.findByUserIdAndExitAtIsNull(userId).ifPresent(open -> {
            throw new IllegalStateException("این نفر هنوز خروج نزده است؛ ابتدا خروج را ثبت کنید");
        });
        Instant moment = at == null ? Instant.now() : at;
        validateShift(moment, null);

        AppUser recorder = users.findById(actor.id()).orElseThrow();
        AttendanceEntry saved = attendance.save(new AttendanceEntry(user, moment, recorder));
        audits.save(new AuditEvent(recorder, "ATTENDANCE_IN", "AppUser", String.valueOf(userId), null));
        return EntryView.of(saved);
    }

    /**
     * A whole shift recorded after the fact — someone forgot to check in, or the desk was
     * unattended. Without this the only way to record anything was "now", which meant a
     * missed arrival could never be entered at all.
     *
     * <p>Deliberately does NOT collide with the one-open-shift rule: this always creates a
     * closed shift, so it can be added while the person is currently clocked in.
     */
    @Transactional
    public EntryView recordManual(Long userId, Instant entryAt, Instant exitAt, String note, AppPrincipal actor) {
        AppUser user = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("کاربر یافت نشد"));
        if (exitAt == null) throw new IllegalArgumentException("زمان خروج الزامی است");
        validateShift(entryAt, exitAt);

        AppUser recorder = users.findById(actor.id()).orElseThrow();
        AttendanceEntry entry = new AttendanceEntry(user, entryAt, recorder);
        entry.setExitAt(exitAt);
        entry.setNote(note == null || note.isBlank() ? null : note.trim());
        AttendanceEntry saved = attendance.save(entry);
        audits.save(new AuditEvent(recorder, "ATTENDANCE_MANUAL", "AppUser", String.valueOf(userId),
                saved.workedMinutes() + " دقیقه"));
        return EntryView.of(saved);
    }

    @Transactional
    public EntryView clockOut(Long entryId, Instant at, AppPrincipal actor) {
        AttendanceEntry entry = attendance.findById(entryId)
                .orElseThrow(() -> new IllegalArgumentException("رکورد یافت نشد"));
        if (!entry.isOpen()) throw new IllegalStateException("خروج این رکورد قبلاً ثبت شده است");
        Instant moment = at == null ? Instant.now() : at;
        validateShift(entry.getEntryAt(), moment);

        entry.setExitAt(moment);
        AppUser recorder = users.findById(actor.id()).orElseThrow();
        audits.save(new AuditEvent(recorder, "ATTENDANCE_OUT", "AppUser",
                String.valueOf(entry.getUser().getId()), entry.workedMinutes() + " دقیقه"));
        return EntryView.of(attendance.save(entry));
    }

    private void validateShift(Instant entryAt, Instant exitAt) {
        ShiftRules.validate(entryAt, exitAt, Instant.now());
    }

    /** Corrections. The paper form gets amended too; the audit log keeps the history. */
    @Transactional
    public EntryView adjust(Long entryId, Instant entryAt, Instant exitAt, String note, AppPrincipal actor) {
        AttendanceEntry entry = attendance.findById(entryId)
                .orElseThrow(() -> new IllegalArgumentException("رکورد یافت نشد"));

        Instant newEntry = entryAt != null ? entryAt : entry.getEntryAt();
        // Clearing the exit of a finished shift puts the person back "in the building". That is a
        // legitimate correction only if they have no other shift running, otherwise it breaks the
        // one-open-shift rule and surfaces as a constraint violation rather than a message.
        if (exitAt == null && !entry.isOpen())
            attendance.findByUserIdAndExitAtIsNull(entry.getUser().getId()).ifPresent(open -> {
                throw new IllegalStateException("این نفر شیفت باز دیگری دارد؛ ابتدا آن را ببندید");
            });
        validateShift(newEntry, exitAt);

        entry.setEntryAt(newEntry);
        entry.setExitAt(exitAt);
        entry.setNote(note == null || note.isBlank() ? null : note.trim());
        AppUser recorder = users.findById(actor.id()).orElseThrow();
        audits.save(new AuditEvent(recorder, "ATTENDANCE_ADJUST", "AttendanceEntry", String.valueOf(entryId), null));
        return EntryView.of(attendance.save(entry));
    }

    @Transactional
    public void delete(Long entryId, AppPrincipal actor) {
        AttendanceEntry entry = attendance.findById(entryId)
                .orElseThrow(() -> new IllegalArgumentException("رکورد یافت نشد"));
        AppUser recorder = users.findById(actor.id()).orElseThrow();
        audits.save(new AuditEvent(recorder, "ATTENDANCE_DELETE", "AttendanceEntry", String.valueOf(entryId),
                entry.getUser().getDisplayName()));
        attendance.delete(entry);
    }

    // -------------------------------------------------------------- reports

    /**
     * @param workedMinutes  total across the range, from real clock times — NOT days × hours
     * @param daysPresent    distinct days with at least one shift
     * @param expectedDays   working days the range contains, so a ten-day view is judged
     *                       against ten days rather than a month it could never reach
     * @param targetMinutes  {@code expectedDays × dailyTargetMinutes} — the period's target
     * @param daysShort      expected days with no attendance at all; a separate concern from
     *                       hours, because turning up for eight of ten days and turning up
     *                       late every day are different problems
     */
    public record StaffSummary(Long userId, String displayName, String username,
                               long workedMinutes, int daysPresent, int shifts,
                               int expectedDays, int daysShort,
                               int dailyTargetMinutes, long targetMinutes, double targetPercent,
                               long reports, long contacted, long ok, long attendees,
                               double successRate) {}

    public record DayRow(LocalDate date, long workedMinutes, List<EntryView> shifts) {}
    public record StaffDetail(StaffSummary summary, List<DayRow> days) {}

    /**
     * Hours and call performance together, for a chosen range. The two live side by side
     * because payroll asks "how long were they here AND what did they get done".
     */
    @Transactional(readOnly = true)
    public List<StaffSummary> report(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) throw new IllegalArgumentException("بازه تاریخ معتبر نیست");
        Instant start = from.atStartOfDay(ZONE).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(ZONE).toInstant();

        Map<Long, List<AttendanceEntry>> shifts = new HashMap<>();
        attendance.between(start, end).forEach(e ->
                shifts.computeIfAbsent(e.getUser().getId(), k -> new ArrayList<>()).add(e));

        // Performance over the same window. Voided reports are excluded; archived still count.
        Map<Long, List<DailyReport>> work = new HashMap<>();
        reports.aggregateSource(from, to, List.of(ReportStatus.SUBMITTED, ReportStatus.APPROVED,
                        ReportStatus.CORRECTED_APPROVED))
                .forEach(r -> work.computeIfAbsent(r.getAgent().getId(), k -> new ArrayList<>()).add(r));

        int defaultDaily = settings.getInt("attendance.daily-target-minutes", DEFAULT_DAILY_TARGET_MINUTES);
        int expectedDays = workingDaysBetween(from, to);

        // Active operators, plus anyone who actually worked in the range. Someone who left
        // mid-period is still owed their hours, and payroll has to be able to print them —
        // filtering to active users alone would make those hours unreachable.
        Map<Long, AppUser> people = new LinkedHashMap<>();
        users.findActiveByRole(Role.AGENT).forEach(u -> people.put(u.getId(), u));
        shifts.values().forEach(list -> list.forEach(e -> people.putIfAbsent(e.getUser().getId(), e.getUser())));

        return people.values().stream().map(u -> {
            List<AttendanceEntry> mine = shifts.getOrDefault(u.getId(), List.of());
            long minutes = mine.stream().mapToLong(AttendanceEntry::workedMinutes).sum();
            int days = (int) mine.stream()
                    .map(e -> LocalDate.ofInstant(e.getEntryAt(), ZONE)).distinct().count();

            List<DailyReport> rs = work.getOrDefault(u.getId(), List.of());
            long contacted = rs.stream().mapToLong(DailyReport::getContactedCount).sum();
            long ok = rs.stream().mapToLong(DailyReport::getOkCount).sum();
            long attendees = rs.stream().filter(r -> r.getAttendeeCount() != null)
                    .mapToLong(DailyReport::getAttendeeCount).sum();

            int daily = u.getDailyTargetMinutes() != null ? u.getDailyTargetMinutes() : defaultDaily;
            long target = (long) expectedDays * daily;
            return new StaffSummary(u.getId(), u.getDisplayName(), u.getUsername(),
                    minutes, days, mine.size(),
                    expectedDays, Math.max(0, expectedDays - days),
                    daily, target,
                    target == 0 ? 0 : minutes * 100d / target,
                    rs.size(), contacted, ok, attendees,
                    contacted == 0 ? 0 : ok * 100d / contacted);
        }).sorted(Comparator.comparing(StaffSummary::displayName)).toList();
    }

    /**
     * Refuses to let a range be settled while somebody is still inside it unclocked.
     *
     * <p>An open shift counts as zero minutes, so closing a pay period over one would freeze
     * that person's day at nothing and there would be no way to correct it afterwards. Better
     * to say so before the money is worked out than to discover it on a payslip.
     */
    @Transactional(readOnly = true)
    public void assertNoOpenShifts(LocalDate from, LocalDate to) {
        List<String> stranded = attendance
                .between(from.atStartOfDay(ZONE).toInstant(), to.plusDays(1).atStartOfDay(ZONE).toInstant())
                .stream().filter(AttendanceEntry::isOpen)
                .map(e -> e.getUser().getDisplayName()).distinct().toList();
        if (!stranded.isEmpty())
            throw new IllegalStateException(
                    "ابتدا خروج این افراد را ثبت کنید: " + String.join("، ", stranded));
    }

    /**
     * Working days the range contains — the denominator behind every target.
     *
     * <p>Counting calendar days would make a target nobody can hit and would penalise people
     * for weekends. Both ends are inclusive: a range of "today to today" is one day.
     */
    static int workingDaysBetween(LocalDate from, LocalDate to) {
        int days = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1))
            if (d.getDayOfWeek() != WEEKEND) days++;
        return days;
    }

    /** The date N working days back, so "۳۰ روز" means thirty *expected* days, not a month. */
    public static LocalDate startOfLastWorkingDays(LocalDate endInclusive, int workingDays) {
        if (workingDays < 1) return endInclusive;
        LocalDate d = endInclusive;
        int counted = d.getDayOfWeek() != WEEKEND ? 1 : 0;
        while (counted < workingDays) {
            d = d.minusDays(1);
            if (d.getDayOfWeek() != WEEKEND) counted++;
        }
        return d;
    }

    /** One person, day by day — the on-screen equivalent of their paper sheet. */
    @Transactional(readOnly = true)
    public StaffDetail detail(Long userId, LocalDate from, LocalDate to) {
        StaffSummary summary = report(from, to).stream()
                .filter(s -> s.userId().equals(userId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("کاربر یافت نشد"));
        return new StaffDetail(summary, groupByDay(entriesFor(userId, from, to)));
    }

    /**
     * Everyone's sheet in one call.
     *
     * <p>Printing or exporting used to ask for each person separately, and every one of those
     * recomputed the whole report — quadratic in headcount for data already in hand. This walks
     * the range once and hands back the same shape.
     */
    @Transactional(readOnly = true)
    public List<StaffDetail> details(LocalDate from, LocalDate to) {
        List<StaffSummary> summaries = report(from, to);
        Map<Long, List<EntryView>> byUser = new HashMap<>();
        attendance.between(from.atStartOfDay(ZONE).toInstant(),
                        to.plusDays(1).atStartOfDay(ZONE).toInstant())
                .forEach(e -> byUser.computeIfAbsent(e.getUser().getId(), k -> new ArrayList<>())
                        .add(EntryView.of(e)));

        return summaries.stream()
                .map(s -> new StaffDetail(s, groupByDay(byUser.getOrDefault(s.userId(), List.of()))))
                .toList();
    }

    /** Newest day first — the correction someone is looking for is almost always a recent one. */
    private List<DayRow> groupByDay(List<EntryView> entries) {
        Map<LocalDate, List<EntryView>> byDay = new TreeMap<>(Comparator.reverseOrder());
        entries.forEach(e -> byDay.computeIfAbsent(LocalDate.ofInstant(e.entryAt(), ZONE),
                k -> new ArrayList<>()).add(e));
        return byDay.entrySet().stream()
                .map(e -> {
                    List<EntryView> shifts = new ArrayList<>(e.getValue());
                    shifts.sort(Comparator.comparing(EntryView::entryAt));
                    return new DayRow(e.getKey(),
                            shifts.stream().mapToLong(EntryView::workedMinutes).sum(), shifts);
                })
                .toList();
    }
}
