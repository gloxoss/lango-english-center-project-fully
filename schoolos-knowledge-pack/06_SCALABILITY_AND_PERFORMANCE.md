# 🚀 Scalability, Performance & Security Architecture

## 1. Resource Constraints & VPS Footprint Optimization

The production environment operates under tight, real-world cloud economics:
- **Host Configuration**: Single Ubuntu VPS (`43.157.17.129`) with **1,935 MB Total RAM**.
- **Service Composition**:
  - `schoolos-app` (Next.js 15 Standalone Node runtime)
  - `schoolos-db` (PostgreSQL 16)
  - `schoolos-redis` (Session cache & queue engine)
  - `schoolos-waha` (WhatsApp HTTP API multi-session engine)
  - `caddy` (High-performance reverse proxy & automatic SSL)

### 1.1 Next.js Standalone Build
In [`next.config.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/next.config.ts), `output: 'standalone'` is enabled. The multi-stage Docker build copies only the strictly necessary runtime assets into the final runner image:
- Standard Next.js image size: `~1.8 GB`
- **SchoolOS optimized image size**: `~120 MB` (Compressed)
- **Idle Memory Consumption**: `~160 MB RAM` for the application container.

### 1.2 Memory Limits in Docker Compose
```yaml
services:
  app:
    image: schoolos-app:latest
    mem_limit: 800m
    restart: unless-stopped
  db:
    image: postgres:16-alpine
    mem_limit: 500m
    restart: unless-stopped
```

---

## 2. Database Concurrency & Query Scaling

1. **Connection Pooling**: PostgreSQL connection pool is tuned for multi-tenant workloads. The pool maintains 20 max connections with idle timeouts to prevent socket exhaustion.
2. **Compound Indexing on `tenant_id`**:
   - All high-frequency query tables feature compound indexes prefixed by `tenant_id`:
     - `idx_students_tenant_status (tenant_id, status)`
     - `idx_invoices_tenant_due (tenant_id, due_date)`
     - `idx_assessment_results_tenant_term (tenant_id, exam_term_id)`
3. **Partitioned In-Memory Caching**:
   - High-throughput metadata (like daily WhatsApp quota usage and feature entitlements) is cached in-memory with automatic database synchronization to avoid redundant SQL queries on every dispatched message.

---

## 3. WhatsApp Anti-Ban & Rate Limiting Engine

Bulk messaging on WhatsApp without rate control triggers algorithmic phone number bans by Meta. SchoolOS implements a three-tier protection architecture:

```
[UI Reminders Hub]
       │
       ▼  1. Client-Side Pre-Check: Checks balanceInfo.whatsapp.remainingToday
       │
       ▼  2. Client-Side Pacing: Injects 1,200ms delay between recipient loops
       │
[POST /api/communication/messages]
       │
       ▼  3. Backend Quota Assertion: assertAndConsumeWhatsAppQuota(tenantId, 1)
             ├── Check dailyLimit vs usedToday
             └── If exceeded: Throws HTTP 429 (WHATSAPP_DAILY_QUOTA_EXCEEDED)
```

- **Daily Limits by Subscription Tier**:
  - Trial: 25 msg/day
  - Basic: 50 msg/day
  - Standard: 100 msg/day
  - Premium: 250 msg/day
- **Tenant Multi-Session Isolation**:
  - Sessions are namespaced per tenant: `tenant_{tenantId}`.
  - School A and School B communicate through separate WhatsApp sessions. A temporary restriction on School A will never impact School B.

---

## 4. Multi-Tenant Security & CNDP Compliance

1. **Law 09-08 (CNDP) Privacy Protection**:
   - Redaction of sensitive guardian and student PII in server logs and audit trails.
   - Strict guardian consent verification for student directory visibility.
2. **Static Cross-Tenant Leak Detection**:
   - Automated via `scripts/check-tenant-isolation.ts`.
   - Scans 813+ source files before deployment to guarantee zero tenant parameter leaks.
3. **Zod Strict Schema Sanitization**:
   - All inbound JSON payloads pass through Zod schemas with `.strict()`, rejecting unmodeled attributes and SQL injection attempts.
