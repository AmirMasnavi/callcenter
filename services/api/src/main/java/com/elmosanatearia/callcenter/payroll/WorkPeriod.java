package com.elmosanatearia.callcenter.payroll;

import com.elmosanatearia.callcenter.user.AppUser;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

/**
 * One person's work cycle, counted in the days they actually turned up.
 *
 * <p>These are project workers: they are paid per {@code targetDays} of attendance, however
 * long that takes. Thirty days may fall inside one month or be spread across four, and one
 * person's cycle can end today while another's ends next month — so a cycle belongs to a
 * person, never to the calendar or to the office as a whole.
 *
 * <p>The date range is bookkeeping, not the definition: it says which attendance days belong
 * to this cycle. What ends the cycle is the day COUNT reaching {@link #targetDays}.
 */
@Entity
@Table(name = "work_periods")
public class WorkPeriod {

    /** How an hours shortfall was settled when the cycle closed. */
    public enum Settlement {
        /** The deficit moves into the next cycle's target, so it is worked off. */
        CARRY_OVER,
        /** The cycle was held open past the day count until the hours were made up. */
        EXTEND,
        /** Written off; the next cycle starts clean. */
        FORGIVE,
    }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    /** 1, 2, 3… within this person's history, so a cycle can be named without a date. */
    @Column(nullable = false)
    private int seq;

    @Column(name = "started_on", nullable = false)
    private LocalDate startedOn;

    @Column(name = "ended_on")
    private LocalDate endedOn;

    @Column(name = "target_days", nullable = false)
    private int targetDays;

    @Column(name = "carried_over_minutes", nullable = false)
    private long carriedOverMinutes;

    @Column(name = "closed_at")
    private Instant closedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by_id")
    private AppUser closedBy;

    @Column(length = 300)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Settlement settlement;

    // --- frozen at close; attendance stays correctable, settled pay does not ---
    @Column(name = "final_worked_minutes") private Long finalWorkedMinutes;
    @Column(name = "final_target_minutes") private Long finalTargetMinutes;
    @Column(name = "final_days")           private Integer finalDays;
    @Column(name = "final_shifts")         private Integer finalShifts;
    @Column(name = "final_reports")        private Long finalReports;
    @Column(name = "final_contacted")      private Long finalContacted;
    @Column(name = "final_ok")             private Long finalOk;
    @Column(name = "final_attendees")      private Long finalAttendees;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected WorkPeriod() {}

    public WorkPeriod(AppUser user, int seq, LocalDate startedOn, int targetDays, long carriedOverMinutes) {
        this.user = user;
        this.seq = seq;
        this.startedOn = startedOn;
        this.targetDays = targetDays;
        this.carriedOverMinutes = carriedOverMinutes;
    }

    public boolean isOpen() { return closedAt == null; }

    public Long getId() { return id; }
    public AppUser getUser() { return user; }
    public int getSeq() { return seq; }
    public LocalDate getStartedOn() { return startedOn; }
    public LocalDate getEndedOn() { return endedOn; }
    public void setEndedOn(LocalDate v) { endedOn = v; }
    public int getTargetDays() { return targetDays; }
    public void setTargetDays(int v) { targetDays = v; }
    public long getCarriedOverMinutes() { return carriedOverMinutes; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant v) { closedAt = v; }
    public AppUser getClosedBy() { return closedBy; }
    public void setClosedBy(AppUser v) { closedBy = v; }
    public String getNote() { return note; }
    public void setNote(String v) { note = v; }
    public Settlement getSettlement() { return settlement; }
    public void setSettlement(Settlement v) { settlement = v; }

    public Long getFinalWorkedMinutes() { return finalWorkedMinutes; }
    public Long getFinalTargetMinutes() { return finalTargetMinutes; }
    public Integer getFinalDays() { return finalDays; }
    public Integer getFinalShifts() { return finalShifts; }
    public Long getFinalReports() { return finalReports; }
    public Long getFinalContacted() { return finalContacted; }
    public Long getFinalOk() { return finalOk; }
    public Long getFinalAttendees() { return finalAttendees; }

    /** Copies the live figures in as the settled record. */
    public void freeze(long workedMinutes, long targetMinutes, int days, int shifts,
                       long reports, long contacted, long ok, long attendees) {
        this.finalWorkedMinutes = workedMinutes;
        this.finalTargetMinutes = targetMinutes;
        this.finalDays = days;
        this.finalShifts = shifts;
        this.finalReports = reports;
        this.finalContacted = contacted;
        this.finalOk = ok;
        this.finalAttendees = attendees;
    }
}
