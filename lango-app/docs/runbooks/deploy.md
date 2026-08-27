# SchoolOS Deployment & Rollback Runbook

**Document Owner:** DevOps & Platform Engineering  
**Target Environment:** Production VPS (`43.157.17.129` / `https://schoolos.epioso.com`)  
**Architecture:** Next.js 15/16 App Router + PostgreSQL + Drizzle ORM + Docker Compose + Nginx Reverse Proxy  
**Classification:** Operational Readiness (Gate 1 / Gate 3 / T9)  
**Last Updated:** 2026-08-27  

---

## 1. Important Host Constraints

* **Host Capacity:** 1935 MB RAM shared across 5 production services (`schoolos`, `fes-tawsil`, `wenaya`, `epioso-cms`, `telegrambot`).
* **Critical Rule:** **NEVER build Docker images or run `npm run build` directly on the production host.** Building on-host triggers out-of-memory kernel panics and takes down neighboring client applications. All image builds must occur locally or in CI, then transferred via compressed images (`docker save | gzip`).

---

## 2. Pre-Deployment Verification Gate

Before creating a production release, run the local quality gates:

```bash
# 1. Type Safety Check
npx tsc --noEmit

# 2. Multi-Tenant Isolation Verification
npx tsx scripts/check-tenant-isolation.ts

# 3. Full Automated Test Suite (must exit 0)
npm test

# 4. Create a Local Pre-Deploy Database Snapshot
npx tsx scripts/backup-db.ts
```

All 4 commands **must exit with code 0**. Do not deploy if any check fails.

---

## 3. Local Image Build & Packaging

Build for the Linux AMD64 architecture from the repo root:

```bash
# Set deployment tag (e.g. git commit hash or release tag)
RELEASE_TAG=$(git rev-parse --short HEAD)
echo "Packaging release: ${RELEASE_TAG}"

# 1. Build the production application image
docker build --platform linux/amd64 -t schoolos-app:${RELEASE_TAG} -t schoolos-app:latest .

# 2. Build the migration runner image (if separate migration container is used)
docker build --platform linux/amd64 -f Dockerfile.migrate -t schoolos-migrate:${RELEASE_TAG} -t schoolos-migrate:latest .

# 3. Export and compress image archives
docker save schoolos-app:${RELEASE_TAG} | gzip -9 > release-schoolos-app-${RELEASE_TAG}.tar.gz
```

---

## 4. Transfer to Production VPS

Transfer the compressed release image and pre-deploy backup to the production host:

```bash
# Upload release image archive
scp release-schoolos-app-${RELEASE_TAG}.tar.gz ubuntu@43.157.17.129:~/releases/

# SSH into production host
ssh ubuntu@43.157.17.129
```

---

## 5. Production Host Deployment Execution

Execute the following steps inside the production host:

```bash
# 1. Load the new Docker image
docker load < ~/releases/release-schoolos-app-${RELEASE_TAG}.tar.gz

# 2. Take a pre-deployment database backup on the VPS
/home/ubuntu/schoolos-app/scripts/backup-db.sh

# 3. Execute database migrations (one-shot container)
cd ~/schoolos-app
docker compose run --rm schoolos-migrate

# 4. Recreate and restart the application container with minimal downtime
docker compose up -d --no-deps schoolos-app

# 5. Verify container status and health
docker compose ps
docker compose logs --tail=50 schoolos-app
```

---

## 6. Post-Deployment Verification

Verify the live deployment:

```bash
# 1. Health endpoint check
curl -f https://schoolos.epioso.com/api/health

# Expected response:
# {"status":"healthy","database":"reachable","uptime":...,"timestamp":"..."}

# 2. Verify HTTPS certificate and HTTP-to-HTTPS redirect
curl -I http://schoolos.epioso.com
curl -I https://schoolos.epioso.com

# 3. Perform manual smoke verification
# Log in with seeded admin account: superadmin@schoolos.ma
# Verify navigation links, student list, and billing desk render without errors.
```

---

## 7. Rollback Procedures

### 7.1 Scenario A: Application Bug (No Schema Changes)
If the new code contains a bug but the database schema is compatible:

```bash
cd ~/schoolos-app

# 1. Revert image tag in docker-compose.yml to previous release tag (e.g. PREVIOUS_TAG)
# Or re-tag previous image as latest:
docker tag schoolos-app:${PREVIOUS_TAG} schoolos-app:latest

# 2. Restart container with previous image
docker compose up -d --no-deps schoolos-app

# 3. Confirm health
curl -f https://schoolos.epioso.com/api/health
```

### 7.2 Scenario B: Schema Migration Failure or Incompatible Migration
If an applied migration causes data inconsistency or errors:

```bash
cd ~/schoolos-app

# 1. Immediately stop the application to prevent further bad writes
docker compose stop schoolos-app

# 2. Restore the pre-deployment database backup taken in Step 5.2
PRE_DEPLOY_BACKUP=$(ls -t ~/schoolos-app/backups/backup-*.sql.gz | head -n 1)
echo "Restoring from pre-deployment backup: ${PRE_DEPLOY_BACKUP}"

gunzip -c "${PRE_DEPLOY_BACKUP}" | docker exec -i schoolos-db psql -U schoolos -d schoolos

# 3. Roll back application image to previous tag
docker tag schoolos-app:${PREVIOUS_TAG} schoolos-app:latest
docker compose up -d --no-deps schoolos-app

# 4. Verify system restored
curl -f https://schoolos.epioso.com/api/health
```

---

## 8. Known Operational Traps & Safeguards

1. **ClamAV Health Dependency:**  
   If `schoolos-clamav` is configured in `docker-compose.yml`, ensure it reports healthy before starting the app container. If ClamAV runs out of memory, disable upload scanning temporarily (`CLAMAV_ENABLED=false`) to release ~474 MB of resident RAM.

2. **File Permissions for `.env`:**  
   The production `.env` must remain strictly `chmod 600` (`-rw-------`) to prevent unauthorized disclosure on the shared host.

3. **Nginx Reverse Proxy:**  
   Nginx terminates SSL (via Certbot) and proxies traffic to `http://127.0.0.1:3030`. If Nginx throws `502 Bad Gateway`, check `docker compose ps` to ensure `schoolos-app` is listening on port 3030.
