package hr.zavrsni.incidentapp.incident.dto;

import hr.zavrsni.incidentapp.incident.Incident;
import hr.zavrsni.incidentapp.incident.IncidentCategory;
import hr.zavrsni.incidentapp.incident.IncidentSeverity;
import hr.zavrsni.incidentapp.incident.IncidentStatus;

import java.time.Instant;
import java.time.LocalDateTime;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Response DTO. We never return the raw JPA entity — that risks leaking
 * internal fields, lazy-loading errors, and couples the JSON contract to the
 * database schema. Here we map to exactly the fields the frontend needs.
 */
public record IncidentDto(
        Long id,
        String title,
        String description,
        IncidentCategory category,
        IncidentSeverity severity,
        IncidentStatus status,
        String reporterUsername,
        LocalDateTime incidentTime,
        Instant createdAt,
        Instant updatedAt,
        Instant resolvedAt
) {
    public static IncidentDto from(Incident i) {
        return new IncidentDto(
                i.getId(),
                i.getTitle(),
                i.getDescription(),
                i.getCategory(),
                i.getSeverity(),
                i.getStatus(),
                i.getReporter().getUsername(),
                i.getIncidentTime(),
                i.getCreatedAt(),
                i.getUpdatedAt(),
                i.getResolvedAt()
        );
    }
}
