#!/usr/bin/env bash
# =====================================================================
#  scripts/backup.sh
# ---------------------------------------------------------------------
#  Daily PostgreSQL dump for the Incident Management app.
#
#  Output:   $BACKUP_DIR/incidents_YYYY-MM-DD.sql        (one file per day)
#  Retains:  files modified within the last 30 days; older ones removed.
#
#  Designed to run two ways:
#
#    1) On the Docker host (e.g. nightly cron in PHASE_07):
#         scripts/backup.sh
#       It shells into the running `incident-db` container and runs pg_dump
#       there, so you don't need a Postgres client on the host.
#
#    2) Inside an environment that already has psql/pg_dump on PATH and
#       PG* env vars set: pass --local to skip the docker exec wrapper.
#
#  Configuration (override via env vars before invoking):
#    BACKUP_DIR        target directory                  (default ./backups)
#    DB_CONTAINER      docker compose service/container  (default incident-db)
#    POSTGRES_DB       database name                     (default incidents)
#    POSTGRES_USER     role used for the dump            (default incident_user)
#    RETENTION_DAYS    delete dumps older than N days    (default 30)
#
#  Exit codes: 0 on success, non-zero if pg_dump or cleanup failed.
# =====================================================================
set -euo pipefail

# --- defaults (override via environment) -----------------------------
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-incident-db}"
POSTGRES_DB="${POSTGRES_DB:-incidents}"
POSTGRES_USER="${POSTGRES_USER:-incident_user}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

LOCAL_MODE=0
if [[ "${1:-}" == "--local" ]]; then
    LOCAL_MODE=1
fi

# --- prepare output directory ----------------------------------------
mkdir -p "$BACKUP_DIR"

DATE_STAMP="$(date +%F)"     # YYYY-MM-DD
OUT_FILE="$BACKUP_DIR/incidents_${DATE_STAMP}.sql"

echo "[backup] dumping database '$POSTGRES_DB' -> $OUT_FILE"

# --- run pg_dump -----------------------------------------------------
# We use plain SQL (no -Fc) so the file is human-readable and restorable
# with a single `psql -f`. For large DBs you'd switch to custom format.
if [[ "$LOCAL_MODE" -eq 1 ]]; then
    pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
        --no-owner --no-privileges \
        > "$OUT_FILE"
else
    docker exec -i "$DB_CONTAINER" \
        pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
        --no-owner --no-privileges \
        > "$OUT_FILE"
fi

# --- prune old dumps -------------------------------------------------
echo "[backup] pruning dumps older than ${RETENTION_DAYS} days in $BACKUP_DIR"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'incidents_*.sql' \
    -mtime "+${RETENTION_DAYS}" -print -delete

echo "[backup] done."
