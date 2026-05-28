package hr.zavrsni.incidentapp.incident;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

// JpaSpecificationExecutor adds findAll(Specification, Pageable) — used for dynamic filtering.
public interface IncidentRepository extends JpaRepository<Incident, Long>, JpaSpecificationExecutor<Incident> {
    long countByStatus(IncidentStatus status);
    long countByCategory(IncidentCategory category);
    long countBySeverity(IncidentSeverity severity);
}
