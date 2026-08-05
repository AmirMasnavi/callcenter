package com.elmosanatearia.callcenter.dashboard;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/**
 * Excel/CSV exports. Both carry two sheets' worth of information: performance per operator,
 * and the same outcomes per school — managers compare both, and attendance is the figure
 * that says whether the calls actually put people in a classroom.
 */
@RestController @RequestMapping("/api/v1/exports")
public class ExportController {
 private static final String[] AGENT_HEADERS={"اپراتور","تعداد گزارش","کل افراد","تماس‌گرفته","OK","شاید","NO","جواب نداد","حاضرین","درصد حضور"};
 private static final String[] SCHOOL_HEADERS={"مدرسه","تعداد گزارش","کل افراد","تماس‌گرفته","OK","حاضرین","درصد حضور"};

 private final DashboardService service; public ExportController(DashboardService s){service=s;}
 private DashboardService.Result data(LocalDate f,LocalDate t,DashboardService.Context c,Long s,Long a){return service.get(f,t,c,s,a);}

 @GetMapping(value="/reports.csv",produces="text/csv")
 ResponseEntity<byte[]> csv(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
  @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,@RequestParam(defaultValue="OPERATIONAL") DashboardService.Context context,
  @RequestParam(required=false) Long supervisorId,@RequestParam(required=false) Long agentId){
  var result=data(from,to,context,supervisorId,agentId);
  // The BOM keeps Excel from mangling the Persian headers when it opens the file.
  StringBuilder b=new StringBuilder("﻿").append(String.join(",",AGENT_HEADERS)).append('\n');
  result.agents().forEach(r->b.append(csv(r.agentName())).append(',').append(r.reports()).append(',').append(r.totalPeople())
    .append(',').append(r.contacted()).append(',').append(r.ok()).append(',').append(r.maybe()).append(',').append(r.no())
    .append(',').append(r.noAnswer()).append(',').append(r.attendees()).append(',').append(rate(r.showUpRate())).append('\n'));
  b.append('\n').append(String.join(",",SCHOOL_HEADERS)).append('\n');
  result.schools().forEach(r->b.append(csv(r.school())).append(',').append(r.reports()).append(',').append(r.totalPeople())
    .append(',').append(r.contacted()).append(',').append(r.ok()).append(',').append(r.attendees())
    .append(',').append(rate(r.showUpRate())).append('\n'));
  return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=callcenter.csv")
    .body(b.toString().getBytes(StandardCharsets.UTF_8));
 }

 @GetMapping(value="/reports.xlsx",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
 ResponseEntity<byte[]> xlsx(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
  @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,@RequestParam(defaultValue="OPERATIONAL") DashboardService.Context context,
  @RequestParam(required=false) Long supervisorId,@RequestParam(required=false) Long agentId) throws IOException{
  var result=data(from,to,context,supervisorId,agentId);
  try(var wb=new XSSFWorkbook();var out=new ByteArrayOutputStream()){
   var agents=wb.createSheet("عملکرد اپراتورها");agents.setRightToLeft(true);
   header(agents,AGENT_HEADERS);
   int n=1;
   for(var r:result.agents()){
    var row=agents.createRow(n++);row.createCell(0).setCellValue(r.agentName());
    double[] v={r.reports(),r.totalPeople(),r.contacted(),r.ok(),r.maybe(),r.no(),r.noAnswer(),r.attendees(),round(r.showUpRate())};
    for(int i=0;i<v.length;i++)row.createCell(i+1).setCellValue(v[i]);
   }
   for(int i=0;i<AGENT_HEADERS.length;i++)agents.autoSizeColumn(i);

   var schools=wb.createSheet("عملکرد مدارس");schools.setRightToLeft(true);
   header(schools,SCHOOL_HEADERS);
   n=1;
   for(var r:result.schools()){
    var row=schools.createRow(n++);row.createCell(0).setCellValue(r.school());
    double[] v={r.reports(),r.totalPeople(),r.contacted(),r.ok(),r.attendees(),round(r.showUpRate())};
    for(int i=0;i<v.length;i++)row.createCell(i+1).setCellValue(v[i]);
   }
   for(int i=0;i<SCHOOL_HEADERS.length;i++)schools.autoSizeColumn(i);

   wb.write(out);
   return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=callcenter.xlsx").body(out.toByteArray());
  }
 }

 private void header(org.apache.poi.ss.usermodel.Sheet sheet,String[] headers){
  var row=sheet.createRow(0);
  for(int i=0;i<headers.length;i++)row.createCell(i).setCellValue(headers[i]);
 }
 private static double round(double v){return Math.round(v*10)/10d;}
 private static String rate(double v){return String.valueOf(round(v));}
 private String csv(String s){return "\""+String.valueOf(s).replace("\"","\"\"")+"\"";}
}
