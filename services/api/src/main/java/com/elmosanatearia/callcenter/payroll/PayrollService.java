package com.elmosanatearia.callcenter.payroll;

import com.elmosanatearia.callcenter.attendance.*;
import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.auth.AppPrincipal;
import com.elmosanatearia.callcenter.report.*;
import com.elmosanatearia.callcenter.settings.SettingsService;
import com.elmosanatearia.callcenter.user.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * Work cycles and the comparison between people.
 *
 * <p>The flow this serves: the front desk records arrivals; a cycle ends when someone reaches
 * their day count; the hours are checked so a full attendance record with missing hours is
 * caught; and people are compared against each other over the same stretch of their own
 * cycles.
 */
@Service
public class PayrollService {

    private static final int DEFAULT_PERIOD_DAYS = 30;
    private static final int DEFAULT_DAILY_MINUTES = 300;

    private final WorkPeriodRepository periods;
    private final AttendanceRepository attendance;
    private final DailyReportRepository reports;
    private final UserRepository users;
    private final AuditRepository audits;
    private final SettingsService settings;

    public PayrollService(WorkPeriodRepository periods, AttendanceRepository attendance,
                          DailyReportRepository reports, UserRepository users,
                          AuditRepository audits, SettingsService settings) {
        this.periods = periods; this.attendance = attendance; this.reports = reports;
        this.users = users; this.audits = audits; this.settings = settings;
    }

    // ----------------------------------------------------------------- views

    /**
     * Where one person stands in their current cycle.
     *
     * @param daysAttended  distinct days turned up so far — the thing the cycle is counted in
     * @param balanceMinutes hours ahead (positive) or short (negative) of the cycle's target
     * @param daysToMakeUp  the shortfall said in days, which is how it gets discussed
     * @param readyToSettle the day count is met; a person still has to confirm the payment
     */
    public record PeriodStatus(
            Long periodId, Long userId, String displayName, String username, boolean hasAvatar,
            int seq, LocalDate startedOn, LocalDate endedOn, boolean open,
            int daysAttended, int targetDays, int shifts,
            long workedMinutes, long targetMinutes, long balanceMinutes,
            long carriedOverMinutes, int dailyTargetMinutes, int daysToMakeUp, boolean readyToSettle,
            long reports, long contacted, long ok, long attendees, double successRate,
            String settlement, String note, String closedByName, Instant closedAt) {}

    /** One person's figures over a chosen slice of days — the unit of comparison. */
    public record Slice(Long userId, String displayName, int days, int shifts,
                        long workedMinutes, long targetMinutes, long balanceMinutes,
                        long reports, long contacted, long ok, long attendees,
                        double successRate, double okPerDay, double hoursPerDay,
                        LocalDate firstDay, LocalDate lastDay) {}

    private int defaultPeriodDays() {
        return settings.getInt("payroll.default-period-days", DEFAULT_PERIOD_DAYS);
    }

    private int dailyMinutesFor(AppUser u) {
        return u.getDailyTargetMinutes() != null ? u.getDailyTargetMinutes()
                : settings.getInt("attendance.daily-target-minutes", DEFAULT_DAILY_MINUTES);
    }

    /**
     * The cycle a person is currently in, started on first use.
     *
     * <p>Lazily rather than on a schedule: an operator who has never worked does not need a
     * cycle, and the first time anyone looks is exactly when the first one should begin.
     */
    @Transactional
    public WorkPeriod currentFor(AppUser user) {
        return periods.findByUserIdAndClosedAtIsNull(user.getId()).orElseGet(() -> {
            // Start from their first ever attendance day if they have one, so an operator who
            // was already working when this feature arrived is not credited from today.
            LocalDate start = attendance.forUserBetween(user.getId(),
                            LocalDate.of(2000, 1, 1).atStartOfDay(AttendanceService.ZONE).toInstant(),
                            Instant.now())
                    .stream().map(e -> LocalDate.ofInstant(e.getEntryAt(), AttendanceService.ZONE))
                    .min(LocalDate::compareTo)
                    .orElse(LocalDate.now(AttendanceService.ZONE));
            return periods.save(new WorkPeriod(user, periods.lastSeq(user.getId()) + 1,
                    start, defaultPeriodDays(), 0));
        });
    }

    // ------------------------------------------------------- computing a cycle

    /** Attendance days (Tehran dates) inside a period's range, with their minutes and shifts. */
    private record DayFacts(Map<LocalDate, Long> minutesByDay, Map<LocalDate, Integer> shiftsByDay) {}

