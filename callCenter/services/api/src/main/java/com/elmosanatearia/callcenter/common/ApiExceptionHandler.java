package com.elmosanatearia.callcenter.common;
import jakarta.persistence.OptimisticLockException;
import org.springframework.dao.*;
import org.springframework.http.*;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;
@RestControllerAdvice
public class ApiExceptionHandler {
 public record Problem(Instant timestamp,int status,String message,Map<String,String> fields){}
 @ExceptionHandler(MethodArgumentNotValidException.class)
 ResponseEntity<Problem> validation(MethodArgumentNotValidException ex){
  Map<String,String> fields=new LinkedHashMap<>();
  ex.getBindingResult().getFieldErrors().forEach(e->fields.put(e.getField(),e.getDefaultMessage()));
  return ResponseEntity.badRequest().body(new Problem(Instant.now(),400,"اطلاعات واردشده معتبر نیست",fields));
 }
 @ExceptionHandler({ObjectOptimisticLockingFailureException.class,OptimisticLockException.class})
 ResponseEntity<Problem> conflict(Exception ex){return ResponseEntity.status(409).body(new Problem(Instant.now(),409,"این اطلاعات هم‌زمان تغییر کرده است؛ صفحه را تازه کنید",Map.of()));}
 @ExceptionHandler(IllegalArgumentException.class)
 ResponseEntity<Problem> bad(IllegalArgumentException ex){return ResponseEntity.badRequest().body(new Problem(Instant.now(),400,ex.getMessage(),Map.of()));}
 @ExceptionHandler(IllegalStateException.class)
 ResponseEntity<Problem> state(IllegalStateException ex){return ResponseEntity.status(409).body(new Problem(Instant.now(),409,ex.getMessage(),Map.of()));}
 @ExceptionHandler(DataIntegrityViolationException.class)
 ResponseEntity<Problem> duplicate(DataIntegrityViolationException ex){return ResponseEntity.status(409).body(new Problem(Instant.now(),409,"گزارش این تاریخ قبلاً ثبت شده است",Map.of()));}
 @ExceptionHandler(SecurityException.class)
 ResponseEntity<Problem> forbidden(SecurityException ex){return ResponseEntity.status(403).body(new Problem(Instant.now(),403,ex.getMessage(),Map.of()));}
 @ExceptionHandler(AuthenticationException.class)
 ResponseEntity<Problem> unauthorized(AuthenticationException ex){return ResponseEntity.status(401).body(new Problem(Instant.now(),401,"نام کاربری یا رمز عبور نادرست است",Map.of()));}
}
