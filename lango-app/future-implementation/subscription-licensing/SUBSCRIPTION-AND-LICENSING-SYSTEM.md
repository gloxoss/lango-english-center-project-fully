# Subscription & Addon Licensing System — Future Implementation

**Status: not started, deliberately deferred.** This doc exists so the
requirement isn't lost, not because work is in progress. Read
`AGENT-HANDOFF.md` first for overall project state before picking this up.

## The business goal (stated 2026-08-01)

SchoolOS is meant to become a **licensed SaaS product sold to schools across
Morocco and, later, internationally** — not just the two tenants (Atlas,
SchoolOS) it currently runs for. Two requirements follow directly from that:

1. **License-key based selling.** A school buys SchoolOS, gets a license.
   The core app should not require reasoning about licensing to run day to
   day — but **specific feature modules ("addons") should be individually
   purchasable and activatable at any time**, not bundled all-or-nothing
   into a single plan tier.
2. **Multi-market from day one.** Morocco first (French/Arabic UI, MAD
   currency, CNDP compliance — all already real), international expansion
   later (more locales, more currencies, no assumption baked in that every
   school is Moroccan).

This is a materially different, bigger requirement than "gate features by
plan tier" — see the "Two different problems" note in
`src/addons/README.md`, written before this fuller picture was stated. That
file's scope decision (organize code only, no gating) still stands for now;
this doc is what supersedes it once real work starts.

## Reference material

Three screenshots of a comparable commercial product ("RamomSchool") are in
`reference-screenshots/` in this folder:

- `ramomschool-subscription-page.png` — the page shape to build: **School
  Details** (name, status, active plan, start/expiry dates, "Renew
  Subscription" action), **Payment History** table (plan, purchase date,
  expiry, transaction ID, amount, method), and a **Modules Permission**
  panel — a per-tenant checklist of feature modules with an enable/disable
  toggle per module (Attendance, Bulk SMS, Card Management, Hostel,
  Inventory, Library, Online Exam, QR Code Attendance, Transport, etc.).
- `ramomschool-dashboard-1.png` / `-2.png` — general dashboard reference
  (not this feature's scope — SchoolOS's own dashboard already covers
  equivalent charts with real data, see `AGENT-HANDOFF.md`).

**Do not copy RamomSchool's visual style** (dark theme, saturated
icon-box KPI cards) — it clashes with SchoolOS's established minimal
Slate/Blue design system. Match the *page structure and data model*, build
the UI in SchoolOS's own component patterns (`Card`, `Badge`, `DataTable`
from `src/components/`).

## What already exists to build on

- `tenants.planTier` (`trial`/`basic`/`standard`/`premium`) — exists in
  schema, currently only ever *displayed* in super-admin views, never used
  to gate anything. Confirmed via full-codebase grep 2026-07-31.
- `src/addons/registry.ts` + `README.md` — a typed list of addon
  candidates (WhatsApp, Hostel, Transport, Library — none built yet), no
  gating logic. Organizational scaffold only.
- `super-admin-subscriptions-view.tsx` / `-list-view.tsx` — honest
  `ComingSoonView` placeholders, zero backing API routes. This is the
  natural landing spot for the school-facing half of this feature; a
  super-admin-facing "manage all schools' licenses" view would be a
  sibling page.
- `src/features/marketing/ui/pricing-section.tsx` — public marketing-page
  pricing table (static content, appropriate for a landing page — not
  connected to and not a substitute for real subscription management).

## Open design questions to resolve before building (don't guess these)

1. **License validation mechanism.** Since this is a self-hosted Docker
   deployment (not a downloaded desktop app), "can't activate without a
   license" most plausibly means: a license key issued per school/tenant,
   validated against either (a) a central license server you control that
   this app phones home to, or (b) a locally-verifiable signed key
   (asymmetric crypto — you sign, the app verifies the signature offline,
   no network dependency). Option (b) is simpler to operate and works for
   schools with unreliable internet; option (a) gives you real-time
   revocation. Needs a decision, not an assumption.
2. **Per-addon activation granularity.** Does an addon activate
   instantly on purchase (self-serve, needs online payment integration —
   Morocco-relevant options: CMI, or manual bank transfer + admin
   approval like the existing `Payment History` "Method: Cash" pattern
   suggests), or does it require manual super-admin approval first?
3. **What happens to data when an addon is deactivated?** (e.g. a school
   stops paying for Hostel — does existing hostel data get hidden,
   archived, or deleted? This has real data-loss implications, needs an
   explicit answer before building deactivation logic.)
4. **Multi-currency.** `invoices`/`payments`/finance schema is currently
   MAD-only (`formatMad()` hardcoded across the finance UI). International
   expansion needs either a per-tenant currency field or a firm decision
   that subscription billing is centrally handled in one currency
   regardless of school location (simpler, and plausible if you're the one
   billing schools directly rather than them self-serve-paying).

