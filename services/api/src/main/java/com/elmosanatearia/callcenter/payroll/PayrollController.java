package com.elmosanatearia.callcenter.payroll;

import com.elmosanatearia.callcenter.auth.AppPrincipal;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/payroll")
public class PayrollController {

    private final PayrollService service;
    public PayrollController(PayrollService service) { this.service = service; }

    public record CloseRequest(WorkPeriod.Settlement settlement, @Size(max = 300) String note) {}
    public record TargetDaysRequest(int targetDays) {}
    public record DailyMinutesRequest(Integer dailyTargetMinutes) {}

    /** Every operator's current cycle: how far through it they are and whether it is due. */
    @GetMapping("/board")
    public List<PayrollService.PeriodStatus> board() { return service.board(); }

    /** One person's cycles, newest first — the current one plus the settled archive. */
    @GetMapping("/employees/{userId}/periods")
    public List<PayrollService.PeriodStatus> history(@PathVariable Long userId) {
        return service.historyFor(userId);
    }

    /**
     * Operators laid side by side over the same stretch of their OWN cycles.
     *
     * @param days      how many of each person's first attendance days to include; 0 = whole cycle
     * @param periodSeq omit for the current cycle, or name a numbered past one
     * @param userIds   omit to include everyone
     */
    @GetMapping("/compare")
    public List<PayrollService.Slice> compare(
            @RequestParam(defaultValue = "0") int days,
            @RequestParam(required = false) Integer periodSeq,
            @RequestParam(required = false) List<Long> userIds) {
        return service.compare(days, periodSeq, userIds);
    }

    /** Settles the cycle and opens the next. Requires PERM_CLOSE_PAYROLL_PERIOD. */
    @PostMapping("/employees/{userId}/close")
    public PayrollService.PeriodStatus close(@PathVariable Long userId, @RequestBody CloseRequest body,
                                             @AuthenticationPrincipal AppPrincipal actor) {
        return service.close(userId, body.settlement(), body.note(), actor);
    }

    @PutMapping("/employees/{userId}/target-days")
    public PayrollService.PeriodStatus targetDays(@PathVariable Long userId,
                                                  @RequestBody TargetDaysRequest body,
                                                  @AuthenticationPrincipal AppPrincipal actor) {
        return service.setTargetDays(userId, body.targetDays(), actor);
    }

    @PutMapping("/employees/{userId}/daily-minutes")
    public PayrollService.PeriodStatus dailyMinutes(@PathVariable Long userId,
                                                    @RequestBody DailyMinutesRequest body,
                                                    @AuthenticationPrincipal AppPrincipal actor) {
        return service.setDailyMinutes(userId, body.dailyTargetMinutes(), actor);
    }
}
