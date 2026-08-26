# SchoolOS — Backup & Disaster Recovery (DR) Procedure

This runbook documents the backup, restore, and database migration alignment procedures for SchoolOS.

---

## 1. On-Demand Tenant Data Backup

Super-admins can perform an on-demand tenant backup via API or Super-Admin Dashboard:
```bash
POST /api/super-admin/schools/backup
Body: { "schoolId": "<TENANT_UUID>" }
```
This produces a tenant-scoped JSON export containing all users, academic sections, invoices, and payments.

---

## 2. Automated PostgreSQL Backups (Daily/Weekly)

Full PostgreSQL database dumps are generated via `pg_dump`:
```bash
docker exec -t schoolos-db-1 pg_dump -U schoolos -d schoolos -F c -b -v -f /var/lib/postgresql/data/backups/backup-$(date +%Y%m%d_%H%M%S).dump
```

---

## 3. Database Restore Procedure

To restore a database dump into a fresh PostgreSQL instance:

### Step 1: Drop & Re-create Database
```bash
docker exec -i schoolos-db-1 dropdb -U schoolos schoolos
docker exec -i schoolos-db-1 createdb -U schoolos schoolos
```

### Step 2: Restore Binary Dump
```bash
docker exec -i schoolos-db-1 pg_restore -U schoolos -d schoolos --verbose /path/to/backup.dump
```

### Step 3: Align Migrations
If restoring a backup taken prior to recent migrations, run the migration service container to bring the schema up to date:
```bash
docker compose run --rm migrate
```

### Step 4: Verify Health
Verify application connectivity and user authentication:
```bash
curl -f http://localhost:3000/api/health || echo "Check application status"
```
