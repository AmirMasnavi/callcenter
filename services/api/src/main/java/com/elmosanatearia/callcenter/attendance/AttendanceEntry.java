package com.elmosanatearia.callcenter.attendance;

import com.elmosanatearia.callcenter.user.AppUser;
import jakarta.persistence.*;
import java.time.*;

/**
 * One shift: a clock-in, and a clock-out once the person leaves.
 *
 * <p>Worked minutes are derived rather than stored. Storing a duration alongside the two
 * timestamps means a correction to either time leaves the stored figure wrong, and payroll
 * is exactly where that must not happen.
 */
@Entity @Table(name = "attendance_entries")
public class AttendanceEntry {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "entry_at", nullable = false)
    private Instant entryAt;

    /** Null while the person is still in the building. */
    @Column(name = "exit_at")
    private Instant exitAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "recorded_by")
    private AppUser recordedBy;

    @Column(name = "note", length = 300)
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate void touch() { updatedAt = Instant.now(); }

    protected AttendanceEntry() {}

    public AttendanceEntry(AppUser user, Instant entryAt, AppUser recordedBy) {
        this.user = user; this.entryAt = entryAt; this.recordedBy = recordedBy;
    }

    public Long getId() { return id; }
    public AppUser getUser() { return user; }
    public Instant getEntryAt() { return entryAt; }
    public void setEntryAt(Instant v) { entryAt = v; }
    public Instant getExitAt() { return exitAt; }
    public void setExitAt(Instant v) { exitAt = v; }
    public AppUser getRecordedBy() { return recordedBy; }
    public void setRecordedBy(AppUser v) { recordedBy = v; }
    public String getNote() { return note; }
    public void setNote(String v) { note = v; }
    public boolean isOpen() { return exitAt == null; }

    /** 0 while the shift is still open — an unfinished shift contributes nothing yet. */
    public long workedMinutes() {
        return exitAt == null ? 0 : Duration.between(entryAt, exitAt).toMinutes();
    }
}
