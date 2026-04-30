package hr.zavrsni.incidentapp.incident.dto;

/**
 * Body for PATCH /api/incidents/{id}/assignee.
 * Send { "assigneeUsername": "alice" } to assign, or { "assigneeUsername": null } to unassign.
 */
public record AssignIncidentRequest(String assigneeUsername) {}
