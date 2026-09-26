# 🛠️ Project Skills & Operational Playbooks

## 1. Agent Operational Rules (`AGENTS.md` Ground Truth)

Every AI agent working on SchoolOS must adhere to the non-negotiable rules outlined in `AGENTS.md`:

1. **Multi-Tenant Invariant**: Never query or update a tenant-scoped table without `eq(table.tenantId, ctx.tenantId)`. Never accept `tenantId` from client parameters.
2. **Moroccan Invariant**: Never invent non-Moroccan grading scales (always `/20`), payroll deductions (always statutory CNSS, AMO, IR brackets), or phone formats (always `+212` / `06` / `07`).
3. **VPS Memory Invariant**: **Never run `npm run build` or build Docker images on the VPS host.** All images must be built locally via Docker Desktop for `--platform linux/amd64` and deployed via `scripts/deploy-to-vps.ps1`.
4. **UI Reality Ratchet**: Never introduce a dead button without a handler, an unlinked dashboard page, or an invented mock array.

---

## 2. Quality Gate Playbook

Before any code commit or deployment, the following verification commands **must** be executed and pass with 0 errors:

### 2.1 TypeScript Strictness Check
```bash
npm run check:types
```
- Validates the entire codebase with `tsc --noEmit --pretty`.
- Must return `exit code 0` with 0 type errors.

### 2.2 UI Reality Ratchet Check
```bash
npm run check:ui
```
- Runs `scripts/check-ui-reality.ts`.
- Validates:
  - **Dead controls**: Must not exceed baseline (47).
  - **Mock screens**: Must be exactly 0.
  - **Unlinked pages**: Must not exceed baseline (34).
  - **Orphaned components**: Must not exceed baseline (7).

### 2.3 Multi-Tenant Isolation Check
```bash
npm run check:isolation
```
- Runs `scripts/check-tenant-isolation.ts`.
- Scans all 813+ route files to ensure every query has an active tenant filter and no client-bound `tenantId` parameters exist.

### 2.4 Unit Test Suite
```bash
$env:ALLOW_DB_SKIP="1"; npx vitest run
```
- Executes Vitest unit tests across payroll, SMS GSM-7, document studio, and provider adapters.

---

## 3. Production Deployment Playbook

### Standard Zero-Downtime Deployment
From the workstation in `lango-app/`:
```powershell
powershell -ExecutionPolicy Bypass -NoProfile -File scripts/deploy-to-vps.ps1 -SkipCheck -SkipMigrate
```

### Script Execution Pipeline:
1. **Pre-flight Checks**: Verifies Docker daemon status and SSH key to `ubuntu@43.157.17.129`.
2. **Local Image Build**: Runs `docker buildx build --platform linux/amd64 -t schoolos-app:latest .`
3. **Image Packaging**: Compresses the build into `schoolos-app-latest.tar.gz` (~120 MB).
4. **Secure Transfer**: Uploads via SCP to `/home/ubuntu/releases/` on the VPS.
5. **Remote Pre-Deploy Backup**: Triggers an automated database snapshot (`schoolos-YYYYMMDD-HHMMSS.sql.gz`) on the VPS.
6. **Container Recreate**: Loads image into remote Docker and restarts `schoolos-app` container.
7. **Live Health Probe**: Queries `https://schoolos.epioso.com/api/health` and verifies `{"status":"healthy","database":"reachable"}`.
8. **Pruning & Cleanup**: Cleans up release archives and older dangling images on the host.
