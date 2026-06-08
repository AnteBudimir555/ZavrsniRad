# Spring Boot 4.0 Migration Assessment & Roadmap

**Project:** Incident Management System (Završni Rad) — backend module
**Author role:** Senior Backend Engineer / Software Architect
**Date:** 2026-06-08
**Current baseline:** Spring Boot 3.3.4 · Spring Framework 6.1 · Java 21 · Maven
**Target baseline:** Spring Boot 4.0.x · Spring Framework 7.0 · Java 21 (LTS)

> **Verdict up front:** **Low effort, moderate-to-high value — recommended, but not urgent.**
> This codebase is already on the modern `jakarta.*` namespace, the lambda-based Security
> DSL, Java 21, and has no Jackson coupling — i.e. it has already paid the expensive parts
> of the Spring Boot 2→3 migration. The remaining work to reach Spring Boot 4 is small and
> largely mechanical. The main reasons to do it are **staying on a supported baseline** and
> **enabling virtual threads** for this I/O-bound workload — not any single must-have feature.

---

## 1. Feasibility & ROI Assessment — "Is it worth it?"

### 1.1 Where we are today

The backend is a clean, single-module Spring Boot 3.3.4 application on **Java 21**:

- REST API (`spring-boot-starter-web`, embedded Tomcat) — Controller → Service → Repository layering.
- JPA/Hibernate + PostgreSQL 16, schema owned by **Flyway** (V1–V6), `ddl-auto: validate`.
- Stateless JWT security (HS256 via JJWT 0.12.6), Bucket4j rate limiting, BCrypt.
- Actuator (`/actuator/health` only), structured JSON logging (logstash-logback-encoder).
- Optional SMTP notifications (`spring-boot-starter-mail`).

Critically, the app **already uses the `jakarta.*` namespace** (e.g. `jakarta.servlet.*`,
`jakarta.persistence.EntityNotFoundException`) and the **lambda `SecurityFilterChain` DSL** —
the two changes that make most Spring Boot upgrades painful. That work is already done.

### 1.2 The case *for* upgrading

