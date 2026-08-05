package com.elmosanatearia.callcenter.report;
import com.elmosanatearia.callcenter.auth.AppPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import static com.elmosanatearia.callcenter.report.ReportDtos.*;
@RestController @RequestMapping("/api/v1")
public class ReportController {
 private final ReportService service; public ReportController(ReportService s){service=s;}
 @GetMapping("/reports/mine") List<View> mine(@AuthenticationPrincipal AppPrincipal p){return service.mine(p);}
 @PostMapping("/reports/draft") View draft(@Valid @RequestBody SaveRequest q,@AuthenticationPrincipal AppPrincipal p){return service.saveDraft(p,q);}
 @PostMapping("/reports/{id}/submit") View submit(@PathVariable Long id,@RequestParam Long version,@AuthenticationPrincipal AppPrincipal p){return service.submit(id,version,p);}
 @GetMapping("/supervisor/reports/pending") List<View> pending(@AuthenticationPrincipal AppPrincipal p){return service.pending(p);}
 @GetMapping("/supervisor/reports") List<View> team(@AuthenticationPrincipal AppPrincipal p){return service.team(p);}
 @GetMapping("/supervisor/reports/{id}/revisions") List<RevisionView> revisions(@PathVariable Long id,@AuthenticationPrincipal AppPrincipal p){return service.revisions(id,p);}
 @PostMapping("/supervisor/reports/{id}/approve") View approve(@PathVariable Long id,@Valid @RequestBody ReviewRequest q,@AuthenticationPrincipal AppPrincipal p){return service.review(id,q,p);}

 // --- admin-only report powers (route prefix already restricted to ADMIN in SecurityConfig) ---
 @GetMapping("/admin/reports") List<View> allReports(@AuthenticationPrincipal AppPrincipal p){return service.team(p);}
 @GetMapping("/admin/reports/voided") List<View> voided(@AuthenticationPrincipal AppPrincipal p){return service.voided();}

 // Archiving sits under /supervisor because a supervisor tidies their own queue; the
 // service still scopes each report to what the caller may review.
 @GetMapping("/supervisor/reports/archived") List<View> archived(@AuthenticationPrincipal AppPrincipal p){return service.archived();}
 @PostMapping("/supervisor/reports/archive") java.util.Map<String,Integer> archive(@Valid @RequestBody ArchiveRequest q,@AuthenticationPrincipal AppPrincipal p){
  return java.util.Map.of("changed",service.archive(q.reportIds(),true,p));
 }
 @PostMapping("/supervisor/reports/unarchive") java.util.Map<String,Integer> unarchive(@Valid @RequestBody ArchiveRequest q,@AuthenticationPrincipal AppPrincipal p){
  return java.util.Map.of("changed",service.archive(q.reportIds(),false,p));
 }
 @PostMapping("/admin/reports/{id}/void") View voidReport(@PathVariable Long id,@Valid @RequestBody VoidRequest q,@AuthenticationPrincipal AppPrincipal p){return service.voidReport(id,q,p);}
 @PostMapping("/admin/reports/{id}/restore") View restore(@PathVariable Long id,@AuthenticationPrincipal AppPrincipal p){return service.restoreReport(id,p);}
 @PostMapping("/admin/reports/{id}/reopen") View reopen(@PathVariable Long id,@Valid @RequestBody ReopenRequest q,@AuthenticationPrincipal AppPrincipal p){return service.reopen(id,q,p);}
}
