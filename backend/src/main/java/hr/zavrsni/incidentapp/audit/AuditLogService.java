package hr.zavrsni.incidentapp.audit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public void record(String actorUsername, AuditLogAction action, Long incidentId, String detail) {
        auditLogRepository.save(new AuditLog(actorUsername, action, incidentId, detail));
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> listForIncident(Long incidentId) {
        return auditLogRepository.findByIncidentIdOrderByOccurredAtDesc(incidentId).stream()
                .map(AuditLogDto::from)
                .toList();
    }
}