    private DayFacts attendanceIn(Long userId, LocalDate from, LocalDate to) {
        Instant start = from.atStartOfDay(AttendanceService.ZONE).toInstant();
        Instant end = (to == null ? LocalDate.now(AttendanceService.ZONE) : to)
                .plusDays(1).atStartOfDay(AttendanceService.ZONE).toInstant();
        Map<LocalDate, Long> minutes = new TreeMap<>();
        Map<LocalDate, Integer> shifts = new TreeMap<>();
        for (AttendanceEntry e : attendance.forUserBetween(userId, start, end)) {
            LocalDate d = LocalDate.ofInstant(e.getEntryAt(), AttendanceService.ZONE);
            minutes.merge(d, e.workedMinutes(), Long::sum);
            shifts.merge(d, 1, Integer::sum);
        }
        return new DayFacts(minutes, shifts);
    }

    /** Report figures for a specific set of dates — used so a slice's calls match its days. */
    private record CallFacts(long reports, long contacted, long ok, long attendees) {
        static final CallFacts NONE = new CallFacts(0, 0, 0, 0);
        CallFacts plus(CallFacts o) {
            return new CallFacts(reports + o.reports, contacted + o.contacted,
                    ok + o.ok, attendees + o.attendees);
        }
    }

    private static final List<ReportStatus> COUNTED =
            List.of(ReportStatus.SUBMITTED, ReportStatus.APPROVED, ReportStatus.CORRECTED_APPROVED);

    /**
     * Per-agent, per-day call totals for a whole group in one query.
     *
     * <p>Asking per person meant loading every report in the range for everybody and filtering
     * in Java, once for each person — work growing with headcount times report volume. The
     * database groups it instead, and the per-day shape is what picking a person's first N
     * days needs anyway.
     */
    private Map<Long, Map<LocalDate, CallFacts>> callsByAgentDay(
            Collection<Long> agentIds, LocalDate from, LocalDate to) {
        if (agentIds.isEmpty() || from == null || to == null) return Map.of();
        Map<Long, Map<LocalDate, CallFacts>> out = new HashMap<>();
        for (Object[] row : reports.dailyTotalsByAgent(agentIds, from, to, COUNTED)) {
            out.computeIfAbsent((Long) row[0], k -> new HashMap<>())
               .put((LocalDate) row[1], new CallFacts(
                       ((Number) row[2]).longValue(), ((Number) row[3]).longValue(),
                       ((Number) row[4]).longValue(), ((Number) row[5]).longValue()));
        }
        return out;
    }

    /** Sums the pre-grouped day totals over exactly the days a slice covers. */
    private static CallFacts sumOver(Map<LocalDate, CallFacts> byDay, Collection<LocalDate> dates) {
        if (byDay == null) return CallFacts.NONE;
        CallFacts total = CallFacts.NONE;
        for (LocalDate d : dates) total = total.plus(byDay.getOrDefault(d, CallFacts.NONE));
        return total;
    }

    /** Live status of an open cycle, or the frozen record of a settled one. */
    @Transactional
    public PeriodStatus status(WorkPeriod p) {
        AppUser u = p.getUser();
        int daily = dailyMinutesFor(u);

        if (!p.isOpen()) {
            long worked = orZero(p.getFinalWorkedMinutes()), target = orZero(p.getFinalTargetMinutes());
            long contacted = orZero(p.getFinalContacted()), ok = orZero(p.getFinalOk());
            return new PeriodStatus(p.getId(), u.getId(), u.getDisplayName(), u.getUsername(),
                    u.getAvatarBytes() != null, p.getSeq(), p.getStartedOn(), p.getEndedOn(), false,
                    p.getFinalDays() == null ? 0 : p.getFinalDays(), p.getTargetDays(),
                    p.getFinalShifts() == null ? 0 : p.getFinalShifts(),
                    worked, target, worked - target, p.getCarriedOverMinutes(), daily,
                    PeriodMath.daysToMakeUp(worked - target, daily), false,
                    orZero(p.getFinalReports()), contacted, ok, orZero(p.getFinalAttendees()),
                    contacted == 0 ? 0 : ok * 100d / contacted,
                    p.getSettlement() == null ? null : p.getSettlement().name(), p.getNote(),
                    p.getClosedBy() == null ? null : p.getClosedBy().getDisplayName(), p.getClosedAt());
        }

        DayFacts facts = attendanceIn(u.getId(), p.getStartedOn(), p.getEndedOn());
        int days = facts.minutesByDay().size();
        long worked = facts.minutesByDay().values().stream().mapToLong(Long::longValue).sum();
        int shifts = facts.shiftsByDay().values().stream().mapToInt(Integer::intValue).sum();
        long target = PeriodMath.targetMinutes(p.getTargetDays(), daily, p.getCarriedOverMinutes());
        long balance = worked - target;
        CallFacts calls = facts.minutesByDay().isEmpty() ? CallFacts.NONE
                : sumOver(callsByAgentDay(List.of(u.getId()),
                              Collections.min(facts.minutesByDay().keySet()),
                              Collections.max(facts.minutesByDay().keySet())).get(u.getId()),
                          facts.minutesByDay().keySet());

        return new PeriodStatus(p.getId(), u.getId(), u.getDisplayName(), u.getUsername(),
                u.getAvatarBytes() != null, p.getSeq(), p.getStartedOn(), null, true,
                days, p.getTargetDays(), shifts, worked, target, balance,
                p.getCarriedOverMinutes(), daily, PeriodMath.daysToMakeUp(balance, daily),
                PeriodMath.readyToSettle(days, p.getTargetDays()),
                calls.reports(), calls.contacted(), calls.ok(), calls.attendees(),
                calls.contacted() == 0 ? 0 : calls.ok() * 100d / calls.contacted(),
                null, p.getNote(), null, null);
    }

