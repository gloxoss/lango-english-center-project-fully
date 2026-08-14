# Library Management — Implementation Plan

Read the shared context and source plan first. The existing `/dashboard/library/catalog` and `src/features/library/` are mock-only scaffolding with no library API/schema. The separate resource library under `/dashboard/content/library` belongs to Attachments/academic content and must not be repurposed.

## 1. Decisions and boundaries

- Track bibliographic record → edition → every physical copy.
- Library member is a tenant-scoped projection over existing users/students/employees, never a duplicate identity.
- Circulation history is immutable; corrections append events.
- Library charges remain an operational subledger and optionally post to Finance through an idempotent adapter.
- Notifications publish to Communication when available and remain honestly queued/logged otherwise.
- Digital resources link to Attachments Book; Library owns catalog metadata and access rules, not generic files.
- Version 1 excludes RFID/SIP2 and full acquisitions/accounting.

## 2. Model

Create a feature schema for records, contributors/link table, publishers, hierarchical categories, subjects/link table, editions, copies, members, policies, closure calendar, loans/events, holds/events, transfers/events, stocktakes/observations/adjustments, charges/adjustments and notification intents.

Enforce tenant-unique accession and barcode, branch ownership, version columns, one active loan per copy, and suitable partial uniqueness for active holds. Copy state is derived/changed only through circulation services.

## 3. Transaction services

- Checkout locks copy/member and validates membership, branch, policy precedence, limits, blocks and hold ownership.
- Renew locks the active loan, calculates a new due date from its policy snapshot/closure calendar and appends an event.
- Return closes once, records condition, calculates charges, and atomically assigns the next eligible hold or transfer.
- Hold queues are branch-aware FIFO with reasoned librarian override and concurrency-safe fulfilment.
- Transfers use dispatch/receive/discrepancy events.
- Stocktake uses validate → preview → commit; adjustments never rewrite history.
- Bulk catalog/copy import uses previewable jobs and downloadable row errors.

## 4. APIs and UI

APIs live under `/api/addons/library/**`; pages under `/dashboard/library/**`: dashboard, catalog/detail, copies, circulation desk, members, holds, transfers, stocktake, policies and reports. Replace `LIBRARY_BOOKS` and all other mock catalog data.

The circulation desk is keyboard/barcode-first and idempotent. Every list uses server pagination and stable sorting. Member self-service is a safe projection for own/authorized household loans and holds.

Permissions follow the source plan and explicitly separate override, stocktake approval and charge waiver. Gate all advanced APIs/pages with the `library` entitlement.

## 5. Delivery

A. Catalog/taxonomy/editions/copies/import.
B. Member projection, policy precedence and closure calendar.
C. Checkout/renew/return and circulation desk.
D. Holds, notifications and member portal.
E. Transfers, loss/damage, charges and optional Finance posting.
F. Stocktake, dashboard, reports, retention and operations.

## 6. Acceptance

- Concurrent checkout cannot loan one copy twice.
- Duplicate return/renew/hold fulfilment requests are idempotent.
- Policy snapshots prevent later policy edits from silently changing existing loans.
- Closure calendar due-date behavior is tested across timezone/DST boundaries.
- Cross-tenant/branch copy, member, policy, hold and Finance references fail safely.
- Return allocates exactly one next hold under concurrency.
- Stocktake reconciliation is reproducible from observations/events.
- Member/guardian APIs reveal only authorized household records.
- Disabling Library leaves identities, Finance, Communication and resource library intact.
- Real barcode workflow, race tests, migration rerun, Docker build/migrate, TypeScript and isolation checks pass.

