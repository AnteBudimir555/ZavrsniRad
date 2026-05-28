package hr.zavrsni.incidentapp.incident;

import hr.zavrsni.incidentapp.audit.AuditLogAction;
import hr.zavrsni.incidentapp.audit.AuditLogService;
import hr.zavrsni.incidentapp.incident.dto.CreateIncidentRequest;
import hr.zavrsni.incidentapp.incident.dto.IncidentDto;
import hr.zavrsni.incidentapp.notification.EmailService;
import hr.zavrsni.incidentapp.user.User;
import hr.zavrsni.incidentapp.user.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Business-logic layer. Controllers should stay thin (parse request, call
 * service, return response). All rules about "who can do what" and state
 * transitions live here so they can be unit-tested without HTTP plumbing.
 */
@Service
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final EmailService emailService;

    public IncidentService(IncidentRepository incidentRepository,
                           UserRepository userRepository,
                           AuditLogService auditLogService,
                           EmailService emailService) {
        this.incidentRepository = incidentRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.emailService = emailService;
    }

    @Transactional
    public IncidentDto create(String reporterUsername, CreateIncidentRequest req) {
        User reporter = userRepository.findByUsername(reporterUsername)
                .orElseThrow(() -> new EntityNotFoundException("Reporter not found: " + reporterUsername));

        Incident incident = new Incident(
                req.title(),
                req.description(),
                req.category(),
                req.severity(),
                reporter,
                req.incidentTime(),
                req.location()
        );
        incident = incidentRepository.save(incident);
        auditLogService.record(reporterUsername, AuditLogAction.INCIDENT_CREATED, incident.getId(),
                "Created: " + incident.getTitle());
        return IncidentDto.from(incident);
    }

    @Transactional(readOnly = true)
    public Page<IncidentDto> listAll(IncidentStatus status, IncidentCategory category,
                                     IncidentSeverity severity, Pageable pageable) {
        var spec = Specification.where(IncidentSpec.hasStatus(status))
                .and(IncidentSpec.hasCategory(category))
                .and(IncidentSpec.hasSeverity(severity));
        return incidentRepository.findAll(spec, pageable).map(IncidentDto::from);
    }

    @Transactional(readOnly = true)
    public Page<IncidentDto> listForReporter(String username, IncidentStatus status,
                                             IncidentCategory category, IncidentSeverity severity,
                                             Pageable pageable) {
        var spec = Specification.where(IncidentSpec.reportedBy(username))
                .and(IncidentSpec.hasStatus(status))
                .and(IncidentSpec.hasCategory(category))
                .and(IncidentSpec.hasSeverity(severity));
        return incidentRepository.findAll(spec, pageable).map(IncidentDto::from);
    }

    @Transactional(readOnly = true)
    public Page<IncidentDto> listAssignedToMe(String username, IncidentStatus status,
                                              IncidentCategory category, IncidentSeverity severity,
                                              Pageable pageable) {
        var spec = Specification.where(IncidentSpec.assignedTo(username))
                .and(IncidentSpec.hasStatus(status))
                .and(IncidentSpec.hasCategory(category))
                .and(IncidentSpec.hasSeverity(severity));
        return incidentRepository.findAll(spec, pageable).map(IncidentDto::from);
    }

    @Transactional(readOnly = true)
    public IncidentDto getById(Long id, String requesterUsername, boolean isAdmin) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Incident not found: " + id));
        if (!isAdmin && !incident.getReporter().getUsername().equals(requesterUsername)) {
            throw new AccessDeniedException("You can only view your own incidents.");
        }
        return IncidentDto.from(incident);
    }

    @Transactional
    public IncidentDto updateStatus(Long id, IncidentStatus newStatus, String actorUsername) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Incident not found: " + id));

        String detail = incident.getStatus() + " → " + newStatus;
        incident.setStatus(newStatus);
        if (newStatus == IncidentStatus.RESOLVED && incident.getResolvedAt() == null) {
            incident.setResolvedAt(Instant.now());
        } else if (newStatus != IncidentStatus.RESOLVED) {
            incident.setResolvedAt(null);
        }
        auditLogService.record(actorUsername, AuditLogAction.STATUS_CHANGED, id, detail);
        emailService.notifyStatusChanged(incident, newStatus);
        return IncidentDto.from(incident);
    }

    @Transactional(readOnly = true)
    public String exportAllAsCsv(IncidentStatus status, IncidentCategory category, IncidentSeverity severity) {
        var spec = Specification.where(IncidentSpec.hasStatus(status))
                .and(IncidentSpec.hasCategory(category))
                .and(IncidentSpec.hasSeverity(severity));
        List<Incident> incidents = incidentRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));

        StringBuilder sb = new StringBuilder(
                "ID,Title,Category,Severity,Status,Reporter,Assigned To,Location,Incident Time,Created At,Resolved At\n");
        for (Incident i : incidents) {
            sb.append(i.getId()).append(',')
              .append(csv(i.getTitle())).append(',')
              .append(i.getCategory()).append(',')
              .append(i.getSeverity()).append(',')
              .append(i.getStatus()).append(',')
              .append(csv(i.getReporter().getUsername())).append(',')
              .append(csv(i.getAssignedTo() != null ? i.getAssignedTo().getUsername() : "")).append(',')
              .append(csv(i.getLocation() != null ? i.getLocation() : "")).append(',')
              .append(i.getIncidentTime() != null ? i.getIncidentTime() : "").append(',')
              .append(i.getCreatedAt() != null ? i.getCreatedAt() : "").append(',')
              .append(i.getResolvedAt() != null ? i.getResolvedAt() : "").append('\n');
        }
        return sb.toString();
    }

    // Wraps a CSV cell in double-quotes if it contains a comma, quote, or newline.
    private static String csv(String value) {
        if (value == null || value.isEmpty()) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    @Transactional
    public IncidentDto assignIncident(Long id, String assigneeUsername, String actorUsername) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Incident not found: " + id));

        String previousAssignee = incident.getAssignedTo() != null
                ? incident.getAssignedTo().getUsername() : "(none)";

        if (assigneeUsername == null) {
            incident.setAssignedTo(null);
        } else {
            User assignee = userRepository.findByUsername(assigneeUsername)
                    .orElseThrow(() -> new EntityNotFoundException("User not found: " + assigneeUsername));
            incident.setAssignedTo(assignee);
        }

        String newAssignee = assigneeUsername != null ? assigneeUsername : "(none)";
        auditLogService.record(actorUsername, AuditLogAction.ASSIGNEE_CHANGED, id,
                previousAssignee + " → " + newAssignee);
        if (incident.getAssignedTo() != null) {
            emailService.notifyAssigned(incident, incident.getAssignedTo());
        }
        return IncidentDto.from(incident);
    }
}
