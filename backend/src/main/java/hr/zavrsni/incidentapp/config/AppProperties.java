package hr.zavrsni.incidentapp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Type-safe wrapper around the "app.*" block in application.yml. Instead of
 * sprinkling @Value("${app.jwt.secret}") everywhere, we inject this record
 * and access appProperties.jwt().secret(). Catches typos at startup, not in prod.
 *
 * Registered as a bean via @EnableConfigurationProperties in SecurityConfig.
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Admin admin) {

    /** Settings for JSON Web Token signing. */
    public record Jwt(String secret, long expirationMs) {}

    /** Default admin account seeded on first startup. */
    public record Admin(String username, String password) {}
}
