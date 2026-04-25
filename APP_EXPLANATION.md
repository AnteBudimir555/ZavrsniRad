# Incident Management Application — Full Technical Explanation

---

## 1. The Big Picture (Architecture)

The application consists of **3 separate programs** running simultaneously, all wired together by Docker:

```
Browser (User)
    │
    │  http://localhost:8080
    ▼
┌─────────────────────────────────┐
│  FRONTEND CONTAINER             │
│  React app (built files)        │
│  served by Nginx                │
│                                 │
│  /api/* → proxied to backend ───┼──────────────────┐
└─────────────────────────────────┘                  │
                                                     ▼
                                    ┌────────────────────────────┐
                                    │  BACKEND CONTAINER         │
                                    │  Spring Boot (Java)        │
                                    │  REST API on port 8080     │
                                    │                            │
                                    │  talks to DB ──────────────┼──┐
                                    └────────────────────────────┘  │
                                                                     ▼
                                                    ┌───────────────────────┐
                                                    │  DATABASE CONTAINER   │
                                                    │  PostgreSQL 16        │
                                                    │  port 5432            │
                                                    │  data in Docker volume│
                                                    └───────────────────────┘
```

The browser **never** talks directly to the database. It only talks to the frontend, which passes API calls to the backend, which talks to the database. This is called a **3-tier architecture**.

---

## 2. Project Folder Structure

```
ZavrsniRad/
├── docker-compose.yml     ← "the master switch" — starts all 3 containers
├── .env                   ← secret values (passwords, JWT key) read by docker-compose
│
├── backend/               ← Java/Spring Boot application
│   ├── Dockerfile         ← how to package the backend into a container
│   ├── pom.xml            ← Maven: list of libraries the backend needs
│   └── src/main/java/hr/zavrsni/incidentapp/
│       ├── security/      ← login, register, JWT token logic
│       ├── user/          ← User entity + database access
│       ├── incident/      ← Incident entity + database access + business rules
│       ├── config/        ← Spring Security setup, app startup seeding
│       └── common/        ← error handling
│
└── frontend/              ← React/TypeScript application
    ├── Dockerfile         ← how to package the frontend into a container
    ├── nginx.conf         ← Nginx config (serves files + proxies /api)
    └── src/
        ├── api/           ← axios HTTP client (all calls to backend)
        ├── auth/          ← login page, register page, auth state
        ├── features/      ← the actual screens (list, form, detail)
        ├── App.tsx        ← top-level layout + route table
        └── main.tsx       ← entry point, renders <App>
```

---

## 3. The Backend Layer by Layer

The backend follows a strict 3-layer pattern. Think of it like a restaurant:

```
HTTP Request
     │
     ▼
┌──────────────┐
│  Controller  │  ← Waiter: takes the order, passes it to the kitchen
│              │    e.g. IncidentController.java
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Service    │  ← Kitchen: does the actual work, enforces rules
│              │    e.g. IncidentService.java
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Repository  │  ← Pantry/storage: talks to the database
│              │    e.g. IncidentRepository.java
└──────┬───────┘
       │
       ▼
  PostgreSQL DB
```

**Controller** — only handles HTTP. Reads the request, calls a service method, returns HTTP response. Has zero business logic.

**Service** — where all rules live. Examples from `IncidentService.java`:
- When creating an incident, it looks up the reporter from the DB first
- When changing status to `RESOLVED`, it also sets the `resolved_at` timestamp
- A reporter calling `getById` can only see their own incidents — others get a 403 Forbidden error

**Repository** — Spring Data JPA auto-generates all SQL from method names. Example:

```java
findByReporter_UsernameOrderByCreatedAtDesc(username)
// Spring turns this into:
// SELECT * FROM incidents WHERE reporter.username = ? ORDER BY created_at DESC
```

No manual SQL is written — the method name itself is the query.

---

## 4. The Database — Where Data Actually Lives

### Physical Storage

Data lives inside a Docker named volume called `db-data`. On the host machine this is managed by Docker's internal storage (not a normal visible folder). The volume **survives** `docker compose down`. Only `docker compose down -v` permanently deletes it.

### Table Structure

Two tables are created automatically by Hibernate (because of `ddl-auto: update` in `application.yml`):

