# UltraPlan Summary — Alumni Portal

## What We're Building
A real, self-service portal for former students: a real graduation transition (single or bulk) that disables old student access and issues fresh alumni credentials, real document access with public no-login verification, real staff-reviewed correction/reissue/data-request queues, real events/RSVP, a real per-field opt-in directory, and a real mentoring listing — all with 18+ safeguarding baked in, replacing a fully fake mock-data alumni page that already exists in the codebase.

## Key Features
- Real graduation transition — first-ever post-creation role change in this codebase, built carefully with session invalidation and concurrency-safety, single or bulk (up to 200 at once)
- Real document verification — unique codes, public no-login check, old code revoked on reissue
- Real staff-reviewed request queue for corrections/reissues/data access/deletion — deletion never touches legally-retained records
- Real self-contained alumni events + RSVP, not blocked on a separate unbuilt addon
- Real per-field directory consent + a real, shared, fail-closed 18+ safeguarding helper reused by both directory and mentoring
- Real opt-in mentoring listing, no automated matching

## Tech Stack
No new stack — pure extension of the existing Next.js/Drizzle/PostgreSQL/Better Auth stack. Reuses the admission-approval credential-issuance pattern, the existing log-only SMS system, the existing tenant-namespaced file storage, the existing `namingSeries` + advisory-lock pattern, and the existing public-endpoint rate-limiter.

## Risk Areas
- [yellow] section-01 — 3 non-DB role touch points, one silently breaks alumni logins if missed
- [yellow] section-02 — the first-ever post-creation role change in this codebase; also handles session invalidation and concurrency safety
- [yellow] section-04 — a real, unauthenticated public endpoint (mitigated by reusing proven rate-limiting)
- [yellow] section-05 — reissue must supersede the old document and issue the new one in one correct transaction
- [yellow] section-07 — real child-safety correctness (fail-closed on unknown age), shared by section-08

## Plan Structure
- 9 sections, 35 tasks
- 5 sequential batches
- Critical path: 01 → 02 → 03 → {04, 06, 07 → 08} → 05 → 09

## How to Execute This Plan
1. Open any AI coding tool in this repo.
2. Point it at `future-implementation/alumni-portal/.ultraplan/` (isolated from both the project-root `.ultraplan/` and the completed `dropped-features-rebuild` plan, both unrelated).
3. Say: "Read future-implementation/alumni-portal/.ultraplan/sections/index.md and execute section 1."
4. Section 1 (schema/role foundation) must complete and be Docker-verified before anything else starts — it's the hard critical path.
5. Section 2 (graduation transition) is the single highest-risk section — build and verify it thoroughly, including the session-invalidation and concurrency checks, before moving on.
6. Sections 4, 6, 7 can run in parallel once 1+3 are done; section 8 specifically needs section 7's safeguarding helper (task 07-01), not all of section 7.
7. Section 5 needs section 4's document mechanics — don't start it early.
8. Section 9 (final verification) is last, always — includes a live end-to-end lifecycle test and a cross-tenant isolation sweep, not just a typecheck.
9. Before touching any existing file, run `git status --short` on it first — this repo has an actively-committing concurrent session.

## How to Update This Plan
Run: `/ultraplan update` from within `future-implementation/alumni-portal/`
Describe what changed, and only affected sections will be regenerated.
