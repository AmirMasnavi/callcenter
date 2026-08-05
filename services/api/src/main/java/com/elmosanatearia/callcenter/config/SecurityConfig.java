package com.elmosanatearia.callcenter.config;

import com.elmosanatearia.callcenter.auth.AppUserDetailsService;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.*;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.Customizer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.context.*;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean AuthenticationManager authenticationManager(AuthenticationConfiguration c) throws Exception {
        return c.getAuthenticationManager();
    }
    @Bean SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }
    @Bean CorsConfigurationSource corsConfigurationSource(@Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173}") String allowedOrigins) {
        var configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.stream(allowedOrigins.split(",")).map(String::trim).filter(origin -> !origin.isEmpty()).toList());
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Content-Type", "X-XSRF-TOKEN"));
        configuration.setAllowCredentials(true);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
    @Bean SecurityFilterChain security(HttpSecurity http, AppUserDetailsService details) throws Exception {
        var csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrf.setCookieName("XSRF-TOKEN");
        var csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName("_csrf");
        http.userDetailsService(details)
            .cors(Customizer.withDefaults())
            .securityContext(c -> c.securityContextRepository(securityContextRepository()))
            .csrf(c -> c.csrfTokenRepository(csrf)
                .csrfTokenRequestHandler(csrfHandler)
                .ignoringRequestMatchers("/api/v1/auth/login"))
            // Gated on capabilities, not roles. A role is just a bundle of these by default,
            // so an admin can hand out one ability (say, exports) without promoting anyone.
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health/**", "/v3/api-docs/**", "/api-docs/**", "/api/v1/auth/login", "/api/v1/auth/csrf").permitAll()
                .requestMatchers("/api/v1/auth/**").authenticated()
                .requestMatchers("/api/v1/admin/users/**").hasAuthority("PERM_MANAGE_USERS")
                .requestMatchers("/api/v1/admin/audit").hasAuthority("PERM_VIEW_AUDIT")
                .requestMatchers("/api/v1/admin/impersonate/**").hasAuthority("PERM_IMPERSONATE")
                .requestMatchers("/api/v1/admin/reports/*/void", "/api/v1/admin/reports/*/restore").hasAuthority("PERM_VOID_REPORT")
                .requestMatchers("/api/v1/admin/reports/*/reopen").hasAuthority("PERM_REOPEN_REPORT")
                .requestMatchers("/api/v1/admin/reports/**").hasAuthority("PERM_VIEW_ALL_REPORTS")
                .requestMatchers("/api/v1/supervisor/**").hasAuthority("PERM_REVIEW_REPORTS")
                .requestMatchers("/api/v1/dashboard/**").hasAuthority("PERM_VIEW_DASHBOARD")
                .requestMatchers("/api/v1/exports/**").hasAuthority("PERM_EXPORT_DATA")
                .requestMatchers("/api/v1/reports/**").hasAuthority("PERM_SUBMIT_REPORTS")
                .anyRequest().authenticated())
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req,res,ex) -> res.sendError(HttpStatus.UNAUTHORIZED.value()))
                .accessDeniedHandler((req,res,ex) -> res.sendError(HttpStatus.FORBIDDEN.value())))
            .logout(l -> l.disable());
        return http.build();
    }
}
