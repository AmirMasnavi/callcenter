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
  DailyReport r=q.reportId()==null?new DailyReport():owned(q.reportId(),actor.id());
  if(r.getId()==null){r.setAgent(user);r.setReportDate(q.reportDate());}
  if(r.getStatus()!=ReportStatus.DRAFT&&r.getStatus()!=ReportStatus.SUBMITTED) throw new IllegalStateException("گزارش تأییدشده فقط توسط ناظر قابل اصلاح است");
  if(q.version()!=null && r.getId()!=null && q.version()!=r.getVersion()) throw new IllegalStateException("نسخه گزارش قدیمی است");
  String old=r.getId()==null?null:snapshot(r); boolean submitted=r.getStatus()==ReportStatus.SUBMITTED;
  r.setReportDate(q.reportDate());r.setReportLabel(clean(q.reportLabel()));
  apply(r,q.totalPeople(),q.contactedCount(),q.okCount(),q.maybeCount(),q.noCount(),q.noAnswerCount(),q.attendeeCount(),q.school(),q.notes());
  if(submitted){validate(r);revisions.save(new ReportRevision(r,user,"ویرایش اپراتور پیش از تأیید ناظر",old,snapshot(r)));}
  DailyReport saved=reports.saveAndFlush(r); audits.save(new AuditEvent(user,submitted?"EDIT_SUBMITTED":"SAVE_DRAFT","DailyReport",String.valueOf(saved.getId()),null)); return View.of(saved);
 }
 @Transactional public View submit(Long id,Long version,AppPrincipal actor){
  DailyReport r=owned(id,actor.id()); if(r.getStatus()!=ReportStatus.DRAFT) throw new IllegalStateException("فقط پیش‌نویس قابل ارسال است");
  if(version!=r.getVersion()) throw new IllegalStateException("نسخه گزارش قدیمی است");
  validate(r);r.setStatus(ReportStatus.SUBMITTED);r.setSubmittedAt(Instant.now());
  DailyReport saved=reports.saveAndFlush(r);audits.save(new AuditEvent(r.getAgent(),"SUBMIT_REPORT","DailyReport",id.toString(),null));return View.of(saved);
 }
 @Transactional(readOnly=true) public List<View> mine(AppPrincipal actor){return reports.findByAgentIdAndVoidedAtIsNullOrderByReportDateDescCreatedAtDesc(actor.id()).stream().map(View::of).toList();}
 // Whoever may see every team is not scoped to one; everyone else sees their own team.
 @Transactional(readOnly=true) public List<View> pending(AppPrincipal actor){
  var rows=actor.can(Permission.VIEW_ALL_REPORTS)?reports.pendingAll(ReportStatus.SUBMITTED):reports.pending(actor.id(),ReportStatus.SUBMITTED);
  return rows.stream().map(View::of).toList();
 }
 @Transactional(readOnly=true) public List<View> team(AppPrincipal actor){
  var rows=actor.can(Permission.VIEW_ALL_REPORTS)?reports.allReports():reports.teamReports(actor.id());
  return rows.stream().map(View::of).toList();
 }
 @Transactional(readOnly=true) public List<View> voided(){return reports.voidedReports().stream().map(View::of).toList();}
 @Transactional(readOnly=true) public List<RevisionView> revisions(Long id,AppPrincipal actor){
  DailyReport r=reports.findById(id).orElseThrow(EntityNotFoundException::new);assertCanReview(r,actor);
  return revisions.findByReportIdOrderByCreatedAtDesc(id).stream().map(RevisionView::of).toList();
 }
 @Transactional public View review(Long id,ReviewRequest q,AppPrincipal principal){
  DailyReport r=reports.findById(id).orElseThrow(EntityNotFoundException::new);
  AppUser reviewer=users.findById(principal.id()).orElseThrow();
  assertCanReview(r,principal);
  boolean alreadyApproved=r.getStatus()==ReportStatus.APPROVED||r.getStatus()==ReportStatus.CORRECTED_APPROVED;
  if(r.getStatus()!=ReportStatus.SUBMITTED&&!alreadyApproved) throw new IllegalStateException("این گزارش قابل بررسی نیست");
  if(q.version()!=r.getVersion()) throw new IllegalStateException("نسخه گزارش قدیمی است");
  String old=snapshot(r); boolean changed=changed(r,q);
  if((changed||alreadyApproved) && (q.correctionReason()==null || q.correctionReason().isBlank())) throw new IllegalArgumentException("دلیل اصلاح الزامی است");
  if(alreadyApproved&&!changed) throw new IllegalArgumentException("برای اصلاح مجدد، حداقل یک مقدار را تغییر دهید");
  apply(r,q.totalPeople(),q.contactedCount(),q.okCount(),q.maybeCount(),q.noCount(),q.noAnswerCount(),q.attendeeCount(),q.school(),q.notes());validate(r);
  if(changed) revisions.save(new ReportRevision(r,reviewer,q.correctionReason().trim(),old,snapshot(r)));
  r.setStatus(changed?ReportStatus.CORRECTED_APPROVED:ReportStatus.APPROVED);r.setReviewer(reviewer);r.setReviewedAt(Instant.now());
  audits.save(new AuditEvent(reviewer,changed?"CORRECT_AND_APPROVE":"APPROVE_REPORT","DailyReport",id.toString(),changed?q.correctionReason():null));
  return View.of(reports.saveAndFlush(r));
 }
 /**
  * Whoever may see every team may act on any report; a reviewer without that reach is
  * limited to their own team. Checked widest-first, so holding both gives the wider access.
  */
 private void assertCanReview(DailyReport r,AppPrincipal principal){
  if(principal.can(Permission.VIEW_ALL_REPORTS)) return;
  if(principal.can(Permission.REVIEW_REPORTS)){
   AppUser supervisor=r.getAgent().getSupervisor();
   if(supervisor==null||!supervisor.getId().equals(principal.id())) throw new SecurityException("این گزارش متعلق به تیم شما نیست");
   return;
  }
  throw new SecurityException("دسترسی غیرمجاز");
 }
 private void assertCan(AppPrincipal principal,Permission permission){
  if(!principal.can(permission)) throw new SecurityException("شما دسترسی لازم برای این عملیات را ندارید");
 }
 /** Soft-delete. The row survives so revisions and the audit trail stay readable. */
 @Transactional public View voidReport(Long id,VoidRequest q,AppPrincipal principal){
  assertCan(principal,Permission.VOID_REPORT);
  DailyReport r=reports.findById(id).orElseThrow(EntityNotFoundException::new);
  if(r.isVoided()) throw new IllegalStateException("این گزارش پیش‌تر ابطال شده است");
  if(q.version()!=r.getVersion()) throw new IllegalStateException("نسخه گزارش قدیمی است");
  AppUser actor=users.findById(principal.id()).orElseThrow();
  r.setVoidedAt(Instant.now());r.setVoidedBy(actor);r.setVoidReason(q.reason().trim());
  DailyReport saved=reports.saveAndFlush(r);
  audits.save(new AuditEvent(actor,"VOID_REPORT","DailyReport",id.toString(),q.reason().trim()));
  return View.of(saved);
 }
 @Transactional public View restoreReport(Long id,AppPrincipal principal){
  assertCan(principal,Permission.VOID_REPORT);
  DailyReport r=reports.findById(id).orElseThrow(EntityNotFoundException::new);
  if(!r.isVoided()) throw new IllegalStateException("این گزارش ابطال نشده است");
  AppUser actor=users.findById(principal.id()).orElseThrow();
  r.setVoidedAt(null);r.setVoidedBy(null);r.setVoidReason(null);
  DailyReport saved=reports.saveAndFlush(r);
  audits.save(new AuditEvent(actor,"RESTORE_REPORT","DailyReport",id.toString(),null));
  return View.of(saved);
 }
 /** Send an approved report back to SUBMITTED or DRAFT so it can be corrected again. */
 @Transactional public View reopen(Long id,ReopenRequest q,AppPrincipal principal){
  assertCan(principal,Permission.REOPEN_REPORT);
  DailyReport r=reports.findById(id).orElseThrow(EntityNotFoundException::new);
  if(r.isVoided()) throw new IllegalStateException("گزارش ابطال‌شده قابل بازگشایی نیست");
  if(q.target()!=ReportStatus.SUBMITTED&&q.target()!=ReportStatus.DRAFT) throw new IllegalArgumentException("وضعیت مقصد باید پیش‌نویس یا در انتظار تأیید باشد");
  if(r.getStatus()!=ReportStatus.APPROVED&&r.getStatus()!=ReportStatus.CORRECTED_APPROVED) throw new IllegalStateException("فقط گزارش تأییدشده قابل بازگشایی است");
  if(q.version()!=r.getVersion()) throw new IllegalStateException("نسخه گزارش قدیمی است");
  AppUser actor=users.findById(principal.id()).orElseThrow();
  String old=snapshot(r);
  r.setStatus(q.target());r.setReviewer(null);r.setReviewedAt(null);
  if(q.target()==ReportStatus.DRAFT) r.setSubmittedAt(null);
  revisions.save(new ReportRevision(r,actor,"بازگشایی توسط مدیر سامانه: "+q.reason().trim(),old,snapshot(r)));
  DailyReport saved=reports.saveAndFlush(r);
  audits.save(new AuditEvent(actor,"REOPEN_REPORT","DailyReport",id.toString(),q.reason().trim()));
  return View.of(saved);
 }
 private DailyReport owned(Long id,Long uid){DailyReport r=reports.findById(id).orElseThrow(EntityNotFoundException::new);if(!r.getAgent().getId().equals(uid))throw new SecurityException("دسترسی غیرمجاز");return r;}
 public static void validate(DailyReport r){
  if(r.getTotalPeople()<=0)throw new IllegalArgumentException("کل افراد باید بیشتر از صفر باشد");
  if(r.getContactedCount()>r.getTotalPeople())throw new IllegalArgumentException("تعداد تماس از کل افراد بیشتر است");
  if(r.outcomeTotal()!=r.getContactedCount())throw new IllegalArgumentException("جمع نتایج باید برابر تعداد تماس‌گرفته باشد");
  // Attendance stays optional: the class may not have run yet when the report is filed.
  if(r.getAttendeeCount()!=null){
   if(r.getAttendeeCount()<0)throw new IllegalArgumentException("تعداد حاضرین نمی‌تواند منفی باشد");
   if(r.getAttendeeCount()>r.getTotalPeople())throw new IllegalArgumentException("تعداد حاضرین از کل افراد بیشتر است");
  }
 }
 private static void apply(DailyReport r,int total,int contacted,int ok,int maybe,int no,int noAnswer,Integer attendees,String school,String notes){
  r.setTotalPeople(total);r.setContactedCount(contacted);r.setOkCount(ok);r.setMaybeCount(maybe);r.setNoCount(no);r.setNoAnswerCount(noAnswer);
  r.setAttendeeCount(attendees);r.setSchool(clean(school));r.setNotes(notes==null?null:notes.trim());
 }
 private static boolean changed(DailyReport r,ReviewRequest q){
  return r.getTotalPeople()!=q.totalPeople()||r.getContactedCount()!=q.contactedCount()||r.getOkCount()!=q.okCount()
   ||r.getMaybeCount()!=q.maybeCount()||r.getNoCount()!=q.noCount()||r.getNoAnswerCount()!=q.noAnswerCount()
   ||!Objects.equals(r.getAttendeeCount(),q.attendeeCount())
   ||!Objects.equals(Objects.toString(r.getSchool(),""),Objects.toString(clean(q.school()),""))
   ||!Objects.equals(Objects.toString(r.getNotes(),""),Objects.toString(q.notes(),""));
 }
 private static String snapshot(DailyReport r){
  return "{\"total\":"+r.getTotalPeople()+",\"contacted\":"+r.getContactedCount()+",\"ok\":"+r.getOkCount()
   +",\"maybe\":"+r.getMaybeCount()+",\"no\":"+r.getNoCount()+",\"noAnswer\":"+r.getNoAnswerCount()
   +",\"attendees\":"+r.getAttendeeCount()
   +",\"school\":\""+escape(r.getSchool())+"\",\"notes\":\""+escape(r.getNotes())+"\"}";
 }
 /** Hand-built JSON, so every control character has to be dealt with explicitly. */
 private static String escape(String value){
  return Objects.toString(value,"").replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r").replace("\t","\\t");
 }
 private static String clean(String value){return value==null||value.isBlank()?null:value.trim();}
}
