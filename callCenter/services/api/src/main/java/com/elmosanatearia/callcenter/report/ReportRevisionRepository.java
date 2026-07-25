package com.elmosanatearia.callcenter.report;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ReportRevisionRepository extends JpaRepository<ReportRevision,Long>{
 List<ReportRevision> findByReportIdOrderByCreatedAtDesc(Long reportId);
}
