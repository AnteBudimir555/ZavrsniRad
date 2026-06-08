package hr.zavrsni.incidentapp;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * End-to-end smoke tests that drive the app through real HTTP (MockMvc), through
 * the full Spring Security filter chain (JWT auth + rate limiting), down to a
 * real PostgreSQL database. These are the regression net for the Spring Boot 4
 * upgrade: they assert the behaviours that MUST stay identical across the
 * migration — token issuance, role-based access, incident CRUD scoping, status
 * changes, and audit logging.
 *
 * Notes on design:
 *  - Assertions use JsonPath / jsonPath() rather than a Jackson ObjectMapper so
 *    the test source survives Boot 4's switch to Jackson 3 with no edits.
 *  - Each call to a rate-limited /api/auth/** endpoint sends a UNIQUE
 *    X-Forwarded-For header. RateLimitFilter keys its token buckets on that
 *    header, so a fresh IP per call means the 5-requests/minute limit never
 *    trips during the suite — no production code changed just to test it.
 *  - Usernames are randomised per test so methods are independent and the suite
 *    can be re-run against the same database without unique-constraint clashes.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SmokeApiTests {

    @Autowired
    private MockMvc mvc;

    /** Hands out a distinct documentation-range IP per auth call (see class doc). */
    private static final AtomicInteger IP = new AtomicInteger(1);

    private static String uniqueIp() {
        int n = IP.getAndIncrement();
        return "203.0." + ((n >> 8) & 0xFF) + "." + (n & 0xFF);
    }

    private static String uniqueUsername(String prefix) {
        return prefix + "_" + Long.toHexString(System.nanoTime());
    }

    /** Registers a fresh REPORTER and returns the JWT from the response. */
    private String registerReporter() throws Exception {
        String username = uniqueUsername("rep");
        String body = """
                {"username":"%s","password":"password123","email":"%s@example.com"}
                """.formatted(username, username);
        MvcResult res = mvc.perform(post("/api/auth/register")
                        .header("X-Forwarded-For", uniqueIp())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.role").value("REPORTER"))
                .andReturn();
        return JsonPath.read(res.getResponse().getContentAsString(), "$.token");
    }

    /** Logs in the seeded admin (admin/admin123 by default) and returns the JWT. */
    private String loginAdmin() throws Exception {
        String body = """
                {"username":"admin","password":"admin123"}
                """;
        MvcResult res = mvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", uniqueIp())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andReturn();
        return JsonPath.read(res.getResponse().getContentAsString(), "$.token");
    }

    /** Creates one incident as the given reporter token; returns its id. */
    private long createIncident(String reporterToken, String title) throws Exception {
        String body = """
                {"title":"%s","description":"smoke test",
                 "category":"IT","severity":"LOW",
                 "incidentTime":"2026-06-01T10:00:00"}
                """.formatted(title);
        MvcResult res = mvc.perform(post("/api/incidents")
                        .header("Authorization", "Bearer " + reporterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.title").value(title))
                .andReturn();
        return ((Number) JsonPath.read(res.getResponse().getContentAsString(), "$.id")).longValue();
    }

    // ---------------------------------------------------------------------

    @Test
    void register_issues_token_and_admin_can_log_in() throws Exception {
        // Covers POST /api/auth/register (token issuance) and POST /api/auth/login.
        registerReporter();
        loginAdmin();
    }

    @Test
    void reporter_can_create_and_list_own_incident() throws Exception {
        String token = registerReporter();
        String title = "Printer on fire " + uniqueIp();
        long id = createIncident(token, title);

        // The reporter sees exactly their one incident under /mine.
        mvc.perform(get("/api/incidents/mine")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].title").value(title));

        // And can fetch it by id.
        mvc.perform(get("/api/incidents/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void reporter_is_forbidden_from_admin_only_list() throws Exception {
        String token = registerReporter();
        // GET /api/incidents is @PreAuthorize("hasRole('ADMIN')") -> 403 for a reporter.
        mvc.perform(get("/api/incidents")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticated_request_is_rejected() throws Exception {
        // No token at all -> rejected. This stateless JWT setup configures no
        // formLogin/httpBasic, so Spring Security falls back to its default
        // Http403ForbiddenEntryPoint: an unauthenticated request to a protected
        // endpoint returns 403 (NOT 401). We lock that actual behaviour in so
        // the upgrade is caught if Spring Security 7 ever changes the default.
        mvc.perform(get("/api/incidents/mine"))
                .andExpect(status().isForbidden());
    }

    @Test
    void admin_can_change_status_and_audit_log_records_it() throws Exception {
        String reporterToken = registerReporter();
        long id = createIncident(reporterToken, "Network down " + uniqueIp());

        String adminToken = loginAdmin();

        // Admin moves the incident to IN_PROGRESS.
        mvc.perform(patch("/api/incidents/" + id + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"IN_PROGRESS"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        // The audit trail for this incident now contains the creation AND the
        // status change (both written by the service layer).
        mvc.perform(get("/api/admin/audit")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("incidentId", String.valueOf(id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$..action", hasItem("INCIDENT_CREATED")))
                .andExpect(jsonPath("$..action", hasItem("STATUS_CHANGED")));
    }
}
