package com.elmosanatearia.callcenter.report;
import com.elmosanatearia.callcenter.user.AppUser;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="report_revisions")
public class ReportRevision {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="report_id") private DailyReport report;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="actor_id") private AppUser actor;
 @Column(nullable=false,length=1000) private String reason;
 @Column(name="old_values",nullable=false,columnDefinition="text") private String oldValues;
 @Column(name="new_values",nullable=false,columnDefinition="text") private String newValues;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 public ReportRevision(){}
 public ReportRevision(DailyReport r,AppUser a,String reason,String oldV,String newV){report=r;actor=a;this.reason=reason;oldValues=oldV;newValues=newV;}
}
