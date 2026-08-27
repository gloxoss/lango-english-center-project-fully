#!/bin/bash
# SchoolOS production database backup.
#
# Runs pg_dump inside the schoolos-db container, compresses, timestamps, and
# prunes old backups (7 daily + 4 weekly kept). Exits non-zero with a clear
# message on any failure - a silent backup failure is as bad as no backup.
#
# Usage: ./backup-db.sh
# Cron:  0 3 * * * /home/ubuntu/schoolos-app/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
CONTAINER="${DB_CONTAINER:-schoolos-db}"
DB_USER="${POSTGRES_USER:-schoolos}"
DB_NAME="${POSTGRES_DB:-schoolos}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday .. 7=Sunday
FILENAME="schoolos-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

echo "[$(date -Iseconds)] Starting backup: $FILENAME"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "[$(date -Iseconds)] ERROR: container '$CONTAINER' is not running. Backup ABORTED." >&2
  exit 1
fi

if ! docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
    | gzip -9 > "$BACKUP_DIR/daily/$FILENAME"; then
  echo "[$(date -Iseconds)] ERROR: pg_dump failed. Removing partial file." >&2
  rm -f "$BACKUP_DIR/daily/$FILENAME"
  exit 1
fi

SIZE=$(stat -c%s "$BACKUP_DIR/daily/$FILENAME" 2>/dev/null || echo 0)
if [ "$SIZE" -lt 1000 ]; then
  echo "[$(date -Iseconds)] ERROR: backup file suspiciously small ($SIZE bytes). Treating as failure." >&2
  rm -f "$BACKUP_DIR/daily/$FILENAME"
  exit 1
fi

echo "[$(date -Iseconds)] Backup written: $BACKUP_DIR/daily/$FILENAME ($SIZE bytes)"

# Weekly retention: keep Sunday's daily backup as a weekly copy too.
if [ "$DAY_OF_WEEK" = "7" ]; then
  cp "$BACKUP_DIR/daily/$FILENAME" "$BACKUP_DIR/weekly/$FILENAME"
  echo "[$(date -Iseconds)] Copied to weekly retention."
fi

# Prune: 7 daily, 4 weekly.
find "$BACKUP_DIR/daily" -name "schoolos-*.sql.gz" -type f | sort | head -n -7 | xargs -r rm -v
find "$BACKUP_DIR/weekly" -name "schoolos-*.sql.gz" -type f | sort | head -n -4 | xargs -r rm -v

echo "[$(date -Iseconds)] Backup complete. Retained: $(ls "$BACKUP_DIR/daily" | wc -l) daily, $(ls "$BACKUP_DIR/weekly" | wc -l) weekly."
