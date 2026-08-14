# Accountant Portal — Phase 3 Execution Agent Prompt
# Give this ENTIRE file to the agent before asking it to do any work.
# Version: 2026-08-05 | Owner: Oussama Zaki (Zakio)

---

## 0. MANDATORY FIRST READS, IN THIS ORDER

1. `SCHOOLOS-AGENT-MASTER-PROMPT.md` (repo root) — project identity, tech stack, API/UI conventions, design system, Docker workflow, permissions registry, agent discipline rules.
2. `CLAUDE.md` (repo root) — project rules.
3. `future-implementation/accountant-portal/ACCOUNTANT-PORTAL-PHASE-3-PLAN.md` — the plan you're executing. Already verified against the live codebase (route files, `Schema.ts`, `permissions.ts` read directly, not assumed) — trust its existing-vs-missing breakdown.
4. `future-implementation/accountant-portal/ACCOUNTANT-PORTAL-PLAN.md` and `EXECUTION-AUDIT-REPORT.md` — Phase 1/2 context. Phase 3 builds directly on the capability model and `usePermissions()` hook those phases shipped.
5. `src/hooks/use-permissions.ts` and one existing consumer — e.g. `src/features/finance/ui/pricing-structures-view.tsx` — to see the exact gating pattern you must replicate in every new page this phase adds.
6. `src/libs/api/permissions.ts` — read the actual current `PERMISSIONS`/`DEFAULT_ROLE_PERMISSIONS.accountant` before touching either; re-confirm against the plan's description in case the concurrent session (§2) has moved it.

Do not start implementing until you've read all six.

---

## 1. MISSION

Build the four features in `ACCOUNTANT-PORTAL-PHASE-3-PLAN.md`, in order:
**Feature 1 (Fee Assignments) → Feature 3 (Credit Notes page) → Feature 2
(Refunds) → Feature 4 (Relances)**. This order is deliberate, not the plan
doc's numbering: 1 and 3 are UI-only or additive-field wiring against
already-correct backends (lowest risk, ship first); 2 requires a schema
migration and a route behavior change (GL posting timing); 4 is the
largest rebuild (fully mock today) and most benefits from the patterns
established by the first three being fresh.

This plan exists because the immediately preceding round of work on this
same portal — done in this session, by a capable agent working carefully —
still shipped a page (`pricing-structures-view.tsx`) whose Create/Edit/
Delete buttons were fully visible to a role the *route itself* rejected
with `403 Permission manquante: Approuver les opérations financières`.
That bug reached the user, who reported it live, twice, on two different
pages, before it was caught. It was not caused by carelessness — it was
caused by writing the UI and the permission gate as two separate mental
steps, and only remembering the second one when a page was new or
obviously sensitive. **Every write control in this phase — every button,
every form, every inline action — must be gated by `usePermissions()`
against the exact capability the route enforces, written in the same
diff as the button itself, not added afterward.** Section 6 has the full
list of failure patterns to avoid, including this one, with specifics.

---

## 2. CONCURRENT EDITING — same standing condition as every prior plan in this repo

A second agent session works in this exact repository throughout the day,
independently, with no coordination channel. At last check this produced
100+ uncommitted files at once, including **a real migration-ledger
inconsistency**: `migrations/0044_pf03_organisation_identity.sql` exists
on disk but isn't journaled, while `migrations/meta/_journal.json`
references `0053_waitlist_leads.sql`, which doesn't exist on disk. This
broke `docker compose run migrate` outright (exit 1) as of this writing.
**Do not attempt to fix, renumber, or delete either side of that
inconsistency** — it's the other session's in-progress work. If you need
to apply your own migration and `migrate` still fails for this reason,
start the `app` service directly with `docker compose up -d --no-deps app`
(bypasses the `migrate` dependency) and apply your SQL by hand via
`docker compose exec db psql -f -`, same fallback already used earlier
this session for a hanging `migrate` container.

