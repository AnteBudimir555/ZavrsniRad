# Implementation Plan — Incident Management System
**Source of Truth · Last Updated: 2026-04-30**

---

## Architecture Overview

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 18 + TypeScript + Material-UI + Vite | SPA served by Nginx |
| API Gateway | Nginx (inside frontend container) | Serves static files, reverse-proxies `/api/*` to backend |
| Backend | Spring Boot 3 + Spring Security + JWT | Stateless REST API on port 8080 |
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
PHASE_02_SECURITY      [ ] TODO       Harden auth and transport layer
PHASE_03_DATABASE      [ ] TODO       Production-safe schema management + backups
PHASE_04_OBSERVABILITY [ ] TODO       Audit trail, health checks, structured logs
PHASE_05_USER_MGMT     [ ] TODO       Admin: list, activate, deactivate accounts
PHASE_06_FEATURES      [ ] TODO       Pagination, email notifications, filters
PHASE_07_DEPLOYMENT    [ ] TODO       Real server, HTTPS, firewall, CI/CD
PHASE_08_DOMAIN_HARDEN [ ] TODO       Mentor-driven: incidentTime, location, assignedTo, AuditLog, comments
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

### PHASE_02_SECURITY — Harden Auth and Transport
> Status: **TODO** · Priority: CRITICAL

