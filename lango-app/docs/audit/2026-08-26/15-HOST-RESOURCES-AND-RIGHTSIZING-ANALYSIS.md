# Production Host Right-Sizing & Memory Resource Analysis

**Finding Reference:** D-9 (P2 Medium) / Task T10  
**Target Host:** Production VPS (`43.157.17.129`, Tencent Cloud)  
**Host Specifications:** 1935 MB RAM, 1 vCPU, ~1 GB swap  
**Shared Workloads:** `schoolos` + 4 other production client apps (`fes-tawsil`, `wenaya`, `epioso-cms`, `telegrambot`)  
**Date:** 2026-08-27  

---

## 1. Executive Summary & Root Cause

During production operations and deployment on 2026-08-26:
* Observed RAM availability: **88 MB free / 638 MB available** with ~1 GB active swap.
* The host became completely unresponsive (SSH timed out at banner exchange, Docker daemon returned HTTP 500), necessitating a hardware console hard reset that took down all 5 hosted production services.
* **Top Memory Consumers on Host:**
  1. `schoolos-clamav`: **~474 MB resident** (24.5% of total physical RAM).
  2. `schoolos-db` (PostgreSQL): **~160 MB resident**.
  3. `schoolos-app` (Node.js Next.js server): **~180-260 MB resident**.
  4. Neighboring containers (`fes-tawsil`, `wenaya`, `epioso-cms`, `telegrambot`): **~700 MB resident combined**.

SchoolOS alone consumes ~900 MB (46.5% of host memory), leaving insufficient headroom for OS kernel buffers, SSH sessions, or concurrent requests.

---

## 2. Codebase Dependency on ClamAV

Inspection of `src/` identified two upload paths calling `scanBuffer` (`src/libs/api/malware-scan.ts`):
1. **Digital Asset Ingestion** (`src/features/attachments/services/asset-service.ts`): Uploads of educational documents, syllabi, and administrative attachments.
2. **Guard Evidence Ingestion** (`src/features/guard/services/incidents-service.ts`): Photo/document uploads for incident reports.

### What breaks if ClamAV is disabled for the pilot?
* File size limits (`maxSizeBytes`), MIME type checks (`MIME_TO_FAMILY`), and Magic Byte signature validation (`MIME_FAMILY_MAGIC`) **continue to enforce security**.
* Antivirus byte scanning (`clamdjs`) is bypassed.
* **Benefit:** Recovers **474 MB RAM immediately** with zero application downtime.

---

## 3. Options Analysis Matrix

| Option | Description | Monthly Cost | Effort | Downtime | Risk Reduction | Tradeoffs / What Breaks |
|---|---|---|---|---|---|---|
| **Option A: Dedicated Host for SchoolOS** | Provision a dedicated 4 GB / 2 vCPU VPS (e.g. Hetzner/OVH/Tencent) solely for SchoolOS. | ~$8–$15 / mo | M (2-3 hrs) | 15–30 min (DNS/DB migration) | **High** (100% blast radius isolation) | Requires new VPS provisioning, DNS update, and SSL setup. Eliminates multi-tenant client risk. |
| **Option B: Resize Existing VPS (Add RAM)** | Upgrade the existing VPS from 2 GB to 4 GB RAM via Tencent Cloud console. | +~$6–$10 / mo | S (15 min) | 2–5 min (VPS reboot) | **Medium-High** | Keeps shared hosting architecture; reboot affects all 5 apps briefly. |
| **Option C: Disable ClamAV for Pilot** | Disable `schoolos-clamav` container and use bypass in `malware-scan.ts` during synthetic pilot testing. | $0 | S (10 min) | None | **Medium** (recovers ~25% RAM instantly) | Bypasses antivirus heuristic scanning on attachment uploads. Magic byte & MIME validation remain active. |
| **Option D: Recommended Hybrid (C + B or A)** | **Phase 1 (Immediate):** Disable ClamAV on the pilot host to restore stability.<br>**Phase 2 (Before 1st Real School):** Move SchoolOS to a dedicated host (Option A). | $0 pilot / ~$10 prod | S → M | None for pilot | **Maximum** | Recommended path to protect paying schools and existing client services. |

---

## 4. Recommendation & Action Plan for Owner

1. **Immediate Action (Zero Cost, Zero Downtime):**  
   Set `CLAMAV_ENABLED=false` in `~/schoolos-app/.env` and run `docker compose stop schoolos-clamav`. This immediately frees 474 MB RAM, preventing further OOM crashes during partner testing.
2. **Before Beta / Onboarding First Real School:**  
   Execute Option A to migrate SchoolOS onto its own dedicated 4 GB instance (`~10€/mo`), completely eliminating cross-client interference with `fes-tawsil`, `wenaya`, and `epioso-cms`.
