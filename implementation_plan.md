# Implementation Plan — Incident Management System
**Source of Truth · Last Updated: 2026-06-08 (backend upgraded to Spring Boot 4.0.6 + virtual threads)**

---

## Architecture Overview

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 18 + TypeScript + Material-UI + Vite | SPA served by Nginx |
| API Gateway | Nginx (inside frontend container) | Serves static files, reverse-proxies `/api/*` to backend |
| Backend | Spring Boot 4 (Framework 7) + Spring Security + JWT, Java 21 + virtual threads | Stateless REST API on port 8080 |
| Database | PostgreSQL 16 | Persistent relational store |
| Container Runtime | Docker + Docker Compose | Orchestrates all 3 services on a shared bridge network |
| Auth Model | JWT (HS256) in `Authorization: Bearer` header | Stateless — no HTTP sessions |
| Role Model | Two roles: `ADMIN` (full access) · `REPORTER` (own incidents only) |

**Entry point:** `http://localhost:8080` → Nginx → React SPA  
**API base:** `/api/**` → Nginx proxy → Spring Boot at `backend:8080`  
**DB host inside Docker:** `db:5432` (service name, not localhost)

---

## Modular Roadmap

```
PHASE_01_CORE          [x] DONE       Core app — fully working end-to-end
PHASE_08_DOMAIN_HARDEN [x] DONE       incidentTime, location, assignedTo, AuditLog, comments
PHASE_03_DATABASE      [x] DONE       Flyway migrations + ddl-auto: validate + backup script
PHASE_02_SECURITY      [x] DONE       Harden auth and transport layer
PHASE_04_OBSERVABILITY [x] DONE       Actuator health endpoint + JSON structured logs
PHASE_05_USER_MGMT     [x] DONE       Admin: list, activate, deactivate accounts
PHASE_06_FEATURES      [ ] TODO       Pagination, email notifications, filters
PHASE_07_DEPLOYMENT    [ ] TODO       Real server, HTTPS, firewall, CI/CD
```

---

## Task Checklist

---

### PHASE_01_CORE — Core Application
> Status: **COMPLETE**

#### Backend
- [x] Spring Boot 3 project scaffold (`pom.xml`, `application.yml`)
- [x] PostgreSQL datasource configured (env-var overridable)
- [x] `User` entity → maps to `users` table (id, username, password, role, created_at)
- [x] `Role` enum (`ADMIN`, `REPORTER`)
- [x] `UserRepository` with `findByUsername`, `existsByUsername`
- [x] `AppUserDetailsService` (loads user for Spring Security)
- [x] `JwtService` — generates and verifies HS256 tokens
- [x] `JwtAuthFilter` — reads JWT from every request, sets Security Context
- [x] `AuthController` — `POST /api/auth/login` and `POST /api/auth/register`
- [x] `AuthRequest` / `AuthResponse` DTOs
- [x] `DataSeeder` — creates admin account at startup from `.env`
- [x] `SecurityConfig` — stateless, CSRF disabled, BCrypt, `@EnableMethodSecurity`
- [x] `AppProperties` — typed config record for jwt + admin blocks
- [x] `Incident` entity → maps to `incidents` table (all fields, FK to users)
- [x] `IncidentCategory`, `IncidentSeverity`, `IncidentStatus` enums
- [x] `IncidentRepository` — derived queries (list all, list by reporter)
- [x] `IncidentService` — create, listAll, listForReporter, getById, updateStatus
- [x] `IncidentController` — 5 REST endpoints with role guards
- [x] `CreateIncidentRequest`, `IncidentDto`, `UpdateStatusRequest` DTOs
- [x] `GlobalExceptionHandler` — maps all exceptions to correct HTTP codes

#### Frontend
- [x] React 18 + TypeScript + Vite scaffold
- [x] Material-UI theme configured (`theme.ts`)
- [x] `AuthContext` — global auth state (token, username, role) + localStorage persistence
- [x] `useAuth()` hook
- [x] `ProtectedRoute` — bounces unauthenticated users to `/login`
- [x] `LoginPage` with form validation
- [x] `RegisterPage` with form validation
- [x] `App.tsx` — TopBar + full route table (login / register / list / form / detail)
- [x] `api/client.ts` — axios instance with request interceptor (auto-attach JWT) and response interceptor (401 → redirect to login)
- [x] `api/incidents.ts` — typed API calls for all incident endpoints
- [x] `IncidentListPage` — MUI DataGrid, scope prop (all / mine), resolve action for admin
- [x] `IncidentFormPage` — create new incident (category, severity dropdowns)
- [x] `IncidentDetailPage` — view single incident

