package com.elmosanatearia.callcenter.config;

import com.elmosanatearia.callcenter.attendance.*;
import com.elmosanatearia.callcenter.report.*;
import com.elmosanatearia.callcenter.user.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import java.time.*;
import java.util.*;

/**
 * Generates a few weeks of believable reports and worked shifts, so the dashboard, charts and
 * payroll view have something to draw. Development aid only.
 *
 * <p>Guarded by the {@code app.mock-data.enabled} property (default false) and, per operator,
 * by a check that they have no data yet. Skipping per operator rather than per table means an
 * operator added later still gets a history, while nobody's real records are ever touched.
 */
@Configuration
@ConditionalOnProperty(name = "app.mock-data.enabled", havingValue = "true")
public class MockDataSeeder {

    private static final String[] SCHOOLS = {
            "دبیرستان فردوسی", "هنرستان رازی", "دبیرستان شهید بهشتی",
            "مجتمع علامه طباطبایی", "دبیرستان نمونه مهر", "هنرستان ابن‌سینا",
    };

    @Bean @Order(100)
    CommandLineRunner seedMockReports(DailyReportRepository reports, UserRepository users) {
        return args -> {
            List<AppUser> reviewers = users.findActiveByRole(Role.SUPERVISOR);
            // Per agent rather than per database: an operator added later still gets a history,
            // and one who already has reports is never touched.
            List<AppUser> agents = users.findActiveByRole(Role.AGENT).stream()
                    .filter(a -> !reports.existsByAgentId(a.getId())).toList();
            if (agents.isEmpty()) return;

            // Fixed seed: the same data every run, so screenshots and numbers are comparable.
            Random random = new Random(20260805L);
            LocalDate today = LocalDate.now(ZoneId.of("Asia/Tehran"));
            List<DailyReport> batch = new ArrayList<>();

            for (int dayOffset = 27; dayOffset >= 0; dayOffset--) {
                LocalDate date = today.minusDays(dayOffset);
                if (date.getDayOfWeek() == DayOfWeek.FRIDAY) continue;   // weekend in Iran

                for (AppUser agent : agents) {
                    int perDay = 1 + random.nextInt(2);
                    for (int i = 0; i < perDay; i++) {
                        DailyReport r = new DailyReport();
                        r.setAgent(agent);
                        r.setReportDate(date);
                        r.setSchool(SCHOOLS[random.nextInt(SCHOOLS.length)]);
                        r.setReportLabel(i == 0 ? "لیست صبح" : "لیست بعدازظهر");

                        int total = 30 + random.nextInt(50);
                        int contacted = (int) Math.round(total * (0.6 + random.nextDouble() * 0.35));
                        // Outcomes must sum to exactly `contacted`, so the last one takes the remainder.
                        int ok = (int) Math.round(contacted * (0.3 + random.nextDouble() * 0.3));
                        int maybe = (int) Math.round((contacted - ok) * random.nextDouble() * 0.5);
                        int no = (int) Math.round((contacted - ok - maybe) * random.nextDouble() * 0.7);
                        int noAnswer = contacted - ok - maybe - no;

                        r.setTotalPeople(total);
                        r.setContactedCount(contacted);
                        r.setOkCount(ok);
                        r.setMaybeCount(maybe);
                        r.setNoCount(no);
                        r.setNoAnswerCount(noAnswer);

                        // Older reports are reviewed; the last few days are still in flight,
                        // so the supervisor queue isn't empty either.
                        if (dayOffset > 3) {
                            r.setStatus(ReportStatus.APPROVED);
                            r.setSubmittedAt(instant(date, 14));
                            r.setReviewedAt(instant(date, 17));
                            if (!reviewers.isEmpty()) r.setReviewer(reviewers.get(random.nextInt(reviewers.size())));
                        } else if (dayOffset > 0) {
                            r.setStatus(ReportStatus.SUBMITTED);
                            r.setSubmittedAt(instant(date, 14));
                        } else {
                            r.setStatus(ReportStatus.DRAFT);
                        }

                        // Attendance only exists once the class has actually run — leaving the
                        // recent ones null exercises the null-is-not-zero path.
                        if (dayOffset > 2) {
                            double showUp = 0.45 + random.nextDouble() * 0.45;
                            r.setAttendeeCount((int) Math.round(ok * showUp));
                        }
                        batch.add(r);
                    }
                }
            }
            reports.saveAll(batch);
            System.out.printf("[mock-data] seeded %d reports for %d agent(s)%n", batch.size(), agents.size());
        };
    }

    /**
     * Worked shifts to sit beside the reports, so the payroll view has real hours to total
     * rather than a table of zeros.
     *
     * <p>Deliberately uneven: people arrive at slightly different times, some days are split
     * into two shifts, and some days are missed entirely. A tidy 5-hours-every-day would hide
     * exactly the arithmetic the monthly target is meant to catch.
     */
    @Bean @Order(110)
    CommandLineRunner seedMockAttendance(AttendanceRepository attendance, UserRepository users) {
        return args -> {
            List<AppUser> agents = users.findActiveByRole(Role.AGENT).stream()
                    .filter(a -> !attendance.existsByUserId(a.getId())).toList();
            if (agents.isEmpty()) return;

            AppUser desk = users.findByUsernameIgnoreCase("office").orElse(null);
            if (desk == null) return;   // shifts have to be attributable to whoever recorded them

            Random random = new Random(20260806L);
            LocalDate today = LocalDate.now(ZoneId.of("Asia/Tehran"));
            List<AttendanceEntry> batch = new ArrayList<>();

            for (AppUser agent : agents) {
                for (int dayOffset = 29; dayOffset >= 1; dayOffset--) {
                    LocalDate date = today.minusDays(dayOffset);
                    if (date.getDayOfWeek() == DayOfWeek.FRIDAY) continue;
                    if (random.nextDouble() < 0.12) continue;             // absent

                    int startMin = 14 * 60 + random.nextInt(40) - 15;     // around 14:00
                    if (random.nextDouble() < 0.2) {
                        // A split day: a break in the middle becomes two shifts on the sheet.
                        int firstEnd = startMin + 100 + random.nextInt(40);
                        batch.add(shift(agent, desk, date, startMin, firstEnd));
                        int secondStart = firstEnd + 45 + random.nextInt(30);
                        batch.add(shift(agent, desk, date, secondStart, secondStart + 120 + random.nextInt(50)));
                    } else {
                        batch.add(shift(agent, desk, date, startMin, startMin + 270 + random.nextInt(70)));
                    }
                }
            }
            attendance.saveAll(batch);
            System.out.printf("[mock-data] seeded %d shifts for %d agent(s)%n", batch.size(), agents.size());
        };
    }

    private static AttendanceEntry shift(AppUser agent, AppUser desk, LocalDate date, int fromMin, int toMin) {
        AttendanceEntry e = new AttendanceEntry(agent, atMinute(date, fromMin), desk);
        e.setExitAt(atMinute(date, toMin));
        return e;
    }

    private static Instant atMinute(LocalDate date, int minuteOfDay) {
        return date.atStartOfDay(TEHRAN).plusMinutes(minuteOfDay).toInstant();
    }

    private static Instant instant(LocalDate date, int hour) {
        return date.atTime(hour, 0).atZone(TEHRAN).toInstant();
    }

    private static final ZoneId TEHRAN = ZoneId.of("Asia/Tehran");
}
