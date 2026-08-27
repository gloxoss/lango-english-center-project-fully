# Runbook: Database Backup & Restore

## Backup (automated)

- Script: `~/schoolos-app/backup-db.sh` on the VPS (source: `lango-app/scripts/backup-db.sh`)
- Schedule: cron, daily at 03:00 — `crontab -l` on the VPS to confirm
- Retention: 7 daily + 4 weekly, pruned automatically
- Location: `~/backups/daily/` and `~/backups/weekly/` on the VPS
- Log: `~/backups/backup.log`

**Verified 2026-08-27:** ran manually, produced `schoolos-20260827-083756.sql.gz`
(431KB, 1 tenant / 233 users / 200 students / 200 invoices / 160 payments).

## ⚠️ Known gap — NOT off-host yet

Backups currently land on the **same VPS** as the database. If the host or its
disk is lost, the backups are lost with it. This satisfies "can I undo my own
mistake" (bad migration, accidental delete) but **not** "can I survive losing
this machine" — which is the scenario that actually happened once this project
(the VPS went fully unreachable and needed a reboot).

**Required next step:** sync `~/backups/` to off-host storage (S3-compatible
bucket, another VPS, etc.) on a schedule. Until this is done, treat the backup
as a convenience, not disaster recovery.

## Restore procedure

**Never restore over the live production database without a deliberate,
confirmed decision to do so.** Restoring into a fresh/throwaway database to
verify or recover is always safe.

```bash
# 1. Copy the desired backup off the VPS
scp -i <key> ubuntu@<vps-ip>:~/backups/daily/schoolos-<timestamp>.sql.gz .

# 2. Start a throwaway Postgres (NEVER the production container)
docker run -d --name schoolos-restore-drill \
  -e POSTGRES_DB=schoolos -e POSTGRES_USER=schoolos \
  -e POSTGRES_PASSWORD=<any-local-password> \
  -p 15434:5432 postgres:17-alpine

# 3. Restore
gunzip -c schoolos-<timestamp>.sql.gz | \
  docker exec -i schoolos-restore-drill psql -U schoolos -d schoolos

# 4. Verify row counts against the source before trusting the backup
docker exec schoolos-restore-drill psql -U schoolos -d schoolos -c \
  "select 'tenants', count(*) from tenants
   union all select 'user', count(*) from \"user\"
   union all select 'invoices', count(*) from invoices
   union all select 'payments', count(*) from payments;"

# 5. Clean up the drill container when done
docker rm -f schoolos-restore-drill
```

**To actually recover production** (only after the above verification passes):
stop `schoolos-app` and `schoolos-migrate`, restore into `schoolos-db` itself
(same steps against the real container instead of a throwaway one), then
restart the app. This has not been rehearsed against the live container —
rehearse it in a maintenance window before you ever need it under pressure.

## Drill history

| Date | Backup tested | Result |
|---|---|---|
| 2026-08-27 | `schoolos-20260827-083756.sql.gz` | ✅ Exact row-count match: tenants 1/1, user 233/233, students 200/200, invoices 200/200, payments 160/160 |
