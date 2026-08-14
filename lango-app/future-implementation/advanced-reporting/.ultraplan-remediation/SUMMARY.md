# UltraPlan Summary — Advanced Reporting Addon Remediation

> One-page overview. Generated 2026-08-06.

## What We're Building
We're fixing the school's "Advanced Reporting" add-on so it actually works. This is the tool that's supposed to let school staff run reports and download them as a spreadsheet or PDF. Right now, even though a previous attempt claimed this was finished and working, almost none of it actually functions.

## Key Features
- Every report either runs against real school data, or clearly says "not available yet" — never fake sample numbers.
- Only the right people can run each report based on sensitivity, and that check is actually enforced.
- Real CSV, Excel, and PDF exports — currently two of the three formats are fake.
- Scheduled reports actually run automatically instead of doing nothing.
- Every report action is written to the school's activity log.
- Rebuilt automated tests that genuinely prove the previously-fabricated claims (balance sheet math, payroll masking) are now correct.

## Tech Stack
- **Frontend:** Next.js 15 App Router (existing, unchanged)
- **Backend:** Next.js API routes, Drizzle ORM
- **Database:** PostgreSQL
- **Auth:** existing `requireRequestContext`/`requireCapability`/`requireAddon` stack, correctly applied
- **Storage:** existing tenant-namespaced local-disk uploads volume
- **New dependencies:** exceljs, pdfkit, cron-parser
- **Scheduling:** Next.js 15 `instrumentation.ts` + in-process interval (new pattern for this codebase)
- **Hosting:** existing Docker Compose deployment

## Risk Areas
- **[Red]** Route Layer Hardening (section-02): security-critical, same bug class as a real vulnerability fixed earlier this session.
- **[Red]** Real Scheduler Worker (section-06): genuinely novel pattern, no existing precedent in this codebase.
- **[Yellow]** Fix Fabricated Adapter Data, Run Engine Wiring, Real Exports & Durable Storage, Wire HMAC-Signed Downloads, Rebuild Test Suite (sections 03, 04, 05, 07, 09).

## Plan Structure
- **10** sections, **35** total tasks
- **4** parallel batches
- **4** sequential steps (minimum to complete)
- **Critical path:** section-01/03 → section-02/04/05 → section-06/07/08/09 → section-10

## How to Execute This Plan
1. Start with Batch 1: section-01 (Schema & Seeding Foundation) and section-03 (Fix Fabricated Adapter Data) — no shared files, can run in either order.
2. Batch 2: section-02 (Route Layer Hardening), section-04 (Run Engine Wiring), section-05 (Real Exports).
3. Batch 3: section-06 (Scheduler Worker), section-07 (HMAC Downloads), section-08 (Missing UI), section-09 (Real Tests).
4. Batch 4: section-10 (Final Verification) — live end-to-end + cross-tenant sweep, run last.
5. After each section, run its TDD test stubs to verify before moving on.

## How to Update This Plan
Run `/ultraplan update` and describe what changed. Only affected sections are regenerated.

## Files in This Plan
| File | What It Contains | Who It's For |
|------|-----------------|--------------|
| `PRD.md` | Product requirements in plain English | You |
| `PLAN.md` | Technical implementation plan | AI executor |
| `RESEARCH.md` | Research findings (1/3 subagents succeeded; rest from built-in knowledge, flagged) | Reference |
| `DISCOVERY.md` | Complete Q&A transcript | Audit trail |
| `VALIDATE.md` | Requirement traceability matrix | Quality check |
| `STATE.md` | Session state | System |
| `SUMMARY.md` | This file | You |
| `sections/index.md` | Section manifest | AI executor |
| `sections/section-*.md` | Individual implementation sections | AI executor |
