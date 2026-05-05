package hr.zavrsni.incidentapp.user;

import java.time.Instant;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Response DTO for user-management endpoints. We never serialise the User
 * entity directly — that would leak the BCrypt password hash and expose us
 * to lazy-loading surprises during JSON conversion.
 */
public record UserDto(
        Long id,
        String username,
        String role,
        boolean active,
        Instant createdAt
) {
    public static UserDto from(User user) {
        return new UserDto(
                user.getId(),
                user.getUsername(),
                user.getRole().name(),
                user.isActive(),
                user.getCreatedAt()
        );
    }
}
