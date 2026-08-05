package com.elmosanatearia.callcenter.attendance;

import com.elmosanatearia.callcenter.user.AppUser;
import jakarta.persistence.*;

/**
 * One person's frozen figures for a closed period.
 *
 * <p>Deliberately a copy, not a view. Shifts stay correctable forever, so recomputing a closed
 * period would silently change what someone was paid for months ago. The display name is
 * copied too — people change names, and a payslip should read as it did when it was issued.
 */
@Entity
@Table(name = "payroll_period_lines")
public class PayrollPeriodLine {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "period_id")
    private PayrollPeriod period;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "display_name", nullable = false, length = 120)
    private String displayName;

    @Column(name = "worked_minutes", nullable = false)
    private long workedMinutes;

    @Column(name = "days_present", nullable = false)
    private int daysPresent;

    @Column(name = "expected_days", nullable = false)
    private int expectedDays;

    @Column(name = "daily_target_minutes", nullable = false)
    private int dailyTargetMinutes;

    @Column(name = "target_minutes", nullable = false)
    private long targetMinutes;

    @Column(nullable = false)
    private int shifts;

    @Column(nullable = false)
    private long reports;

    @Column(nullable = false)
    private long contacted;

    @Column(name = "ok_count", nullable = false)
    private long okCount;

    protected PayrollPeriodLine() {}

    PayrollPeriodLine(PayrollPeriod period, AppUser user, AttendanceService.StaffSummary s) {
        this.period = period;
        this.user = user;
        this.displayName = s.displayName();
        this.workedMinutes = s.workedMinutes();
        this.daysPresent = s.daysPresent();
        this.expectedDays = s.expectedDays();
        this.dailyTargetMinutes = s.dailyTargetMinutes();
        this.targetMinutes = s.targetMinutes();
        this.shifts = s.shifts();
        this.reports = s.reports();
        this.contacted = s.contacted();
        this.okCount = s.ok();
    }

    /** Hours owed against hours expected. Negative means they came up short. */
    public long balanceMinutes() { return workedMinutes - targetMinutes; }

    public Long getId() { return id; }
    public PayrollPeriod getPeriod() { return period; }
    public AppUser getUser() { return user; }
    public String getDisplayName() { return displayName; }
    public long getWorkedMinutes() { return workedMinutes; }
    public int getDaysPresent() { return daysPresent; }
    public int getExpectedDays() { return expectedDays; }
    public int getDailyTargetMinutes() { return dailyTargetMinutes; }
    public long getTargetMinutes() { return targetMinutes; }
    public int getShifts() { return shifts; }
    public long getReports() { return reports; }
    public long getContacted() { return contacted; }
    public long getOkCount() { return okCount; }
}
