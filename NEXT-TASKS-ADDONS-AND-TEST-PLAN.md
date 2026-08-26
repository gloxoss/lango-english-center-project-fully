# Next Tasks — Addon Architecture Audit + Full Test Plan (2026-08-25)

> **STATUS UPDATE (2026-08-25, later same day): the priority-order items (1-3 below) are done.** `AGENT-EXECUTION-PROMPTS-SECURITY-AND-TESTS.md` dispatched this as 3 parallel agents; all three were independently verified against a live, reachable, schema-current Postgres (not trusted from any self-report) — real test run: 130+/133 passing, then two follow-up fixes (a test-fixture bug in hostel's regression test, a DB-check-pattern inconsistency in 9 files) brought it to 38/38 clean on the affected files, 0 TypeScript errors throughout.
>
> **Guard tests now exist and pass for every addon that had zero coverage** (transport, cards, lead-crm, school-website-cms) plus the attachments-book gating fix (item 13) and the certificates/cards adversarial QR-verification tests (items 10-11). New test files added this round: `transport-guard.test.ts`, `transport-rider-scan-adversarial.test.ts`, `card-verification-adversarial.test.ts` (now includes a `validUntil` case — see below), `inquiries-guard.test.ts`, `website-guard.test.ts`, `certificate-verification-adversarial.test.ts`, `hostel-guard.test.ts`, `event-management-guard.test.ts`, `inventory-guard.test.ts`, `human-resources-guard.test.ts`, `payroll-workforce-guard.test.ts`, `attachments-book-guard.test.ts`, `bigbluebutton-contract.test.ts`, `broadcast-guard.test.ts`, `broadcast-provider-degrade.test.ts`, `broadcast-consent.test.ts`, `advanced-reporting-guard.test.ts`, `report-access.test.ts`, `secure-download.test.ts`, `snapshot-immutability.test.ts`, `recurrence-boundary.test.ts`, `accounting-export-adapter.test.ts` — 21 new files.
>
> **One real, new finding closed in the same pass, not originally in this plan:** cards' public verify route checked `status` but never `validUntil` — a card left `active` past its expiry date still verified. Fixed directly (`api/public/cards/verify/route.ts`), no sweep job needed, plus a new adversarial test case for it.
>
> **UPDATE 2: the remaining gaps above are now closed too.** Written and verified directly (5 new files, 24 new tests, real Postgres, 0 TypeScript errors): `multi-branch-guard.test.ts` (4 tests — proves the addon's actual soft-gate design: first branch always allowed, second blocked with `ADDON_REQUIRED` until entitled, then tenant isolation); `inventory-accounting.test.ts` (6 tests — `receivePurchase()` posts stock + exactly one `expenses` row, idempotent on repeat calls; a sale within stock succeeds, an oversell is rejected with `INSUFFICIENT_STOCK` and leaves the balance untouched; a student sale posts a real invoice); `hr-lifecycle-and-isolation.test.ts` (6 tests — `me/profile`/`me/documents` routes proven to never leak another employee's data even within the same tenant; `offboardEmployee`/`reactivateEmployee` reject illegal transitions and correctly toggle the linked account's login access); `payroll-maker-checker.test.ts` (2 tests — the calculator cannot approve their own run, a different approver can); `inquiries-duplicate-merge-convert.test.ts` (6 tests — phone/email duplicate matching, merge unions tags/re-points follow-ups/refuses already-converted records, and lead-to-admission conversion is confirmed exactly-once even on retry). The registry header comment (item 5 of the priority list) is done — confirmed fixed, now reads "27 SchoolOS optional modules."
>
> **Every item in this document's Section 3 priority list is now done.** Nothing from this plan remains open.
>
> Full evidence trail: `AGENT-EXECUTION-PROMPTS-SECURITY-AND-TESTS.md` and the session's own audit turns.

**Purpose:** same holding-area convention as `NEXT-TASKS-BUILD-AND-SECURITY.md` — verified problems + a concrete test plan, queued for later execution, not actioned yet.

A full 18-addon architecture report was independently re-checked against live code before anything below was written down.

---

## 1. Corrections to the pasted audit

| Claim | Verdict | Evidence |
|---|---|---|
| 18 addons total, 16 enabled, 2 disabled (`whatsapp`, `online-examinations`) | ✅ Confirmed | `src/addons/registry.ts`: exactly 18 `id:` entries, exactly 2 with `enabled: false` |
| Registry header still says "only multi-branch is wired" | ✅ Confirmed stale | `registry.ts:1-8`, verbatim: *"Only `multi-branch` is wired to that gate today; the rest are unbuilt, so there is nothing yet to gate."* — false; hostel/transport/library/etc. all have real `requireAddon` gates. Worth a one-line comment fix, low priority. |
| #13 attachments-book: capability-only, no `requireAddon` | ✅ Confirmed, real gap | Zero `requireAddon` calls found across all 10 `src/app/api/content/**/route.ts` files — only `requireCapability(context, 'content.manage')`. Revoking the addon entitlement today does **not** block the API. |
| §17.8 "5 of 6 raw-JSON payroll pages still open" | ❌ **False — already fixed** | Re-confirmed today: `payroll-workspace.tsx` has 9 `CreateForm` usages and real tables/actions for all 6 resources. Of the 14 `JSON.stringify` occurrences, 12 are ordinary `body: JSON.stringify(...)` request serialization (not a UI problem at all) — only 2 are genuine display-context JSON (one intentional collapsible "Preuves de calcul" trace viewer, one settings-row config display). This exact item was already closed and documented in `EXECUTION-AUDIT-VERIFIED.md`'s 2026-08-25 section — this pasted report is working from a stale snapshot, same failure mode flagged there for a different tool the same day. |
| §15.2 "broadcast error-message split open" | ❌ **False — already fixed** | `isAddonNotActivated()` is real and imported/used in 5+ broadcast UI files (`automations-view.tsx`, `broadcast-overview-view.tsx`, etc.). Also already documented as closed in `EXECUTION-AUDIT-VERIFIED.md`. |
| Broadcast "test provider only, real SMS/email provider pending" | ✅ Accurate, with a nuance worth keeping | Only `test-provider.ts` and `webhook-provider.ts` exist under `src/features/broadcast/providers/` — no purpose-built commercial SMS gateway ships today. This doesn't contradict the earlier finding that `sms-delivery.ts`'s send mechanism is genuinely well-designed (real send attempt when *any* provider is configured, honest `simulated` fallback otherwise) — the mechanism is real, but no ready-to-use commercial provider is bundled. Both things are true at once. |

## 2. New finding, not in the pasted report — the biggest one

**"Review excellent" / "14/14 acceptance, 7/7 adversarial" ratings for transport, cards, certificates, crm, and school-website-cms are not backed by any automated test file.** Checked directly:

| Addon | Automated `.test.ts` files found anywhere in `src/` |
|---|---|
| transport | **0** |
| cards | **0** |
| lead-crm | **0** |
| school-website-cms | **0** |
| hostel | 1 |
| inventory | 1 |
| certificate-management | 1 |
| attachments-book | 1 |
| payroll-workforce | 2 |
| event-management | 2 |
| advanced-reporting | 2 |
| human-resources | 3 |
| broadcast-messaging | 4 |
| live-classrooms | 7 |
| library | 8 |

The "excellent"/"14/14" ratings almost certainly describe a **one-time manual or agent-run verification pass** (there's a `future-implementation/student-transport/MANUAL-TESTING.md` matching this pattern), not a regression-protected automated suite. This matters: those four zero-coverage addons could silently break on any future change with no automated warning, despite carrying the best reputation in the report. This is the real headline finding, and it's what Section 3 below is for.

---

## 3. Full test plan — all 18 addons

Convention to follow throughout (already established correctly in `library`/`live-classrooms`, the two best-covered addons): a `<domain>-guard.test.ts` for entitlement/tenant-isolation, `<domain>-service.test.ts` for business logic, and where the addon is security/integrity-sensitive, an `adversarial.test.ts` (see `api/addons/live-classrooms/adversarial.test.ts` for the existing pattern to copy). Every addon needs at minimum the guard test — that's the cheapest, highest-leverage test in this whole plan since it protects the entitlement/tenant-isolation boundary every other test assumes holds.

### 1. multi-branch — 🟢 small, stable
- **Existing:** none found dedicated to this addon specifically.
- **Add:** a guard test on `POST /api/settings/branches` confirming a non-entitled tenant is blocked; a tenant-isolation test (branch created under tenant A never visible to tenant B).

### 2. whatsapp — ⚪ not built
- No test plan needed until it's built — don't write tests against mockups.

### 3. hostel — 🟢 excellent code, thin coverage (1 file)
- **Existing:** 1 test (`hostel-audit.test.ts` per earlier session notes).
- **Add:** guard test (entitlement + tenant isolation across the full `api/addons/hostel/**` surface — allocations, roll call, visitors, incidents, charges). Service tests for the allocation state machine (reserved → checked_in → checked_out, including the `'all'` filter regression from §19.11 — add a regression test locking that fix in place). Charges-to-accounting integration test (hostel is one of the modules whose charges post into core student-accounting — verify the posting is correct and idempotent).

### 4. transport — 🔴 zero automated tests despite "best-audited" reputation
- **Existing:** none.
- **Add, in priority order:** (a) guard test — entitlement + tenant isolation across `api/transport/**`; (b) capacity-aware allocation service test (a bus/route can't be over-assigned); (c) rider-scan integrity test — this is exactly the kind of thing that needs an adversarial test (can a scan be replayed? forged for another tenant's student? recorded against a route the student isn't assigned to?); (d) GPS/ETA data test — confirm stale/missing location data degrades honestly rather than showing fabricated ETAs; (e) compliance/incident reporting test. This addon needs the most net-new test work of the "already built" set, precisely because its current reputation rests entirely on unverifiable manual claims.

### 5. library — 🟢 best-covered (8 files), keep as the reference pattern
- **Existing:** guard, self-service, catalog, policy, copies-CSV, operations, accounting-adapter tests already present — genuinely the model to copy for every addon above.
- **Add:** one gap check — confirm the library-to-student-accounting charge coupling (flagged 🟡 in the report) has a dedicated integration test proving a lost-book fine posts correctly and exactly once; if `library-accounting-adapter.test.ts` already covers this, this is done, just confirm.

### 6. event-management — 🟡 rich backend, thin UI, only 2 test files
- **Existing:** `event-operations-service.test.ts` and one other.
- **Add:** guard test across all 28 routes cited in the report (script it — assert every route under `api/addons/events/**` 403s a non-entitled tenant, don't hand-write 28 near-identical tests). Recurrence-boundary test (the "bounded recurrence" feature — confirm it actually bounds, doesn't generate unbounded occurrences). RSVP/waitlist-offer race test (two people claiming the last seat simultaneously). The iCal export test (confirm the `PRODID` and UID fields — recently renamed to SchoolOS branding — round-trip through a real calendar parser without error).

### 7. inventory — 🟢 excellent, thin coverage (1 file)
- **Existing:** 1 test.
- **Add:** guard test. Purchase/sale-to-accounting integration test (flagged 🟡 coupling, same pattern as library/hostel — needs its own idempotency-and-correctness test). Stock-level test (a sale can't oversell below zero stock; a loan can't exceed available equipment).

### 8. human-resources — 🟡 3 tests, real HR/payroll boundary risk
- **Existing:** 3 tests.
- **Add:** guard test covering both `api/hr/**` and the 13 `api/employee/me/**` self-service routes (the report's 🔴 portability flag — self-service routes need their own isolation test: an employee must never reach another employee's `me/*` data even within the same tenant). Employment-lifecycle state-machine test (hire → active → leave → terminated transitions, no illegal jumps).

### 9. payroll-workforce — 🟠 partial by design (external certification pending), 2 tests
- **Existing:** 2 tests, plus a real `calculate.test.ts` under `api/hr/payroll/periods/[id]/calculate/` per earlier session verification.
- **Add:** guard test via `requireWorkforceAddon`. Maker-checker test (the report notes this is enforced — add a test proving a single user can't both create and approve the same payroll run). Explicitly **do not** write tests against DAMANCOM/bank-export adapters while they're disabled pending certification — that's wasted effort until the external blocker clears; instead add one test asserting the disabled adapters fail closed (never silently no-op as if they succeeded).

### 10. card-management — 🔴 zero tests despite "excellent" rating, high fan-in
- **Existing:** none.
- **Add:** guard test. QR-verification adversarial test (can a forged/expired/revoked card QR still validate? cross-tenant card QR reuse?). Since this addon is imported by admissions-convert, report-card generation, and student-detail UI (the report's 🔴 portability flag), add an integration test for at least one of those call sites confirming card issuance actually completes end-to-end from admission approval.

### 11. certificate-management — 🟢 excellent, 1 test
- **Existing:** 1 test.
- **Add:** guard test. QR-verification adversarial test (same class of risk as cards — forged/revoked/replayed verification attempts). Correction/replacement/revocation workflow test (the report notes this workflow exists — confirm a revoked certificate's QR actually stops verifying, not just changes a status flag nobody checks).

### 12. live-classrooms — 🟡 7 tests, webhook security already exemplary
- **Existing:** dev-provider, lifecycle-races, live-classrooms-db tests, and a real `adversarial.test.ts` — the best security-test example in the whole codebase, worth copying its shape for cards/certificates/transport above.
- **Add:** one gap — a BBB-adapter contract test that runs against the dev provider's deterministic behavior (can't test the uncertified real BBB adapter live, but the contract it's implemented to *can* be tested without real BBB credentials).

### 13. attachments-book — 🟠 the one real security gap in this whole list
- **Existing:** 1 test.
- **Fix first, then test:** add `requireAddon(tenantId, 'attachments-book')` to all 10 `api/content/**` routes (small, well-scoped fix — do this before writing the guard test, otherwise the test would just document the hole rather than catch it). Then add the guard test proving revocation actually blocks access. Also: this addon's 3 content routes were separately flagged in the security audit's M-4 (unvalidated request bodies) — worth fixing both gaps in the same pass since they're the same file set.

### 14. online-examinations — ⚪ disabled, legacy code lives elsewhere
- No test plan for the addon itself (not built). If the legacy MCQ flow living in core (migration 0025) is still reachable and used, it needs its own coverage check — but that's a core-assessment question, not an addon-test question. Flag separately if it turns out to matter.

### 15. lead-crm — 🔴 zero tests, breaks admissions/reception if cut
- **Existing:** none.
- **Add:** guard test (note: public capture endpoint is intentionally ungated — the test should assert that's still true by design, not treat it as a bug). Duplicate-detection/merge test (the report notes this exists — verify two leads with the same phone/email actually get flagged, and merging preserves history rather than dropping it). Admissions-convert integration test (a converted lead correctly creates a real admission record, exactly once, even on retry).

### 16. broadcast-messaging — 🟡 4 tests, most-depended-on addon
- **Existing:** 4 tests.
- **Add:** guard test across the full addon surface (finance reminders, attendance flags, and `communication/send` all import this addon per the report's 🔴 fan-in flag — each dependent feature needs a test confirming it degrades honestly, not silently, if broadcast is ever disabled for a tenant). Consent/suppression test (a suppressed/opted-out recipient must never receive a campaign — this is a compliance-relevant test, treat it as high priority).

### 17. advanced-reporting — 🟢 best isolation, 2 tests
- **Existing:** 2 tests.
- **Add:** guard test. Rate-limit test (the report notes runs are rate-limited — confirm it's actually enforced, not just configured). Snapshot-immutability test (a delivered report snapshot must not change even if the underlying data changes afterward — this is the specific guarantee governed exports are supposed to provide, worth locking in with a test).

### 18. school-website-cms — 🔴 zero tests despite "verified end-to-end" claim
- **Existing:** none (the "verified end-to-end" claim refers to a manual fresh-DB migration + smoke test, not a persisted automated test).
- **Add:** guard test (settings/website gate). Public-route tenant-isolation test (the public slug-resolved site for tenant A must never leak tenant B's content — this is the single most important test for this addon, since it's the one addon with a genuinely public, unauthenticated surface). Page-type completeness test (Home/About/Gallery/FAQ/Contact/Services all render without error on a fresh tenant with no content yet — confirms honest empty states, not broken pages).

---

## Priority order for execution (combines both documents' logic)

1. **attachments-book gating fix** (Section 1/13) — small, closes a real, live gap. Do this before its guard test, not after.
2. **Guard tests for the 4 zero-coverage "excellent"-rated addons** (transport, cards, crm, school-website-cms) — cheapest way to convert an unverifiable reputation into an actual regression-protected baseline.
3. **The two adversarial/QR-verification tests** (cards, certificates) — genuine security surface, currently untested.
4. Everything else in Section 3, addon by addon, using library/live-classrooms as the template.
5. Registry header comment fix (cosmetic, do whenever, costs nothing).

Not in scope for this doc (already covered elsewhere or externally blocked): payroll DAMANCOM/bank certification, live-classrooms BBB certification, broadcast real commercial SMS provider — all need an external party/credential, not test-writing.