#### `users` table

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT (auto-increment) | Primary key |
| `username` | VARCHAR(64) | Unique, not null |
| `password` | VARCHAR | BCrypt hash — never plaintext |
| `role` | VARCHAR(16) | Either `ADMIN` or `REPORTER` |
| `created_at` | TIMESTAMP | Set once on insert, never updated |

#### `incidents` table

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT (auto-increment) | Primary key |
| `title` | VARCHAR(140) | Required |
| `description` | TEXT | Long text, optional |
| `category` | VARCHAR(16) | Enum: `NETWORK`, `HARDWARE`, `SOFTWARE`, etc. |
| `severity` | VARCHAR(16) | Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `status` | VARCHAR(16) | Enum: `OPEN`, `IN_PROGRESS`, `RESOLVED` |
| `reporter_id` | BIGINT (FK) | Foreign key → `users.id` |
| `created_at` | TIMESTAMP | Auto-set on insert |
| `updated_at` | TIMESTAMP | Auto-updated on every save |
| `resolved_at` | TIMESTAMP | Set when status changes to `RESOLVED` |

### How Java Classes Map to Tables

The `@Entity` annotation tells Hibernate "this class is a table row." Each field with `@Column` becomes a column. The `@ManyToOne` on `reporter` creates the foreign key relationship — one user can have many incidents:

```
users                    incidents
─────                    ─────────
id ◄──────────────────── reporter_id  (Foreign Key)
username                 title
password                 status
role                     category
created_at               severity
                         created_at
                         updated_at
                         resolved_at
```

---

## 5. Authentication — How JWT Works

JWT (JSON Web Token) is the core security mechanism. Here is the complete login flow:

```
1.  User types username + password → clicks Login
2.  React calls POST /api/auth/login  { username, password }
3.  Backend: AuthController receives the request
4.  Spring Security checks BCrypt(password) against the hash stored in DB
5.  If match: JwtService.generateToken() creates a signed token string
6.  Token is returned to React → stored in localStorage
7.  Every future API call: React attaches it as "Authorization: Bearer <token>"
8.  Backend: JwtAuthFilter runs on every request, reads the token from the header
9.  JwtService.parse() verifies the cryptographic signature
10. If valid: Spring Security knows who the user is and what role they have
11. @PreAuthorize("hasRole('ADMIN')") checks either pass or fail accordingly
```

### What is a JWT?

A JWT is a string split into 3 parts separated by dots:

```
eyJhbGciOiJIUzI1NiJ9                         ← Header (algorithm used)
.
eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiJ9    ← Payload (username + role)
.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c ← Signature (tamper-proof seal)
```

The signature is created using the `JWT_SECRET` from the `.env` file. If anyone changes the payload, the signature no longer matches and the backend rejects the request. **The database is never queried again after login** — the token itself is the proof of identity.

### Admin Account

The admin account is created at application startup by `DataSeeder.java` using credentials from `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). Registering as admin through the UI is intentionally impossible — that would be a security hole.

---

## 6. The Frontend Layer by Layer

```
main.tsx
  └── <AuthProvider>      ← wraps everything; holds login state in memory + localStorage
        └── <App>
              ├── <TopBar>             ← navigation bar (shows username/role, logout button)
              └── <Routes>             ← React Router: maps URL → component
                    ├── /login         → LoginPage
                    ├── /register      → RegisterPage
                    ├── /              → IncidentListPage (scope="all" for admin, "mine" for reporter)
                    ├── /my-incidents  → IncidentListPage (scope="mine")
                    ├── /incidents/new → IncidentFormPage
                    └── /incidents/:id → IncidentDetailPage
```

### Key Frontend Concepts

**ProtectedRoute** — a wrapper component that checks `isAuthenticated`. If the user is not logged in and tries to visit a protected URL, it redirects them to `/login` automatically.

**AuthContext** — React's way of sharing state globally without passing data down through every component. Any component can call `useAuth()` and receive `{ username, role, isAdmin, login, logout }`.

**api/client.ts** — a single Axios instance used by every feature in the app:
- `baseURL: '/api'` → all calls go to `/api/...`, which Nginx proxies to the Spring Boot backend
- **Request interceptor**: before every call, reads the JWT from `localStorage` and adds it to the `Authorization` header automatically. Feature code never has to handle tokens manually.
- **Response interceptor**: if any call returns `401 Unauthorized`, clears the token and redirects the user to `/login`.

---

## 7. One Full Request End to End

**Example: A Reporter creates a new incident**

```
Step 1:  Reporter fills out IncidentFormPage and clicks Submit

