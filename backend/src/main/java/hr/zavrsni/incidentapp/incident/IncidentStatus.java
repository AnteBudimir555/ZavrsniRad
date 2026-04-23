package hr.zavrsni.incidentapp.incident;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Lifecycle states of an incident. We store the enum name as a VARCHAR (see
 * the @Enumerated(EnumType.STRING) in Incident.java) so the column is
 * human-readable in psql.
 */
public enum IncidentStatus {
    OPEN,
    IN_PROGRESS,
    RESOLVED
}
