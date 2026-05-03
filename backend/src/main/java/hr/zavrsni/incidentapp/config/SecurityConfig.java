package hr.zavrsni.incidentapp.config;

import hr.zavrsni.incidentapp.security.JwtAuthFilter;
import hr.zavrsni.incidentapp.security.RateLimitFilter;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Central Spring Security configuration. Here we:
 *   - declare which endpoints are public vs authenticated vs role-gated
 *   - say "we're stateless" (no HTTP sessions — JWT-only)
 *   - plug in our JwtAuthFilter BEFORE the username/password filter
 *   - expose a BCryptPasswordEncoder bean (used to hash passwords on register)
 *
 * @EnableMethodSecurity turns on @PreAuthorize on controller methods.
 */
@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(AppProperties.class)
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitFilter rateLimitFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, RateLimitFilter rateLimitFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.rateLimitFilter = rateLimitFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // CSRF protection is meaningful for cookie-based sessions; with JWT in
            // an Authorization header it isn't, so we disable it.
            .csrf(csrf -> csrf.disable())
            // Stateless: Spring will not create HttpSession.
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Anything else -> must be authenticated. Role checks are done on
                // the controller methods with @PreAuthorize.
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            // Rate limiter sits BEFORE the JWT filter. /api/auth/** is permitAll,
            // so without this an attacker could call login as fast as the network
            // allows. Putting it early means rejected requests are cheap.
            .addFilterBefore(rateLimitFilter, JwtAuthFilter.class);

        return http.build();
    }

    /** BCrypt is the recommended password hashing algorithm for Spring Security. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Exposes AuthenticationManager so AuthController can call it for login. */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
