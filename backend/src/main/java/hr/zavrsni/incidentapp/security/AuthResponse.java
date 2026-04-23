package hr.zavrsni.incidentapp.security;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * DTO returned on successful login/register: the signed JWT plus the user's
 * username and role (so the frontend can render role-specific UI without
 * decoding the token itself).
 */
public record AuthResponse(String token, String username, String role) {}
