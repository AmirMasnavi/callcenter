package com.elmosanatearia.callcenter.user;
import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.auth.AppPrincipal;
import com.elmosanatearia.callcenter.auth.AuthController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.Instant;
import java.util.*;

@RestController @RequestMapping("/api/v1/admin")
public class AdminController {
 private final UserRepository users;private final PasswordEncoder encoder;private final AuditRepository audits;
 public AdminController(UserRepository u,PasswordEncoder e,AuditRepository a){users=u;encoder=e;audits=a;}

 /**
  * @param grantedPermissions capabilities to add on top of the roles' defaults
  * @param revokedPermissions capabilities to withhold despite the roles granting them
  */
 public record UserRequest(@NotBlank @Size(max=80) String username,@NotBlank @Size(max=120) String displayName,
   @NotEmpty Set<Role> roles,Set<Permission> grantedPermissions,Set<Permission> revokedPermissions,
   Long supervisorId,boolean active,
   @Size(min=AuthController.MIN_PASSWORD_LENGTH,max=100) String temporaryPassword){}

 public record UserView(Long id,String username,String displayName,Set<Role> roles,
   Set<Permission> effectivePermissions,Set<Permission> rolePermissions,
   Set<Permission> grantedPermissions,Set<Permission> revokedPermissions,
   Long supervisorId,String supervisorName,boolean active,boolean mustChangePassword,boolean hasAvatar){
  static UserView of(AppUser u){
   Set<Permission> granted=u.getPermissionOverrides().stream().filter(UserPermission::isGranted).map(UserPermission::getPermission).collect(java.util.stream.Collectors.toCollection(()->EnumSet.noneOf(Permission.class)));
   Set<Permission> revoked=u.getPermissionOverrides().stream().filter(p->!p.isGranted()).map(UserPermission::getPermission).collect(java.util.stream.Collectors.toCollection(()->EnumSet.noneOf(Permission.class)));
   return new UserView(u.getId(),u.getUsername(),u.getDisplayName(),u.getRoles(),
     u.effectivePermissions(),Permission.defaultsFor(u.getRoles()),granted,revoked,
     u.getSupervisor()==null?null:u.getSupervisor().getId(),
     u.getSupervisor()==null?null:u.getSupervisor().getDisplayName(),
     u.isActive(),u.isMustChangePassword(),u.getAvatarBytes()!=null);}}

 /** Catalogue for the admin UI: every capability, its label, and which roles grant it by default. */
 public record PermissionInfo(Permission id,String label,Set<Role> defaultRoles){}
 @GetMapping("/permissions") public List<PermissionInfo> permissions(){
  return Arrays.stream(Permission.values()).map(p->new PermissionInfo(p,p.getLabel(),
    Arrays.stream(Role.values()).filter(r->Permission.defaultsFor(r).contains(p))
      .collect(java.util.stream.Collectors.toCollection(()->EnumSet.noneOf(Role.class))))).toList();
 }

 public record AuditView(Long id,String actor,String action,String entityType,String entityId,String metadata,Instant createdAt){}

 @GetMapping("/users") @Transactional(readOnly=true) public List<UserView> all(){return users.findAllByOrderByDisplayNameAsc().stream().map(UserView::of).toList();}

 @PostMapping("/users") @Transactional @ResponseStatus(HttpStatus.CREATED)
 public UserView create(@Valid @RequestBody UserRequest q,@AuthenticationPrincipal AppPrincipal p){
  if(users.existsByUsernameIgnoreCase(q.username()))throw new IllegalArgumentException("نام کاربری تکراری است");
  if(q.temporaryPassword()==null||q.temporaryPassword().isBlank())throw new IllegalArgumentException("رمز موقت الزامی است");
  AppUser u=new AppUser();apply(u,q);u.setPasswordHash(encoder.encode(q.temporaryPassword()));u.setMustChangePassword(true);
  u=users.save(u);audit(p,"CREATE_USER",u.getId(),u.getUsername());return UserView.of(u);}

