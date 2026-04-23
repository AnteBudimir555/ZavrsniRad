package hr.zavrsni.incidentapp.user;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Enum listing the roles a user can have. Spring Security expects role names to
 * be prefixed with "ROLE_" when performing hasRole() checks — we handle that
 * prefixing in AppUserDetailsService so the rest of the code stays clean.
 */
public enum Role {
    ADMIN,
    REPORTER
}
