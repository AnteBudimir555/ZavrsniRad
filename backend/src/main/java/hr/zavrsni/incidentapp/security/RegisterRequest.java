package hr.zavrsni.incidentapp.security;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Registration-only DTO. Login doesn't need an email, so we keep it out of
 * AuthRequest and use a dedicated record here. The @Email constraint validates
 * the format; nullability is enforced in AuthController (returns 400 if absent).
 */
public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 64) String username,
        @NotBlank @Size(min = 8, max = 128) String password,
        @NotBlank @Email @Size(max = 255) String email
) {}
