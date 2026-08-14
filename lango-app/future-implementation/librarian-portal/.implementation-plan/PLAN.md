# Librarian Portal — Implementation Plan

This portal depends on Library Management phases A–D. It is not a separate library backend. The current `src/features/crm/ui/librarian-portal-view.tsx` is hardcoded mock data and must be replaced by restricted Library services.

## 1. Identity and authorization

Introduce the `librarian` application role only with the Library add-on and map it to library-specific capabilities. A designation named “Librarian” must never grant access automatically. Core authentication remains usable, while disabling Library blocks portal/API access without deleting the user.

Librarians are explicitly scoped to tenant and allowed branches. Cross-branch operation requires a capability and a deliberate branch switch.

## 2. Portal surface

Keep a dedicated `/dashboard/portals/librarian` entry or redirect it to a restricted `/dashboard/library/desk`; choose one canonical URL and remove duplicate navigation.

- Home: due/overdue, holds awaiting pickup, exceptions and recent circulation from real APIs.
- Catalog/copies: search and safe copy management.
- Circulation desk: member lookup, barcode checkout/renew/return.
- Holds/transfers: operational queues for assigned branches.
- Stocktake: scan/count and discrepancy workflow where permitted.
- Reports: only permitted operational reports; no unrelated student profile, Finance or HR access.

Use the same Library services and invariants as administrator pages. Do not duplicate transaction logic in portal routes.

## 3. Safe projections

Member lookup returns only identity/contact fields required for circulation, current block/eligibility state and relevant loans/holds. It must not expose grades, attendance, balances outside library charges, medical data, guardian directory or HR data. Search must be rate/length constrained and auditable to prevent directory enumeration.

Overrides require capability, reason and immutable audit evidence. Shared-desk sessions support fast lock/sign-out and must not persist member details in browser storage.

## 4. Delivery and acceptance

1. Role/capability/branch assignment and real home.
2. Catalog and circulation desk.
3. Holds/transfers/stocktake queues.
4. Restricted reports, kiosk hardening and operational accessibility.

Acceptance:

- The mock librarian arrays are deleted or unreachable.
- Every operation calls the same Library service used by admin APIs.
- Wrong tenant/branch, expired session and missing override capability fail safely.
- API response-field audit proves no forbidden student/Finance/HR fields.
- Keyboard/barcode workflow meets a measured checkout/return target.
- Add-on disable blocks portal but preserves the librarian identity for reactivation.
- Two-tenant/branch sweep, shared-session tests, Docker build, TypeScript and isolation checks pass.

