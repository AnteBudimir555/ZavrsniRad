package hr.zavrsni.incidentapp.incident;

import hr.zavrsni.incidentapp.incident.dto.StatsDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/stats")
@PreAuthorize("hasRole('ADMIN')")
public class StatsController {

    private final IncidentService incidentService;

    public StatsController(IncidentService incidentService) {
        this.incidentService = incidentService;
    }

    @GetMapping
    public StatsDto getStats() {
        return incidentService.getStats();
    }
}