- [ ] **Rate limiting on login endpoint** — add Bucket4j dependency to `pom.xml`; create `RateLimitFilter` that allows max 5 requests/minute per IP on `/api/auth/**`; return `429 Too Many Requests` on breach
- [ ] **Password length validation** — add `@Size(min = 8)` to `AuthRequest.password`; update frontend `LoginPage` and `RegisterPage` form rules to match
- [ ] **Strengthen JWT secret** — generate 64 random bytes and Base64-encode them (canonical path); `JwtService` also tolerates raw UTF-8 secrets ≥ 32 bytes as a fallback. Update `.env` and `.env.example` placeholder.
- [ ] **Change default admin password** — update `.env` default away from `admin123`; document change in README
- [ ] **HTTPS termination** — install Caddy on the production server (PHASE_07); add `Caddyfile` to repo with TLS config and `reverse_proxy localhost:8080`
- [ ] **HSTS header** — add `Strict-Transport-Security: max-age=31536000` in `nginx.conf` for production profile
- [ ] **Security headers** — add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` to Nginx response headers
- [x] **`JwtService` non-Base64 secret hot-fix** — JJWT 0.12.x throws `DecodingException` (extends `RuntimeException`, NOT `IllegalArgumentException`), so the original catch never triggered and the context refused to start on a non-Base64 `JWT_SECRET`. Catch widened to `DecodingException | IllegalArgumentException`. *Follow-up:* add a unit test in `JwtServiceTest` that constructs the bean with a non-Base64 secret and asserts no exception.
- [ ] **LocalStorage vs HttpOnly cookie — trade-off note** — current frontend stores the JWT in `localStorage` (vulnerable to XSS exfiltration). Document in README the rationale (simpler stateless setup, no CSRF surface) and the migration condition (move to HttpOnly + SameSite=Strict cookie + CSRF token if any user-supplied HTML is ever rendered un-sanitized).

**Definition of Done:** Brute-forcing login returns 429 after 5 attempts. Weak passwords are rejected on both backend (400) and frontend (inline error). App is only accessible over HTTPS on the production domain. Security headers verified with securityheaders.com. Backend boots cleanly with any reasonable `JWT_SECRET` value (Base64 or raw).

---

### PHASE_03_DATABASE — Production-Safe Schema Management
> Status: **TODO** · Priority: CRITICAL

- [ ] **Add Flyway dependency** to `backend/pom.xml`
- [ ] **Write V1 migration** — `src/main/resources/db/migration/V1__create_users_table.sql`
- [ ] **Write V2 migration** — `src/main/resources/db/migration/V2__create_incidents_table.sql`
- [ ] **Switch ddl-auto** — change `application.yml` from `update` to `validate`; Flyway now owns the schema
- [ ] **Write pg_dump backup script** — `scripts/backup.sh` that dumps to `/backups/incidents_YYYY-MM-DD.sql` and deletes files older than 30 days
- [ ] **Test restore procedure** — restore from a backup dump into a clean DB instance; verify all rows and FK relationships survive
- [ ] **Document backup process** — add backup/restore instructions to README

**Definition of Done:** App starts cleanly with `ddl-auto: validate`. A fresh deploy runs Flyway migrations in order from scratch. Backup script runs without error. Restore procedure verified manually.

---

### PHASE_04_OBSERVABILITY — Audit Trail, Health, Logs
> Status: **TODO** · Priority: IMPORTANT

- [ ] **Spring Boot Actuator** — add dependency; expose only `/actuator/health` publicly; keep all other actuator endpoints behind auth
- [ ] **Structured logging** — configure Logback in `logback-spring.xml` to write JSON logs to `/logs/app.log` with daily rotation and 30-day retention
- [→] **AuditLog moved to PHASE_08** (consolidated with the domain fields it audits — `incidentTime`, `assignedTo`, status changes, comments).

**Definition of Done:** `/actuator/health` returns 200 over HTTP. App log file rotates daily and is parseable as JSON.

---

### PHASE_05_USER_MANAGEMENT — Admin Account Control
> Status: **TODO** · Priority: IMPORTANT

- [ ] **Add `active` column to users** — Flyway migration V4; default `true`; `User` entity gets `boolean active` field
- [ ] **Block inactive users from login** — `AppUserDetailsService.loadUserByUsername` checks `active` flag; throws `DisabledException` if false; `GlobalExceptionHandler` returns 401
- [ ] **GET /api/admin/users** — admin-only; returns list of all users (id, username, role, active, createdAt); no passwords
- [ ] **UserDto** — response DTO (never expose the password field)
- [ ] **PATCH /api/admin/users/{id}** — admin-only; body `{ "active": false }`; cannot deactivate self (guard in service layer)
- [ ] **Frontend: User Management page** — new route `/admin/users`; DataGrid with columns (username, role, status, created); toggle active/inactive button per row; visible only to admins
- [ ] **Add nav link** — TopBar shows "Users" link for admins

**Definition of Done:** Admin can view all accounts. Deactivating a user prevents their next login (existing JWT is still valid until expiry — acceptable for thesis scope). Admin cannot accidentally deactivate their own account. Reactivation works.

---

### PHASE_06_FEATURES — Pagination, Notifications, Filters
> Status: **TODO** · Priority: GOOD TO HAVE

- [ ] **Backend pagination** — change `IncidentRepository` to return `Page<Incident>`; accept `Pageable` parameter; controller accepts `?page=0&size=20&sort=createdAt,desc`
- [ ] **Frontend pagination** — remove client-side `pageSizeOptions` workaround; send `page` and `size` to API; update DataGrid `rowCount` and `paginationMode="server"`
- [ ] **Incident filters on backend** — add `findByStatus`, `findByCategory`, `findBySeverity` or use JPA Specification for dynamic filtering
- [ ] **Incident filters on frontend** — add filter dropdowns (Status, Category, Severity) above DataGrid
- [ ] **Email notification — dependency** — add `spring-boot-starter-mail` to `pom.xml`; configure SMTP in `application.yml` (env-var driven)
- [ ] **Email notification — logic** — `EmailService` sends "Your incident #N status changed to X" to reporter on status update; called from `IncidentService.updateStatus`
- [ ] **Session expiry warning** — detect 401 response in axios interceptor; instead of immediate redirect, show a MUI Dialog "Your session has expired. Please log in again." with a single "Go to Login" button
- [ ] **CSV export** — `GET /api/admin/incidents/export.csv` (admin-only); streams results respecting current filter params; Content-Disposition `attachment; filename=incidents-YYYY-MM-DD.csv`. Frontend: "Export CSV" button on `IncidentListPage` (admin scope only).
- [ ] **Admin stats dashboard** — `GET /api/admin/stats` returns `{ openCount, inProgressCount, resolvedCount, byCategory, bySeverity, avgResolutionMinutes }`. New `/admin/stats` route on the frontend with MUI cards + a small bar chart (e.g. recharts).
- [ ] **Loading skeletons** — replace blank/spinner states on `IncidentListPage`, `IncidentDetailPage`, and the new stats page with MUI `Skeleton` components matching final layout.

**Definition of Done:** List page with 500+ rows loads in under 200ms (verified with DB populated via DataSeeder). Filter by status works end-to-end. Email is sent (verified via Mailtrap or similar in dev). Session expiry shows a dialog instead of silently losing form data. CSV export downloads a valid file. Admin stats page renders all cards and the chart with non-zero data.

---

### PHASE_07_DEPLOYMENT — Production Server
> Status: **TODO** · Priority: IMPORTANT (for real institutional use)

- [ ] **Provision server** — Linux VPS (Ubuntu 22.04 LTS recommended, 2 vCPU / 4 GB RAM minimum); document provider and specs
- [ ] **Install Docker + Compose** — `apt install docker.io docker-compose-plugin`; add deploy user to `docker` group
- [ ] **Register domain** — DNS A record pointing to server IP (e.g. `incidents.foi.hr`)
- [ ] **Install Caddy** — `apt install caddy`; write `Caddyfile` with automatic HTTPS (`tls` block); reverse proxy to port 8080
- [ ] **Configure firewall** — `ufw allow 22`, `ufw allow 80`, `ufw allow 443`; deny everything else including 8080 and 5432 from external
- [ ] **Production `.env`** — set strong `JWT_SECRET`, strong `ADMIN_PASSWORD`, correct `POSTGRES_*` values; store securely (not in git)
- [ ] **Systemd service** — write `/etc/systemd/system/incidentapp.service` to run `docker compose up` on boot and restart on failure
- [ ] **Automated backups** — install `scripts/backup.sh` as a daily cron job (`0 2 * * *`); verify output in `/backups/`
- [ ] **Smoke test** — register a reporter, create an incident, log in as admin, change status; verify HTTPS in browser padlock

**Definition of Done:** App is reachable at `https://your-domain.example` with a valid TLS cert (auto-renewed by Caddy). App survives server reboot. Backup runs nightly. Port scan confirms only 80 and 443 are open. All smoke test steps pass.

