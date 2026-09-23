# Agent Hub changelog

One entry per finished item. Written by `hub.mjs done`; verification results are appended by `hub.mjs verify`.

## 2026-09-23 12:46 · codex-s41 · S-41

Added a shared Better Auth rate-limit rule set that exempts /get-session from the IP bucket while retaining the 60-second/30-request email sign-in rule. Added focused tests for both policies.

- Files: `lango-app/src/libs/auth.ts`, `lango-app/src/libs/auth/rate-limit.ts`, `lango-app/src/libs/auth/rate-limit.test.ts`
- Verified with: `npm exec vitest run src/libs/auth/rate-limit.test.ts -> 1 file, 2 tests passed; npm run check:types -> exit 0; npm run check:isolation -> passed with existing 73 non-failing warnings`
- Status: done, waiting for a second agent to verify
- 2026-09-23 12:47 VERIFIED by codex-1: Reviewed diff; /get-session is exempt, sign-in email remains 30/60s, and focused tests pass. (S-41)

## 2026-09-23 12:49 · codex-s3940 · S-39

Super-admin summary now uses real admissions and class-section counts, derives the seven-day attendance chart from recorded marks with null empty days, and returns no fabricated schools.

- Files: `lango-app/src/app/api/super-admin/summary/route.ts`, `lango-app/src/app/api/__tests__/super-admin-summary.test.ts`
- Verified with: `npx vitest run src/app/api/__tests__/super-admin-summary.test.ts -> 3 passed; npm run check:types -> exit 0; npm run check:isolation -> passed with baseline 73 warnings; npm run check:ui -> ratchet holding`
- Status: done, waiting for a second agent to verify

## 2026-09-23 12:49 · codex-s3940 · S-40

Super-admin revenue now filters to valid invoice/payment statuses, nets collected payments through the shared finance helper, and reports outstanding open invoice balances instead of same-month subtraction.

- Files: `lango-app/src/app/api/super-admin/summary/route.ts`, `lango-app/src/app/api/__tests__/super-admin-summary.test.ts`
- Verified with: `npx vitest run src/app/api/__tests__/super-admin-summary.test.ts -> 3 passed; npm run check:types -> exit 0; npm run check:isolation -> passed with baseline 73 warnings; npm run check:ui -> ratchet holding`
- Status: done, waiting for a second agent to verify
- 2026-09-23 12:49 VERIFIED by codex-1: Reviewed summary diff; invented admissions/sections/attendance/branch data removed, finance values use shared definitions, and 3 focused tests pass. (S-39)
- 2026-09-23 12:49 VERIFIED by codex-1: Reviewed revenue diff; collected is net of refunds, outstanding balance is computed from open invoices, and 3 focused tests pass. (S-40)

## 2026-09-23 12:51 · codex-s38 · S-38

Granted payroll.self.read to teacher, accountant, receptionist, guard, and librarian defaults. Employee self-service now treats only NOT_AN_EMPLOYEE as a missing profile and hides only failed sections; added HR status translations for all locales.

- Files: `lango-app/src/libs/api/permissions.ts`, `lango-app/src/features/hr/ui/employee-portal-view.tsx`, `lango-app/src/libs/api/permissions.test.ts`, `lango-app/locales/fr.json`, `lango-app/locales/en.json`, `lango-app/locales/ar.json`
- Verified with: `npx vitest run src/libs/api/permissions.test.ts -> 13 passed; npm run check:types -> passed; npm run check:isolation -> passed with 73 existing non-failing warnings; node scripts/check-missing-i18n-keys.mjs -> missing translation keys: 0 in 0 files; AUDIT_BASE=http://localhost:3444 ACCOUNT_EMAIL=prof.01@atlas.ma AUDIT_PASSWORD=Admin123! node scripts/visual-sweep.mjs teacher artifacts/visual-sweep-s38/routes.txt artifacts/visual-sweep-s38 -> ok /dashboard/hr/self-service`
- Status: done, waiting for a second agent to verify

## 2026-09-23 12:51 · codex-s38 · task:port-3444

Ran isolated teacher visual sweep on port 3444 and preserved screenshot plus JSON evidence.

- Files: `lango-app/artifacts/visual-sweep-s38`
- Verified with: `AUDIT_BASE=http://localhost:3444 ACCOUNT_EMAIL=prof.01@atlas.ma AUDIT_PASSWORD=Admin123! node scripts/visual-sweep.mjs teacher artifacts/visual-sweep-s38/routes.txt artifacts/visual-sweep-s38 -> ok /dashboard/hr/self-service`
- Status: done, waiting for a second agent to verify
- 2026-09-23 12:51 VERIFIED by codex-1: Reviewed permission and HR portal changes; employee roles receive payroll.self.read, section-level failures no longer lock the whole portal, tests pass, and the agent supplied a teacher sweep artifact. (S-38)
