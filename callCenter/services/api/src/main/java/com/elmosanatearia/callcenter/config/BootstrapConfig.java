package com.elmosanatearia.callcenter.config;
import com.elmosanatearia.callcenter.user.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class BootstrapConfig {
 @Bean CommandLineRunner bootstrap(UserRepository users,PasswordEncoder encoder,
  @Value("${app.bootstrap.admin-username}") String username,@Value("${app.bootstrap.admin-password}") String password,
  @Value("${app.bootstrap.admin-name}") String name,
  @Value("${app.demo.users-enabled:false}") boolean demoEnabled,
  @Value("${app.demo.password}") String demoPassword){
  return args->{
   if(users.findByUsernameIgnoreCase(username).isEmpty()) create(users,encoder,username,name,Role.ADMIN,password,null);
   if(demoEnabled){
    AppUser supervisor=users.findByUsernameIgnoreCase("supervisor").orElseGet(()->create(users,encoder,"supervisor","ناظر نمونه",Role.SUPERVISOR,demoPassword,null));
    if(users.findByUsernameIgnoreCase("operator").isEmpty()) create(users,encoder,"operator","اپراتور نمونه",Role.AGENT,demoPassword,supervisor);
    if(users.findByUsernameIgnoreCase("manager").isEmpty()) create(users,encoder,"manager","مدیر نمونه",Role.MANAGER,demoPassword,null);
   }
  };
 }
 private static AppUser create(UserRepository users,PasswordEncoder encoder,String username,String name,Role role,String password,AppUser supervisor){
  AppUser u=new AppUser();u.setUsername(username);u.setDisplayName(name);u.setRole(role);u.setSupervisor(supervisor);
  u.setPasswordHash(encoder.encode(password));u.setMustChangePassword(true);return users.save(u);
 }
}
