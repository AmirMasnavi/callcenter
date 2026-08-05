package com.elmosanatearia.callcenter.report;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class ReportRulesTest {
 @Test void validReportPasses(){DailyReport r=report(100,80,20,10,15,35);assertDoesNotThrow(()->ReportService.validate(r));}
 @Test void mismatchedOutcomesFail(){DailyReport r=report(100,80,20,10,15,34);assertThrows(IllegalArgumentException.class,()->ReportService.validate(r));}
 @Test void contactedCannotExceedTotal(){DailyReport r=report(10,11,11,0,0,0);assertThrows(IllegalArgumentException.class,()->ReportService.validate(r));}
 // --- attendance (تعداد حاضرین) ---
 @Test void attendanceIsOptional(){
  DailyReport r=report(100,80,20,10,15,35);
  r.setAttendeeCount(null);
  assertDoesNotThrow(()->ReportService.validate(r),"the class may not have run yet");
 }
 @Test void attendanceWithinTotalPasses(){
  DailyReport r=report(100,80,20,10,15,35);
  r.setAttendeeCount(18);
  assertDoesNotThrow(()->ReportService.validate(r));
 }
 @Test void attendanceCannotExceedTotalPeople(){
  DailyReport r=report(100,80,20,10,15,35);
  r.setAttendeeCount(101);
  assertThrows(IllegalArgumentException.class,()->ReportService.validate(r));
 }
 @Test void attendanceMayExceedPositiveAnswers(){
  // Someone who said "maybe" can still turn up, so this must not be rejected.
  DailyReport r=report(100,80,20,10,15,35);
  r.setAttendeeCount(30);
  assertDoesNotThrow(()->ReportService.validate(r));
 }
 @Test void attendanceRateIsShareOfPositiveAnswers(){
  DailyReport r=report(100,80,20,10,15,35);
  r.setAttendeeCount(10);
  assertEquals(50.0,r.attendanceRate(),0.001);
 }
 @Test void attendanceRateIsZeroWhenUnknown(){
  DailyReport r=report(100,80,20,10,15,35);
  r.setAttendeeCount(null);
  assertEquals(0.0,r.attendanceRate(),0.001);
 }

 private DailyReport report(int total,int contacted,int ok,int maybe,int no,int noAnswer){DailyReport r=new DailyReport();r.setTotalPeople(total);r.setContactedCount(contacted);r.setOkCount(ok);r.setMaybeCount(maybe);r.setNoCount(no);r.setNoAnswerCount(noAnswer);return r;}
}