---

### PHASE_08_DOMAIN_HARDENING — Mentor-Driven Domain Hardening
> Status: **TODO** · Priority: CRITICAL (blocks realistic use)

#### Backend
- [x] **Add `incidentTime` to `Incident`** — `LocalDateTime`, nullable=false, validated `@PastOrPresent`. Distinct from `createdAt` (when the row was written) — captures when the incident actually happened.
- [x] **Add `location` to `Incident`** — `String`, nullable=true, max length 200 (free text; e.g. "Server room B, rack 3").
- [ ] **Add `assignedTo` to `Incident`** — `@ManyToOne(fetch=LAZY)` to `User`, nullable=true. No role validation — any user can be assigned (scope decision; tightening to a TECHNICIAN role is left for a future phase).
- [x] **Update `CreateIncidentRequest`** — `incidentTime` (required, `@PastOrPresent`) and `location` (optional, `@Size(max=200)`) added. `assignedTo` is NOT settable on create (admin-only later via PATCH).
- [x] **Update `IncidentDto`** — `incidentTime` and `location` exposed. Still TODO: `assignedToUsername` (null-safe).
- [ ] **New endpoint:** `PATCH /api/incidents/{id}/assignee` — admin-only; body `{ "assigneeUsername": "..." }` or `null` to unassign. Writes AuditLog entry.
- [ ] **`AuditLog` entity** — `id`, `actorUsername`, `action` (enum `INCIDENT_CREATED`, `STATUS_CHANGED`, `ASSIGNEE_CHANGED`, `COMMENT_ADDED`), `incidentId`, `detail` (free-text, e.g. `"OPEN → IN_PROGRESS"`), `occurredAt`.
- [ ] **`AuditLogRepository`** — `findByIncidentIdOrderByOccurredAtDesc`.
- [ ] **`AuditLogService`** — `record(actor, action, incidentId, detail)`. Called from `IncidentService` on create / `updateStatus` / new assignee endpoint / new comment endpoint.
- [ ] **`Comment` entity + repo + service + endpoints** — `POST /api/incidents/{id}/comments`, `GET /api/incidents/{id}/comments`. Reporter can comment on own incident; admin on any. Writes AuditLog.
- [ ] **`GET /api/admin/audit?incidentId=`** — admin-only; returns audit entries.
- [ ] **Flyway migrations** (run after PHASE_03 lands; otherwise rely on `ddl-auto: update` and convert later):
  - `V5__alter_incidents_add_fields.sql` (incident_time, location, assigned_to_id FK)
  - `V6__create_audit_log_table.sql`
  - `V7__create_comments_table.sql`

#### Frontend
- [x] **`IncidentFormPage`** — `incidentTime` and `location` inputs added. `incidentTime` is a native `<TextField type="datetime-local">` (default now, capped at now). `location` is an optional free-text field (max 200). Dependency upgrade to `@mui/x-date-pickers` deferred.
- [ ] **`IncidentDetailPage`** — show `incidentTime`, `location`, `assignedToUsername`. Admin-only "Assign…" action (autocomplete of users). Collapsible **History** section (audit log) and **Comments** thread.
- [ ] **`IncidentListPage`** — add `incidentTime`, `location`, and `assignedTo` columns.
- [ ] **`api/incidents.ts`** — add `assignIncident`, `listAuditForIncident`, `addComment`, `listComments`, `listUsers` typed clients.

**Definition of Done:** A reporter can record an incident with a real occurrence time and location. An admin can assign it to any user, change status, and add comments — every such action appears in the AuditLog. Detail page shows full history + comment thread. No regression in existing flows.

---

## Progress Summary

| Phase | Status | Completion |
|---|---|---|
| PHASE_01_CORE | DONE | 100% |
| PHASE_02_SECURITY | TODO | 0% |
| PHASE_03_DATABASE | TODO | 0% |
| PHASE_04_OBSERVABILITY | TODO | 0% |
| PHASE_05_USER_MGMT | TODO | 0% |
| PHASE_06_FEATURES | TODO | 0% |
| PHASE_07_DEPLOYMENT | TODO | 0% |
| PHASE_08_DOMAIN_HARDENING | IN PROGRESS | ~10% |

**Overall:** Core product complete. Production hardening not yet started. Mentor smoke-test surfaced one critical startup bug (fixed) and a domain-hardening backlog (PHASE_08).

---

## How to Resume

---

*To resume this project in a new session, the user should run:*

> "Read `implementation_plan.md`, sync with the current status, and wait for my command to start the next `[ ] TODO` task."

---

**Next pending task:** `PHASE_08_DOMAIN_HARDENING` — add `assignedTo` (`@ManyToOne` to `User`) to `Incident` + `PATCH /api/incidents/{id}/assignee` endpoint + the AuditLog entity/service. (`incidentTime` and `location` are wired end-to-end as of 2026-04-30. `JwtService` non-Base64 hot-fix is already applied — see PHASE_02.)