## Suggested shape when this is picked up (not a commitment, a starting point)

1. New tables: `schoolLicenses` (tenantId, licenseKey, status, issuedAt,
   expiresAt) and `addonActivations` (tenantId, addonId, activatedAt,
   activatedById, status) — separate from `tenants.planTier` since
   per-addon activation doesn't fit a single tier enum.
2. `requireRequestContext` (or a thin wrapper) checks `addonActivations`
   for addon-gated routes, same call shape as the existing role check —
   don't invent a second access-control pattern.
3. School-facing subscription page at
   `/dashboard/settings/subscription` (replaces the `ComingSoonView`
   pairing), built from real `schoolLicenses` + `addonActivations` +
   payment records.
4. Super-admin-facing license management (issue/revoke licenses, toggle
   addon activations per school) alongside the existing
   `super-admin/schools` module.

## Page-by-page business logic (implementation-ready detail)

### 1. School Subscription page (school-admin facing, `/dashboard/settings/subscription`)

Replaces the `ComingSoonView` currently at
`super-admin-subscriptions-view.tsx`'s sibling location on the school
side. The one page a school's own admin sees for this whole feature.

- **School Details panel** (read-only): plan tier (from `tenants.planTier`
  or the new `schoolLicenses.planTier` if that table is added — pick one
  source of truth, don't duplicate the field in two places), license
  status derived from `schoolLicenses.expiresAt` vs now (`Active` /
  `Expiring Soon` within e.g. 14 days / `Expired`), start date, expiry
  date, last upgrade date.
- **Payment History table**: plan, purchase date, expiry at time of
  purchase, transaction reference, amount, payment method (Cash/Bank
  Transfer/Card — matches the reference screenshot's "Method: Cash").
  Read-only list from a `licensePayments` table (or reuse `payments` with
  a discriminator if you want one payment ledger app-wide — a real design
  choice, not obvious which is better without knowing if subscription
  billing should appear in the same reports as tuition payments; probably
  *shouldn't*, since a super-admin manages this centrally and a school's
  own finance reports are about money the SCHOOL collects, not money the
  school pays SchoolOS — recommend a separate table).
- **Modules/Addons panel**: read-only list of what's active for this
  tenant, sourced from `addonActivations` joined against
  `src/addons/registry.ts` definitions. **Read-only for school_admin** —
  they request changes, they don't self-toggle (that's the super-admin's
  call, since it's tied to what they're paying for).
- **"Renew Subscription" / "Request Addon" actions**: button behavior
  depends on the payment-model decision in "Open design questions" above
  — if self-serve online payment isn't built, this should open a request
  that notifies the super-admin, not silently do nothing or fake success.
- **Business rule to decide, not guess**: what happens when a license
  expires? A hard lockout is harsh (locks a school out of their own
  student data); a silent no-op defeats the point of licensing. Recommend
  a grace period (e.g. 7 days of full access with a persistent warning
  banner) then a read-only mode (existing data visible, no new writes)
  rather than a full lockout — but this is a real product decision for
  the project owner, not something to build on assumption.

### 2. Super-Admin License Management page (new, `/dashboard/super-admin/licenses`)

Cross-school view, sibling to the existing `super-admin/schools` module.

- **List**: every school, their plan tier, license status, expiry,
  filterable by status (matches the pattern already used in
  `super-admin-schools-view.tsx`).
- **Issue/extend/revoke actions**: writes to `schoolLicenses`
  (`status`, `expiresAt`), every action `recordAudit()`'d — this changes
  what a paying customer can access, audit trail is not optional here.
- **Per-school detail drawer or page**: the addon-activation toggles live
  here (see below), plus the same payment-history table the school sees,
  since the super-admin needs to see it too when a school disputes a
  charge or asks about their status.

### 3. Addon Activation control (super-admin, likely a panel within the license-management detail view rather than its own page)

- Checklist of every addon in `src/addons/registry.ts`, toggle per
  school, writes to `addonActivations` (tenantId, addonId, activatedAt,
  activatedById, status).
- **Business rule**: does toggling an addon off hide the feature
  immediately for logged-in users of that school, or only on next login?
  Recommend immediate (check `addonActivations` at the route-guard level,
  same place role checks already happen via
  `requireRequestContext`) — a lapsed payment should take effect
  right away, not linger until someone happens to log out.

## Explicitly not scoped by this doc

The actual license-crypto/validation implementation, payment gateway
integration, and international currency/locale expansion are all separate
decisions with their own tradeoffs — this doc records the *requirement*
and the *reference material*, not a committed technical design for those
pieces. Resolve the open questions above with the project owner before
writing code.
