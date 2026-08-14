# Parent / Guardian Portal — Security Audit Response

> Direct response to PLAN.md §5.1 (28 mandatory security tests) with the exact
> check that covers each, the fixture used, and honest gaps. Live evidence is in
> `MANUAL-TESTING.md`; the executable is `scripts/verify-parent-security.mjs`
> (**40/40**).

## The 28 tests

| # | Plan test | Coverage | Status |
|---|---|---|---|
| 1 | Anonymous → 401 on every `/api/guardian/**` | S1 + anonymous probe of all new routes (preferences, meetings, requests, documents, finance → 401) | ✅ live |
| 2 | Non-parent role → 403 | S2 (school_admin) | ✅ live |
| 3 | Parent of tenant A calls tenant B child → 404 | S14 both directions | ✅ live |
| 4 | Cross-child arbitrary studentId → 404 (no existence oracle) | S11 unknown rel id; every route resolves from `relationshipId`, never a client studentId | ✅ live |
| 5 | Cross-guardian child → 404 | S6–S10, S27 (excuse POST) | ✅ live |
| 6 | Sibling isolation, different guardians, no cross leak | S3 (mustNot list) + S31/S32 (class-scoped announcements) | ✅ live |
| 7 | Client-chosen child id ≠ server relationship → 404 | All routes; S27 exercises the write path | ✅ live |
| 8 | Revocation without relogin → next request fails | S23 (live `status='revoked'` flip, same session) | ✅ live |
| 9 | Cached role context after revocation falls back to base role | Foundation `resolveActiveContext` re-binds + re-reads live rows; S23 proves the parent sees no stale data | ✅ verified via S23 |
| 10 | `effective_to` past → no access | S8 (PRN-CHILD-EXP expired → 404) | ✅ live |
| 11 | `effective_from` future → no access | S9 (PRN-CHILD-FUT → 404) | ✅ live |
| 12 | `status='suspended'` → no access | S10 (PRN-CHILD-SUSP → 404) | ✅ live |
| 13 | No `can_access_academic` → results/homework 403/empty | Enforced: `results` + `homework` routes call `requireRelationship(ctx, id, { academic: true })` (403 when withheld). **No academic:false fixture exists**, so this is code-enforced, not live-asserted | ⚠️ code-enforced |
| 14 | No `can_access_attendance` → 403/empty | S25 (PRN-CHILD-ATD → 403) | ✅ live |
| 15 | No `can_access_finance` → 403/empty | S30 (PRN-CHILD-B → 403); S5 redacted projection | ✅ live |
| 16 | No `can_access_medical` → medical documents 403/empty | S37 (PRN-CHILD-MED → 403) | ✅ live |
| 17 | No `can_access_communication` → messages/announcements 403/empty | S35 (PRN-CHILD-COM meetings → 403); messages route filters to communication-right children; announcements gate on the right | ✅ live |
| 18 | No `has_pickup_authority` → pickup/transport surfaces denied | Transport is addon-gated (S40 403). Pickup authority is surfaced redacted on child summary; **no pickup-release surface exists in the parent portal** (parent portal never grants pickup release) | ⚠️ n/a + S40 |
| 19 | `is_financially_responsible=false` → excluded from household roll-up, sibling hidden | S28 (PRN-CHILD-B + PRN-CHILD-FIN excluded; total 800) | ✅ live |
| 20 | `custody_restriction` non-null → sensitive contact/address stripped | Child summary returns `custodyRestriction` + `sensitiveContactHidden`; projection deliberately omits contact/address fields. No live adversarial fixture with a restricted-contact child | ⚠️ code-enforced |
| 21 | Parent-search enumeration resistance | Foundation `portal-search` parent branch is already link-scoped (verified read); Parent Portal adds no new search surface | ✅ Foundation |
| 22 | Excuse POST for non-linked child → 404 | S27 (cross-guardian excuse POST → uniform 404) | ✅ live |
| 23 | Meeting booking for non-linked child → 404 | Booking reuses existing link-gated `POST /api/academics/meeting-slots/book` (not re-wrapped); listing is relationship-scoped (S34) | ⚠️ delegated |
| 24 | Announcement class-scope leak | S31/S32 (child A sees class-A + all-parents, never class-B; child B symmetric) | ✅ live |
| 25 | Addon disabled → 403 `ADDON_NOT_ACTIVATED`, never 500 | S40 (transport + hostel 403 on Atlas where both addons are off) | ✅ live |
| 26 | Preferences invalid key → 400; consents tenant+user scoped | S39 (bad key 400 `INVALID_PREFERENCE_KEY`; non-boolean consent 400 `INVALID_CONSENT_VALUE`; value persisted + read back; table keyed tenant+user) | ✅ live |
| 27 | One-time link token: reuse → refused; hash never returned; no password exposure | S18–S22 (raw token returned once to staff; digest-only at rest; cross-tenant 403; garbage 422; replay 422; rebind 409) | ✅ live |
| 28 | Branch scope `x-branch-id` mismatch → 403 | Foundation `assertBranchScope` consumed via tenant context; parent resolver is tenant-scoped. Not separately fixture-tested in this workstream | ⚠️ Foundation |

## Cross-cutting controls (verified)

- **Deny-by-default, uniform 404** everywhere: a non-owned/ineffective relationship
  is indistinguishable from "does not exist" (no existence oracle) — S6–S11, S27.
- **Handoffs never perform the destination module's privileged action**: a
  `parent_requests` row records *intent only*; the destination module (academics/
  admin) performs the actual change in its own table. `attendance_excuses` are
  inserted `pending`; staff approve in the attendance module.
- **No client-chosen child id is ever authorization**: every endpoint takes the
  `relationshipId` path param and re-resolves it against the effective
  relationship server-side.
- **Financially responsible children only** in the household finance roll-up; a
  non-responsible child is neither another guardian's leak nor folded into a
  sibling's balance — S28.
- **Addon gates are explicit**: transport/hostel surface 403 until the tenant is
  entitled, never a silent empty state — S40.

## Explicitly NOT granted to parents (matches the receptionist constraint set)

Finance *mutations* (payment capture, refunds, invoices), admissions conversion,
bulk messaging, raw contact export, Guard administration, grades entry,
attendance *recording*, HR/medical/safeguarding data, and pickup release are all
absent from the parent surface. The portal is read/request-only against
authoritative modules.
