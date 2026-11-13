package com.festflow.backend.config;

import com.festflow.backend.security.JwtAuthenticationFilter;
import com.festflow.backend.security.OpsKeyAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final OpsKeyAuthenticationFilter opsKeyAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, OpsKeyAuthenticationFilter opsKeyAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.opsKeyAuthenticationFilter = opsKeyAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/ops/master/**").hasRole("OPS_MASTER")
                        // 스태프 화면: 공용 부스 키(OPS_CREW) · 부스별 키 · 마스터 키 모두 연다.
                        .requestMatchers("/api/ops/crew", "/api/ops/crew/**").hasAnyRole("OPS_MASTER", "OPS_BOOTH", "OPS_CREW")
                        .requestMatchers("/api/ops/booth/**").hasAnyRole("OPS_MASTER", "OPS_BOOTH")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/auth/**", "/api/**", "/uploads/**").permitAll()
                        .anyRequest().permitAll()
                )
                .addFilterBefore(opsKeyAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
