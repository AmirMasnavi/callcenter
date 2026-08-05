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
    private static final int DEFAULT_MONTHLY_HOURS = 150;

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
        if (moment.isAfter(Instant.now().plus(Duration.ofMinutes(5))))
            throw new IllegalArgumentException("زمان ورود نمی‌تواند در آینده باشد");

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
        if (entryAt == null) throw new IllegalArgumentException("زمان ورود الزامی است");
        if (exitAt == null) throw new IllegalArgumentException("زمان خروج الزامی است");
        if (!exitAt.isAfter(entryAt)) throw new IllegalArgumentException("زمان خروج باید بعد از زمان ورود باشد");
        if (entryAt.isAfter(Instant.now())) throw new IllegalArgumentException("زمان ورود نمی‌تواند در آینده باشد");
        if (Duration.between(entryAt, exitAt).toHours() > 24)
            throw new IllegalArgumentException("مدت یک شیفت نمی‌تواند بیش از ۲۴ ساعت باشد");

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
        if (!moment.isAfter(entry.getEntryAt()))
            throw new IllegalArgumentException("زمان خروج باید بعد از زمان ورود باشد");

        entry.setExitAt(moment);
        AppUser recorder = users.findById(actor.id()).orElseThrow();
        audits.save(new AuditEvent(recorder, "ATTENDANCE_OUT", "AppUser",
                String.valueOf(entry.getUser().getId()), entry.workedMinutes() + " دقیقه"));
        return EntryView.of(attendance.save(entry));
    }

    /** Corrections. The paper form gets amended too; the audit log keeps the history. */
    @Transactional
    public EntryView adjust(Long entryId, Instant entryAt, Instant exitAt, String note, AppPrincipal actor) {
        AttendanceEntry entry = attendance.findById(entryId)
                .orElseThrow(() -> new IllegalArgumentException("رکورد یافت نشد"));
        if (entryAt != null) entry.setEntryAt(entryAt);
        entry.setExitAt(exitAt);
        if (exitAt != null && !exitAt.isAfter(entry.getEntryAt()))
            throw new IllegalArgumentException("زمان خروج باید بعد از زمان ورود باشد");
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
     * @param workedMinutes total across the range, from real clock times — NOT days × hours
     * @param targetHours   the person's monthly target, or the system default
     * @param daysPresent   distinct days with at least one shift
     */
    public record StaffSummary(Long userId, String displayName, String username,
                               long workedMinutes, int daysPresent, int shifts,
                               int targetHours, double targetPercent,
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

        int defaultTarget = settings.getInt("attendance.default-monthly-hours", DEFAULT_MONTHLY_HOURS);

        return users.findActiveByRole(Role.AGENT).stream().map(u -> {
            List<AttendanceEntry> mine = shifts.getOrDefault(u.getId(), List.of());
            long minutes = mine.stream().mapToLong(AttendanceEntry::workedMinutes).sum();
            int days = (int) mine.stream()
                    .map(e -> LocalDate.ofInstant(e.getEntryAt(), ZONE)).distinct().count();

            List<DailyReport> rs = work.getOrDefault(u.getId(), List.of());
            long contacted = rs.stream().mapToLong(DailyReport::getContactedCount).sum();
            long ok = rs.stream().mapToLong(DailyReport::getOkCount).sum();
            long attendees = rs.stream().filter(r -> r.getAttendeeCount() != null)
                    .mapToLong(DailyReport::getAttendeeCount).sum();

            int target = u.getMonthlyHoursTarget() != null ? u.getMonthlyHoursTarget() : defaultTarget;
            return new StaffSummary(u.getId(), u.getDisplayName(), u.getUsername(),
                    minutes, days, mine.size(), target,
                    target == 0 ? 0 : minutes * 100d / (target * 60d),
                    rs.size(), contacted, ok, attendees,
                    contacted == 0 ? 0 : ok * 100d / contacted);
        }).sorted(Comparator.comparing(StaffSummary::displayName)).toList();
    }

    /** One person, day by day — the on-screen equivalent of their paper sheet. */
    @Transactional(readOnly = true)
    public StaffDetail detail(Long userId, LocalDate from, LocalDate to) {
        List<EntryView> entries = entriesFor(userId, from, to);
        Map<LocalDate, List<EntryView>> byDay = new TreeMap<>(Comparator.reverseOrder());
        entries.forEach(e -> byDay.computeIfAbsent(LocalDate.ofInstant(e.entryAt(), ZONE),
                k -> new ArrayList<>()).add(e));
        List<DayRow> days = byDay.entrySet().stream()
                .map(e -> new DayRow(e.getKey(),
                        e.getValue().stream().mapToLong(EntryView::workedMinutes).sum(), e.getValue()))
                .toList();
        StaffSummary summary = report(from, to).stream()
                .filter(s -> s.userId().equals(userId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("کاربر یافت نشد"));
        return new StaffDetail(summary, days);
    }
}
