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
}
