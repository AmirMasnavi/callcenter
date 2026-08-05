package com.elmosanatearia.callcenter.attendance;

import com.elmosanatearia.callcenter.auth.AppPrincipal;
import jakarta.validation.constraints.Size;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.io.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/attendance")
public class AttendanceController {
    private final AttendanceService service;
    public AttendanceController(AttendanceService service) { this.service = service; }

    /** {@code at} is optional — omitted means "now", supplied means the desk adjusted it. */
    public record ClockRequest(Instant at, @Size(max = 300) String note) {}
    public record AdjustRequest(Instant entryAt, Instant exitAt, @Size(max = 300) String note) {}

    // --- front desk (RECORD_ATTENDANCE) ---

    @GetMapping("/today")
    public List<AttendanceService.StaffState> today() { return service.today(); }

    @PostMapping("/{userId}/in")
    public AttendanceService.EntryView clockIn(@PathVariable Long userId,
                                               @RequestBody(required = false) ClockRequest body,
                                               @AuthenticationPrincipal AppPrincipal actor) {
        return service.clockIn(userId, body == null ? null : body.at(), actor);
    }

    /** Backdated shift, for arrivals nobody was there to record. */
    @PostMapping("/{userId}/manual")
    public AttendanceService.EntryView manual(@PathVariable Long userId, @RequestBody AdjustRequest body,
                                              @AuthenticationPrincipal AppPrincipal actor) {
        return service.recordManual(userId, body.entryAt(), body.exitAt(), body.note(), actor);
    }

    /** Shifts for one person on one day, so the desk can correct a day other than today. */
    @GetMapping("/{userId}/entries")
    public List<AttendanceService.EntryView> entries(@PathVariable Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.entriesFor(userId, date, date);
    }

    @PostMapping("/entries/{entryId}/out")
    public AttendanceService.EntryView clockOut(@PathVariable Long entryId,
                                                @RequestBody(required = false) ClockRequest body,
                                                @AuthenticationPrincipal AppPrincipal actor) {
        return service.clockOut(entryId, body == null ? null : body.at(), actor);
    }

    @PutMapping("/entries/{entryId}")
    public AttendanceService.EntryView adjust(@PathVariable Long entryId, @RequestBody AdjustRequest body,
                                              @AuthenticationPrincipal AppPrincipal actor) {
        return service.adjust(entryId, body.entryAt(), body.exitAt(), body.note(), actor);
    }

    @DeleteMapping("/entries/{entryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long entryId, @AuthenticationPrincipal AppPrincipal actor) {
        service.delete(entryId, actor);
    }

    // --- payroll reporting (VIEW_ATTENDANCE) ---

    /**
     * The date range covering the last {@code days} *working* days.
     *
     * <p>The presets mean expected days, not calendar days — "۳۰ روز" is a pay period of
     * thirty days someone was due in, and counting Fridays into it would quietly lower the
     * target. The client asks the server so both agree on where the weekend falls.
     */
    @GetMapping("/window")
    public Map<String, String> window(@RequestParam int days) {
        LocalDate today = LocalDate.now(AttendanceService.ZONE);
        return Map.of("from", AttendanceService.startOfLastWorkingDays(today, days).toString(),
                      "to", today.toString());
    }

    @GetMapping("/report")
    public List<AttendanceService.StaffSummary> report(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.report(from, to);
    }

    /** Every person's sheet at once — what the printable form needs, in one round trip. */
    @GetMapping("/report/details")
    public List<AttendanceService.StaffDetail> details(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.details(from, to);
    }

    @GetMapping("/report/{userId}")
    public AttendanceService.StaffDetail detail(@PathVariable Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.detail(userId, from, to);
    }

