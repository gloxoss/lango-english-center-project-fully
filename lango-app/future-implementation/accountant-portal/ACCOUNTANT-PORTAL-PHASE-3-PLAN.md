# Accountant Portal — Phase 3 (Fee Assignments, Refunds, Credit Notes, Relances)

**Status: not started.** Phase 1/2 (capability model, navigation filtering,
Collection Desk, receivables/home fixes, page-level hardcoded-data cleanup)
are done — see `ACCOUNTANT-PORTAL-PLAN.md` and this session's earlier
audit rounds. This phase adds four pages, chosen because each one is either
a real backend route with **zero UI anywhere** in the app, or an existing
page that is **100% fabricated mock data** with real tables already sitting
under it.

Same discipline as every prior phase: verified by reading the actual route/
schema files, not assumed. `requireRequestContext` → `requireTenant` →
`requireCapability` → Zod `.strict()` → tenant-scoped Drizzle query →
`recordAudit()` → `apiErrorResponse()`. Next migration number is **0056**
(`0055_add_credit_note_approval.sql` is the last one on disk — re-check
`migrations/meta/_journal.json`'s true highest `idx` at execution time,
since a concurrent session may have taken 0056 first; see this repo's
established "un-journaled migration" collision pattern before creating it).

## Standing rule for every page in this phase

Phase 2 shipped `src/hooks/use-permissions.ts` (`can(permission)`, `role`)
specifically to stop the pattern this session had to repeatedly clean up
after: a button visible to a role that then gets a raw
`Permission manquante: ...` string back from the server on click. **Every
write action added in this phase must be gated client-side by the same
capability the route actually enforces, from the first commit** — not
retrofitted after a user reports the raw error message. Cross-check the
gate against the literal `requireRequestContext`/`requireCapability` calls
in the route, not against what "should" be true.

---

## Feature 1 — Fee Assignments (`finance/allocation` route already exists, unused)

**Real backend, zero UI.** `GET /api/finance/fee-assignments` (accountant
included in the role gate) joins `feeStructureAssignments` →
`feeStructures` → `classes` — which fee structure a class currently owes.
`POST`/`DELETE` are `school_admin` + `finance.approve` only (assigning
tuition to an entire class is a bigger decision than an accountant acts on
alone).

