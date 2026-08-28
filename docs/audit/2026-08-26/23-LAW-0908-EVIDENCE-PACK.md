# SchoolOS — Law 09-08 / CNDP Evidence Pack (Wave 3 W10 — evidence only)

**Date:** 2026-08-28.
**Purpose:** assemble the engineering facts a legal adviser needs to answer Moroccan Law 09-08 (and CNDP filing) questions for SchoolOS. **This document deliberately draws NO compliance conclusion** — per the audit's standing instruction, compliance is not an engineering verdict. Everything below was verified by code inspection or live execution on 2026-08-28 unless stated otherwise.

---

## 1. Hosting & sub-processors (facts)

| Item | Fact | Source |
|---|---|---|
| Production host | Tencent Cloud VPS, IP `43.157.17.129` | `lango-app/docs/audit/2026-08-26/15-HOST-RESOURCES-AND-RIGHTSIZING-ANALYSIS.md`; live deploys |
| **Hosting region** | **Not documented anywhere in the repo.** Tencent operates many regions; which one hosts `43.157.17.129` is an open question the owner must answer from the Tencent console. | Absence verified by search (doc 16 discusses region choice only as a cost factor) |
| Error tracking | Sentry (client/server/edge configs exist; production event delivery **not yet proven** — W3 pending) | `sentry.{client,server,edge}.config.ts` |
| SMS/Email | Providers are pluggable; dev delivery is **log-only** (no third party called in dev). Real provider choices are tenant broadcast connections. | `src/features/broadcast/`, auth sendOTP code path |
| Payments | Stripe + CMI/Payzone exist as **sandbox** integrations; live charging is not configured | `src/libs/payments/`, `/api/finance/payments/sandbox` |

**For legal:** data residency hinges on the Tencent region (§1) — this is the single most important open fact.

## 2. What personal data the application stores (table-level inventory)

| Store | Personal fields observed |
|---|---|
| `user` (all roles) | name, email, phone, matricule (students), guardianPhone, guardianEmail, photo, class/branch assignment |
| `guardians` + `guardian_students` | guardian first/last name, phone, email, link to students (incl. `canAccessLibrary` consent-style flag) |
| `inquiries` (admissions CRM) | contactName, phone, email |
| `invoices`, `invoice_items`, `payments`, `payment_allocations` | student-linked financial history and amounts |
| `communication_campaign_recipients` | contactName, phone, email snapshots for broadcasts |
| `attendance`, `assessment_results(_details)` | per-student behaviour and academic records |
| `audit_logs` | actor + entity ids; `metadata` jsonb can embed field values (e.g. waiver reasons) |
| `two_factor_otps` | hashed OTPs only (sha256); login events stored via `login_events` |
| `files` / attachments / student photos | documents about identifiable students |

Method: schema inspection (`src/models/Schema.ts`, feature `*-schema.ts`). Column lists are representative, not exhaustive.

## 3. Existing controls found in the codebase (relevant to Law 09-08)

1. **CNDP filing tracker exists:** `cndp_filings` table + `/fr/dashboard/settings/cndp` page (owner-facing). Whether any filing has actually been *made* is an owner/legal question, not answerable from code.
2. **Tenant anonymization endpoint:** `POST /api/super-admin/schools/anonymize` (super-admin gated) — a bulk de-identification path exists.
3. **Data export module:** `/fr/dashboard/settings/exports` with job infrastructure (`export_jobs` table) — tenant-scoped exports; **no generic per-data-subject (student/parent) self-service export or erasure endpoint was found** — gap to put to legal, not to engineer unilaterally.
4. **Audit logging:** `recordAudit()` is invoked from **382 API route files** (verified by count, 2026-08-28) covering create/update/delete/export/import on sensitive entities; the W4 sweep added the missing audit on `library members` create.
5. **Logs:** before Wave 3, `console.*` could emit PII (one 2FA path logged a user email in plaintext). W8 replaced all API/libs logging with pino + a redaction config (emails, phones, matricules, names, amounts → `[REDACTED]`), regression-tested (`logger-redaction.test.ts`).
6. **Consent-adjacent flags:** `guardians.canAccessLibrary` and broadcast `consents`/`suppressions` tables exist for communication consent management.

## 4. Open questions this pack cannot answer (for the owner + legal)

1. Which Tencent **region** hosts production (§1)?
2. Has any **CNDP filing** actually been submitted (the tracker exists; its real-world status does not live in code)?
3. Is a **DPO/representative** designated, and do Tencent + Sentry **data-processing agreements** meet Law 09-08 processor requirements?
4. Is the existing tenant-level anonymize endpoint sufficient as an erasure mechanism, or is per-subject erasure legally required?
5. Retention: what retention periods should apply to `audit_logs`, `inquiries`, broadcasts, and backups (W2 retention config should mirror the legal answer)?

## 5. Explicit non-conclusion

Nothing in this pack states or implies that SchoolOS is, or is not, compliant with Law 09-08. That determination requires the legal answers above.
