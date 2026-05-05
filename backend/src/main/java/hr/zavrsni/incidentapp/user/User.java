package hr.zavrsni.incidentapp.user;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * JPA @Entity representing a row in the "users" table. Hibernate will generate
 * the table from this class (because we set ddl-auto: update in application.yml).
 *
 * The fields map 1:1 with the columns in the data-model section of the README.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String username;

    /** BCrypt hash — NEVER store plaintext passwords. */
    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role;

    /**
     * Soft-disable flag. When false, AppUserDetailsService marks the Spring
     * UserDetails as disabled, which makes Spring throw DisabledException at
     * login. The default mirrors the DB-level DEFAULT TRUE (see V5 migration).
     */
    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    // --- constructors ---
    protected User() {}  // required by JPA

    public User(String username, String password, Role role) {
        this.username = username;
        this.password = password;
        this.role = role;
    }

    // --- getters / setters ---
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
}
