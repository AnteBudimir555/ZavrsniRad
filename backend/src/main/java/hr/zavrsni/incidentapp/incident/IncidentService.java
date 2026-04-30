package hr.zavrsni.incidentapp.incident;

import hr.zavrsni.incidentapp.incident.dto.CreateIncidentRequest;
import hr.zavrsni.incidentapp.incident.dto.IncidentDto;
import hr.zavrsni.incidentapp.user.User;
import hr.zavrsni.incidentapp.user.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

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

    public IncidentService(IncidentRepository incidentRepository,
                           UserRepository userRepository) {
        this.incidentRepository = incidentRepository;
        this.userRepository = userRepository;
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
                req.incidentTime()
        );
        incident = incidentRepository.save(incident);
        return IncidentDto.from(incident);
    }

    @Transactional(readOnly = true)
    public List<IncidentDto> listAll() {
        return incidentRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(IncidentDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<IncidentDto> listForReporter(String username) {
        return incidentRepository.findByReporter_UsernameOrderByCreatedAtDesc(username).stream()
                .map(IncidentDto::from)
                .toList();
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
    public IncidentDto updateStatus(Long id, IncidentStatus newStatus) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Incident not found: " + id));

        incident.setStatus(newStatus);
        if (newStatus == IncidentStatus.RESOLVED && incident.getResolvedAt() == null) {
            incident.setResolvedAt(Instant.now());
        } else if (newStatus != IncidentStatus.RESOLVED) {
            incident.setResolvedAt(null);
        }
        return IncidentDto.from(incident);
    }
}
