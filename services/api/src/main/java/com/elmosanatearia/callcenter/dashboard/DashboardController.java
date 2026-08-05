package com.elmosanatearia.callcenter.dashboard;
import com.elmosanatearia.callcenter.user.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
@RestController @RequestMapping("/api/v1/dashboard")
public class DashboardController {
 private final DashboardService service;private final UserRepository users;public DashboardController(DashboardService s,UserRepository u){service=s;users=u;}
 public record FilterOption(Long id,String name,Long supervisorId){}
 public record Filters(java.util.List<FilterOption> supervisors,java.util.List<FilterOption> agents){}
 @GetMapping("/filters") public Filters filters(){
  var supervisors=users.findActiveByRole(Role.SUPERVISOR).stream().map(u->new FilterOption(u.getId(),u.getDisplayName(),null)).toList();
  var agents=users.findActiveByRole(Role.AGENT).stream().map(u->new FilterOption(u.getId(),u.getDisplayName(),u.getSupervisor()==null?null:u.getSupervisor().getId())).toList();
  return new Filters(supervisors,agents);
 }
 @GetMapping public DashboardService.Result get(
  @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
  @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
  @RequestParam(defaultValue="OPERATIONAL") DashboardService.Context context,
  @RequestParam(required=false) Long supervisorId,@RequestParam(required=false) Long agentId){
  return service.get(from,to,context,supervisorId,agentId);
 }
}