 @PutMapping("/users/{id}") @Transactional
 public UserView update(@PathVariable Long id,@Valid @RequestBody UserRequest q,@AuthenticationPrincipal AppPrincipal p){
  AppUser u=users.findById(id).orElseThrow();
  guardLastAdmin(u,q);
  apply(u,q);
  if(q.temporaryPassword()!=null&&!q.temporaryPassword().isBlank()){u.setPasswordHash(encoder.encode(q.temporaryPassword()));u.setMustChangePassword(true);}
  u=users.save(u);audit(p,"UPDATE_USER",id,u.getUsername());return UserView.of(u);}

 @PostMapping(value="/users/{id}/avatar",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @Transactional
 public UserView avatar(@PathVariable Long id,@RequestPart("file") MultipartFile file,@AuthenticationPrincipal AppPrincipal p)throws java.io.IOException{
  AvatarController.validate(file);
  AppUser u=users.findById(id).orElseThrow();u.setAvatarBytes(file.getBytes());u.setAvatarContentType(file.getContentType());
  audit(p,"UPDATE_AVATAR",id,u.getUsername());return UserView.of(users.save(u));
 }

 @GetMapping("/audit") @Transactional(readOnly=true) public List<AuditView> audit(){
  return audits.newest().stream().limit(500).map(a->new AuditView(a.getId(),a.getActor()==null?"سیستم":a.getActor().getDisplayName(),a.getAction(),a.getEntityType(),a.getEntityId(),a.getMetadata(),a.getCreatedAt())).toList();}

 /** Stops an admin from demoting or deactivating the last remaining active admin — including themselves. */
 private void guardLastAdmin(AppUser existing,UserRequest q){
  boolean wasAdmin=existing.hasRole(Role.ADMIN)&&existing.isActive();
  boolean staysAdmin=q.roles().contains(Role.ADMIN)&&q.active();
  if(wasAdmin&&!staysAdmin&&users.countActiveByRoleExcluding(Role.ADMIN,existing.getId())==0)
   throw new IllegalArgumentException("حداقل یک مدیر سامانه فعال باید باقی بماند");
 }

 private void apply(AppUser u,UserRequest q){
  u.setUsername(q.username().trim());u.setDisplayName(q.displayName().trim());
  u.setRoles(q.roles());u.setActive(q.active());
  applyPermissionOverrides(u,q);
  // A supervisor is only meaningful for someone who files reports.
  if(!q.roles().contains(Role.AGENT)){u.setSupervisor(null);return;}
  if(q.supervisorId()==null){u.setSupervisor(null);return;}
  if(q.supervisorId().equals(u.getId()))throw new IllegalArgumentException("کاربر نمی‌تواند ناظر خودش باشد");
  AppUser supervisor=users.findById(q.supervisorId()).orElseThrow(()->new IllegalArgumentException("ناظر انتخاب‌شده یافت نشد"));
  if(!supervisor.hasRole(Role.SUPERVISOR))throw new IllegalArgumentException("کاربر انتخاب‌شده نقش ناظر ندارد");
  u.setSupervisor(supervisor);
 }

 /**
  * Only stores real exceptions. A "grant" of something the roles already give, or a
  * "revoke" of something they never gave, is dropped — otherwise the override would
  * linger and silently change meaning the next time the user's roles are edited.
  */
 private void applyPermissionOverrides(AppUser u,UserRequest q){
  Set<Permission> fromRoles=Permission.defaultsFor(q.roles());
  Set<Permission> granted=q.grantedPermissions()==null?Set.of():q.grantedPermissions();
  Set<Permission> revoked=q.revokedPermissions()==null?Set.of():q.revokedPermissions();
  Set<UserPermission> overrides=new LinkedHashSet<>();
  granted.stream().filter(p->!fromRoles.contains(p)).forEach(p->overrides.add(new UserPermission(p,true)));
  revoked.stream().filter(fromRoles::contains).forEach(p->overrides.add(new UserPermission(p,false)));
  u.setPermissionOverrides(overrides);
 }

 private void audit(AppPrincipal p,String action,Long id,String meta){audits.save(new AuditEvent(users.findById(p.id()).orElseThrow(),action,"AppUser",id.toString(),meta));}
}
