package com.elmosanatearia.callcenter.report;
import jakarta.validation.constraints.*;
import java.time.*;
public final class ReportDtos {
 private ReportDtos(){}
 public record SaveRequest(Long reportId,@NotNull LocalDate reportDate,@Size(max=120) String reportLabel,
   @Size(max=160) String school,@PositiveOrZero int totalPeople,@PositiveOrZero int contactedCount,
   @PositiveOrZero int okCount,@PositiveOrZero int maybeCount,@PositiveOrZero int noCount,
   @PositiveOrZero int noAnswerCount,@PositiveOrZero Integer attendeeCount,@Size(max=1000) String notes,Long version){}
 public record ReviewRequest(@NotNull Long version,@PositiveOrZero int totalPeople,@PositiveOrZero int contactedCount,
   @PositiveOrZero int okCount,@PositiveOrZero int maybeCount,@PositiveOrZero int noCount,
   @PositiveOrZero int noAnswerCount,@PositiveOrZero Integer attendeeCount,@Size(max=160) String school,
   @Size(max=1000) String notes,@Size(max=1000) String correctionReason){}
 public record VoidRequest(@NotNull Long version,@NotBlank @Size(max=1000) String reason){}
 /** Bulk on purpose: clearing a backlog one report at a time is not realistic. */
 public record ArchiveRequest(@NotEmpty java.util.List<Long> reportIds){}
 public record ReopenRequest(@NotNull Long version,@NotNull ReportStatus target,@NotBlank @Size(max=1000) String reason){}
 public record View(Long id,Long agentId,String agentName,LocalDate reportDate,String reportLabel,String school,
   int totalPeople,int contactedCount,
   int notContacted,int okCount,int maybeCount,int noCount,int noAnswerCount,
   Integer attendeeCount,double attendanceRate,String notes,ReportStatus status,
   Instant createdAt,Instant updatedAt,Instant submittedAt,Instant reviewedAt,String reviewerName,long version,
   boolean voided,Instant voidedAt,String voidedByName,String voidReason,
   boolean archived,Instant archivedAt){
   public static View of(DailyReport r){
    return new View(r.getId(),r.getAgent().getId(),r.getAgent().getDisplayName(),r.getReportDate(),r.getReportLabel(),r.getSchool(),
      r.getTotalPeople(),
      r.getContactedCount(),r.notContacted(),r.getOkCount(),r.getMaybeCount(),r.getNoCount(),r.getNoAnswerCount(),
      r.getAttendeeCount(),r.attendanceRate(),
      r.getNotes(),r.getStatus(),r.getCreatedAt(),r.getUpdatedAt(),r.getSubmittedAt(),r.getReviewedAt(),
      r.getReviewer()==null?null:r.getReviewer().getDisplayName(),r.getVersion(),
      r.isVoided(),r.getVoidedAt(),r.getVoidedBy()==null?null:r.getVoidedBy().getDisplayName(),r.getVoidReason(),
      r.isArchived(),r.getArchivedAt());
   }
 }
 public record RevisionView(Long id,String actor,String reason,String oldValues,String newValues,Instant createdAt){
  public static RevisionView of(ReportRevision r){return new RevisionView(r.getId(),r.getActor().getDisplayName(),r.getReason(),r.getOldValues(),r.getNewValues(),r.getCreatedAt());}
 }
}
