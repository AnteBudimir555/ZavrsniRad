package hr.zavrsni.incidentapp.audit;

import java.time.Instant;

public record AuditLogDto(
        Long id,
        String actorUsername,
        AuditLogAction action,
        Long incidentId,
        String detail,
        Instant occurredAt
) {
    public static AuditLogDto from(AuditLog log) {
        return new AuditLogDto(
                log.getId(),
                log.getActorUsername(),
                log.getAction(),
                log.getIncidentId(),
                log.getDetail(),
                log.getOccurredAt()
        );
    }
}
