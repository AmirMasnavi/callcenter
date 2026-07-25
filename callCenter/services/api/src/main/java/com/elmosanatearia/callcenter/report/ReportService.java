package com.elmosanatearia.callcenter.report;
import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.auth.AppPrincipal;
import com.elmosanatearia.callcenter.user.*;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static com.elmosanatearia.callcenter.report.ReportDtos.*;

@Service
public class ReportService {
 private final DailyReportRepository reports; private final ReportRevisionRepository revisions;
 private final UserRepository users; private final AuditRepository audits;
 public ReportService(DailyReportRepository r,ReportRevisionRepository rv,UserRepository u,AuditRepository a){reports=r;revisions=rv;users=u;audits=a;}
 @Transactional public View saveDraft(AppPrincipal actor,SaveRequest q){
  if(q.reportDate().isAfter(LocalDate.now(ZoneId.of("Asia/Tehran")))) throw new IllegalArgumentException("ثبت گزارش برای آینده مجاز نیست");
  AppUser user=users.findById(actor.id()).orElseThrow();
  DailyReport r=reports.findByAgentIdAndReportDate(actor.id(),q.reportDate()).orElseGet(()->{DailyReport n=new DailyReport();n.setAgent(user);n.setReportDate(q.reportDate());return n;});
  if(r.getStatus()!=ReportStatus.DRAFT) throw new IllegalStateException("گزارش ارسال‌شده قابل ویرایش نیست");
  if(q.version()!=null && r.getId()!=null && q.version()!=r.getVersion()) throw new IllegalStateException("نسخه گزارش قدیمی است");
  apply(r,q.totalPeople(),q.contactedCount(),q.okCount(),q.maybeCount(),q.noCount(),q.noAnswerCount(),q.notes());
  DailyReport saved=reports.save(r); audits.save(new AuditEvent(user,"SAVE_DRAFT","DailyReport",String.valueOf(saved.getId()),null)); return View.of(saved);
 }
 @Transactional public View submit(Long id,Long version,AppPrincipal actor){
  DailyReport r=owned(id,actor.id()); if(r.getStatus()!=ReportStatus.DRAFT) throw new IllegalStateException("فقط پیش‌نویس قابل ارسال است");
  if(version!=r.getVersion()) throw new IllegalStateException("نسخه گزارش قدیمی است");
  validate(r);r.setStatus(ReportStatus.SUBMITTED);r.setSubmittedAt(Instant.now());
  audits.save(new AuditEvent(r.getAgent(),"SUBMIT_REPORT","DailyReport",id.toString(),null));return View.of(reports.save(r));
 }
 @Transactional(readOnly=true) public List<View> mine(AppPrincipal actor){return reports.findByAgentIdOrderByReportDateDesc(actor.id()).stream().map(View::of).toList();}
 @Transactional(readOnly=true) public List<View> pending(AppPrincipal actor){return reports.pending(actor.id(),ReportStatus.SUBMITTED).stream().map(View::of).toList();}
 @Transactional public View review(Long id,ReviewRequest q,AppPrincipal principal){
  DailyReport r=reports.findById(id).orElseThrow(EntityNotFoundException::new);
  AppUser reviewer=users.findById(principal.id()).orElseThrow();
  if(principal.role()==Role.SUPERVISOR && (r.getAgent().getSupervisor()==null || !r.getAgent().getSupervisor().getId().equals(principal.id()))) throw new SecurityException("این گزارش متعلق به تیم شما نیست");
  if(r.getStatus()!=ReportStatus.SUBMITTED) throw new IllegalStateException("این گزارش در انتظار بررسی نیست");
  if(q.version()!=r.getVersion()) throw new IllegalStateException("نسخه گزارش قدیمی است");
  String old=snapshot(r); boolean changed=changed(r,q);
  if(changed && (q.correctionReason()==null || q.correctionReason().isBlank())) throw new IllegalArgumentException("دلیل اصلاح الزامی است");
  apply(r,q.totalPeople(),q.contactedCount(),q.okCount(),q.maybeCount(),q.noCount(),q.noAnswerCount(),q.notes());validate(r);
  if(changed) revisions.save(new ReportRevision(r,reviewer,q.correctionReason().trim(),old,snapshot(r)));
  r.setStatus(changed?ReportStatus.CORRECTED_APPROVED:ReportStatus.APPROVED);r.setReviewer(reviewer);r.setReviewedAt(Instant.now());
  audits.save(new AuditEvent(reviewer,changed?"CORRECT_AND_APPROVE":"APPROVE_REPORT","DailyReport",id.toString(),changed?q.correctionReason():null));
  return View.of(reports.save(r));
 }
 private DailyReport owned(Long id,Long uid){DailyReport r=reports.findById(id).orElseThrow(EntityNotFoundException::new);if(!r.getAgent().getId().equals(uid))throw new SecurityException("دسترسی غیرمجاز");return r;}
 public static void validate(DailyReport r){if(r.getTotalPeople()<=0)throw new IllegalArgumentException("کل افراد باید بیشتر از صفر باشد");if(r.getContactedCount()>r.getTotalPeople())throw new IllegalArgumentException("تعداد تماس از کل افراد بیشتر است");if(r.outcomeTotal()!=r.getContactedCount())throw new IllegalArgumentException("جمع نتایج باید برابر تعداد تماس‌گرفته باشد");}
 private static void apply(DailyReport r,int total,int contacted,int ok,int maybe,int no,int noAnswer,String notes){r.setTotalPeople(total);r.setContactedCount(contacted);r.setOkCount(ok);r.setMaybeCount(maybe);r.setNoCount(no);r.setNoAnswerCount(noAnswer);r.setNotes(notes==null?null:notes.trim());}
 private static boolean changed(DailyReport r,ReviewRequest q){return r.getTotalPeople()!=q.totalPeople()||r.getContactedCount()!=q.contactedCount()||r.getOkCount()!=q.okCount()||r.getMaybeCount()!=q.maybeCount()||r.getNoCount()!=q.noCount()||r.getNoAnswerCount()!=q.noAnswerCount()||!Objects.equals(Objects.toString(r.getNotes(),""),Objects.toString(q.notes(),""));}
 private static String snapshot(DailyReport r){return "{\"total\":"+r.getTotalPeople()+",\"contacted\":"+r.getContactedCount()+",\"ok\":"+r.getOkCount()+",\"maybe\":"+r.getMaybeCount()+",\"no\":"+r.getNoCount()+",\"noAnswer\":"+r.getNoAnswerCount()+",\"notes\":\""+Objects.toString(r.getNotes(),"").replace("\"","'")+"\"}";}
}
