package hr.zavrsni.incidentapp.incident;

import hr.zavrsni.incidentapp.incident.dto.AssignIncidentRequest;
import hr.zavrsni.incidentapp.incident.dto.CreateIncidentRequest;
import hr.zavrsni.incidentapp.incident.dto.IncidentDto;
import hr.zavrsni.incidentapp.incident.dto.UpdateStatusRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * REST endpoints for the Incident resource. Kept deliberately thin — all
 * business rules live in IncidentService.
 *
 * @PreAuthorize("hasRole('ADMIN')") checks the authority name set up in
 * AppUserDetailsService. If the check fails, Spring throws AccessDeniedException,
 * which GlobalExceptionHandler turns into a 403.
 */
@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final IncidentService incidentService;

    public IncidentController(IncidentService incidentService) {
        this.incidentService = incidentService;
    }

    /** Any authenticated user can create an incident; the reporter = current user. */
    @PostMapping
    public ResponseEntity<IncidentDto> create(@Valid @RequestBody CreateIncidentRequest req,
                                              Authentication auth) {
        IncidentDto created = incidentService.create(auth.getName(), req);
        return ResponseEntity.ok(created);
    }

    /** Admins only: see every incident in the system. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Page<IncidentDto> listAll(
            @RequestParam(required = false) IncidentStatus status,
            @RequestParam(required = false) IncidentCategory category,
            @RequestParam(required = false) IncidentSeverity severity,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return incidentService.listAll(status, category, severity, pageable);
    }

    /** Reporter's own incidents (works for admin too — lists what admin reported). */
    @GetMapping("/mine")
    public Page<IncidentDto> listMine(Authentication auth,
            @RequestParam(required = false) IncidentStatus status,
            @RequestParam(required = false) IncidentCategory category,
            @RequestParam(required = false) IncidentSeverity severity,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return incidentService.listForReporter(auth.getName(), status, category, severity, pageable);
    }

    /** Incidents assigned to the current user, regardless of who reported them. */
    @GetMapping("/assigned")
    public Page<IncidentDto> listAssigned(Authentication auth,
            @RequestParam(required = false) IncidentStatus status,
            @RequestParam(required = false) IncidentCategory category,
            @RequestParam(required = false) IncidentSeverity severity,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return incidentService.listAssignedToMe(auth.getName(), status, category, severity, pageable);
    }

    /** Reporters can fetch only their own; admins can fetch any. */
    @GetMapping("/{id}")
    public IncidentDto getOne(@PathVariable Long id, Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return incidentService.getById(id, auth.getName(), isAdmin);
    }

    /** Admin-only: change status (OPEN / IN_PROGRESS / RESOLVED). */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public IncidentDto updateStatus(@PathVariable Long id,
                                    @Valid @RequestBody UpdateStatusRequest req,
                                    Authentication auth) {
        return incidentService.updateStatus(id, req.status(), auth.getName());
    }

    /** Admin-only: assign (or unassign) an incident to a user. */
    @PatchMapping("/{id}/assignee")
    @PreAuthorize("hasRole('ADMIN')")
    public IncidentDto assignIncident(@PathVariable Long id,
                                      @RequestBody AssignIncidentRequest req,
                                      Authentication auth) {
        return incidentService.assignIncident(id, req.assigneeUsername(), auth.getName());
    }
}
