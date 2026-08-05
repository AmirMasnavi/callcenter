package com.elmosanatearia.callcenter.config;
import com.elmosanatearia.callcenter.user.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Set;

@Configuration
public class BootstrapConfig {
 @Bean CommandLineRunner bootstrap(UserRepository users,PasswordEncoder encoder,
  @Value("${app.bootstrap.admin-username}") String username,@Value("${app.bootstrap.admin-password}") String password,
  @Value("${app.bootstrap.admin-name}") String name,
  @Value("${app.demo.users-enabled:false}") boolean demoEnabled,
  @Value("${app.demo.password}") String demoPassword){
  return args->{
   if(users.findByUsernameIgnoreCase(username).isEmpty()) create(users,encoder,username,name,Set.of(Role.ADMIN),password,null);
   if(demoEnabled){
    AppUser supervisor=users.findByUsernameIgnoreCase("supervisor").orElseGet(()->create(users,encoder,"supervisor","ناظر نمونه",Set.of(Role.SUPERVISOR),demoPassword,null));
    if(users.findByUsernameIgnoreCase("operator").isEmpty()) create(users,encoder,"operator","اپراتور نمونه",Set.of(Role.AGENT),demoPassword,supervisor);
    if(users.findByUsernameIgnoreCase("manager").isEmpty()) create(users,encoder,"manager","مدیر نمونه",Set.of(Role.MANAGER),demoPassword,null);
    // Demonstrates the multi-role model: reviews their own team *and* sees company-wide analytics.
    if(users.findByUsernameIgnoreCase("lead").isEmpty()) create(users,encoder,"lead","سرپرست نمونه",Set.of(Role.SUPERVISOR,Role.MANAGER),demoPassword,null);
    if(users.findByUsernameIgnoreCase("office").isEmpty()) create(users,encoder,"office","مسئول دفتر",Set.of(Role.OFFICE_MANAGER),demoPassword,null);
    if(users.findByUsernameIgnoreCase("payroll").isEmpty()) create(users,encoder,"payroll","مسئول حقوق و دستمزد",Set.of(Role.PAYROLL),demoPassword,null);
    // A single operator makes the attendance and comparison screens meaningless — several
    // are needed before "who worked how much" is a question worth asking.
    String[][] team={{"operator2","سارا محمدی"},{"operator3","رضا کریمی"},{"operator4","مینا رضایی"},{"operator5","حسین نوری"}};
    for(String[] member:team)
     if(users.findByUsernameIgnoreCase(member[0]).isEmpty())
      create(users,encoder,member[0],member[1],Set.of(Role.AGENT),demoPassword,supervisor);
   }
  };
 }
 private static AppUser create(UserRepository users,PasswordEncoder encoder,String username,String name,Set<Role> roles,String password,AppUser supervisor){
  AppUser u=new AppUser();u.setUsername(username);u.setDisplayName(name);u.setRoles(roles);u.setSupervisor(supervisor);
  u.setPasswordHash(encoder.encode(password));u.setMustChangePassword(true);return users.save(u);
 }
}
