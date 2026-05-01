package hr.zavrsni.incidentapp.comment;

import hr.zavrsni.incidentapp.audit.AuditLogAction;
import hr.zavrsni.incidentapp.audit.AuditLogService;
import hr.zavrsni.incidentapp.incident.Incident;
import hr.zavrsni.incidentapp.incident.IncidentRepository;
import hr.zavrsni.incidentapp.user.User;
import hr.zavrsni.incidentapp.user.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Business logic for comments. Access rule: reporters may only comment on
 * incidents they reported; admins may comment on any incident.
 * Every successful post is recorded in the audit log (COMMENT_ADDED).
 */
@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final IncidentRepository incidentRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public CommentService(CommentRepository commentRepository,
                          IncidentRepository incidentRepository,
                          UserRepository userRepository,
                          AuditLogService auditLogService) {
        this.commentRepository = commentRepository;
        this.incidentRepository = incidentRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public CommentDto addComment(Long incidentId, String body, String authorUsername, boolean isAdmin) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new EntityNotFoundException("Incident not found: " + incidentId));
        if (!isAdmin && !incident.getReporter().getUsername().equals(authorUsername)) {
            throw new AccessDeniedException("You can only comment on your own incidents.");
        }

        User author = userRepository.findByUsername(authorUsername)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + authorUsername));

        Comment comment = commentRepository.save(new Comment(body, author, incident));
        auditLogService.record(authorUsername, AuditLogAction.COMMENT_ADDED, incidentId,
                "Comment by " + authorUsername);
        return CommentDto.from(comment);
    }

    @Transactional(readOnly = true)
    public List<CommentDto> listComments(Long incidentId, String requesterUsername, boolean isAdmin) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new EntityNotFoundException("Incident not found: " + incidentId));
        if (!isAdmin && !incident.getReporter().getUsername().equals(requesterUsername)) {
            throw new AccessDeniedException("You can only view comments on your own incidents.");
        }
        return commentRepository.findByIncident_IdOrderByCreatedAtAsc(incidentId).stream()
                .map(CommentDto::from)
                .toList();
    }
}
