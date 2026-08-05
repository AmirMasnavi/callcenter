package com.elmosanatearia.callcenter.config;

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
 * Generates a few weeks of believable reports so the dashboard and charts have something
 * to draw. Development aid only.
 *
 * <p>Guarded three ways: the {@code app.mock-data.enabled} property (default false), a
 * check that the table is empty, and a requirement that demo users exist. It will never
 * touch a database that already holds reports.
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
            if (reports.count() > 0) return;  // never disturb existing data

            List<AppUser> agents = users.findActiveByRole(Role.AGENT);
            List<AppUser> reviewers = users.findActiveByRole(Role.SUPERVISOR);
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
            System.out.printf("[mock-data] seeded %d reports across %d schools%n", batch.size(), SCHOOLS.length);
        };
    }

    private static Instant instant(LocalDate date, int hour) {
        return date.atTime(hour, 0).atZone(ZoneId.of("Asia/Tehran")).toInstant();
    }
}
