package hr.zavrsni.incidentapp.security;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * DTO (Data Transfer Object) for login & register request bodies. A DTO is a
 * plain class that only carries data — no business logic. Keeping it separate
 * from the JPA @Entity means the API contract and the database schema can
 * evolve independently.
 */
public record AuthRequest(
        @NotBlank @Size(min = 3, max = 64) String username,
        @NotBlank @Size(min = 8, max = 128) String password
) {}
