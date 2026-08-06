package com.elmosanatearia.callcenter.report;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.*;
public interface DailyReportRepository extends JpaRepository<DailyReport,Long>{

    boolean existsByAgentId(Long agentId);
 List<DailyReport> findByAgentIdAndVoidedAtIsNullAndArchivedAtIsNullOrderByReportDateDescCreatedAtDesc(Long agentId);

 @Query("select r from DailyReport r join fetch r.agent a where r.status=:status and a.supervisor.id=:supervisor and r.voidedAt is null and r.archivedAt is null order by r.submittedAt desc")
 List<DailyReport> pending(@Param("supervisor") Long supervisor,@Param("status") ReportStatus status);

 @Query("select r from DailyReport r join fetch r.agent a left join fetch r.reviewer where a.supervisor.id=:supervisor and r.status<>com.elmosanatearia.callcenter.report.ReportStatus.DRAFT and r.voidedAt is null and r.archivedAt is null order by r.reportDate desc,r.createdAt desc")
 List<DailyReport> teamReports(@Param("supervisor") Long supervisor);

 @Query("select r from DailyReport r join fetch r.agent a left join fetch a.supervisor where r.reportDate between :from and :to and r.status in :statuses and r.voidedAt is null order by r.reportDate,a.displayName")
 List<DailyReport> aggregateSource(@Param("from") LocalDate from,@Param("to") LocalDate to,@Param("statuses") Collection<ReportStatus> statuses);

 /**
  * Per-agent daily totals over a range, aggregated in the database.
  *
  * Payroll asks this once per person. Reusing aggregateSource meant loading every report for
  * every agent across the range and filtering in Java — the work grew with headcount TIMES
  * report volume. Grouping by date here returns one row per day per agent instead, which is
  * also exactly the shape the caller needs to pick out a person's first N days.
  */
 @Query("""
     select r.agent.id, r.reportDate, count(r), coalesce(sum(r.contactedCount),0),
            coalesce(sum(r.okCount),0), coalesce(sum(r.attendeeCount),0)
       from DailyReport r
      where r.agent.id in :agentIds and r.reportDate between :from and :to
        and r.status in :statuses and r.voidedAt is null
      group by r.agent.id, r.reportDate""")
 List<Object[]> dailyTotalsByAgent(@Param("agentIds") Collection<Long> agentIds,
   @Param("from") LocalDate from,@Param("to") LocalDate to,
   @Param("statuses") Collection<ReportStatus> statuses);

 // --- admin-wide views: no supervisor scoping ---

 @Query("select r from DailyReport r join fetch r.agent a where r.status=:status and r.voidedAt is null and r.archivedAt is null order by r.submittedAt desc")
 List<DailyReport> pendingAll(@Param("status") ReportStatus status);

 @Query("select r from DailyReport r join fetch r.agent a left join fetch r.reviewer where r.status<>com.elmosanatearia.callcenter.report.ReportStatus.DRAFT and r.voidedAt is null and r.archivedAt is null order by r.reportDate desc,r.createdAt desc")
 List<DailyReport> allReports();

 @Query("select r from DailyReport r join fetch r.agent a left join fetch r.reviewer where r.voidedAt is not null order by r.voidedAt desc")
 List<DailyReport> voidedReports();

 /**
  * Everything that still exists, archived included. This backs the ledger — the whole
  * point of "archived, not deleted" is that the reports remain findable, so the lookup
  * view must not apply the same filter the working lists do.
  */
 @Query("select r from DailyReport r join fetch r.agent a left join fetch r.reviewer where r.status<>com.elmosanatearia.callcenter.report.ReportStatus.DRAFT and r.voidedAt is null order by r.reportDate desc,r.createdAt desc")
 List<DailyReport> ledger();

 /** Archived reports stay in the statistics, so aggregateSource deliberately does NOT filter them. */
 @Query("select r from DailyReport r join fetch r.agent a left join fetch r.reviewer where r.archivedAt is not null and r.voidedAt is null order by r.archivedAt desc")
 List<DailyReport> archivedReports();
}
