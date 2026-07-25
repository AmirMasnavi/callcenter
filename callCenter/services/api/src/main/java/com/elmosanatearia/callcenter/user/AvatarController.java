package com.elmosanatearia.callcenter.user;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/users")
public class AvatarController{
 private final UserRepository users;public AvatarController(UserRepository users){this.users=users;}
 @GetMapping("/{id}/avatar") ResponseEntity<byte[]> avatar(@PathVariable Long id){
  AppUser u=users.findById(id).orElseThrow();if(u.getAvatarBytes()==null)return ResponseEntity.notFound().build();
  return ResponseEntity.ok().contentType(MediaType.parseMediaType(u.getAvatarContentType())).cacheControl(CacheControl.noCache()).body(u.getAvatarBytes());
 }
}
