# Risks, Security, and Technical Debt

## Critical, current, verified issues

### 1. Broken build (P0)
`npm run check:types` fails with 3 real TypeScript errors as of this audit, run fresh this session. Two are in newly-added Events edit-capability code (loose null/undefined typing); one is more serious — `homework-service.ts` imports `leftJoin` as a named export from `drizzle-orm`, which does not exist. This is not a style nit; it means that specific code path cannot be correct as written. **Not fixed during this audit, per the audit's own no-modify rule** — see `07-testing-results.md` for exact locations.

### 2. Database was down at audit time
`docker-desktop`'s WSL distro was reported `Stopped` mid-session by a concurrent agent working in this same repository. This blocked all DB-dependent verification (tests, migrations, seed validation, production build). This is an environment-state fact at a point in time, not a code defect — but it means every readiness score in this audit that touches "does it actually run" is bounded by manual code review, not a live confirmation.

### 3. A specific, independently-caught false claim
Earlier in this same broader working session, a prior status report claimed Office Accounting had been wired to post directly into the real double-entry GL ledger. **This was traced and found false**: the page still calls the old, disconnected `/api/accountant/me/office-accounting` route, which has no GL-posting logic anywhere in it. A separate, unused route (`/api/finance/expenses`) does have the correct logic, but nothing calls it from the UI. **This is named here specifically because it demonstrates that self-reported "done" claims in this project's history have been wrong before** — not to cast blanket doubt on every claim, but to justify why this audit insists on confidence-labeling every item rather than repeating prior claims at face value.

## Security

**Positive evidence:**
- A documented, deliberate 7-commit sweep (2026-08-03) wiring `requireCapability` authorization into every write route across academics, grading, attendance, finance, students/teachers/users, settings, and receptionist/accountant access — this is real, systematic hardening, not incidental.
- A genuine fail-open tenant-isolation bug (portal-manifest) was found and fixed the same day (`d6e4c9f`).
- Role-permission overrides support deny, not just grant (`6fc02d3`) — a real, non-trivial RBAC capability.
- File-service path-scrubbing and dual-write error handling were hardened (`ed9158b`) — relevant to preventing path-traversal-class bugs in the upload system used across Students/HR/Documents.

**Gaps:**
- No independent penetration test or security review evidence exists anywhere in the repo.
- The existence of one real, fixed fail-open bug is a positive sign it was caught, but should not be read as proof no similar issues remain — a dedicated security review is recommended before handling real student data.
- No documented data-privacy/consent framework was found for a product that is, by its nature, custodian of minors' PII. This is a real gap for a Morocco-market education product and should be addressed with appropriate legal/compliance input before any real-school pilot.
- No secrets were read or exposed as part of this audit (per its own instructions) — `.env`/`.env.production` exist but their contents were deliberately not inspected here; a separate, authorized secret-rotation review should confirm nothing sensitive has ever been committed to git history (a quick `git log -p | grep` sweep for common secret patterns was not performed this session and is recommended as a follow-up).

## Technical debt, explicitly named

| Item | Why it's debt | Cost of not fixing |
|---|---|---|
| Manual-verification-as-primary-QA | Real but slow, non-repeatable, doesn't scale | Every new feature re-accumulates unverified risk until someone manually checks it again |
| Zero confirmed-passing automated tests | Test infrastructure exists unused | Regressions can land silently; this project has already shown at least one silent regression pattern (the payroll-recalculation "silent no-op" bug, commit `766cec9`) |
| Single git identity, no branch/PR workflow | No second reviewer has ever looked at any change before it landed on `main` | Higher risk of exactly the kind of false-claim/compile-error issues this audit found |
| Documentation drift (self-acknowledged in the repo's own tracker) | 10 plan docs self-report "not started" for code that's actually built | Wastes effort re-investigating already-solved problems; erodes trust in status docs generally |
| Stale addon-registry flags (partially fixed this period) | `inventory`/`human-resources` were flagged `enabled:false` despite being fully shipped, until fixed this session | New team members could wrongly deprioritize working features |
| No `.env.example` template found | Onboarding friction for any new engineer | Slower ramp-up, risk of misconfigured local environments |

## Scalability / operational concerns

- No load-testing evidence found anywhere in the repository.
- No production monitoring/observability configuration found beyond a local dev error-overlay tool (`dev:spotlight`).
- No evidence of a successful production deployment — meaning scalability characteristics under real load are entirely unverified, not just "unverified at scale," but unverified at any deployed scale.
- `docs/backup-restore.md` exists (real, positive) but no evidence a restore has ever actually been tested/drilled.

## Recommended immediate actions, in order

1. Fix the 3 TypeScript errors.
2. Restore and stabilize the database environment.
3. Run the full test suite and record real results.
4. Resolve the Office Accounting architecture decision.
5. Schedule a dedicated security/privacy review before any real-school pilot.