    private static long orZero(Long v) { return v == null ? 0 : v; }

    /**
     * Every operator's current cycle — the payroll manager's board.
     *
     * <p>Includes anyone with an OPEN cycle even if their account has been deactivated. Someone
     * who leaves partway through is still owed the days they worked, and dropping them from
     * the board would make that money unreachable — the cycle has to stay visible until it is
     * settled.
     */
    @Transactional
    public List<PeriodStatus> board() {
        Map<Long, AppUser> people = new LinkedHashMap<>();
        users.findActiveByRole(Role.AGENT).forEach(u -> people.put(u.getId(), u));
        periods.allOpen().forEach(p -> people.putIfAbsent(p.getUser().getId(), p.getUser()));

        return people.values().stream()
                .map(u -> status(currentFor(u)))
                // Whoever is closest to being owed money first; that is the actionable end.
                .sorted(Comparator.comparingDouble(
                        (PeriodStatus s) -> s.targetDays() == 0 ? 0 : -s.daysAttended() / (double) s.targetDays()))
                .toList();
    }

    @Transactional
    public List<PeriodStatus> historyFor(Long userId) {
        AppUser u = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("کاربر یافت نشد"));
        currentFor(u);   // make sure there is always something to show
        return periods.historyFor(userId).stream().map(this::status).toList();
    }

    // ------------------------------------------------------------ comparison

    /**
     * Everyone's first {@code days} attendance days, so they can be laid side by side.
     *
     * <p>The point of slicing by each person's OWN first days rather than by a shared date
     * range: someone twenty-five days into a cycle and someone on day eight are then measured
     * over the same stretch of work, which is the only way the comparison means anything.
     *
     * @param days      how many of each person's days to include; 0 means the whole cycle
     * @param periodSeq null for the current cycle, otherwise that numbered cycle
     */
    @Transactional
    public List<Slice> compare(int days, Integer periodSeq, Collection<Long> userIds) {
        List<AppUser> people = users.findActiveByRole(Role.AGENT).stream()
                .filter(u -> userIds == null || userIds.isEmpty() || userIds.contains(u.getId()))
                .toList();

        // Everyone's periods and attendance first, so the call totals can be fetched in one
        // query for the whole group rather than one per person.
        record Prepared(AppUser user, DayFacts facts, List<LocalDate> window) {}
        List<Prepared> prepared = new ArrayList<>();
        for (AppUser u : people) {
            WorkPeriod p = periodSeq == null ? currentFor(u)
                    : periods.historyFor(u.getId()).stream()
                        .filter(x -> x.getSeq() == periodSeq).findFirst().orElse(null);
            if (p == null) continue;
            DayFacts facts = attendanceIn(u.getId(), p.getStartedOn(), p.getEndedOn());
            List<LocalDate> window = days > 0
                    ? PeriodMath.firstDays(facts.minutesByDay().keySet(), days)
                    : List.copyOf(facts.minutesByDay().keySet());
            prepared.add(new Prepared(u, facts, window));
        }

        List<LocalDate> everyDay = prepared.stream().flatMap(x -> x.window().stream()).toList();
        Map<Long, Map<LocalDate, CallFacts>> callsByAgent = everyDay.isEmpty() ? Map.of()
                : callsByAgentDay(prepared.stream().map(x -> x.user().getId()).toList(),
                                  Collections.min(everyDay), Collections.max(everyDay));

        List<Slice> out = new ArrayList<>();
        for (Prepared prep : prepared) {
            AppUser u = prep.user();
            DayFacts facts = prep.facts();
            List<LocalDate> window = prep.window();
            if (window.isEmpty()) {
                out.add(new Slice(u.getId(), u.getDisplayName(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null));
                continue;
            }

            long worked = window.stream().mapToLong(d -> facts.minutesByDay().getOrDefault(d, 0L)).sum();
            int shifts = window.stream().mapToInt(d -> facts.shiftsByDay().getOrDefault(d, 0)).sum();
            int daily = dailyMinutesFor(u);
            long target = (long) window.size() * daily;
            CallFacts calls = sumOver(callsByAgent.get(u.getId()), window);

            out.add(new Slice(u.getId(), u.getDisplayName(), window.size(), shifts,
                    worked, target, worked - target,
                    calls.reports(), calls.contacted(), calls.ok(), calls.attendees(),
                    calls.contacted() == 0 ? 0 : calls.ok() * 100d / calls.contacted(),
                    Math.round(calls.ok() / (double) window.size() * 10) / 10d,
                    Math.round(worked / 60d / window.size() * 10) / 10d,
                    window.get(0), window.get(window.size() - 1)));
        }
        return out.stream().sorted(Comparator.comparing(Slice::displayName)).toList();
    }

    // -------------------------------------------------------------- settling

    /**
     * Settle a cycle and open the next.
     *
     * @param settlement how the hours shortfall is handled — the manager's call, because the
     *                   right answer is a judgement about the person, not arithmetic
     */
    @Transactional
    public PeriodStatus close(Long userId, WorkPeriod.Settlement settlement, String note, AppPrincipal actor) {
        AppUser u = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("کاربر یافت نشد"));
        WorkPeriod p = currentFor(u);
        LocalDate today = LocalDate.now(AttendanceService.ZONE);

        attendance.findByUserIdAndExitAtIsNull(userId).ifPresent(open -> {
            throw new IllegalStateException("این نفر هنوز خروج نزده است؛ ابتدا خروج را ثبت کنید");
        });

        PeriodStatus live = status(p);
        p.setEndedOn(today);
        p.setSettlement(settlement);
        p.setNote(note == null || note.isBlank() ? null : note.trim());
        p.freeze(live.workedMinutes(), live.targetMinutes(), live.daysAttended(), live.shifts(),
                live.reports(), live.contacted(), live.ok(), live.attendees());

        AppUser closer = users.findById(actor.id()).orElseThrow();
        p.setClosedBy(closer);
        p.setClosedAt(Instant.now());
        // Flushed before the next cycle is inserted: Hibernate orders inserts ahead of updates
        // within a flush, so the new row would otherwise land while this one is still open and
        // idx_work_period_one_open rejects it.
        periods.saveAndFlush(p);

        // Only CARRY_OVER hands the deficit on. EXTEND means they already worked it off by
        // staying longer, and FORGIVE writes it off deliberately.
        long carry = settlement == WorkPeriod.Settlement.CARRY_OVER && live.balanceMinutes() < 0
                ? -live.balanceMinutes() : 0;
        periods.save(new WorkPeriod(u, p.getSeq() + 1, today.plusDays(1), defaultPeriodDays(), carry));

        audits.save(new AuditEvent(closer, "PAYROLL_CLOSE_PERIOD", "WorkPeriod",
                String.valueOf(p.getId()),
                u.getDisplayName() + " — دوره " + p.getSeq() + "، " + settlement));
        return status(p);
    }

    /** The day count for one person's current cycle — arrangements differ person to person. */
    @Transactional
    public PeriodStatus setTargetDays(Long userId, int targetDays, AppPrincipal actor) {
        if (targetDays < 1 || targetDays > 365)
            throw new IllegalArgumentException("تعداد روز دوره باید بین ۱ تا ۳۶۵ باشد");
        AppUser u = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("کاربر یافت نشد"));
        WorkPeriod p = currentFor(u);
        p.setTargetDays(targetDays);
        periods.save(p);
        audits.save(new AuditEvent(users.findById(actor.id()).orElseThrow(),
                "PAYROLL_SET_PERIOD_DAYS", "WorkPeriod", String.valueOf(p.getId()),
                u.getDisplayName() + " → " + targetDays + " روز"));
        return status(p);
    }

    /** The expected hours per attended day for one person. */
    @Transactional
    public PeriodStatus setDailyMinutes(Long userId, Integer minutes, AppPrincipal actor) {
        if (minutes != null && (minutes < 30 || minutes > 16 * 60))
            throw new IllegalArgumentException("ساعت روزانه معتبر نیست");
        AppUser u = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("کاربر یافت نشد"));
        u.setDailyTargetMinutes(minutes);
        users.save(u);
        audits.save(new AuditEvent(users.findById(actor.id()).orElseThrow(),
                "PAYROLL_SET_DAILY_TARGET", "AppUser", String.valueOf(userId),
                u.getDisplayName() + " → " + (minutes == null ? "پیش‌فرض" : minutes + " دقیقه")));
        return status(currentFor(u));
    }
}
