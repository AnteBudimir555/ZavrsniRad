package hr.zavrsni.incidentapp;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * The most basic regression test there is: it boots the WHOLE Spring application
 * context (every @Component, @Service, @RestController, the JPA/Hibernate layer,
 * Flyway migrations, the security filter chain) against a real PostgreSQL
 * database and fails if anything refuses to wire up.
 *
 * For a framework MAJOR-version upgrade (Spring Boot 3 -> 4) this single test is
 * worth a lot: most breaking changes (removed beans, renamed properties,
 * incompatible auto-configuration, Hibernate/Flyway version clashes) surface
 * here as a context-load failure long before any HTTP call is made.
 *
 * It needs a database — see scripts/run-backend-tests.ps1, which starts a
 * throwaway Postgres container and points SPRING_DATASOURCE_URL at it.
 */
@SpringBootTest
class IncidentAppApplicationTests {

    @Test
    void contextLoads() {
        // Intentionally empty. If the application context fails to start,
        // this test fails — that's the assertion.
    }
}
