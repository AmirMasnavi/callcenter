package com.elmosanatearia.callcenter.report;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.*;
public interface DailyReportRepository extends JpaRepository<DailyReport,Long>{
 List<DailyReport> findByAgentIdOrderByReportDateDescCreatedAtDesc(Long agentId);
 @Query("select r from DailyReport r join fetch r.agent a where r.status=:status and a.supervisor.id=:supervisor order by r.submittedAt")
 List<DailyReport> pending(@Param("supervisor") Long supervisor,@Param("status") ReportStatus status);
 @Query("select r from DailyReport r join fetch r.agent a left join fetch r.reviewer where a.supervisor.id=:supervisor and r.status<>com.elmosanatearia.callcenter.report.ReportStatus.DRAFT order by r.reportDate desc,r.createdAt desc")
 List<DailyReport> teamReports(@Param("supervisor") Long supervisor);
 @Query("select r from DailyReport r join fetch r.agent a left join fetch a.supervisor where r.reportDate between :from and :to and r.status in :statuses order by r.reportDate,a.displayName")
 List<DailyReport> aggregateSource(@Param("from") LocalDate from,@Param("to") LocalDate to,@Param("statuses") Collection<ReportStatus> statuses);
}
