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
3. *(future entries go here)*

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
