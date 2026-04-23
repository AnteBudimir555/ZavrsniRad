# Incident Management App (Završni Rad)

A minimal 3-tier incident tracker built as a learning project.

- **Frontend**: React 18 + TypeScript + Vite + Material UI, served by nginx
- **Backend**: Spring Boot 3.3 + Spring Security (JWT) + Spring Data JPA, Java 21
- **Database**: PostgreSQL 16
- **Orchestration**: Docker Compose (3 containers on a shared network)

Two roles:
- **REPORTER** — can self-register, create incidents, and see their own.
- **ADMIN** — can see all incidents and resolve them. One admin account is seeded on first run.

---

## 1. First-run guide (3 steps)

You need **Docker Desktop** running on Windows (or Docker Engine on Linux/macOS).

```bash
# 1. Copy the env template and (optionally) edit credentials / secrets
cp .env.example .env           # Git Bash / macOS / Linux
# Copy-Item .env.example .env  # Windows PowerShell

# 2. Build images and start all three containers
docker compose up --build

# 3. Open the app
#    Browser -> http://localhost:8080
#    Login   -> admin / admin123   (or whatever you set in .env)
```

That's it. On first start Postgres initialises, then the backend seeds the admin user, then nginx starts serving the SPA.

Stop everything with `Ctrl+C`, then `docker compose down`. To **also** wipe the database, run `docker compose down -v`.

---

## 2. How the three containers talk to each other

```
  Your browser                 Docker host                Docker bridge network "incident-net"
 ──────────────               ──────────────              ─────────────────────────────────────

 http://localhost:8080  ──►  port 8080 on host           ┌──────────────┐
                             (published by frontend)  ──►│  frontend:80 │  (nginx)
                                                         │              │
                                                         │  /api/*  ───►│──►  backend:8080  (Spring Boot)
                                                         │  (proxy)     │           │
                                                         │  everything  │           ▼
                                                         │  else: SPA   │       db:5432   (PostgreSQL)
                                                         └──────────────┘
```

The critical idea: **inside the Docker network, containers address each other by service name**, not `localhost`. That is why:

- `application.yml` uses `jdbc:postgresql://db:5432/...` (not `localhost:5432`)
- `nginx.conf` uses `proxy_pass http://backend:8080;` (not `localhost:8080`)

The frontend's nginx is also the reason the browser doesn't need CORS: from the browser's perspective, both the HTML and the `/api/*` requests come from the same origin (`http://localhost:8080`).

---

## 3. Day-to-day commands

```bash
# Rebuild after changing Dockerfiles or pom.xml / package.json
docker compose up --build

# Start in background
docker compose up -d

# Follow logs for one service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Shell into a running container
docker compose exec backend sh
docker compose exec db psql -U incident_user -d incidents

# Full teardown (containers + network, keeps DB volume)
docker compose down

# Nuclear option (also deletes the DB volume)
docker compose down -v
```

---

## 4. Troubleshooting — which log for which symptom?

| Symptom                                         | Run this                           | What you're looking for                                            |
| ----------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| Browser shows `ERR_CONNECTION_REFUSED`          | `docker compose ps`                | A service in `Exited` state — check that service's logs next       |
| Frontend page is blank / 404                    | `docker compose logs frontend`     | nginx config errors, missing `dist/` files                         |
| API calls return **404** (from browser devtools)| `docker compose logs frontend`     | `nginx.conf` `/api/` proxy block misconfigured                     |
| Login returns **401**                           | `docker compose logs backend`      | `Bad credentials` (wrong password) vs `JWT secret` errors          |
| Login returns **500**                           | `docker compose logs backend`      | Stack trace — usually JWT secret too short (<32 chars)             |
| Backend keeps restarting                        | `docker compose logs backend`      | `Connection refused` → DB not ready yet; wait or check healthcheck |
| DB container unhealthy                          | `docker compose logs db`           | Auth errors usually mean stale volume — `docker compose down -v`   |
| Port 8080 already in use                        | (Windows) `netstat -ano \| findstr 8080` | Change the host port in `docker-compose.yml` (`"9090:80"`)   |
| Data vanished after restart                     | `docker volume ls`                 | Confirm `zavrsnirad_db-data` exists; `down -v` deletes it          |

**When in doubt:** `docker compose logs --tail 100` shows the last 100 lines from every service at once. It is the single most useful debugging command.

---

## 5. Project layout

```
ZavrsniRad/
├── docker-compose.yml         # 3 services, 1 network, 1 volume
├── .env / .env.example        # config (DB creds, JWT secret, seeded admin)
├── backend/                   # Spring Boot app
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/...           # see backend/README (code is commented in mentor style)
└── frontend/                  # React + MUI app
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/...
```

---

## 6. Manual test flow (smoke test)

1. `docker compose up --build` — wait for `Started IncidentAppApplication` in the backend log.
2. Open `http://localhost:8080` → login as `admin` / `admin123`.
3. You land on the admin list (empty).
4. Log out → click **Register** → create a reporter account.
5. Log in as that reporter → **Report incident** → fill title / description / category / severity → submit.
6. You see your incident in the reporter's list with status `OPEN`.
7. Log out → log back in as `admin` → see the same incident → click **Resolve**.
8. Status flips to `RESOLVED`, `resolvedAt` is set.
9. `docker compose down` then `docker compose up` (no `-v`!) → your data is still there.
