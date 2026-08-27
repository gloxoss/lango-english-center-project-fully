# Database Backup & Restore Runbook

**Document Owner:** DevOps / Platform Engineering  
**Classification:** Disaster Recovery & Operational Readiness (D-10 / Gate 3)  
**Last Updated:** 2026-08-27  

---

## 1. Architecture & Strategy

SchoolOS stores multi-tenant relational data in PostgreSQL (tenants, users, students, guardians, invoices, payments, grades, attendance, documents).

### Key Parameters:
* **Primary Container:** `schoolos-db`
* **Volume Name:** `schoolos_postgres_data`
* **Backup Format:** Compressed PostgreSQL Plain Dump (`.sql.gz`) with SHA-256 Checksums (`.sha256`)
* **Local Retention:** 7 daily backups + 4 weekly backups (automated rotation via `scripts/backup-db.ts` / `scripts/backup-db.sh`)
* **Off-Host Replication:** Scheduled synchronization to S3/Cloudflare R2 object storage.

---

## 2. Automated Scheduled Backups

### 2.1 Crontab Configuration on Production VPS
Add the following entry to the `crontab` of the deployment user on the production host (`43.157.17.129`):

```bash
# Run automated database backup daily at 02:15 AM UTC
15 2 * * * /home/ubuntu/schoolos-app/scripts/backup-db.sh >> /var/log/schoolos-backup.log 2>&1
```

### 2.2 Manual Backup Execution
To take an immediate backup before migrations, updates, or maintenance:

```bash
# Via TypeScript runner:
npx tsx scripts/backup-db.ts

# Or via Shell script:
./scripts/backup-db.sh
```

Backups are saved to `backups/backup-YYYY-MM-DD_HHmmss.sql.gz` with a companion `.sha256` verification hash.

---

## 3. Off-Host Storage Sync

To ensure backups survive host failure, configure off-host storage environment variables in `~/schoolos-app/.env`:

```env
BACKUP_S3_BUCKET=schoolos-production-backups
AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=eu-west-3
```

---

## 4. Disaster Recovery & Restore Drill Procedure

> **SAFETY RULE:** Never perform a test restore directly onto the live production database. Always verify backups against a throwaway test database or verification container.

### Step 1: Verify Archive Integrity & Checksum
```bash
sha256sum -c backups/backup-2026-08-27_002812.sql.gz.sha256
```

### Step 2: Run the Automated Restore Verification Tool
The automated drill script validates decompression, tests database connection, and queries row counts across all critical business tables:

```bash
npx tsx scripts/restore-db.ts backups/backup-2026-08-27_002812.sql.gz
```

### Step 3: Manual Restore Into a Throwaway Database
```bash
# 1. Create a temporary restoration database
docker exec -i schoolos-db psql -U schoolos -c "CREATE DATABASE schoolos_restore_test;"

# 2. Decompress and pipe the dump into the test database
gunzip -c backups/backup-2026-08-27_002812.sql.gz | docker exec -i schoolos-db psql -U schoolos -d schoolos_restore_test

# 3. Verify row counts in the test database
docker exec -i schoolos-db psql -U schoolos -d schoolos_restore_test -c "
SELECT 'tenants' AS table_name, count(*) FROM tenants UNION ALL
SELECT 'user', count(*) FROM \"user\" UNION ALL
SELECT 'invoices', count(*) FROM invoices UNION ALL
SELECT 'payments', count(*) FROM payments UNION ALL
SELECT 'attendance_events', count(*) FROM attendance_events;
"

# 4. Clean up throwaway database
docker exec -i schoolos-db psql -U schoolos -c "DROP DATABASE schoolos_restore_test;"
```

---

## 5. Emergency Full Production Restore

If production data loss occurs:

1. **Stop Application Container:**
   ```bash
   docker stop schoolos-app
   ```
2. **Restore PostgreSQL Dump:**
   ```bash
   docker exec -i schoolos-db psql -U schoolos -c "DROP DATABASE schoolos WITH (FORCE);"
   docker exec -i schoolos-db psql -U schoolos -c "CREATE DATABASE schoolos;"
   gunzip -c backups/<TARGET_BACKUP>.sql.gz | docker exec -i schoolos-db psql -U schoolos -d schoolos
   ```
3. **Restart Application Container & Verify Health:**
   ```bash
   docker start schoolos-app
   curl -I https://schoolos.epioso.com/api/health
   ```
