package com.elmosanatearia.callcenter.auth;

import com.elmosanatearia.callcenter.user.UserRepository;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service
public class AppUserDetailsService implements UserDetailsService {
    private final UserRepository users;
    public AppUserDetailsService(UserRepository users) { this.users = users; }
    @Override public UserDetails loadUserByUsername(String username) {
        return users.findByUsernameIgnoreCase(username).map(AppPrincipal::from)
                .orElseThrow(() -> new UsernameNotFoundException("نام کاربری یا رمز عبور نادرست است"));
    }
}
