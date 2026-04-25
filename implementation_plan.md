# Implementation Plan — Incident Management System
**Source of Truth · Last Updated: 2026-04-25**

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
- [ ] **Strengthen JWT secret** — generate a cryptographically random 64-char string; update `.env` and `.env.example` placeholder
- [ ] **Change default admin password** — update `.env` default away from `admin123`; document change in README
- [ ] **HTTPS termination** — install Caddy on the production server (PHASE_07); add `Caddyfile` to repo with TLS config and `reverse_proxy localhost:8080`
- [ ] **HSTS header** — add `Strict-Transport-Security: max-age=31536000` in `nginx.conf` for production profile
- [ ] **Security headers** — add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` to Nginx response headers

**Definition of Done:** Brute-forcing login returns 429 after 5 attempts. Weak passwords are rejected on both backend (400) and frontend (inline error). App is only accessible over HTTPS on the production domain. Security headers verified with securityheaders.com.

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
- [ ] **AuditLog entity** — new table with columns: `id`, `actor_username`, `action` (enum: `INCIDENT_CREATED`, `STATUS_CHANGED`), `incident_id`, `detail`, `occurred_at`
- [ ] **AuditLogRepository** — `findByIncidentIdOrderByOccurredAtDesc`
- [ ] **AuditLogService** — `record(actor, action, incidentId, detail)` called from `IncidentService` on create and status change
- [ ] **Flyway migration V3** — `V3__create_audit_log_table.sql`
- [ ] **GET /api/admin/audit** endpoint — admin-only; returns audit entries, optionally filtered by `incidentId`
- [ ] **Structured logging** — configure Logback in `logback-spring.xml` to write JSON logs to `/logs/app.log` with daily rotation and 30-day retention
- [ ] **Frontend: show audit trail** — add a collapsible "History" section in `IncidentDetailPage` for admins

**Definition of Done:** Every status change and incident creation appears in the `audit_log` table with actor, timestamp, and details. Admin can query the audit trail via API. App log file rotates daily and is parseable as JSON.

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

**Definition of Done:** List page with 500+ rows loads in under 200ms (verified with DB populated via DataSeeder). Filter by status works end-to-end. Email is sent (verified via Mailtrap or similar in dev). Session expiry shows a dialog instead of silently losing form data.

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

**Overall:** Core product complete. Production hardening not yet started.

---

## How to Resume

---

*To resume this project in a new session, the user should run:*

> "Read `implementation_plan.md`, sync with the current status, and wait for my command to start the next `[ ] TODO` task."

---

**Next pending task:** `PHASE_02_SECURITY` — Rate limiting on the login endpoint (Bucket4j filter).
