# SchoolOS v2 — Phase 2 Completion Report

## Overview
Phase 2 (🔴 P0 — Auth/Session Hardening & API/Infra Hardening) has been fully implemented, migrated, typechecked, and verified.

---

## 1. What Was Built

### Files Modified & Created
- **Database Schema & Migration**:
  - `[MODIFY]` [Schema.ts](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/src/models/Schema.ts) — added `failedLoginCount`, `lockedUntil`, and `mustChangePassword` to `user` table.
  - `[NEW]` [0020_add_user_lockout_and_must_change_password.sql](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/migrations/0020_add_user_lockout_and_must_change_password.sql) — Drizzle SQL migration.
  - `[MODIFY]` [_journal.json](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/migrations/meta/_journal.json) — registered migration `0020`.
- **Password Policy & Lockout**:
  - `[NEW]` [password-policy.ts](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/src/libs/api/password-policy.ts) — shared password strength and common dictionary validator.
  - `[NEW]` [unlock/route.ts](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/src/app/api/users/unlock/route.ts) — `POST /api/users/unlock` school_admin account unlock action.
- **Canonical Role Matrix & Testing**:
  - `[NEW]` [role-matrix.md](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/docs/role-matrix.md) — canonical role matrix documentation.
  - `[NEW]` [role-matrix.test.ts](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/src/app/api/role-matrix.test.ts) — regression test validating role guards across all API routes.
- **API & Upload Protection**:
  - `[NEW]` [rate-limit.ts](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/src/libs/api/rate-limit.ts) — sliding window in-memory rate limiter.
  - `[MODIFY]` [uploads.ts](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/src/libs/api/uploads.ts) — magic-bytes sniffing for PNG (`0x89 50 4E 47`), JPEG (`0xFF D8 FF`), and PDF (`0x25 50 44 46`).
  - `[MODIFY]` [next.config.ts](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/next.config.ts) — added `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, and `Referrer-Policy`.
- **Runbooks**:
  - `[NEW]` [secret-rotation.md](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/lango-english-center-project-fully/lango-app/docs/secret-rotation.md) — secret rotation runbook for DB credentials and Better Auth secrets.

---

## 2. Verification Results
- `npm run check:types`: 0 errors.
- `npm test`: 11 active unit/role tests passed.
- `docker compose build migrate`: Image rebuilt successfully with migration `0020`.
