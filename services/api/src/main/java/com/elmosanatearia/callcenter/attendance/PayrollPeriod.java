package com.elmosanatearia.callcenter.attendance;

import com.elmosanatearia.callcenter.user.AppUser;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A wage cycle.
 *
 * <p>One period is open at a time. Closing it freezes what every person worked into
 * {@link PayrollPeriodLine} rows and opens the next one the following day — a shift corrected
 * afterwards belongs to the new period, not to money already paid.
 */
@Entity
@Table(name = "payroll_periods")
public class PayrollPeriod {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "starts_on", nullable = false)
    private LocalDate startsOn;

    @Column(name = "ends_on", nullable = false)
    private LocalDate endsOn;

    /** Null while the period is still running. */
    @Column(name = "closed_at")
    private Instant closedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by_id")
    private AppUser closedBy;

    @Column(length = 300)
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "period", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PayrollPeriodLine> lines = new ArrayList<>();

    protected PayrollPeriod() {}

    public PayrollPeriod(LocalDate startsOn, LocalDate endsOn) {
        this.startsOn = startsOn;
        this.endsOn = endsOn;
    }

    public boolean isOpen() { return closedAt == null; }

    public Long getId() { return id; }
    public LocalDate getStartsOn() { return startsOn; }
    public void setStartsOn(LocalDate v) { startsOn = v; }
    public LocalDate getEndsOn() { return endsOn; }
    public void setEndsOn(LocalDate v) { endsOn = v; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant v) { closedAt = v; }
    public AppUser getClosedBy() { return closedBy; }
    public void setClosedBy(AppUser v) { closedBy = v; }
    public String getNote() { return note; }
    public void setNote(String v) { note = v; }
    public Instant getCreatedAt() { return createdAt; }
    public List<PayrollPeriodLine> getLines() { return lines; }
}
