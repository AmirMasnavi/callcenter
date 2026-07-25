package com.elmosanatearia.callcenter.auth;
import org.springframework.stereotype.Component;
import java.time.*;
import java.util.concurrent.*;
@Component
public class LoginGuard {
 private record Attempt(int count,Instant since){}
 private final ConcurrentMap<String,Attempt> attempts=new ConcurrentHashMap<>();
 public void check(String key){Attempt a=attempts.get(key);if(a!=null&&a.count>=5&&a.since.plus(Duration.ofMinutes(15)).isAfter(Instant.now()))throw new IllegalStateException("تلاش‌های ورود بیش از حد است؛ ۱۵ دقیقه بعد دوباره امتحان کنید");if(a!=null&&a.since.plus(Duration.ofMinutes(15)).isBefore(Instant.now()))attempts.remove(key);}
 public void failed(String key){attempts.compute(key,(k,a)->a==null?new Attempt(1,Instant.now()):new Attempt(a.count+1,a.since));}
 public void success(String key){attempts.remove(key);}
}
