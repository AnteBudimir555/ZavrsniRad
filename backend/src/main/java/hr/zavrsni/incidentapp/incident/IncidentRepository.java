package hr.zavrsni.incidentapp.incident;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IncidentRepository extends JpaRepository<Incident, Long> {
    Page<Incident> findByReporter_Username(String username, Pageable pageable);
    Page<Incident> findByAssignedTo_Username(String username, Pageable pageable);
}