**Before touching ANY file:**
```powershell
git status --short -- <exact file path>
```
If it's dirty and you didn't just make it dirty yourself, don't edit it
directly — hold that task or use the isolated git-blob commit technique
for a clean, additive change to a large shared file:
```powershell
git show HEAD:<path> > /tmp/clean_copy
# apply ONLY your own change to /tmp/clean_copy, never to the working-tree file
git hash-object -w /tmp/clean_copy
git update-index --cacheinfo 100644,<hash>,<path>   # full repo-root-relative path required
git commit -m "..."
```
**Never** `git checkout`/`restore`/`reset --hard`/`clean` a file with
someone else's uncommitted changes. Never revert their WIP to resolve a
collision.

**Before every commit**: `git diff --cached --stat`, confirm every listed
file is one you intentionally changed. Commit per feature (4 features ≈ 4
commits minimum, more if a feature naturally splits into schema/route/UI),
not one giant batch at the end.

---

## 3. EXECUTION PROTOCOL, PER FEATURE

1. Re-read the relevant section of `ACCOUNTANT-PORTAL-PHASE-3-PLAN.md`
   fresh before starting it.
2. Collision-check every file you're about to touch (§2).
3. For Feature 1: **first** read `finance/allocation/page.tsx` →
   `FeeAllocationView` line-by-line before deciding whether it's a
   sidebar-wiring gap or a full mock rebuild — the plan flags this as
   unverified. Don't assume either way.
