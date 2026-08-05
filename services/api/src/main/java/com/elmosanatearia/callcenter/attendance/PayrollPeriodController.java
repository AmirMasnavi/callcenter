package com.elmosanatearia.callcenter.attendance;

import com.elmosanatearia.callcenter.auth.AppPrincipal;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/payroll/periods")
public class PayrollPeriodController {

    private final PayrollPeriodService service;
    public PayrollPeriodController(PayrollPeriodService service) { this.service = service; }

    public record CloseRequest(@DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endsOn,
                               @Size(max = 300) String note) {}

    @GetMapping
    public List<PayrollPeriodService.PeriodView> list() { return service.list(); }

    @GetMapping("/{id}/lines")
    public List<PayrollPeriodService.LineView> lines(@PathVariable Long id) { return service.lines(id); }

    /** Settles the open period and opens the next. Requires PERM_CLOSE_PAYROLL_PERIOD. */
    @PostMapping("/close")
    public PayrollPeriodService.PeriodView close(@RequestBody(required = false) CloseRequest body,
                                                 @AuthenticationPrincipal AppPrincipal actor) {
        return service.close(body == null ? null : body.endsOn(),
                             body == null ? null : body.note(), actor);
    }
}
