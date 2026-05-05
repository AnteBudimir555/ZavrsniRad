package hr.zavrsni.incidentapp.user.dto;

import jakarta.validation.constraints.NotNull;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Request body for PATCH /api/admin/users/{id}. Today the only mutable
 * field is 'active' (de-/re-activate an account). Wrapping it in a record
 * keeps the door open for adding fields (role change, password reset…)
 * without breaking the API shape.
 */
public record UpdateUserRequest(@NotNull Boolean active) {}