4. For Feature 2 (schema): re-read `migrations/meta/_journal.json`'s true
   highest `idx` at execution time before assigning `0056` — do not trust
   the number in the plan doc if the concurrent session has since taken
   it (check §2's migration-ledger note first).
5. For every new page: write the `usePermissions()` gate in the same
   commit as the button/form it protects — not as a follow-up task.
6. After every schema change: `docker compose build migrate` AND
   `docker compose build app` (separate images, separate caches), apply
   the migration, verify via a **real `psql` query** — row counts and the
   actual new column values, not just a success log line.
7. After every route/UI change: rebuild the app image, restart the
   container, hit the real endpoint or page with `curl` as **both** an
   accountant session and a school_admin session — same two-role check
   pattern used throughout Phase 1/2 — and confirm actual response codes,
   not expected ones.
8. `npx tsc --noEmit` after every file change, but never as the only test.
9. Stage and commit only what that task changed, verified via
   `git diff --cached --stat` before committing.

---

## 4. THE AUDIT REPORT

Create and continuously update:
`future-implementation/accountant-portal/EXECUTION-AUDIT-REPORT-PHASE-3.md`
(separate file from Phase 1/2's report — don't overwrite that history).

```markdown
## Overview Table
| Feature | Status | Commits | Tests run (real evidence) | Notes |
|---|---|---|---|---|
| 1. Fee Assignments | | | | |
| 3. Credit Notes page | | | | |
| 2. Refunds | | | | |
| 4. Relances | | | | |
```

Per-feature detail with exact commands run and exact output pasted in,
not paraphrased. If the only evidence for a task that touched the
database or a UI fetch call is `tsc✓`, that's not verification — go run
the real check.

---

## 5. WHAT "TESTED" MEANS HERE

- **Every gated button/form**: log in as `accountant@atlas.ma` (or
  `accountant@lango.ma`), confirm the control does NOT render. Log in as
  `y.elamrani@atlas.ma` (school_admin), confirm it DOES. Then, for at
  least the accountant session, hit the underlying route directly with
  `curl` to confirm the server still rejects it — the UI gate is not the
  security boundary, the route is; both must be checked independently.
- **Refunds status/GL timing**: create a refund as accountant → real
  `psql` query confirms `status = 'pending'` and **no** row was written to
  the GL entries table yet. Approve as school_admin → confirm `status`
  flips to `approved` AND the GL entry now exists. This specific
  before/after is the actual point of Feature 2; a passing `tsc` run says
  nothing about it.
- **Credit Notes GET fields**: confirm the API response actually contains
  `status`/`approvedById`/`approvedAt`/`rejectionReason` via a raw `curl`
  response dump, not just "the page renders a badge" (the badge could be
  silently defaulting on `undefined`).
- **Relances**: send a real reminder for a real overdue invoice, confirm
  a real row lands in `sms_messages` via `psql` (`SELECT * FROM
  sms_messages ORDER BY created_at DESC LIMIT 1`), and confirm a student
  with no linked guardian phone renders an honest disabled state — not a
  fabricated phone number, not a silent no-op.

---

## 6. SPECIFIC FAILURE PATTERNS TO AVOID (from this exact repo, this exact portal)

1. **A write control rendered for a role the route rejects.** This is the
   failure that directly produced this prompt. It happened twice on two
   different pages in the round immediately before this one, despite the
   `usePermissions()` hook already existing and being used correctly
   elsewhere in the same codebase — the gap was forgetting to apply it to
   a *newly built* page, not not knowing the pattern. Before marking any
   page in this phase done, grep the file for every `<button`/`<Button`
   that calls a mutating fetch (POST/PUT/PATCH/DELETE) and confirm each
   one sits inside a `can(...)` or `role === ...` check matching the
   route's actual gate — do this as a final pass across all four
   features, not just while writing each one.
2. **Claiming a migration succeeded without checking the database.**
   `docker compose run migrate` (or a manual `psql -f -`) printing success
   only means the SQL parsed — it says nothing about whether the backfill
   `UPDATE refunds SET status = 'approved' WHERE status = 'pending'`
   actually matched the pre-existing rows. Query row counts before/after.
3. **GL posting at the wrong point in the refund lifecycle.** The plan
   explicitly changes refunds from "post to GL immediately on create" to
   "post to GL only on approval." If this is implemented as "post on
   create, same as before" with only the status column added cosmetically,
   the feature is not actually fixed — a pending, unapproved refund would
   still hit the ledger. Verify the GL entry's `createdAt` corresponds to
   the approval action's timestamp, not the initial request's.
4. **Silently reusing `communication.send` instead of `finance.manage`**
   for the Relances send action because it "sounds like" a messaging
   capability. The plan is explicit about why: accountant has
   `finance.manage`, not `communication.send`, and overloading the wrong
   capability either breaks the feature for accountant or grants
   messaging permissions nobody intended. If you find a reason to deviate
   from the plan's capability choice, say so explicitly in the audit
   report — don't silently pick the "closer-sounding" one.
5. **Reporting zero commits as an acceptable end state**, or committing
   everything in one giant batch at the end mixed in with concurrent
   session files. Commit per feature as you go.
6. **"Deviations from the plan: None" on a section that actually
   deviated** — e.g. building `FeeAllocationView` as a full rebuild when
   it turned out to already be real (or vice versa). State the actual
   finding and what you did about it.

---

## 7. SCOPE DISCIPLINE

- Don't touch `bank-reconciliation`, `chart-of-accounts`, or `journal` —
  explicitly out of scope per the plan's non-goals section.
- Don't build a real SMS/email gateway for Relances — log-only via
  `sms_messages`, same as every other communication feature in this app.
- Don't build statement/receipt PDF generation — not part of this phase.
- Don't touch `future-implementation/admission-and-student-model` or
  attempt to populate real guardian data as a side effect of Feature 4 —
  that's a separate, not-yet-started plan; Feature 4 must degrade
  honestly against the current empty `guardians` table, not work around
  it.
- Don't add new capability keys beyond what the plan specifies
  (`finance.manage` reuse for both Refunds POST and Relances send) — if a
  real need for a new capability surfaces mid-execution, say so in the
  audit report rather than silently adding one.

---

## 8. WHEN YOU'RE DONE (or time/scope runs out)

1. Finalize `EXECUTION-AUDIT-REPORT-PHASE-3.md`'s summary — what shipped,
   what's blocked, what needs a decision.
2. Update `ACCOUNTANT-PORTAL-PHASE-3-PLAN.md` with actual outcomes if
   anything deviated from plan (especially Feature 1's
   real-vs-mock finding for `FeeAllocationView`).
3. Run the §6.1 final pass (grep every mutating button across all four
   new/touched pages, confirm each is capability-gated) as the literal
   last step before declaring done, and paste its result into the audit
   report.
4. Give a short, direct final message: what's real and verified right
   now, with evidence — and the single most important thing to check
   first if someone doubts the report.
