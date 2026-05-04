# Design Notes — Trade-offs and Limitations

**Purpose.** This file records *why* certain pieces of the system were built the way they were, what assumptions they rest on, and under what conditions those assumptions stop holding. It is intended for the thesis defense and for any future maintainer (including future-me) who needs to know what is intentionally simple versus what is accidentally simple.

Each entry follows the same shape:

1. **What was built** — the actual code/decision.
2. **Why this choice** — the constraint or principle it satisfies.
3. **When it breaks down** — the conditions that make this no longer the right answer.
4. **How to fix it then** — the concrete migration path.

---

## Table of Contents

1. [Login rate limiting — single-instance, in-memory, per-IP](#1-login-rate-limiting--single-instance-in-memory-per-ip)
2. [HTTPS termination — Caddy on the host, Docker app on HTTP internally](#2-https-termination--caddy-on-the-host-docker-app-on-http-internally)
3. [Default INFO logging — successful HTTP requests are silent](#3-default-info-logging--successful-http-requests-are-silent)
4. [DB-outage health responses return 504, not 503](#4-db-outage-health-responses-return-504-not-503)
5. *(future entries go here)*

---

## 1. Login rate limiting — single-instance, in-memory, per-IP

**Phase:** PHASE_02_SECURITY · **Files:** `RateLimitFilter.java`, `pom.xml`, `SecurityConfig.java` · **Date:** 2026-05-03

### What was built

A `OncePerRequestFilter` that intercepts every `/api/auth/**` request, looks up a Bucket4j token bucket keyed by client IP in a `ConcurrentHashMap<String, Bucket>`, and returns `429 Too Many Requests` (with `Retry-After: 60`) when the bucket is empty. Capacity 5, refills 5 tokens every 60 seconds.

### Why this choice

- **Brute-force defense.** Without a brake, an attacker could call `/api/auth/login` thousands of times per second and try every password in a leaked breach corpus. Five attempts/minute makes guessing economically pointless.
- **Token bucket over fixed window.** A fixed-window counter (e.g. "5 per minute, reset on the minute") allows a 10-attempt burst across a window boundary (5 at 0:59, 5 at 1:00). A token bucket drains and refills smoothly so the cap holds.
- **In-memory over Redis.** Bucket4j supports a Redis-backed store, but Redis would mean another container in `docker-compose.yml`, another startup dependency, and another moving part to defend in the thesis. The in-memory variant is one library, zero infra.
- **Per-IP keying.** The simplest defensible signal of "who is doing this." A username key alone would block the legitimate owner of a targeted account; an IP key blocks the source.

### Assumption — *exactly one backend instance*

The map lives in the JVM heap. Every login attempt for a given IP must hit the same JVM, otherwise each replica has its own independent bucket and the cap multiplies. We deploy one `incident-backend` container, so this holds.

### Assumption — *trusted reverse proxy in front*

Client IP is read from `X-Forwarded-For` (first entry), falling back to `remoteAddr`. This is correct **only** when a reverse proxy (PHASE_07: Caddy) sets the header and the backend is not directly reachable from the public internet. If port 8080 were exposed publicly, an attacker could spoof `X-Forwarded-For` on every request and dodge the limit by appearing to come from a different IP each time. The PHASE_07 firewall step (deny 8080 from external) is what makes this safe in production.

### When it breaks down

| Scenario | Symptom | Severity |
|---|---|---|
| Scale to multiple backend replicas behind a load balancer | Real cap becomes N × 5/min (each replica has its own map) | Doesn't apply at thesis/faculty scale |
| Many users share one public IP via NAT (e.g., users on a campus network connecting to an off-campus server) | A classroom of students logging in simultaneously triggers `429` for legitimate users | **Real risk for institutional deployment** |
| `X-Forwarded-For` reachable without a trusted proxy | Attacker spoofs the header and bypasses the limit | Mitigated by PHASE_07 firewall |
| Map grows unboundedly across millions of distinct IPs | Slow memory leak | Theoretical at faculty scale (would take years) |

### How to fix it then

- **Multi-instance deployments → Redis.** Add `bucket4j-redis`, swap the bucket factory to a `RedisBucketBuilder`, point at a Redis container. Code change ~20 lines. Operational cost: one more service.
- **Shared-IP institutional deployment → two strategies, can be combined:**
  - Raise the per-IP cap (e.g., 30/min). Still defeats brute-force, accommodates classrooms.
  - Add a second bucket keyed by `req.username()` (e.g., 10/min per username). Catches the attack that actually matters — someone targeting a specific account — without punishing legitimate IP-sharing users. This is the production-grade answer.
- **Memory-bounded map.** Replace the raw `ConcurrentHashMap` with a Caffeine cache that expires entries after, say, 10 minutes of inactivity.

### Verdict for this thesis

Ship as-is. Document the assumptions (this entry). If the faculty actually adopts the system, the first follow-up is per-username rate limiting on top of per-IP — see PHASE_02_SECURITY backlog.

---

## 2. HTTPS termination — Caddy on the host, Docker app on HTTP internally

**Phase:** PHASE_02_SECURITY (file added) · PHASE_07_DEPLOYMENT (wired up) · **Files:** `Caddyfile` · **Date:** 2026-05-03

### What was built

A `Caddyfile` committed to the repo root. On the production server, Caddy runs on the **host** (not inside Docker) and listens on ports 80 and 443. It obtains a TLS certificate from Let's Encrypt automatically, then reverse-proxies all traffic over plain HTTP to `localhost:8080` — the port exposed by the Docker frontend container. Inside the Docker network, all traffic remains HTTP.

Traffic path:

```
Browser ──HTTPS:443──▶ Caddy (host) ──HTTP:8080──▶ Nginx (Docker) ──/api/──▶ Spring Boot
```

### Why this choice

- **Caddy over Nginx for TLS.** Nginx (already inside Docker) serves the SPA and proxies `/api/*` perfectly. Adding TLS to that container would require volume-mounting certificates and running a cert-renewal cron job. Caddy handles the full ACME lifecycle automatically — it issues, renews, and reloads certs without any manual intervention.
- **Host process over Docker container for Caddy.** Running Caddy as a systemd-managed host process means it starts before Docker, survives Docker restarts, and has unambiguous access to ports 80/443 for the ACME HTTP-01 challenge. Putting Caddy in Docker would require binding port 80/443 on the host anyway, and adds a layer of indirection with no benefit.
- **Internal HTTP is acceptable.** The connection between Caddy and the Docker app is `localhost` on the same physical machine — it never leaves the host's network stack. Encrypting a loopback connection would add CPU overhead and cert complexity for zero security gain.

### Assumption — *Caddy can reach Let's Encrypt and the DNS A record is live*

Let's Encrypt's ACME HTTP-01 challenge requires Let's Encrypt's servers to reach the machine on port 80 to verify domain ownership before issuing a cert. This means:
- The domain's DNS A record must point at the server's public IP before `systemctl reload caddy`.
- Port 80 must be open in the firewall (the PHASE_07 firewall step allows 80 and 443).

### Deploy steps (PHASE_07 checklist)

1. Install Caddy on the Linux host (see commands in `Caddyfile` comments).
2. Copy: `cp Caddyfile /etc/caddy/Caddyfile`
3. Edit the two placeholders — replace `your-domain.example` with the real domain, and set `email` to a real address for Let's Encrypt expiry notifications.
4. Verify DNS A record is live: `dig +short your-domain.example` should return the server IP.
5. `systemctl reload caddy` — Caddy fetches the cert on the first request.
6. Smoke-test: open `https://your-domain.example` in a browser; check the padlock.

### When it breaks down

| Scenario | Symptom | Severity |
|---|---|---|
| DNS not pointing at server when Caddy starts | ACME challenge fails; Caddy serves HTTP-only or errors | Deploy-time mistake — fix DNS, reload Caddy |
| Port 80 blocked by firewall at cert-renewal time | Renewal fails silently; cert expires after 90 days | Caddy logs a warning ~30 days before expiry |
| Wildcard cert needed (multiple subdomains) | HTTP-01 challenge cannot issue wildcards | Switch to DNS-01 challenge in `Caddyfile` — requires DNS provider API key |
| Multiple backend instances behind a load balancer | Caddy would need to proxy to more than `localhost:8080` | Add an upstream block with multiple addresses; or put a dedicated LB in front |

### How to fix it then

- **Cert renewal issues →** `journalctl -u caddy` to inspect. `caddy renew` to force manually.
- **Wildcard / DNS-01 →** Add a `tls { dns <provider> }` block in `Caddyfile` and install the relevant Caddy DNS plugin.
- **Multi-instance →** Replace `reverse_proxy localhost:8080` with an upstream block listing all instances; add health checks.

### Verdict for this thesis

Ship the `Caddyfile` now as a ready-to-use artefact. Wire it up in PHASE_07. The automatic cert management is the main reason Caddy was chosen — it removes an entire class of operational mistakes (forgotten renewals, manual cert installs) that are common in student/small-team deployments.

---

## 3. Default INFO logging — successful HTTP requests are silent

**Phase:** PHASE_04_OBSERVABILITY · **Files:** `application.yml`, `logback-spring.xml` · **Date:** 2026-05-04

### What was built

The root logger is set to `INFO`. Two appenders run in parallel: a plain-text `CONSOLE` appender (visible via `docker compose logs backend`) and a JSON `JSON_FILE` appender writing to `/logs/app.log` with daily + 100 MB rolling and 30-day retention. Application code is bumped to `DEBUG` only for the `hr.zavrsni.incidentapp` package.

### Why this choice

- **INFO is Spring Boot's default for a reason.** Logging every framework lifecycle event already produces ~75 lines on startup. Adding per-request logging at INFO would make the console unreadable and dominate the JSON log file with noise the team rarely needs.
- **Per-package DEBUG over global DEBUG.** Setting `logging.level.root: DEBUG` would emit Hibernate SQL, Tomcat internals, and Spring filter chain traces on every request — gigabytes of disk per day. Limiting DEBUG to our own package keeps the signal-to-noise ratio high while still letting us trace our code.
- **No request-logging filter.** Spring Boot offers `CommonsRequestLoggingFilter` and `logging.level.org.springframework.web: DEBUG` for per-request logs. We deliberately did not enable either — for a thesis-scale app with low traffic, the value isn't worth the disk + cognitive cost. Production-grade observability uses request tracing (Sleuth/Micrometer + a trace collector), not log lines.

### Assumption — *the team is comfortable inferring "no log line = success"*

A successful 200 response on `POST /api/auth/login` produces zero log lines. Failures (401, 429, 500) produce exactly the log lines we wired up: `JwtAuthFilter` logs at DEBUG when a token is missing/bad, `GlobalExceptionHandler` logs at WARN/ERROR for handled exceptions, Spring Security itself logs failed authentications at DEBUG. If you grep for "login attempt" expecting one line per call, you'll find nothing — that's expected.

### How this surfaced

During PHASE_04 acceptance testing we sent a login + four health checks against a freshly restarted backend and counted JSON log lines. The count didn't change. First instinct: the file appender is broken. Actual diagnosis: nothing inside the request path logged at INFO, so neither appender (console or file) had anything to emit. Confirmed by restarting the backend (which emits ~40 INFO startup events) and seeing both appenders write the same 40 events.

### When it breaks down

| Scenario | Symptom | Severity |
|---|---|---|
| Need to audit every login attempt for compliance | No record of who logged in when | **Real risk for institutional deployment** |
| Debugging a "request didn't reach my controller" issue in prod | No way to confirm the request even got handled | Medium — workaround is to add a temporary log line |
| Investigating a slow endpoint | No latency data per request | Out of scope until Actuator metrics are added |

### How to fix it then

- **Need request audit trail →** add `CommonsRequestLoggingFilter` as a `@Bean` and bump `org.springframework.web` to DEBUG, OR (better) write a small `OncePerRequestFilter` that logs `method`, `uri`, `status`, `durationMs`, `username` at INFO so the audit fields are stable column names in the JSON output.
- **Need login audit specifically →** log inside `AuthController.login` at INFO with `username` and outcome. This is the production-grade answer: targeted audit logs, not blanket request logs.
- **Need latency / throughput data →** add `spring-boot-starter-actuator` Micrometer endpoints (we already have Actuator on board, just expose `metrics` and `prometheus` to an authenticated endpoint).

### Verdict for this thesis

Ship as-is. The current logging level is appropriate for a thesis demo and a small institutional deployment. The follow-up — a targeted audit-log filter for `/api/auth/**` — is recorded in the PHASE_06_FEATURES backlog as a candidate for the "production hardening" pass.

---

## 4. DB-outage health responses return 504, not 503

**Phase:** PHASE_04_OBSERVABILITY · **Files:** `docker-compose.yml`, `frontend/nginx.conf`, `application.yml` · **Date:** 2026-05-04

### What was built

Spring Boot Actuator's default `db` health indicator pings the datasource as part of `/actuator/health`. The Docker healthcheck on the `backend` service polls `http://localhost:8080/actuator/health` every 30 s with a 5 s timeout and 3 retries; after three consecutive failures the container reports `(unhealthy)` in `docker ps`. External traffic reaches the endpoint via nginx in the frontend container, which proxies `/actuator/health` to `backend:8080`.

### Why this choice

- **Default health indicators are a feature, not a footgun.** Spring Boot auto-wires `DiskSpace`, `Db`, `Ping` health indicators when their starters are on the classpath. Disabling the `db` indicator would mean `(healthy)` could be reported with a broken database — exactly the wrong signal.
- **Docker healthcheck over Spring's own scheduling.** Spring Boot has no built-in periodic self-healthcheck — Docker's healthcheck is the orchestration layer asking the question. Keeping that orchestration in `docker-compose.yml` (not the app) follows the principle that the runtime, not the app, decides whether the app is alive.
- **5 s timeout on the Docker healthcheck.** Short enough that a hung backend gets caught quickly; long enough that a normally slow first response after GC doesn't false-alarm.

### Assumption — *connecting to a downed Postgres takes longer than 5 s*

Hikari's `connection-timeout` defaults to 30 s. When the DB stops, an in-flight `SELECT 1` from the `db` health indicator parks on the socket waiting for either a response or the OS-level TCP timeout. nginx's default `proxy_read_timeout` (we set 5 s for `/actuator/health`) fires first and returns `504 Gateway Time-out`. The client never sees the `503 Service Unavailable` Spring would have eventually returned.

### How this surfaced

During PHASE_04 acceptance test A4 we ran `docker stop incident-db` and watched the backend's health status. The backend stayed `(healthy)` for ~100 s before flipping to `(unhealthy)` (3 × 30 s healthcheck interval). `curl http://localhost:8080/actuator/health` during the outage returned an nginx 504 page, not a Spring 503 JSON body. After `docker start incident-db` the status flipped back to `(healthy)` in ~30 s.

### Why the 504 is acceptable

- The end-state contract still holds: an unhealthy backend reports `(unhealthy)` to Docker, and external monitors hitting `/actuator/health` get a non-2xx response (504 vs. 503 — both are "this service is broken").
- The 100-second detection lag is a function of `interval × retries`, not the 504 itself. Tightening the interval to 10 s would catch outages faster at the cost of more healthcheck noise during normal operation.
- A 503 would carry a structured JSON body (`{"status":"DOWN","components":{"db":{"status":"DOWN", ...}}}`) when `show-details` is `always`. We have it set to `when_authorized`, so anonymous probes get only `{"status":"DOWN"}` — barely more informative than the 504. The structured detail isn't lost; it's available to authenticated callers via the same endpoint.

### When it breaks down

| Scenario | Symptom | Severity |
|---|---|---|
| Need a 503-with-JSON-body for an external monitor that distinguishes 5xx codes | Monitor tags a DB outage as "gateway error" instead of "service unhealthy" | Cosmetic for most monitoring stacks |
| Liveness must be independent of DB state (e.g., Kubernetes restart loop on DB outage) | DB outage makes Kubernetes kill and restart the backend, which won't help and may cascade | **Real risk on Kubernetes**; non-issue under Docker Compose |
| Need outage detection in seconds, not 100s | Slow paging on real incidents | Tune `interval`/`retries` |

### How to fix it then

- **Want 503 not 504 →** lower `spring.datasource.hikari.connection-timeout` to e.g. 2000 ms so the backend fails fast before nginx times out, or raise nginx's `proxy_read_timeout` for `/actuator/health` above 30 s. The first is the right answer (failing fast is good for healthchecks).
- **Need liveness independent of DB →** use Spring Boot's health groups: `management.endpoint.health.group.liveness.include: ping` makes the liveness probe a pure "JVM is up" check, while `readiness` keeps the full DB-aware behavior. Kubernetes maps `livenessProbe → /actuator/health/liveness` and `readinessProbe → /actuator/health/readiness`. We already have `probes.enabled: true` set, so the sub-paths exist — just unused under Docker Compose.
- **Faster outage detection →** drop `interval` from 30 s to 10 s, raise `retries` to 5 to keep the false-positive rate similar. Detection then takes ~50 s instead of ~100 s.

### Verdict for this thesis

Ship as-is. For the Docker Compose deployment in scope, a 504 during DB outage is functionally equivalent to a 503 — both correctly indicate "do not route traffic here." If the system later moves to Kubernetes, the first follow-up is enabling the `liveness` and `readiness` health groups so the orchestrator can distinguish "JVM dead, restart me" from "DB dead, don't restart me, just stop sending traffic."

---

<!--
================================================================================
TEMPLATE — copy this when adding the next entry. Number it sequentially in the
Table of Contents above and replace the placeholder line.
================================================================================

## N. Short title — the headline trade-off

**Phase:** PHASE_XX · **Files:** `Foo.java`, `Bar.ts` · **Date:** YYYY-MM-DD

### What was built

(Concrete description of the code/decision.)

### Why this choice

- (Bullet the alternatives considered and why this one won.)

### Assumption — *one-line statement of what must remain true*

(Explain what the assumption is, and what currently makes it hold in our deployment.)

### When it breaks down

| Scenario | Symptom | Severity |
|---|---|---|
| ... | ... | ... |

### How to fix it then

- (Concrete migration paths, with rough effort.)

### Verdict for this thesis

(Ship-as-is / revisit-before-deployment / revisit-when-X-happens.)

================================================================================
-->
