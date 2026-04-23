package hr.zavrsni.incidentapp.incident.dto;

import hr.zavrsni.incidentapp.incident.IncidentStatus;
import jakarta.validation.constraints.NotNull;

/** DTO for PATCH /api/incidents/{id}/status — admin-only endpoint. */
public record UpdateStatusRequest(@NotNull IncidentStatus status) {}
