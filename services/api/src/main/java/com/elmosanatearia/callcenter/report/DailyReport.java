package com.elmosanatearia.callcenter.report;

import com.elmosanatearia.callcenter.user.AppUser;
import jakarta.persistence.*;
import java.time.*;

@Entity @Table(name="daily_reports")
public class DailyReport {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="agent_id") private AppUser agent;
    @Column(name="report_date",nullable=false) private LocalDate reportDate;
    @Column(name="report_label",length=120) private String reportLabel;
    @Column(name="total_people",nullable=false) private int totalPeople;
    @Column(name="contacted_count",nullable=false) private int contactedCount;
    @Column(name="ok_count",nullable=false) private int okCount;
    @Column(name="maybe_count",nullable=false) private int maybeCount;
    @Column(name="no_count",nullable=false) private int noCount;
    @Column(name="no_answer_count",nullable=false) private int noAnswerCount;
    /** How many actually attended the class. Null until the class has happened. */
    @Column(name="attendee_count") private Integer attendeeCount;
    /** The school that was called — managers compare per school, not only per operator. */
    @Column(name="school",length=160) private String school;
    @Column(length=1000) private String notes;
    @Enumerated(EnumType.STRING) @Column(nullable=false) private ReportStatus status = ReportStatus.DRAFT;
    @Column(name="submitted_at") private Instant submittedAt;
    @Column(name="reviewed_at") private Instant reviewedAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="reviewer_id") private AppUser reviewer;
    @Column(name="created_at",nullable=false) private Instant createdAt = Instant.now();
    @Column(name="updated_at",nullable=false) private Instant updatedAt = Instant.now();
    @Version private long version;
    // Voiding is a soft delete: the row stays so revisions and audit history remain readable.
    @Column(name="voided_at") private Instant voidedAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="voided_by") private AppUser voidedBy;
    @Column(name="void_reason",length=1000) private String voidReason;
    // Archiving only removes a report from the working lists — it stays in every statistic.
    @Column(name="archived_at") private Instant archivedAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="archived_by") private AppUser archivedBy;
    @PreUpdate void updated(){ updatedAt=Instant.now(); }
    public int outcomeTotal(){ return okCount+maybeCount+noCount+noAnswerCount; }
    public int notContacted(){ return totalPeople-contactedCount; }
    public Long getId(){return id;} public AppUser getAgent(){return agent;} public void setAgent(AppUser v){agent=v;}
    public LocalDate getReportDate(){return reportDate;} public void setReportDate(LocalDate v){reportDate=v;}
    public String getReportLabel(){return reportLabel;} public void setReportLabel(String v){reportLabel=v;}
    public int getTotalPeople(){return totalPeople;} public void setTotalPeople(int v){totalPeople=v;}
    public int getContactedCount(){return contactedCount;} public void setContactedCount(int v){contactedCount=v;}
    public int getOkCount(){return okCount;} public void setOkCount(int v){okCount=v;}
    public int getMaybeCount(){return maybeCount;} public void setMaybeCount(int v){maybeCount=v;}
    public int getNoCount(){return noCount;} public void setNoCount(int v){noCount=v;}
    public int getNoAnswerCount(){return noAnswerCount;} public void setNoAnswerCount(int v){noAnswerCount=v;}
    public Integer getAttendeeCount(){return attendeeCount;} public void setAttendeeCount(Integer v){attendeeCount=v;}
    public String getSchool(){return school;} public void setSchool(String v){school=v;}
    /** Attendees as a share of those who answered positively — 0 when nothing to compare. */
    public double attendanceRate(){ return okCount==0||attendeeCount==null?0:attendeeCount*100d/okCount; }
    public String getNotes(){return notes;} public void setNotes(String v){notes=v;}
    public ReportStatus getStatus(){return status;} public void setStatus(ReportStatus v){status=v;}
    public Instant getSubmittedAt(){return submittedAt;} public void setSubmittedAt(Instant v){submittedAt=v;}
    public Instant getReviewedAt(){return reviewedAt;} public void setReviewedAt(Instant v){reviewedAt=v;}
    public AppUser getReviewer(){return reviewer;} public void setReviewer(AppUser v){reviewer=v;}
    public Instant getCreatedAt(){return createdAt;} public Instant getUpdatedAt(){return updatedAt;}
    public long getVersion(){return version;}
    public boolean isVoided(){ return voidedAt != null; }
    public Instant getVoidedAt(){return voidedAt;} public void setVoidedAt(Instant v){voidedAt=v;}
    public AppUser getVoidedBy(){return voidedBy;} public void setVoidedBy(AppUser v){voidedBy=v;}
    public String getVoidReason(){return voidReason;} public void setVoidReason(String v){voidReason=v;}
    public boolean isArchived(){ return archivedAt != null; }
    public Instant getArchivedAt(){return archivedAt;} public void setArchivedAt(Instant v){archivedAt=v;}
    public AppUser getArchivedBy(){return archivedBy;} public void setArchivedBy(AppUser v){archivedBy=v;}
}
