package com.elmosanatearia.callcenter.dashboard;
import com.elmosanatearia.callcenter.report.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Predicate;

@Service
public class DashboardService {
 private final DailyReportRepository reports;
 public DashboardService(DailyReportRepository reports){this.reports=reports;}
 public enum Context { OPERATIONAL, OFFICIAL }
 public record Totals(long reports,long totalPeople,long contacted,long notContacted,long ok,long maybe,long no,long noAnswer,double contactRate,double okRate){}
 public record Trend(LocalDate date,long totalPeople,long contacted,long ok,long maybe,long no,long noAnswer){}
 public record AgentRow(Long agentId,String agentName,long reports,long totalPeople,long contacted,long ok,long maybe,long no,long noAnswer){}
 public record Result(Totals totals,List<Trend> trend,List<AgentRow> agents,Totals previous){}
 @Transactional(readOnly=true)
 public Result get(LocalDate from,LocalDate to,Context context,Long supervisorId,Long agentId){
  if(to.isBefore(from)||from.plusYears(2).isBefore(to))throw new IllegalArgumentException("بازه تاریخ معتبر نیست");
  List<ReportStatus> statuses=context==Context.OFFICIAL?List.of(ReportStatus.APPROVED,ReportStatus.CORRECTED_APPROVED):
    List.of(ReportStatus.SUBMITTED,ReportStatus.APPROVED,ReportStatus.CORRECTED_APPROVED);
  Predicate<DailyReport> filter=r->(supervisorId==null||(r.getAgent().getSupervisor()!=null&&supervisorId.equals(r.getAgent().getSupervisor().getId())))&&(agentId==null||agentId.equals(r.getAgent().getId()));
  List<DailyReport> current=reports.aggregateSource(from,to,statuses).stream().filter(filter).toList();
  long days=java.time.temporal.ChronoUnit.DAYS.between(from,to)+1;
  LocalDate pTo=from.minusDays(1),pFrom=pTo.minusDays(days-1);
  List<DailyReport> previous=reports.aggregateSource(pFrom,pTo,statuses).stream().filter(filter).toList();
  Map<LocalDate,List<DailyReport>> byDate=new TreeMap<>();current.forEach(r->byDate.computeIfAbsent(r.getReportDate(),x->new ArrayList<>()).add(r));
  Map<Long,List<DailyReport>> byAgent=new LinkedHashMap<>();current.forEach(r->byAgent.computeIfAbsent(r.getAgent().getId(),x->new ArrayList<>()).add(r));
  return new Result(total(current),byDate.entrySet().stream().map(e->trend(e.getKey(),e.getValue())).toList(),
   byAgent.values().stream().map(this::agent).sorted(Comparator.comparing(AgentRow::agentName)).toList(),total(previous));
 }
 private Totals total(List<DailyReport> rs){long t=sum(rs,DailyReport::getTotalPeople),c=sum(rs,DailyReport::getContactedCount),ok=sum(rs,DailyReport::getOkCount);return new Totals(rs.size(),t,c,t-c,ok,sum(rs,DailyReport::getMaybeCount),sum(rs,DailyReport::getNoCount),sum(rs,DailyReport::getNoAnswerCount),t==0?0:c*100d/t,c==0?0:ok*100d/c);}
 private Trend trend(LocalDate d,List<DailyReport> r){return new Trend(d,sum(r,DailyReport::getTotalPeople),sum(r,DailyReport::getContactedCount),sum(r,DailyReport::getOkCount),sum(r,DailyReport::getMaybeCount),sum(r,DailyReport::getNoCount),sum(r,DailyReport::getNoAnswerCount));}
 private AgentRow agent(List<DailyReport> r){DailyReport a=r.getFirst();return new AgentRow(a.getAgent().getId(),a.getAgent().getDisplayName(),r.size(),sum(r,DailyReport::getTotalPeople),sum(r,DailyReport::getContactedCount),sum(r,DailyReport::getOkCount),sum(r,DailyReport::getMaybeCount),sum(r,DailyReport::getNoCount),sum(r,DailyReport::getNoAnswerCount));}
 private long sum(List<DailyReport> r,java.util.function.ToIntFunction<DailyReport> f){return r.stream().mapToLong(x->f.applyAsInt(x)).sum();}
}
