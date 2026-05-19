package hr.zavrsni.incidentapp.incident;

import hr.zavrsni.incidentapp.audit.AuditLogAction;
import hr.zavrsni.incidentapp.audit.AuditLogService;
import hr.zavrsni.incidentapp.incident.dto.CreateIncidentRequest;
import hr.zavrsni.incidentapp.incident.dto.IncidentDto;
import hr.zavrsni.incidentapp.user.User;
import hr.zavrsni.incidentapp.user.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

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

    public IncidentService(IncidentRepository incidentRepository,
                           UserRepository userRepository,
                           AuditLogService auditLogService) {
        this.incidentRepository = incidentRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
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
    public Page<IncidentDto> listAll(Pageable pageable) {
        return incidentRepository.findAll(pageable).map(IncidentDto::from);
    }

    @Transactional(readOnly = true)
    public Page<IncidentDto> listForReporter(String username, Pageable pageable) {
        return incidentRepository.findByReporter_Username(username, pageable).map(IncidentDto::from);
    }

    @Transactional(readOnly = true)
    public Page<IncidentDto> listAssignedToMe(String username, Pageable pageable) {
        return incidentRepository.findByAssignedTo_Username(username, pageable).map(IncidentDto::from);
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
        return IncidentDto.from(incident);
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
        return IncidentDto.from(incident);
    }
}
