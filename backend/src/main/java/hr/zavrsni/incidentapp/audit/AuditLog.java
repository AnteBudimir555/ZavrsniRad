package hr.zavrsni.incidentapp.audit;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * One row per notable event (incident created, status changed, etc.).
 * incidentId is stored as a plain Long (not a FK) so the audit table survives
 * if an incident is ever hard-deleted, and to keep the join optional.
 */
@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_username", nullable = false, length = 64)
    private String actorUsername;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private AuditLogAction action;

    @Column(name = "incident_id", nullable = false)
    private Long incidentId;

    /** Human-readable summary, e.g. "OPEN → IN_PROGRESS" or "Assigned to alice". */
    @Column(columnDefinition = "TEXT")
    private String detail;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @PrePersist
    void onCreate() {
        this.occurredAt = Instant.now();
    }

    protected AuditLog() {}

    public AuditLog(String actorUsername, AuditLogAction action, Long incidentId, String detail) {
        this.actorUsername = actorUsername;
        this.action = action;
        this.incidentId = incidentId;
        this.detail = detail;
    }

    public Long getId() { return id; }
    public String getActorUsername() { return actorUsername; }
    public AuditLogAction getAction() { return action; }
    public Long getIncidentId() { return incidentId; }
    public String getDetail() { return detail; }
    public Instant getOccurredAt() { return occurredAt; }
}
