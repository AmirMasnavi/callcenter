package com.elmosanatearia.callcenter.config;

import com.elmosanatearia.callcenter.auth.AppUserDetailsService;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.context.*;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean AuthenticationManager authenticationManager(AuthenticationConfiguration c) throws Exception {
        return c.getAuthenticationManager();
    }
    @Bean SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }
    @Bean SecurityFilterChain security(HttpSecurity http, AppUserDetailsService details) throws Exception {
        var csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrf.setCookieName("XSRF-TOKEN");
        var csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName("_csrf");
        http.userDetailsService(details)
            .securityContext(c -> c.securityContextRepository(securityContextRepository()))
            .csrf(c -> c.csrfTokenRepository(csrf)
                .csrfTokenRequestHandler(csrfHandler)
                .ignoringRequestMatchers("/api/v1/auth/login"))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health/**", "/v3/api-docs/**", "/api-docs/**", "/api/v1/auth/login", "/api/v1/auth/csrf").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/supervisor/**").hasAnyRole("SUPERVISOR", "ADMIN")
                .requestMatchers("/api/v1/dashboard/**", "/api/v1/exports/**").hasAnyRole("MANAGER", "ADMIN")
                .anyRequest().authenticated())
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req,res,ex) -> res.sendError(HttpStatus.UNAUTHORIZED.value()))
                .accessDeniedHandler((req,res,ex) -> res.sendError(HttpStatus.FORBIDDEN.value())))
            .logout(l -> l.disable());
        return http.build();
    }
}
