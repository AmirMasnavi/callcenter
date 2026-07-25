package com.elmosanatearia.callcenter.report;
import jakarta.validation.constraints.*;
import java.time.*;
public final class ReportDtos {
 private ReportDtos(){}
 public record SaveRequest(@NotNull LocalDate reportDate,@PositiveOrZero int totalPeople,@PositiveOrZero int contactedCount,
   @PositiveOrZero int okCount,@PositiveOrZero int maybeCount,@PositiveOrZero int noCount,
   @PositiveOrZero int noAnswerCount,@Size(max=1000) String notes,Long version){}
 public record ReviewRequest(@NotNull Long version,@PositiveOrZero int totalPeople,@PositiveOrZero int contactedCount,
   @PositiveOrZero int okCount,@PositiveOrZero int maybeCount,@PositiveOrZero int noCount,
   @PositiveOrZero int noAnswerCount,@Size(max=1000) String notes,@Size(max=1000) String correctionReason){}
 public record View(Long id,Long agentId,String agentName,LocalDate reportDate,int totalPeople,int contactedCount,
   int notContacted,int okCount,int maybeCount,int noCount,int noAnswerCount,String notes,ReportStatus status,
   Instant submittedAt,Instant reviewedAt,String reviewerName,long version){
   public static View of(DailyReport r){
    return new View(r.getId(),r.getAgent().getId(),r.getAgent().getDisplayName(),r.getReportDate(),r.getTotalPeople(),
      r.getContactedCount(),r.notContacted(),r.getOkCount(),r.getMaybeCount(),r.getNoCount(),r.getNoAnswerCount(),
      r.getNotes(),r.getStatus(),r.getSubmittedAt(),r.getReviewedAt(),
      r.getReviewer()==null?null:r.getReviewer().getDisplayName(),r.getVersion());
   }
 }
}
