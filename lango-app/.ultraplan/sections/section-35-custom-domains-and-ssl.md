# Section 35: Custom Domains & Automated On-Demand TLS

## 1. Overview & Business Value
Allows individual schools (e.g. Groupe Scolaire Atlas `ecole-atlas.ma`) to use their own branded domain or subdomain with fully automated HTTPS/TLS certificate provisioning and multi-tenant host resolution.

## 2. Target Files & Architecture
- **API Endpoint**: `src/app/api/platform/caddy-ask/route.ts` [NEW]
  - Endpoint queried by Caddy's `on_demand_tls` directive before obtaining a certificate.
  - Queries `tenantDomains` table: if `domain` exists and `status = 'approved'`, returns HTTP 200. Otherwise returns HTTP 403.
  - Rate limited by IP and domain.
- **Reverse Proxy**: `deploy/Caddyfile.template` [NEW]
  - Configures Caddy to proxy traffic to Next.js on port 3000.
  - Directives for `on_demand_tls` with `ask http://127.0.0.1:3000/api/platform/caddy-ask`.
- **UI Enhancement**: `src/features/platform/ui/school-admin-domains-view.tsx` & `src/features/platform/ui/super-admin-domains-view.tsx`
  - Instant DNS verification tester button calling `/api/settings/domains/[id]/verify`.
  - Step-by-step visual DNS guide for Moroccan domain registrars (.ma, Maroc Telecom, Nindohost, Genious, Capconnect).
  - Live SSL status indicator (Active / Pending DNS Propagation / Failed).

## 3. Acceptance Criteria
1. `GET /api/platform/caddy-ask?domain=ecole-atlas.ma` returns 200 only if the domain is approved for a tenant.
2. Tenant domain records in `tenantDomains` are verified via DNS CNAME/A/TXT records before approval.
3. Requests arriving with Host `ecole-atlas.ma` are automatically resolved to the tenant in `src/middleware.ts` via `x-tenant-id` and `x-tenant-slug`.
4. Tenant isolation is strictly preserved (0 cross-tenant leaks).
