# Numbering analysis

## Two independent numbering systems

| | `naming_series` (real) | `numbering_series_definitions` (Numbering settings page) |
|---|---|---|
| Shape | `(tenant_id, prefix)` → `current_val` | key, name, prefix, suffix, padding, start, current, step, is_active + versions table |
| Writers/readers | `libs/finance/document-number.ts` (`consumeDocumentNumber`: invoices `INV-{year}-`, receipts `RC-{year}-`, fee allocation runs), `libs/services/matricule.ts` (matricules), `features/hr/services/employee-id.ts`, `features/inventory/services/inventory-sequence.ts`, `features/hostel/server/finance-adapter.ts`, `libs/services/alumni-verification-code.ts` | only `/api/settings/numbering/*` and `features/settings/services/numbering-service.ts` (+ two scripts) |
| Concurrency | advisory xact lock per `tenant:naming_series:prefix` + row lock | advisory lock in `consumeNextNumber` |
| Rows (dev Atlas) | `ATL-2526` = 200, `INV-2026-` = 200 | 3 definitions: student.matricule "ATL-2526-0201", invoice.number "INV-2026-0201", exam.candidate "CND-0091" (seeded) |

**Verdict:** the Numbering page has **no runtime consumer**. It is REAL as storage (versioned, audited, tenant-isolated, proven by round-trip T5: rename persisted, restored, versions 1→3) but its series drive nothing. The page's own amber banner says so. Its "Attribuer" button consumes numbers no document ever uses.

The seed made it look live by mirroring the real counters (ATL-2526 at 200, INV-2026 at 200).

## Candidate numbers

`exam_seats.candidate_number` (text, NOT NULL) is built inline in `features/assessment/services/exam-master-service.ts:126` as `CAND-{year}-{index+1, 4 digits}`, not by either series system. So the real format is `CAND-2026-0001` while the settings page advertises `CND-0091`. The "Numéro candidat" series is decorative, and the index-based number restarts per allocation run (not a tenant-wide sequence).

## Invoice numbers

`consumeDocumentNumber(tx, { tenantId, prefix: 'INV-{year}-' })` inside the invoice/allocation transaction: sequential per tenant and calendar year, lock-protected. Prefix and year format are hard-coded, not configurable.

## Recommendation (not implemented)

Make the settings page a view/editor of `naming_series` (prefix format per document type, padding, next value with a "never go backwards" rule) and retire `numbering_series_definitions`, or wire the definitions into `document-number.ts`/`matricule.ts`. Remove the "Attribuer" button (manual consumption of document numbers has no use case).