| Driver | Relevance to this app | Weight |
|---|---|---|
| **Supported baseline / security compliance** | Spring Boot 3.3.x open-source support is finite; 3.5 is the last 3.x line. Staying current keeps the app receiving CVE patches without a commercial support contract. For an app meant for "real institutional use" (PHASE_07), this is the strongest single argument. | **High** |
| **Virtual threads (Java 21 + Boot 4)** | This is an **I/O-bound CRUD app**: every request blocks on JDBC (Postgres) and occasionally SMTP. `spring.threads.virtual.enabled=true` lets each request run on a virtual thread, removing the fixed ~200-thread Tomcat pool ceiling under concurrent load — better throughput and lower memory per in-flight request, at near-zero code cost. | **High** |
| **Framework 7 modernization** | JSpecify null-safety, refined `RestClient`, built-in resilience (`@Retryable`, `@ConcurrencyLimit`), API versioning. Nice-to-have here; not blocking. | Low–Medium |
| **GraalVM native image** | Boot 4 continues first-class AOT/native support. Could cut cold-start to ~50ms and RSS dramatically — attractive *if* deployment ever moves to scale-to-zero/serverless. Today we run a long-lived container, so this is **optional future upside**, not a current win. | Low (today) |
| **Reduced infra cost** | Virtual threads + (optionally) native image reduce memory headroom needed on the PHASE_07 VPS (spec'd at 4 GB). Marginal but real. | Low–Medium |
| **Academic value (thesis)** | Demonstrating a disciplined, audited framework-major-version migration with OpenRewrite + regression testing is itself a strong thesis artifact. | Medium |

### 1.3 The case *against* / friction

- **No automated tests exist.** `spring-boot-starter-test` and `spring-security-test` are
  declared in `pom.xml` but `src/test` is empty. A framework major upgrade with **no
  regression net** is the single biggest risk here. Mitigation (a thin smoke-test suite) is
  itself worthwhile regardless of the upgrade, but it is real work — and should be treated as
  a **prerequisite**, not an afterthought.
- **Third-party version vetting.** A handful of pinned non-Spring dependencies must be
  confirmed compatible (details in §2).
- **Jackson 3 default.** Boot 4 defaults to Jackson 3. Our risk is *low* (no custom
  `ObjectMapper`, no Jackson annotations), but JJWT pulls in Jackson 2 — both must be allowed
  to coexist (they can; see §2.3).
- **No killer feature.** Nothing in the current feature set is *blocked* by Spring Boot 3.
  This is future-proofing and optimization, not unblocking.

### 1.4 Effort vs. payoff (engineering estimate)

| Item | Estimate |
|---|---|
| Build regression smoke tests (prerequisite) | 0.5–1 day |
| OpenRewrite upgrade run + manual fixes | 0.5 day |
| Dependency version bumps + verification | 0.5 day |
| Enable + load-test virtual threads | 0.5 day |
| **Total** | **~2–2.5 focused days** |

**ROI conclusion:** For a thesis app, this is a **favorable, low-risk upgrade**. The headline
returns are (1) a supported, CVE-patched baseline and (2) virtual-thread scalability for an
I/O-bound workload, both at low cost *because the hard namespace/security migration is already
done*. The work is worth doing **once a minimal regression test suite exists**. It is not
urgent enough to interrupt PHASE_07 deployment if a deadline is near — it can follow it.

---

## 2. Breaking Changes & Dependency Audit

Scope of audit: `backend/pom.xml` plus a repo-wide scan for Jackson, security-config, and
nullability API usage.

### 2.1 Java & framework baseline

| Concern | Status in this repo | Action |
|---|---|---|
| Spring Framework 7 requires **Java 17+** | On **Java 21** | None — compliant; keep Java 21 (LTS, virtual-thread-ready) |
| `jakarta.*` namespace (no `javax.*`) | Already fully `jakarta.*` | **None** — already migrated |
| Spring Security 7 requires lambda DSL; removes `WebSecurityConfigurerAdapter` | Uses `SecurityFilterChain` + lambda DSL (`SecurityConfig.java`) | None — already compliant. Verify no removed/renamed DSL methods after bump |
| Hibernate ORM 7 / Jakarta Persistence 3.2 (ships with Boot 4) | Standard JPA mappings only; explicit `PostgreSQLDialect` | Low — explicit dialect still valid; can be dropped (auto-detected). Validate entities boot under Hibernate 7 |

### 2.2 Module restructuring (Spring Boot 4)

Spring Boot 4 splits several artifacts into more granular modules. Our starters
(`-web`, `-data-jpa`, `-security`, `-validation`, `-actuator`, `-mail`) remain the supported
entry points, so the `pom.xml` dependency list is expected to need **only a parent version
bump**. Watch for any starter that has been renamed/relocated during the OpenRewrite run.

### 2.3 Jackson 3 (default in Boot 4)

- **Boot 4 defaults to Jackson 3** (`tools.jackson.*` packages, `tools.jackson` groupId).
- **Our serialization risk is LOW:** repo-wide grep found **no** `com.fasterxml.jackson`
  imports, **no** custom `ObjectMapper` bean, and **no** Jackson annotations
  (`@JsonProperty`/`@JsonFormat`/`@JsonInclude`). Our DTOs are plain records/POJOs that Spring
  auto-configures — serialization behavior carries over transparently.
- **JJWT interaction:** `jjwt-jackson` (0.12.6) binds to **Jackson 2** (`com.fasterxml`).
  Jackson 2 and Jackson 3 use different groupIds/packages and **coexist on the classpath**.
  Boot 4 keeps Jackson 2 available for exactly this reason. **Action:** confirm `jjwt-jackson`
  still resolves Jackson 2 transitively after the bump; if not, add an explicit
  `com.fasterxml.jackson.core:jackson-databind` dependency. (Alternatively, JJWT can serialize
  with Gson/org-json, but no change is expected to be needed.)

### 2.4 Pinned third-party dependencies — vetting checklist

| Dependency | Pinned version | Risk | Action |
|---|---|---|---|
| `io.jsonwebtoken:jjwt-*` | 0.12.6 | Low | Confirm latest 0.12.x; verify Jackson-2 coexistence (§2.3). API used (`Jwts.builder/parser`, `Keys`, `Decoders`) is stable |
| `com.bucket4j:bucket4j-core` | 8.10.1 | Low | Pure-Java, no Spring coupling. Bump to current 8.x if available; otherwise leave |
| `net.logstash.logback:logstash-logback-encoder` | **7.4** | **Medium** | Boot 4 ships a newer Logback (1.5.x). Bump encoder to **8.x** for Logback compatibility; re-verify `logback-spring.xml` JSON output |
| `org.flywaydb:flyway-core` + `flyway-database-postgresql` | parent-managed | Low | Boot 4 manages a newer Flyway (11.x). Keep both artifacts (Postgres dialect still separate). Re-run V1–V6 on a fresh volume to confirm |
| `org.postgresql:postgresql` | parent-managed | Low | Driver version follows parent; no action |
| `spring-boot-starter-mail` | parent-managed | Low | Jakarta Mail; no API change expected |

### 2.5 Deprecated API usage in our code

| Usage | Location | Action |
|---|---|---|
| `org.springframework.lang.NonNull` | `JwtAuthFilter.java:9,42-44` | Framework 7 deprecates the `org.springframework.lang` nullability annotations in favor of **JSpecify** (`org.jspecify.annotations.NonNull`). Swap the import (or drop the annotation — `OncePerRequestFilter` params are already non-null by contract). Cosmetic; no behavior change |
| `server.error.include-message: always` | `application.yml:76` | Still valid in Boot 4. No change |
| Actuator `health.probes.enabled`, `show-details: when_authorized` | `application.yml:105-109` | Still valid. Re-verify endpoint IDs after bump |

### 2.6 Not applicable to this repo (explicitly cleared)

- **Apache Kafka 4.0 / KRaft** — no Kafka/messaging dependency present. N/A.
- **Spring Cloud** — not used. N/A.
- **`RestTemplate` / `WebMvcConfigurer` / `@MockBean`** — grep found none. N/A.
- **CORS config** — none in app (same-origin via Nginx proxy). N/A.

---

## 3. Step-by-Step Migration Roadmap

Iterative and milestone-based. Each milestone is independently verifiable and committable.
**Do the whole migration on a dedicated branch** (`git checkout -b feat/spring-boot-4`).

### Milestone 0 — Safety net (PREREQUISITE)
> Rationale: a framework major upgrade without tests is flying blind. Build the net first.

1. Add a `@SpringBootTest` context-load test (proves the app still wires up).
2. Add slice/integration smoke tests for the critical paths:
   - `POST /api/auth/register` + `POST /api/auth/login` → token issued.
   - `POST /api/incidents` (REPORTER) → 201; `GET /api/incidents` scoping.
   - `PATCH /api/incidents/{id}/status` (ADMIN) → 200 + AuditLog written.
   - `@PreAuthorize` denial → 403 for REPORTER hitting admin route.
   - Use **Testcontainers PostgreSQL** so Flyway V1–V6 run against a real DB.
3. Capture a **baseline run**: `mvn test` green on Spring Boot 3.3.4. Commit.

### Milestone 1 — Java baseline confirmation
1. Confirm Java 21 toolchain (already set, `pom.xml:35`). No change expected.
2. (Optional) decide whether to target Java 25 later; **stay on 21 LTS for the migration** to
   isolate variables.

### Milestone 2 — Automated upgrade via OpenRewrite
1. Run the Spring Boot 4 upgrade recipe (dry run first):
   ```bash
   mvn org.openrewrite.maven:rewrite-maven-plugin:run \
     -Drewrite.activeRecipes=org.openrewrite.java.spring.boot4.UpgradeSpringBoot_4_0 \
     -Drewrite.exportDatatables=true
   ```
2. Review the diff: parent version → 4.0.x, property/API renames, removed-API rewrites.
3. (If needed) run the Jackson 2→3 recipe — expected to be a no-op here given §2.3.
4. Commit the OpenRewrite output as its own commit so it is auditable.

### Milestone 3 — Manual dependency & config fixes
1. Bump `logstash-logback-encoder` to 8.x (§2.4).
2. Verify/adjust `jjwt-*` and `bucket4j-core` versions; confirm Jackson-2 coexistence.
3. Swap `org.springframework.lang.NonNull` → JSpecify (or remove) in `JwtAuthFilter`.
4. Re-confirm `SecurityConfig` compiles against Security 7 (no removed DSL methods).
5. `mvn -U clean compile` → resolve any remaining breakages.

### Milestone 4 — Data & security regression
1. **Fresh-volume DB test:** `docker compose down -v && docker compose up --build` →
   confirm Flyway applies V1–V6 and Hibernate `validate` passes under Hibernate 7.
2. Run Milestone 0 test suite → must be green.
3. Manual auth smoke: login, JWT issued/verified, rate-limit 429 after 5 attempts,
   deactivated-user 401, `@PreAuthorize` 403.

### Milestone 5 — Virtual threads (the payoff)
1. Add `spring.threads.virtual.enabled: true` to `application.yml`.
2. Re-run the full test suite + manual smoke under the new threading model (watch for any
   `ThreadLocal`/synchronized pinning — our code uses none of note; `SecurityContextHolder`
   is virtual-thread-safe).
3. Proceed to §4 load testing.

### Milestone 6 — Cutover
1. Update `backend/Dockerfile` base images if bumping JDK (otherwise keep `temurin:21`).
2. Update `pom.xml` comments, `implementation_plan.md`, and `CLAUDE.md`/README stack table
   (Spring Boot 4 / Framework 7).
3. Merge `feat/spring-boot-4` → `main` after green CI.

---

## 4. Production Testing & Performance Verification

### 4.1 Functional regression
- `mvn test` (Milestone 0 suite) green against Spring Boot 4.
- Full manual smoke against a `docker compose up --build` stack on a fresh volume:
  register → login → create incident → assign → status change → comment → audit log →
  CSV export → admin stats → user activate/deactivate.

### 4.2 Virtual-threads load test (the core performance claim)
- **Tool:** k6 or JMeter against `POST /api/auth/login` + `GET /api/incidents?page=&size=`
  (both block on JDBC — representative of the I/O profile).
- **Method:** A/B compare two builds — virtual threads **off** vs **on** — at rising
  concurrency (e.g. 50 → 200 → 500 → 1000 VUs).
- **Metrics to capture:** p95/p99 latency, throughput (req/s), error rate, and **peak heap /
  RSS** (via the container + actuator metrics). Expectation for an I/O-bound app: virtual
  threads sustain higher concurrency before latency degrades, without growing the platform
  thread pool.
- **Watch for thread pinning:** monitor with `-Djdk.tracePinnedThreads=short` during the test;
  confirm no `synchronized`-over-blocking-I/O pinning warnings.

### 4.3 Observability / metrics endpoints
- Temporarily expand actuator exposure in a **non-prod** profile to include `metrics` and
  `threaddump`; confirm:
  - `/actuator/health` returns 200 (liveness/readiness probes intact).
  - `/actuator/metrics/jvm.threads.live` and virtual-thread metrics behave as expected.
  - JSON log file still rotates and round-trips (`logback-spring.xml` after encoder bump).
- **Revert exposure to `health`-only before production** (matches current hardened config in
  `application.yml` + `SecurityConfig`).

### 4.4 Acceptance criteria
- All regression tests green on Spring Boot 4.0.x.
- Flyway V1–V6 apply cleanly on a fresh volume; Hibernate `validate` passes.
- Auth, rate-limiting, role guards, and audit logging behave identically to the 3.3.4 baseline.
- Load test shows virtual-threads build ≥ baseline throughput with no pinning warnings.
- Actuator health probe and JSON logging verified; actuator exposure reverted to `health`-only.

---

## Appendix — One-paragraph executive summary

This Spring Boot 3.3.4 / Java 21 backend is an unusually clean migration candidate: it is
already on the `jakarta.*` namespace, the lambda Security DSL, and has zero Jackson coupling,
so the expensive parts of a Spring upgrade are already done. Reaching Spring Boot 4.0 /
Framework 7.0 is an estimated ~2 focused days, gated on first building the regression test
suite the project currently lacks. The payoff is a supported, CVE-patched baseline plus
virtual-thread scalability for this I/O-bound workload — solid future-proofing and a strong
thesis artifact, though no current feature is blocked by staying on Spring Boot 3.
