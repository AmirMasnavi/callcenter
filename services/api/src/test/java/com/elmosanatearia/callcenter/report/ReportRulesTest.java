package com.elmosanatearia.callcenter.report;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class ReportRulesTest {
 @Test void validReportPasses(){DailyReport r=report(100,80,20,10,15,35);assertDoesNotThrow(()->ReportService.validate(r));}
 @Test void mismatchedOutcomesFail(){DailyReport r=report(100,80,20,10,15,34);assertThrows(IllegalArgumentException.class,()->ReportService.validate(r));}
 @Test void contactedCannotExceedTotal(){DailyReport r=report(10,11,11,0,0,0);assertThrows(IllegalArgumentException.class,()->ReportService.validate(r));}
 private DailyReport report(int total,int contacted,int ok,int maybe,int no,int noAnswer){DailyReport r=new DailyReport();r.setTotalPeople(total);r.setContactedCount(contacted);r.setOkCount(ok);r.setMaybeCount(maybe);r.setNoCount(no);r.setNoAnswerCount(noAnswer);return r;}
}
