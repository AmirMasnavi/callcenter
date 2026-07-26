package com.elmosanatearia.callcenter.dashboard;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

@RestController @RequestMapping("/api/v1/exports")
public class ExportController {
 private final DashboardService service; public ExportController(DashboardService s){service=s;}
 private DashboardService.Result data(LocalDate f,LocalDate t,DashboardService.Context c,Long s,Long a){return service.get(f,t,c,s,a);}
 @GetMapping(value="/reports.csv",produces="text/csv")
 ResponseEntity<byte[]> csv(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
  @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,@RequestParam(defaultValue="OPERATIONAL") DashboardService.Context context,
  @RequestParam(required=false) Long supervisorId,@RequestParam(required=false) Long agentId){
  StringBuilder b=new StringBuilder("\uFEFFاپراتور,تعداد گزارش,کل افراد,تماس‌گرفته,OK,شاید,NO,جواب نداد\n");
  data(from,to,context,supervisorId,agentId).agents().forEach(r->b.append(csv(r.agentName())).append(',').append(r.reports()).append(',').append(r.totalPeople()).append(',').append(r.contacted()).append(',').append(r.ok()).append(',').append(r.maybe()).append(',').append(r.no()).append(',').append(r.noAnswer()).append('\n'));
  return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=callcenter.csv").body(b.toString().getBytes(StandardCharsets.UTF_8));
 }
 @GetMapping(value="/reports.xlsx",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
 ResponseEntity<byte[]> xlsx(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
  @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,@RequestParam(defaultValue="OPERATIONAL") DashboardService.Context context,
  @RequestParam(required=false) Long supervisorId,@RequestParam(required=false) Long agentId) throws IOException{
  try(var wb=new XSSFWorkbook();var out=new ByteArrayOutputStream()){
   var sh=wb.createSheet("گزارش");sh.setRightToLeft(true);String[] h={"اپراتور","تعداد گزارش","کل افراد","تماس‌گرفته","OK","شاید","NO","جواب نداد"};
   var hr=sh.createRow(0);for(int i=0;i<h.length;i++)hr.createCell(i).setCellValue(h[i]);int n=1;
   for(var r:data(from,to,context,supervisorId,agentId).agents()){var row=sh.createRow(n++);row.createCell(0).setCellValue(r.agentName());double[] v={r.reports(),r.totalPeople(),r.contacted(),r.ok(),r.maybe(),r.no(),r.noAnswer()};for(int i=0;i<v.length;i++)row.createCell(i+1).setCellValue(v[i]);}
   for(int i=0;i<h.length;i++)sh.autoSizeColumn(i);wb.write(out);
   return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=callcenter.xlsx").body(out.toByteArray());
  }
 }
 private String csv(String s){return "\""+s.replace("\"","\"\"")+"\"";}
}
