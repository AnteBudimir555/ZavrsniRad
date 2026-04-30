package hr.zavrsni.incidentapp.incident;

import hr.zavrsni.incidentapp.user.User;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * JPA entity for a single incident report. One row per incident.
 *
 * Notes:
 *   - @ManyToOne relates each incident to the user who reported it.
 *   - @PrePersist / @PreUpdate stamp timestamps so we don't have to remember to
 *     set them in the service layer.
 */
@Entity
@Table(name = "incidents")
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 140)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private IncidentCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private IncidentSeverity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private IncidentStatus status;

    /** FetchType.LAZY avoids pulling the whole User every time we load an Incident. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    /**
     * When the incident actually happened (reporter-supplied).
     * Distinct from createdAt, which is when the row was written.
     * LocalDateTime (no zone) matches what an HTML datetime-local input emits.
     */
    @Column(name = "incident_time", nullable = false)
    private LocalDateTime incidentTime;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) this.status = IncidentStatus.OPEN;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // --- constructors ---
    protected Incident() {}

    public Incident(String title,
                    String description,
                    IncidentCategory category,
                    IncidentSeverity severity,
                    User reporter,
                    LocalDateTime incidentTime) {
        this.title = title;
        this.description = description;
        this.category = category;
        this.severity = severity;
        this.reporter = reporter;
        this.incidentTime = incidentTime;
        this.status = IncidentStatus.OPEN;
    }

    // --- getters / setters ---
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public IncidentCategory getCategory() { return category; }
    public void setCategory(IncidentCategory category) { this.category = category; }
    public IncidentSeverity getSeverity() { return severity; }
    public void setSeverity(IncidentSeverity severity) { this.severity = severity; }
    public IncidentStatus getStatus() { return status; }
    public void setStatus(IncidentStatus status) { this.status = status; }
    public User getReporter() { return reporter; }
    public void setReporter(User reporter) { this.reporter = reporter; }
    public LocalDateTime getIncidentTime() { return incidentTime; }
    public void setIncidentTime(LocalDateTime incidentTime) { this.incidentTime = incidentTime; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }
}
