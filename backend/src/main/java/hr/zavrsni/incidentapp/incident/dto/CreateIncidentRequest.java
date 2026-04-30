package hr.zavrsni.incidentapp.incident.dto;

import hr.zavrsni.incidentapp.incident.IncidentCategory;
import hr.zavrsni.incidentapp.incident.IncidentSeverity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * DTO for POST /api/incidents. Bean Validation annotations run automatically
 * when the controller method is annotated with @Valid: invalid payloads are
 * rejected before any handler code runs, and GlobalExceptionHandler converts
 * the error into a clean JSON response.
 */
public record CreateIncidentRequest(
        @NotBlank @Size(max = 140) String title,
        @Size(max = 4000) String description,
        @NotNull IncidentCategory category,
        @NotNull IncidentSeverity severity,
        @NotNull @PastOrPresent LocalDateTime incidentTime,
        @Size(max = 200) String location
) {}
