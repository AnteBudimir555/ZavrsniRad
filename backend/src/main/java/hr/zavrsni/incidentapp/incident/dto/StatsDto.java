package hr.zavrsni.incidentapp.incident.dto;

import java.util.Map;

public record StatsDto(
        long total,
        Map<String, Long> byStatus,
        Map<String, Long> byCategory,
        Map<String, Long> bySeverity
) {}
