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
2. *(future entries go here)*

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