#### Infrastructure
- [x] `backend/Dockerfile` — multi-stage (Maven build → minimal JRE, non-root user)
- [x] `frontend/Dockerfile` — multi-stage (Node build → Nginx, non-root)
- [x] `frontend/nginx.conf` — serves SPA + proxies `/api/*` to `backend:8080`
- [x] `docker-compose.yml` — 3 services, healthcheck on db, named volume `db-data`, bridge network `incident-net`
- [x] `.env` / `.env.example` — externalized secrets

**Definition of Done:** All three containers start with `docker compose up --build`. Admin can log in, create incidents, change status. Reporter can register, log in, create and view own incidents only.

---

### PHASE_08_DOMAIN_HARDENING — Domain Hardening
> Status: **COMPLETE**

#### Backend
- [x] **Add `incidentTime` to `Incident`** — `LocalDateTime`, nullable=false. Captures when the incident actually happened (distinct from `createdAt`).
- [x] **Add `location` to `Incident`** — `String`, nullable=true, max length 200.
- [x] **Add `assignedTo` to `Incident`** — `@ManyToOne(fetch=LAZY)` to `User`, nullable=true.
- [x] **Update `CreateIncidentRequest`** — `incidentTime` (required) and `location` (optional) added.
- [x] **Update `IncidentDto`** — `incidentTime`, `location`, and `assignedToUsername` exposed.
- [x] **`PATCH /api/incidents/{id}/assignee`** — admin-only; body `{ "assigneeUsername": "..." }` or `null` to unassign. Writes AuditLog entry.
- [x] **`AuditLog` entity + repository + service** — records `INCIDENT_CREATED`, `STATUS_CHANGED`, `ASSIGNEE_CHANGED`, `COMMENT_ADDED` events.
- [x] **`GET /api/admin/audit?incidentId=`** — admin-only; returns audit entries newest-first.
- [x] **`Comment` entity + repository + service** — `POST /api/incidents/{id}/comments`, `GET /api/incidents/{id}/comments`. Reporter on own incident; admin on any. Writes AuditLog.

#### Frontend
- [x] **`IncidentFormPage`** — `incidentTime` and `location` inputs added.
- [x] **`IncidentDetailPage`** — shows `incidentTime`, `location`, `assignedToUsername`; admin "Assign…" dialog; collapsible History (audit log); Comments thread with post form.
- [x] **`IncidentListPage`** — `incidentTime`, `location`, `assignedTo` columns; row click navigates to detail.
- [x] **`api/incidents.ts`** — `assign`, `listAudit`, `addComment`, `listComments` typed clients added.

**Definition of Done:** A reporter can record an incident with a real occurrence time and location. An admin can assign it, change status, and add comments — every action appears in the AuditLog. Detail page shows full history + comment thread. ✓

---

### PHASE_03_DATABASE — Production-Safe Schema Management
> Status: **COMPLETE**

**Context:** The app currently runs with `ddl-auto: update` — Hibernate auto-creates tables. This is fine for development but dangerous for production (Hibernate can silently drop columns on rename). Flyway replaces it: we write explicit SQL migration files and Hibernate only *validates* that the DB matches the entities.

**Current DB state** (all tables exist via `ddl-auto: update`):
- `users`, `incidents` (with all Phase 8 fields), `audit_log`, `comments`

**Migration plan — all four tables in one go:**
- V1 → users
- V2 → incidents (includes `incident_time`, `location`, `assigned_to_id` — already in the entity)
- V3 → audit_log
- V4 → comments

#### Tasks
- [x] **Add Flyway dependency** — `flyway-core` and `flyway-database-postgresql` added to `backend/pom.xml`
- [x] **Write V1 migration** — `src/main/resources/db/migration/V1__create_users_table.sql`
- [x] **Write V2 migration** — `src/main/resources/db/migration/V2__create_incidents_table.sql` (includes all Phase 8 columns + FK indexes)
- [x] **Write V3 migration** — `src/main/resources/db/migration/V3__create_audit_log_table.sql`
- [x] **Write V4 migration** — `src/main/resources/db/migration/V4__create_comments_table.sql`
- [x] **Switch ddl-auto** — `application.yml` now uses `validate`; Flyway owns the schema
- [x] **Document reset procedure** — note added to `application.yml` and README §6; `docker compose down -v && docker compose up --build` for the one-time wipe
- [x] **Write pg_dump backup script** — `scripts/backup.sh` (daily dump, 30-day retention, `--local` flag for non-Docker hosts)
- [x] **Document backup/restore** — added to README §7

