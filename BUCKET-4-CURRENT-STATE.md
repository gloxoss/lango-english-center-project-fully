# Bucket 4 — Current State (re-derived against live code)

**Date:** 2026-08-25
**Method:** Every item from `AGENT-EXECUTION-PROMPTS.md` Part 3 ("~40 unbuilt features") was re-checked against the working tree at commit `a431047` + uncommitted changes — not against any document's claims. Evidence = file path (+ line-level detail where decisive). Spot-check standard follows `EXECUTION-AUDIT-VERIFIED.md`.

**Bottom line:** of ~33 discrete line-items (~40 counting sub-bullets), **17 are now built or substantially built**, 6 are partial, **7 are genuinely still unbuilt**, and 1 was intentionally never started (by-design flat table). The "~40" figure is dead — do not write execution prompts off it.

---

## A. Built since the review (17) — remove from Bucket 4

| Item | Evidence |
|---|---|
| §2.7 student photo gallery | `studentPhotos` table (`src/models/Schema.ts`); gallery branch in `src/app/api/students/photos/route.ts` (`?gallery=`); `src/features/students/ui/student-photos-view.tsx` |
| §2.9 threshold-based promotion | `recommend(avgPct, passThresholdPct)` → promote/retain/defer in `src/app/api/students/promotions/preview/route.ts` L11–14 |
| §3.1 scheduled alumni transition | `alumniTransitionJob` registered in `src/features/settings/services/scheduled-jobs-service.ts` ("Transition automatique vers Anciens élèves"), calls `transitionStudentToAlumni` |
| §5.1 alumni requests kanban | Column board over `RequestStatus` in `src/features/students/ui/alumni-requests-view.tsx` (L30 COLUMNS, L122 render) — scope resolved as alumni-requests-only |
| §6.1 class-create wizard core | `Availability` type + `/api/academics/teacher-availability` fetch + inline teacher fields in `src/features/academics/ui/classes-client.tsx` L28–164 (weekly-calendar preview not verified) |
| §6.5 per-class period mode | `period_type` on classes in `Schema.ts`; consumed in `classes-client.tsx`, `schedule-client.tsx` |
| §6.12 conflict auto-fix suggestions | `ApiSuggestion[]` + `handleApply()` via slot PUT in `src/features/academics/ui/conflicts-view.tsx` — no longer a bare deep-link |
| §6.14 substitute teachers | `substitute` handling in `assignment-workspace-view.tsx`, `classes-client.tsx` |
| §6.16 readiness drill-down | Explicit "(§6.16)" drill-down link + export in `src/features/academics/ui/academic-readiness-view.tsx` (week-over-week trend NOT found — remainder) |
| §8.1 bulk badge issuance UI | `badge-management-view.tsx` wires `bulk-issue` |
| §8.3 camera QR scanning | `getUserMedia`/`BarcodeDetector` present in `src/features/attendance/ui/attendance-scanner-kiosk.tsx`; scanner playground added this wave |
| §10.3 devoirs question bank | `question-bank-view.tsx` + `api/academics/teacher-question-bank/[id]` routes (`teacher_question_bank_items` table in schema) |
| §12.1 library sidebar naming | Single renamed label `'Bibliothèque & Prêt d'Ouvrages'` in `sidebar.tsx` |
| §13.3 grouped billing entry point | Invoices view references `Facturation groupée` / `finance/allocations` |
| §19.2/3/5 hostel bulk creation | Floors×rooms×beds wizard state (`wizardFloorsCount`, `autoGenerateBeds`) in `rooms-beds-view.tsx`; bulk allocation preview/commit APIs under `api/addons/hostel/allocations/bulk/*` |
| §22.6 DB-driven addon catalog | `addon_definitions` table (migration `0126`) + `src/libs/api/addon-catalog.ts`; settings/website routes entitlement-gated — hardcoded-registry premise is gone |

## B. Partial (6) — scope the remainder, don't rebuild

| Item | Done | Missing |
|---|---|---|
| §1.3 unified school management | Plan-tier enforcement is real: `requirePlanTier(`/`assertStudentCapacity(` in 6 files | Whether school-detail + plans catalog + subscriptions are actually merged into one screen (`super-admin/schools/[id]`) — verify before writing prompts |
| §1.4 platform stub pages | Real pages exist for SMS (`super-admin/sms/`), Support, Reports, Waitlist | "Santé & Infrastructure" page absent |
| §4.1/§11.4 event admin detail | `event-admin-detail-view.tsx` exists + calendar views | Coverage of all 7 sub-resources (venues/tasks/incidents/feedback/comms/reports/check-ins) inside that view unverified |
| §6.13 session-copy JSON preview | Structured preview interfaces in `session-copy-view.tsx` (`PreviewSummary/ClassSubject/ClassTeacher…`) | Full editable-JSON-before-apply UX unproven |
| §1.5 IGP score ⚠️ | Composite referenced in `api/analytics/route.ts` + `api/leadership/me/home/route.ts` | Formula provenance/sign-off (the actual ⚠️ blocker) still open — decision item |
| §7.3 old teacher form ⚠️ | HR employee wizard covers employment records | Consolidate-vs-duplicate decision still unanswered |

## C. Genuinely still unbuilt (7) — the real Bucket 4

| Item | Evidence of absence |
|---|---|
| §6.6 filière structure (coefficients, Bac code, cycle restriction) | No hits for `filiereCode`/`coefficient`/cycle-restriction anywhere in academics schema/UI |
| §6.10 timetabling constraint solver | No solver/auto-assign implementation in `features/academics` |
| §10.1 sequential exam-master flow | No step/locked/disabled gating in `exam-planning-view.tsx` |
| §10.4 keyboard-driven marksheets + live mention | Only mention hit is `assessment-policies-client.tsx`; no marksheet grid wiring |
| §10.5 shared room registry | `src/features/academics/data/rooms-config.ts` exports hardcoded `MOCK_ROOMS` — static data masquerading as a registry |
| §14.3 inventory reorder-point automation | No `reorderPoint`/`reorder_point` field anywhere in `features/inventory`; suggestions endpoint is manual-only |
| §21.1 stuck-run crash recovery | No stale-`running` sweep in `advanced-reporting/services` (`report-cleanup.ts`/`schedule-worker.ts` don't recover interrupted runs) |

## D. Intentionally not built (1)

| Item | State |
|---|---|
| §15.4 broadcast campaigns kanban ⚠️ | Flat table remains (`campaigns-view.tsx`) — legitimate design per the item's own caveat; build only if requested |

---

## Recommended re-slice for the next execution prompt

1. **One small batch**: C-items that are single-surface builds — §10.1, §10.4, §14.3, §21.1, plus replacing `MOCK_ROOMS` (§10.5) with a real tenant-scoped rooms table (this also feeds §6.x scheduling work).
2. **One medium project**: §6.6 filière model (schema + Massar-facing codes + cycle validation) — pairs with the deferred Massar phase.
3. **Standalone/large, defer**: §6.10 solver.
4. **Verification-first mini-prompt**: confirm depth of B-row partials (§1.3 merge, §4.1 seven sub-resources, §6.1 calendar preview, §6.13 editable JSON, §6.16 trend) before anyone scopes them.
5. **Human decisions still owed**: §1.5 IGP formula sign-off; §7.3 consolidate-vs-retire; §15.4 kanban yes/no.