Step 2:  incidents.ts calls:
         apiClient.post('/incidents', { title, category, severity, description })

Step 3:  Axios request interceptor adds the header:
         Authorization: Bearer eyJ...

Step 4:  Nginx receives the request at /api/incidents
         and forwards it to backend:8080/api/incidents

Step 5:  JwtAuthFilter intercepts the request
         → reads the token from the header
         → verifies the cryptographic signature
         → sets the Security Context (Spring now knows who the user is)

Step 6:  IncidentController.create() is called
         with the request body and the current user's identity

Step 7:  IncidentController delegates to IncidentService.create():
         a. looks up User from DB by username
         b. creates a new Incident object, links it to the User
         c. incidentRepository.save(incident)
            → Hibernate runs: INSERT INTO incidents (...) VALUES (...)
         d. converts the saved Incident to an IncidentDto (safe response object)
         e. returns the IncidentDto

Step 8:  Controller returns HTTP 200 OK + the IncidentDto as JSON

Step 9:  React receives the response and navigates back to the list

Step 10: List page calls apiClient.get('/incidents/mine')
         → gets the updated list → renders it in the DataGrid
```

---

## 8. Docker — How the 3 Containers Start

Running the command:

```bash
docker compose up --build
```

Triggers the following sequence:

1. Docker reads `.env` for all secret values (passwords, JWT key, admin credentials)
2. Builds the **backend** container: compiles Java with Maven, creates a minimal JRE runtime image
3. Builds the **frontend** container: runs `npm run build` to create static HTML/JS files, copies them into an Nginx image
4. Starts the `db` container first — Docker waits until `pg_isready` reports healthy (up to 50 seconds, checked every 5 seconds)
5. Starts the `backend` container — Spring Boot connects to PostgreSQL, Hibernate creates/updates the tables, DataSeeder creates the admin account
6. Starts the `frontend` container — Nginx is ready, the app is accessible at `http://localhost:8080`

### Why "db" and not "localhost"?

Each container has its own `localhost` that refers only to itself. Containers on the same Docker network (`incident-net`) find each other using their **service name** as a hostname. That is why the backend connects to `jdbc:postgresql://db:5432/incidents` — `db` is the service name defined in `docker-compose.yml`, not a real domain name.

---

## 9. Role-Based Access Control Summary

| Action | REPORTER | ADMIN |
|---|---|---|
| Register / Login | ✅ | ✅ |
| Create an incident | ✅ | ✅ |
| View own incidents | ✅ | ✅ |
| View all incidents | ❌ | ✅ |
| View someone else's incident | ❌ | ✅ |
| Change incident status | ❌ | ✅ |

Role enforcement happens at two levels:
- **HTTP level**: `@PreAuthorize("hasRole('ADMIN')")` on controller methods — Spring rejects the request before the service is even called
- **Business logic level**: inside `IncidentService.getById()`, a reporter trying to view another user's incident gets `AccessDeniedException`

---

## 10. Quick Reference — Key Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Defines and wires all 3 containers |
| `.env` | Secret configuration values |
| `application.yml` | Spring Boot configuration (DB URL, JWT, logging) |
| `User.java` | Defines the `users` database table |
| `Incident.java` | Defines the `incidents` database table |
| `IncidentController.java` | HTTP endpoints for incidents |
| `IncidentService.java` | Business rules for incidents |
| `IncidentRepository.java` | Database queries for incidents |
| `AuthController.java` | Login and register endpoints |
| `JwtService.java` | Creates and verifies JWT tokens |
| `JwtAuthFilter.java` | Reads JWT from every incoming request |
| `SecurityConfig.java` | Defines which endpoints are public vs. protected |
| `DataSeeder.java` | Creates the admin account on startup |
| `App.tsx` | Frontend route table and top navigation bar |
| `AuthContext.tsx` | Global login state shared across all React components |
| `api/client.ts` | Axios HTTP client with auto-auth header injection |