**Definition of Done:** App starts cleanly with `ddl-auto: validate` on a fresh volume. Flyway applies V1–V4 in order. Backup script runs without error. ✓ Verified end-to-end on 2026-05-03.

---

### PHASE_02_SECURITY — Harden Auth and Transport
> Status: **COMPLETE** (admin password change deferred to pre-production) · Priority: CRITICAL

- [x] **Rate limiting on login endpoint** — Bucket4j 8.10.1 added to `pom.xml`; `RateLimitFilter` allows 5 req/min per client IP on `/api/auth/**`, registered before `JwtAuthFilter`. Returns `429` with `Retry-After: 60` and JSON body `{"status":429,"message":"..."}`. Verified end-to-end on 2026-05-03
- [x] **Password length validation** — add `@Size(min = 8)` to `AuthRequest.password`; update frontend `LoginPage` and `RegisterPage` form rules to match
- [x] **Strengthen JWT secret** — generate 64 random bytes and Base64-encode them; update `.env` and `.env.example` placeholder
- [x] **HTTPS termination** — add `Caddyfile` to repo with TLS config (wired up in PHASE_07)
- [x] **HSTS header** — add `Strict-Transport-Security: max-age=31536000` in `nginx.conf`
- [x] **Security headers** — add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` to Nginx response headers
- [x] **`JwtService` non-Base64 secret hot-fix** — catch widened to `DecodingException | IllegalArgumentException`
- [x] **LocalStorage vs HttpOnly cookie — trade-off note** — document in README the rationale and migration condition (README §8)
- [ ] **Change default admin password** — update `.env` default away from `admin123`; document change in README *(deferred — do last, before production)*

**Definition of Done:** Brute-forcing login returns 429 after 5 attempts. Weak passwords rejected on both sides. Security headers verified. Backend boots cleanly with any reasonable `JWT_SECRET`.

---

### PHASE_04_OBSERVABILITY — Health Checks + Structured Logs
> Status: **COMPLETE**

- [x] **Spring Boot Actuator** — `spring-boot-starter-actuator` added to `pom.xml`. `application.yml` exposes ONLY `/actuator/health` (`management.endpoints.web.exposure.include: health`). `SecurityConfig` permits `GET /actuator/health` and `/actuator/health/**`; everything else under `/actuator/**` is not exposed at all. Nginx proxies `/actuator/health` to the backend so external uptime monitors can reach it. Docker `healthcheck` block on the backend polls this URL every 30s and reports `(healthy)` in `docker ps`.
- [x] **Structured logging** — `logstash-logback-encoder` 7.4 added to `pom.xml`. `logback-spring.xml` configures two appenders: console (plain text for `docker compose logs`) and `JSON_FILE` (one JSON object per line at `/logs/app.log`). `SizeAndTimeBasedRollingPolicy` rotates daily (also rolls over at 100 MB per file), keeps 30 days of `*.log.gz` archives, and caps total size at 1 GB. The `backend-logs` named Docker volume in `docker-compose.yml` makes archives survive container restarts. Custom field `app: "incidentapp"` on every event for multi-service log streams.

**Definition of Done:** `/actuator/health` returns 200 over HTTP. App log file rotates daily and is parseable as JSON. ✓ Verified end-to-end on 2026-05-04 — backend reports `(healthy)`, JSON lines round-trip through `python -m json.tool`.

---

### PHASE_05_USER_MANAGEMENT — Admin Account Control
> Status: **COMPLETE**

- [x] **Add `active` column to users** — Flyway migration **V5** (`V5__add_active_column_to_users.sql`) with `BOOLEAN NOT NULL DEFAULT TRUE`; `User` entity gets `boolean active = true`
- [x] **Block inactive users from login** — `AppUserDetailsService` builds the Spring `UserDetails` with `.disabled(!user.isActive())`; `DaoAuthenticationProvider` throws `DisabledException` during pre-checks; `GlobalExceptionHandler` returns 401 with message "This account has been deactivated."
- [x] **GET /api/admin/users** — admin-only; returns id, username, role, active, createdAt
- [x] **UserDto** — extended to (id, username, role, active, createdAt); never exposes the password
- [x] **PATCH /api/admin/users/{id}** — admin-only; body `{ "active": boolean }`; `UserService.setActive` throws `AccessDeniedException` when an admin targets their own account
- [x] **Frontend: User Management page** — `/admin/users`, DataGrid with username/role/status/created columns, Activate/Deactivate button per row, confirmation dialog before toggle, "— self —" placeholder on the current admin's row
- [x] **Add nav link** — TopBar shows "Users" link for admins
- [x] **Wire up Assign autocomplete** — `IncidentDetailPage` already populates the "Assign…" dialog from `usersApi.listAll()` (now returns the extended `UserSummary` shape — no further change needed)

**Definition of Done:** Admin can view all accounts. Deactivating a user prevents their next login (existing JWTs remain valid until expiry — documented in the confirmation dialog). Admin cannot deactivate their own account. Reactivation works. Assign autocomplete shows real usernames. ✓

---

### PHASE_06_FEATURES — Pagination, Notifications, Filters
> Status: **TODO** · Priority: GOOD TO HAVE

- [x] **Backend pagination** — change `IncidentRepository` to return `Page<Incident>`; accept `Pageable` parameter; controller accepts `?page=0&size=20&sort=createdAt,desc`
- [x] **Frontend pagination** — remove client-side `pageSizeOptions` workaround; send `page` and `size` to API; update DataGrid `rowCount` and `paginationMode="server"`
- [x] **Incident filters on backend** — add `findByStatus`, `findByCategory`, `findBySeverity` or use JPA Specification for dynamic filtering
- [x] **Incident filters on frontend** — add filter dropdowns (Status, Category, Severity) above DataGrid
- [x] **Email notification — dependency** — add `spring-boot-starter-mail` to `pom.xml`; configure SMTP in `application.yml` (env-var driven)
- [x] **Email notification — logic** — `EmailService` sends "Your incident #N status changed to X" to reporter on status update; called from `IncidentService.updateStatus`
- [x] **Session expiry warning** — detect 401 response in axios interceptor; show a MUI Dialog "Your session has expired. Please log in again." instead of silent redirect
- [x] **CSV export** — `GET /api/incidents/export.csv` (admin-only); Content-Disposition `attachment`. Frontend: "Export CSV" button on `IncidentListPage`.
- [x] **Admin stats dashboard** — `GET /api/admin/stats` returns counts by status/category/severity. New `/admin/stats` route with MUI cards + bar chart.
- [x] **Loading skeletons** — replace blank/spinner states with MUI `Skeleton` components.

**Definition of Done:** List page with 500+ rows loads under 200ms. Filter by status works end-to-end. Email sent (verified via Mailtrap). Session expiry shows dialog. CSV export downloads a valid file.

---

### PHASE_07_DEPLOYMENT — Production Server
> Status: **TODO** · Priority: IMPORTANT (for real institutional use)

- [ ] **Provision server** — Linux VPS (Ubuntu 22.04 LTS, 2 vCPU / 4 GB RAM minimum)
- [ ] **Install Docker + Compose** — `apt install docker.io docker-compose-plugin`
- [ ] **Register domain** — DNS A record pointing to server IP
- [ ] **Install Caddy** — write `Caddyfile` with automatic HTTPS; reverse proxy to port 8080
- [ ] **Configure firewall** — allow 22, 80, 443; deny 8080 and 5432 from external
- [ ] **Production `.env`** — strong `JWT_SECRET`, strong `ADMIN_PASSWORD`, correct `POSTGRES_*`
- [ ] **Systemd service** — `/etc/systemd/system/incidentapp.service`; restart on failure
- [ ] **Automated backups** — `scripts/backup.sh` as daily cron (`0 2 * * *`)
- [ ] **Smoke test** — register reporter, create incident, change status; verify HTTPS padlock

**Definition of Done:** App reachable at `https://your-domain.example` with valid TLS. App survives reboot. Backup runs nightly. Port scan confirms only 80 and 443 open.

---

## Progress Summary

| Phase | Status | Completion |
|---|---|---|
| PHASE_01_CORE | DONE | 100% |
| PHASE_08_DOMAIN_HARDENING | DONE | 100% |
| PHASE_03_DATABASE | DONE | 100% |
| PHASE_02_SECURITY | DONE | 100% |
| PHASE_04_OBSERVABILITY | DONE | 100% |
| PHASE_05_USER_MGMT | DONE | 100% |
| PHASE_06_FEATURES | DONE | 100% |
| PHASE_07_DEPLOYMENT | TODO | 0% |

**Overall:** Core product, domain hardening, Flyway schema management, security hardening, observability, and user management all complete. Next: PHASE_06_FEATURES (server-side pagination, filters, email notifications, CSV export, admin stats).

---

## How to Resume

*To resume this project in a new session, the user should run:*

> "Read `implementation_plan.md`, sync with the current status, and wait for my command to start the next `[ ] TODO` task."

---

**Next pending task:** `PHASE_07_DEPLOYMENT` — provision a Linux VPS, install Docker + Caddy, configure HTTPS, firewall, and systemd service.