- Page: reuse `src/app/[locale]/(dashboard)/dashboard/finance/allocation/page.tsx`
  (already routes to `FeeAllocationView` — verify at execution time whether
  that view is real or mock; it showed live `fetch()` calls in this
  session's grep but was never read line-by-line). If real, this may just
  be a **sidebar-wiring gap** — add it to `schoolNavItems`'s Finance
  section with `permission: 'finance.read'` and confirm the create/delete
  controls are gated by `role === 'school_admin'` (mirrors the exact gate
  already applied to `pricing-structures-view.tsx`'s create/edit/delete
  this session — same capability shape, same fix).
- If `FeeAllocationView` turns out to be mock: rebuild it as a simple table
  (class, fee structure, amount, effective date) + create/delete form,
  same shape as `pricing-structures-view.tsx`.

**Verify:** accountant sees the list read-only, no create/delete controls
render; school_admin can assign a real fee structure to a real class and
see it reflected immediately.

---

## Feature 2 — Refunds (real table, but no maker-checker — same gap Credit Notes had before this session's fix)

`refunds` table (`Schema.ts:2916`) has **no status column at all** —
`POST /api/finance/refunds` requires `finance.approve` outright and
inserts the refund as already-final, with `approvedById` set to whoever
created it (misleading name — nothing is actually approved, there's no
second party). Accountant lacks `finance.approve`, so today an accountant
literally cannot create a refund at all, not even a pending one — the same
bug this session found and fixed for credit notes in migration `0055`.

### Schema (migration `0056_add_refund_approval.sql`)

Mirror `0055` exactly:

```sql
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS status discount_approval_status NOT NULL DEFAULT 'pending';
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS decided_by_id text;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS decided_at timestamp;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE refunds ADD CONSTRAINT refunds_decided_by_id_user_id_fk FOREIGN KEY (decided_by_id) REFERENCES "user"(id);
-- backfill: refunds created before this workflow existed are already final
UPDATE refunds SET status = 'approved', decided_at = created_at WHERE status = 'pending';
```

Reuse `discountApprovalStatus` (already `pending/approved/rejected`) —
same reasoning as credit notes, don't invent a near-duplicate enum.
Rename the existing `approvedById` column's *meaning* only in code/docs
(it's actually "requested by"); don't rename the column itself, that's an
unrelated migration for no real benefit.

### Route changes (`src/app/api/finance/refunds/route.ts`)

- `POST`: change the capability check from `finance.approve` to
  `finance.manage` (accountant has this — matches the credit-notes POST
  fix). Insert with `status: canSelfApprove ? 'approved' : 'pending'`
  where `canSelfApprove = await hasCapability(ctx.userId, tenantId,
  ctx.role, 'finance.approve')` — identical logic to
  `credit-notes/route.ts`'s POST. Only run `tryPostRefundGLEntry` when the
  refund lands `approved` (a pending refund hasn't happened yet — no GL
  entry should post until it's decided; this is a real behavior change
  from today's code, which posts unconditionally at creation).
- New `PATCH`: approve/reject, `finance.approve`-gated. Extract a shared
  `decideRefund()` service in `src/libs/services/refund-approval.ts`,
  same shape as `src/libs/services/credit-note-approval.ts` — on approve,
  *then* call `tryPostRefundGLEntry`.
- `GET`: add `status`, `decidedById`, `decidedAt`, `rejectionReason` to
  the returned columns (currently omits them entirely, same gap Credit
  Notes' GET has today — fix both while touching this pattern).

### Approvals inbox integration

`accountant/me/approvals/route.ts` already handles `expense`/`credit_note`
as a discriminated `type`. Add `'refund'` as a third type to both the GET
(query `refunds` where `status = 'pending'`, same shape as the existing
`pendingCreditNotes` query) and the POST action switch (call
`decideRefund()`). This is the same file, same pattern, third branch —
not a new endpoint.

### Page

New `src/app/[locale]/(dashboard)/dashboard/finance/refunds/page.tsx` +
`refunds-view.tsx`: list (student, amount, method, reason, status badge),
"Nouveau remboursement" form (student + original payment picker + amount
+ method + reason) gated by `can('finance.manage')`, inline
Approuver/Rejeter gated by `can('finance.approve')` — same
"En attente d'un administrateur" fallback text already used on the
Approvals page for the equivalent case. Add to sidebar under Finance,
`permission: 'finance.read'`.

**Verify:** accountant creates a refund → lands `pending`, no GL entry
yet, no crash on the now-missing immediate approval. school_admin
approves it from either the Refunds page or Mes Approbations → GL entry
posts, status flips to `approved`. Reject path stores `rejectionReason`.

---

## Feature 3 — Credit Notes management page (backend real, buried inside Approvals only)

Today a credit note can only be *approved/rejected* from the Approvals
inbox — there's no page to browse all credit notes (approved and rejected
included, not just pending) or to create one outside of... actually,
check at execution time whether **any** UI currently calls
`POST /api/finance/credit-notes` at all. If none does, creating one is
currently only possible via raw `curl`, which is a real gap on top of the
missing list page.

### Route change

`GET /api/finance/credit-notes` currently omits `status`, `approvedById`,
`approvedAt`, `rejectionReason` from its select (`route.ts:44-54`) even
though the columns exist since migration `0055`. Add them — needed to
render status badges.

### Page

New `src/app/[locale]/(dashboard)/dashboard/finance/credit-notes/page.tsx`
+ `credit-notes-view.tsx`: list with status badges (pending/approved/
rejected, same badge styling already used on the Refunds/Approvals pages
for consistency), filter by student, "Nouvelle note de crédit" form
(student + optional invoice + amount + reason) gated by
`can('finance.manage')`, inline Approuver/Rejeter gated by
`can('finance.approve')`. Add to sidebar, `permission: 'finance.read'`.

**Verify:** accountant creates a credit note → pending, visible on both
the new Credit Notes page and Mes Approbations (same underlying row, two
views). school_admin approves from either page, both reflect the change
after refetch.

---

## Feature 4 — Relances (payment reminders) — `reminders-statements-view.tsx` is 100% mock, rebuild scoped to real data

Confirmed via grep: every array in this component (`FAMILIES`,
`INVOICE_HISTORY`, `SEND_LOG`, `RECEIPT_HISTORY`) is hardcoded, zero
`fetch()` calls. The mock invents a fabricated "statement/receipt
history" on top of the reminder concept — drop that part; it's a second,
undeclared feature (document generation & delivery tracking) with no
schema backing.

### What's real and buildable

- Overdue invoices per student: same computation already proven in
  `accountant/me/receivables/route.ts` and `finance/reports/route.ts`
  (`netAmount - paidAmount > 0`, `status != paid/cancelled`, bucket by
  `dueDate`). Reuse the aging-bucket logic already written this session
  for the `finance/reports` CSV export rather than re-deriving it.
- Guardian contact (phone) for the send target: `guardians`/
  `guardianStudents`, same join already used in `students/parents`. Note:
  as of this session's testing, `guardians` is empty in the dev tenant —
  the reminders list will legitimately show "no phone on file" for most
  students until `future-implementation/admission-and-student-model`'s
  real guardian-linking work lands. That's an honest empty state, not a
  bug to hide.
- Delivery log: real `smsMessages` table (`Schema.ts:1953`) — already the
  established "log-only simulated SMS" pattern used elsewhere in this
  app (no real SMS gateway integrated; a row is written with
  `status: 'queued'`, this is disclosed, not pretended to be delivered).

### New route

`POST /api/finance/reminders` — gated on `finance.manage` (not
`communication.send`; accountant has the former, not the latter, and this
is specifically a collections action, not general messaging — don't
overload an unrelated capability for a one-off). Body: `{ studentId,
channel: 'sms' }`. Looks up the student's outstanding balance and primary
guardian phone, writes one `smsMessages` row with a templated body
("Rappel: solde impayé de {amount} MAD, échéance {date}"), returns the
created row.

`GET /api/finance/reminders` — two parts: (a) outstanding-balance list
(reuse the aging query), (b) recent `smsMessages` where
`body ILIKE '%Rappel%'` or a dedicated marker, ordered by `createdAt desc`,
as the "send log."

### Page

Rebuild `reminders-statements-view.tsx` in place: outstanding-balance
table (student, guardian phone or "Non renseigné", balance, days
overdue) with a per-row "Envoyer un rappel" button calling the new route;
a send-log panel below showing real `smsMessages` rows. Drop the
`INVOICE_HISTORY`/`RECEIPT_HISTORY` fabricated sections entirely — no
per-student invoice timeline or receipt-batch history exists; that's a
different, unrequested feature.

**Verify:** sending a reminder for a real overdue student inserts a real
`smsMessages` row visible in the send log; a student with no linked
guardian phone shows a disabled send button with an honest reason, not a
silent failure or a fabricated phone number.

---

## Sidebar additions (all four, `permission: 'finance.read'` — matches every other Finance sub-item)

```
{ label: 'Assignations tarifaires', href: `/${locale}/dashboard/finance/allocation` },
{ label: 'Remboursements', href: `/${locale}/dashboard/finance/refunds` },
{ label: 'Notes de crédit', href: `/${locale}/dashboard/finance/credit-notes` },
{ label: 'Relances', href: `/${locale}/dashboard/finance/reminders` },
```

## Migration plan

Single migration `0056_add_refund_approval.sql` covers Feature 2's schema
change. Features 1/3/4 need no schema changes (existing tables, or the
already-shipped `smsMessages`/`creditNotes` tables). Apply via the
established fallback if `drizzle-kit migrate` hangs again: raw
`psql -f -`, then manually register the hash in
`drizzle.__drizzle_migrations`.

## Explicit non-goals (don't scope-creep into these)

- No real SMS/email gateway — reminders stay log-only, same as every
  other communication feature in this app today.
- No statement/receipt PDF generation for Feature 4 — that's a distinct,
  unrequested feature (document generation), not a reminders workflow.
- No touching `bank-reconciliation`/`chart-of-accounts`/`journal` —
  already deliberately scoped down this session, out of scope here.
- Don't build real guardian data as part of Feature 4 — that dependency
  is `future-implementation/admission-and-student-model`'s job; Feature 4
  should degrade honestly (visible "no phone on file"), not duplicate
  that plan's work.
