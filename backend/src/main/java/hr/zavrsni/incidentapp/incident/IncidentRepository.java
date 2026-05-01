package hr.zavrsni.incidentapp.incident;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Spring Data JPA repository. findByReporter_Username is a derived query:
 * Spring reads the method name and generates
 *     SELECT i FROM Incident i WHERE i.reporter.username = ?
 * at startup. No SQL required.
 */
public interface IncidentRepository extends JpaRepository<Incident, Long> {
    List<Incident> findByReporter_UsernameOrderByCreatedAtDesc(String username);
    List<Incident> findAllByOrderByCreatedAtDesc();
    List<Incident> findByAssignedTo_UsernameOrderByCreatedAtDesc(String username);
}