    /**
     * Two sheets: a summary per person, and the day-by-day detail that mirrors the paper
     * timesheet — the same columns someone is used to signing.
     */
    @GetMapping(value = "/report.xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> excel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long userId) throws IOException {

        // One pass for both sheets — asking per person re-derived the whole report each time.
        // `userId` narrows it to one person without changing the shape of the workbook.
        var sheets = service.details(from, to).stream()
                .filter(d -> userId == null || d.summary().userId().equals(userId))
                .toList();
        var summaries = sheets.stream().map(AttendanceService.StaffDetail::summary).toList();
        DateTimeFormatter time = DateTimeFormatter.ofPattern("HH:mm").withZone(AttendanceService.ZONE);

        try (var wb = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var bold = wb.createCellStyle();
            var boldFont = wb.createFont(); boldFont.setBold(true); bold.setFont(boldFont);

            var sheet = wb.createSheet("خلاصه ساعات");
            sheet.setRightToLeft(true);
            String[] headers = {"پرسنل", "ساعات کارکرد", "روزهای حضور", "روزهای کاری بازه",
                                "روزهای غیبت", "تعداد شیفت", "سقف بازه (ساعت)", "درصد تحقق",
                                "گزارش", "تماس", "OK", "حاضرین", "درصد موفقیت"};
            var head = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) { var c = head.createCell(i); c.setCellValue(headers[i]); c.setCellStyle(bold); }

            int n = 1;
            for (var s : summaries) {
                var row = sheet.createRow(n++);
                row.createCell(0).setCellValue(s.displayName());
                // Hours as a decimal so Excel can sum the column; minutes stay exact upstream.
                row.createCell(1).setCellValue(Math.round(s.workedMinutes() / 60d * 100) / 100d);
                row.createCell(2).setCellValue(s.daysPresent());
                row.createCell(3).setCellValue(s.expectedDays());
                row.createCell(4).setCellValue(s.daysShort());
                row.createCell(5).setCellValue(s.shifts());
                row.createCell(6).setCellValue(Math.round(s.targetMinutes() / 60d * 100) / 100d);
                row.createCell(7).setCellValue(Math.round(s.targetPercent() * 10) / 10d);
                row.createCell(8).setCellValue(s.reports());
                row.createCell(9).setCellValue(s.contacted());
                row.createCell(10).setCellValue(s.ok());
                row.createCell(11).setCellValue(s.attendees());
                row.createCell(12).setCellValue(Math.round(s.successRate() * 10) / 10d);
            }
            for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);

            // Detail sheet, laid out like the paper form.
            var detail = wb.createSheet("جزئیات روزانه");
            detail.setRightToLeft(true);
            String[] dh = {"پرسنل", "تاریخ", "ساعت ورود", "ساعت خروج", "مدت (ساعت)", "توضیحات"};
            var dhead = detail.createRow(0);
            for (int i = 0; i < dh.length; i++) { var c = dhead.createCell(i); c.setCellValue(dh[i]); c.setCellStyle(bold); }

            int d = 1;
            for (var sheetFor : sheets) {
                for (var day : sheetFor.days()) {
                    for (var shift : day.shifts()) {
                        var row = detail.createRow(d++);
                        row.createCell(0).setCellValue(sheetFor.summary().displayName());
                        row.createCell(1).setCellValue(day.date().toString());
                        row.createCell(2).setCellValue(time.format(shift.entryAt()));
                        row.createCell(3).setCellValue(shift.exitAt() == null ? "—" : time.format(shift.exitAt()));
                        row.createCell(4).setCellValue(Math.round(shift.workedMinutes() / 60d * 100) / 100d);
                        row.createCell(5).setCellValue(shift.note() == null ? "" : shift.note());
                    }
                }
            }
            for (int i = 0; i < dh.length; i++) detail.autoSizeColumn(i);

            wb.write(out);
            // The filename says what is inside, so a folder of exports stays readable.
            String name = "attendance-" + from + "-" + to + (userId == null ? "" : "-" + userId) + ".xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + name)
                    .body(out.toByteArray());
        }
    }
}
