package hr.zavrsni.incidentapp.incident;

import org.springframework.data.jpa.domain.Specification;

public class IncidentSpec {

    public static Specification<Incident> hasStatus(IncidentStatus status) {
        return (root, query, cb) -> status == null ? null : cb.equal(root.get("status"), status);
    }

    public static Specification<Incident> hasCategory(IncidentCategory category) {
        return (root, query, cb) -> category == null ? null : cb.equal(root.get("category"), category);
    }

    public static Specification<Incident> hasSeverity(IncidentSeverity severity) {
        return (root, query, cb) -> severity == null ? null : cb.equal(root.get("severity"), severity);
    }

    public static Specification<Incident> reportedBy(String username) {
        return (root, query, cb) -> username == null ? null : cb.equal(root.get("reporter").get("username"), username);
    }

    public static Specification<Incident> assignedTo(String username) {
        return (root, query, cb) -> username == null ? null : cb.equal(root.get("assignedTo").get("username"), username);
    }
}
