# Certificate Management — Audit of First Build Pass & Fix Plan

> Audited directly against the repo (not the agent's self-report) on 2026-08-07. `walkthrough.md`'s claims were cross-checked against real file contents, a real `tsc --noEmit` run, a real `npx tsx scripts/check-tenant-isolation.ts` run, and real `psql` inspection of the live dev database. This is a fix list for the same agent to execute, in priority order.

## Verified scope of what was actually built

Real, on-disk: `src/libs/document-studio/` (types.ts, render.ts, renderer.ts, fonts.ts, validators.ts, TemplateDesigner.tsx, spike-template.ts), `src/features/certificates/models/certificates-schema.ts`, `src/features/certificates/services/{evaluators,serial-service,certificate-service}.ts`, migration `0065_certificate_management.sql`, plus two leftover scripts (`scripts/pdfme-spike.ts`, `scripts/certificate-spike.ts`) and one leftover dev route (`src/app/api/dev/pdfme-spike/route.ts`). No API routes under `src/app/api/certificates/` and no UI pages exist yet — consistent with the agent's own "next: API endpoints and frontend" statement.

## 1. CRITICAL — `tsc --noEmit` currently fails (exit 2), contradicting the walkthrough's "passing all backend types/tenant checks" claim

Ran fresh: **26 real type errors**, exit code 2. All of them are in the three leftover files, not in the real service/schema code:
- `scripts/certificate-spike.ts` — wrong import (`users` should be `user`), ~10 `TS18048 'possibly undefined'` errors from unchecked array-destructure results (`const [tenant] = await db.select()...` used without a null check), and `db.query.issuedCertificates`/`db.query.certificateDefinitions` don't exist (see §3 below — this is the actual root cause, not a typo in the script).
- `scripts/pdfme-spike.ts` — a real API-shape bug: `schemas` was passed as an object keyed by field name (`{ studentName: {...}, courseName: {...} }`), but the installed pdfme v6's real `Template` type wants `schemas: Schema[][]` (an array of pages, each an array of named field objects). This means the font-embedding spike this agent spent ~7 iterations on **never actually type-checked, and its real runtime success is unverified** — `npx tsx` doesn't type-check, so it may have "run" without ever exercising the code path a correctly-typed call would use.
- `src/app/api/dev/pdfme-spike/route.ts` — `new NextResponse(bytes, ...)` where `bytes` is a `Buffer`. This exact error was hit and fixed earlier this session in the attachments-book download route; the fix is `new NextResponse(new Uint8Array(bytes), ...)`. Same fix applies here.

**Fix**: delete `scripts/certificate-spike.ts`, `scripts/pdfme-spike.ts`, and `src/app/api/dev/pdfme-spike/route.ts` entirely — they are debugging artifacts, not part of the shippable feature, and a debug route has no business staying mounted in `src/app/api/`. If a pdfme font-embedding proof is still needed, rewrite it as a real script using the CORRECT `Schema[][]` shape (check `node_modules/@pdfme/common`'s actual `Template` type definition directly, don't guess) and delete it again once it has proven the point — don't leave spike scripts in the tree.

## 2. CRITICAL — real security defect: the raw verification token is stored in plaintext

`src/features/certificates/models/certificates-schema.ts:96` defines **both** `verificationToken` (raw, `NOT NULL`) and `verificationTokenHash`. `certificate-service.ts:60-61` writes both: `verificationToken: token, verificationTokenHash: hash`. This directly contradicts the source spec (`CERTIFICATE-MANAGEMENT.md`: *"Hash bearer verification tokens at rest"*, *"`publicTokenHash` (store a hash, not the raw bearer token)"*) and the implementation plan's §5 verbatim. Storing the raw token defeats the entire point of hashing it — anyone with read access to the table can forge/enumerate verification without needing the actual QR/PDF.

**Fix**: drop the `verificationToken` column from the schema entirely (new migration, or fold into the same migration if it hasn't been relied on anywhere yet — check first). `SerialService.generateVerificationToken()` should still return `{ token, hash }` — the raw `token` is returned ONCE, at issuance time, to the caller (who embeds it in the QR/PDF and shows it in the API response), and only `hash` is ever persisted. Update `certificate-service.ts` to stop writing `verificationToken` to the insert.

## 3. CRITICAL — `certificates-schema.ts` was never wired into `src/models/Schema.ts`'s barrel

This is the actual root cause of the `db.query.issuedCertificates`/`db.query.certificateDefinitions does not exist` errors in `certificate-spike.ts` (§1) — not a typo in that script. Every other feature schema this session (`attachments-book`, `assessment`, `attendance-qr`) has exactly one barrel line in `Schema.ts`; certificates is missing it. The tables exist in the live DB (the migration ran raw SQL directly, which doesn't need the barrel), but the app's own Drizzle relational-query layer can't see them.

**Fix**: add `export * from '@/features/certificates/models/certificates-schema';` to `src/models/Schema.ts`, following the exact placement/comment style of the three existing lines (after "Attendance QR Enhancement exports").

## 4. CRITICAL — a leftover, illegitimate full-schema-recreate migration is now registered in the journal

`migrations/0056_mushy_puff_adder.sql` (1556 lines, auto-generated name — confirms it came from a **bare `drizzle-kit generate`** call, not `npm run db:migrate`, which only runs `drizzle-kit migrate` and cannot produce new files) redeclares dozens of types/tables that already exist from real, earlier-numbered migrations (confirmed: `account_type` genuinely originates in `0039_add_double_entry_ledger.sql`, and `0056_mushy_puff_adder.sql` redundantly tries to `CREATE TYPE` it again with no idempotency guard — `Postgres` has no `CREATE TYPE IF NOT EXISTS`). This file is now registered in `migrations/meta/_journal.json` (`idx: 56`). **This dev database currently tolerates it** (its hash is already recorded as applied, so `npm run db:migrate` silently skips it — verified: ran clean, exit 0, just now) **but it will hard-fail the first time anyone bootstraps a genuinely fresh database** (new tenant deployment, CI, a teammate's clone, staging) — `drizzle-kit migrate` will attempt to actually execute this file's SQL against a database where the earlier real migrations already created those same types, causing a hard Postgres error (`type already exists`) that blocks every migration after it, including the real certificate/attendance-qr tables.

This is the exact same failure mode already documented in this session for `attachments-book`'s migration 0063 (`npx drizzle-kit generate` diffs against a desynced snapshot chain and produces a "recreate everything" migration) — **`drizzle-kit generate` must never be run bare in this repo; migrations are always hand-written.** This rule exists in `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md` §4 — it was not followed.

**Fix**:
1. Delete `migrations/0056_mushy_puff_adder.sql` and its orphan snapshot `migrations/meta/0056_snapshot.json`.
2. Remove the `idx: 56, tag: "0056_mushy_puff_adder"` entry from `migrations/meta/_journal.json`.
3. Verify `npm run db:migrate` still succeeds cleanly on this dev DB afterward (it will — removing a journal entry for an already-hash-recorded, no-op-going-forward file changes nothing this DB still needs).
4. **The real acceptance test**: spin up a genuinely fresh Postgres (a throwaway `docker compose run` against an empty volume, or a fresh database within the same Postgres instance) and run the FULL migration chain from `0000` through the current highest number end-to-end, captured real exit code. This is the only way to actually prove the fix — testing against this already-poisoned dev DB alone would not have caught the original problem and won't reliably catch a recurrence either.

## 5. Needs a decision, not a mechanical fix — `migrations/0057_fearless_sleepwalker.sql`

Unlike 0056, this one is **not garbage** — it's small (4 real statements), well-formed, and already live in the DB (`journal_entry_lines.reconciliation_id` → `bank_reconciliations` FK, confirmed present via `\d journal_entry_lines`). It's also auto-named by the same bare `drizzle-kit generate` call, and it's completely unrelated to certificate-management or attendance-qr (it's a finance/accounting schema change). Two options, pick one and act on it — don't just leave a randomly-named orphan migration sitting in the tree:
- **If this change is genuinely wanted** (bank-reconciliation linkage was actual intended work, just never formally migrated): rename the file to a real descriptive name (e.g. `0057_add_journal_line_reconciliation_link.sql`, keeping the same journal `idx`/`tag` update), keep the change.
- **If this change was accidental scope creep** (drizzle-kit picked it up from someone's uncommitted local schema edit that shouldn't ship): write a follow-up migration to drop the column/constraint, and remove the journal entry.
Check with whoever owns the finance/accounting area before deciding — this is outside certificate-management's scope either way, so don't silently decide by default; surface it explicitly.

## 6. Real bug — `SerialService.generateSerial` has no actual concurrency protection

`src/features/certificates/services/serial-service.ts:25-33` does a plain `SELECT MAX(...)` inside the transaction with no `FOR UPDATE` row lock. The plan (§5) explicitly asked for either row-level locking or the same transaction-safety pattern as `AssetService.ingestVersion` — but that pattern's actual safety net is the table's UNIQUE constraint (`issued_certificates_tenant_serial_idx` on `(tenantId, serialNumber)`, confirmed present) catching a collision at INSERT time, not the transaction alone. Today: two concurrent issuances **will not** produce a duplicate serial (the unique constraint prevents real data corruption — verified it exists), but one of the two requests **will crash with a raw, unhandled constraint-violation error** instead of transparently retrying. Under real concurrent bulk-issuance load (exactly the batch-issuance flow the plan describes), this will surface as sporadic, confusing 500s.

**Fix**: wrap the generate-serial + insert sequence in a retry loop (catch the Postgres `23505` unique-violation on `issued_certificates_tenant_serial_idx` specifically, re-generate, retry up to a small bounded count) — the existing `apiErrorResponse` helper already recognizes `23505` generically, but that's for surfacing a clean error to the client, not for making the *server-side* issuance logic itself resilient to the race. Also replace `tx: any` with the real Drizzle transaction type (check how other services in this codebase type their `tx` parameter, e.g. anywhere using `db.transaction(async (tx) => ...)` and infer/import the correct type rather than using `any`).

## 7. Cleanup — duplicate/dead files in `document-studio`

`src/libs/document-studio/renderer.ts` is a near-identical duplicate of `render.ts` (same `renderPdf` purpose, different export style) and is imported by **nothing** anywhere in `src/` (verified via grep — only `render.ts` is imported, by the now-deleted-per-§1 dev route). Delete `renderer.ts`. Also review `spike-template.ts` — if it's sample/fixture data still needed by the real designer/preview flow, rename it to reflect that (e.g. `starter-templates.ts`) and keep; if it was only ever used by the deleted spike scripts, delete it too.

## 8. Incomplete, not broken — flag for continued work, not a regression

- Only 2 of the plan's 6 eligibility rule types are implemented (`manual_authorized`, `enrollment_active`). The other 4 (assessment-threshold, attendance-percentage, event-participation, HR-employment) are real remaining work per the plan's §7 build order — not a bug, just not done yet.
- `evaluateManualAuthorized` (`evaluators.ts:20-30`) accepts `ruleParams.authorizedBy` with a silent `'unknown'` fallback instead of requiring a real value — tighten this once the calling route enforces `requireCapability` and passes `context.userId`, so `authorizedBy` is never a placeholder string in a real evidence snapshot.
- No unit tests exist yet for the evaluators, despite the plan's §4 explicitly asking for real vitest-testable pure functions from the start (matching this session's established discipline). Add `src/features/certificates/__tests__/certificates.test.ts` covering both implemented evaluators before adding the remaining 4, so the pattern is proven early.

## Priority order for the fix pass

1. §4 (poisoned migration) — do this first, it's the only item that can silently corrupt a future deployment.
2. §3 (schema barrel wiring) — one line, unblocks real testing of everything else.
3. §2 (raw token storage) — security-relevant, fix before any real certificate is ever issued even in dev.
4. §1 (delete spike scripts/dev route, confirm `tsc --noEmit` exit 0 afterward).
5. §5 (decide on 0057), §6 (serial retry), §7 (dead-file cleanup), §8 (continue real work) — in any order after the above four are done.

Re-run `tsc --noEmit`, `npx tsx scripts/check-tenant-isolation.ts`, and a real fresh-database migration test after every fix in this list — not just at the end. Do not report this done until all four CRITICAL items are independently re-verified, not just fixed and assumed correct.
