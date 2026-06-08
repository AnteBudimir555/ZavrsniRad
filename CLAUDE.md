# Incident Management System — Claude Instructions

## Project

A full-stack incident reporting app built as a university thesis (ZavrsniRad). Users can report IT incidents; admins manage and resolve them. Two roles: `ADMIN` (full access) and `REPORTER` (own incidents only).

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Material-UI + Vite, served by Nginx |
| Backend | Spring Boot 4 (Framework 7) + Spring Security + JWT (HS256), Java 21 + virtual threads, port 8080 |
| Database | PostgreSQL 16, Docker named volume `db-data` |
| Auth | Stateless JWT in `Authorization: Bearer` header — no sessions |
| Runtime | Docker + Docker Compose, bridge network `incident-net` |

Entry point: `http://localhost:8080` → Nginx → React SPA → `/api/*` proxied to Spring Boot at `backend:8080` → PostgreSQL at `db:5432`.

## Session Start

**At the beginning of every session: read `implementation_plan.md`, note the current phase and next pending task, then wait for the user's instruction before doing anything.**

## Coding Conventions

- Backend follows strict Controller → Service → Repository layering. Business logic belongs in the Service layer only.
- Never expose JPA entity objects directly in HTTP responses — always use DTOs.
- Role guards live at two levels: `@PreAuthorize` on controllers (HTTP) and explicit checks inside Service methods (business logic).
- Frontend API calls go through `api/client.ts` exclusively — never raw fetch or a separate axios instance.
- Secrets (JWT key, DB password, admin credentials) come from `.env` only — never hardcoded.

## User Context

The user is a student learning full-stack development. Explain the *why* behind changes, not just the *what*. Keep explanations alongside the code changes.
