package hr.zavrsni.incidentapp.comment;

import hr.zavrsni.incidentapp.incident.Incident;
import hr.zavrsni.incidentapp.user.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "comments")
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String body;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "incident_id", nullable = false)
    private Incident incident;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    protected Comment() {}

    public Comment(String body, User author, Incident incident) {
        this.body = body;
        this.author = author;
        this.incident = incident;
    }

    public Long getId() { return id; }
    public String getBody() { return body; }
    public User getAuthor() { return author; }
    public Incident getIncident() { return incident; }
    public Instant getCreatedAt() { return createdAt; }
}
