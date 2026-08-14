# Library Management Add-on — Implementation Plan

Status: **operational core implemented and verified** (2026-08-09) — catalog, copies, policies,
circulation, holds, transfers, stocktake, charges (incl. Accounting posting), safe CSV import/export,
and member self-service are DB-backed and covered by 32 live vitest tests. Product decisions below
remain the authoritative scope; see `VERIFICATION-EVIDENCE.md` and `PLAN-STATUS.md` for the
delivery record. The remaining manual/browser flows are tracked in `MANUAL-TESTING.md`.

## Screen inventory

| # | Screen | Visible elements | Primary action |
|---|---|---|---|
| 1 | Library navigation | Books, Books Category, My Issued Book, Book Issue/Return | Open a library workflow |

The screenshot proves navigation only. The operational screens below are derived from the minimum complete circulation workflow, not copied from the reference UI.

## Feature map against the current app

### Keep

- Existing tenant, branch, users, students, staff, roles, audit conventions, shared tables/forms, exports, and add-on registry.
- Existing Card/QR planning can provide optional person identification, but Library must work independently with exact search.
- Attachments Book remains the academic digital-resource add-on; Library owns physical/e-book catalog and circulation.

### Change

- Expand the existing placeholder registry description from “book catalog, borrowing, and returns” to the full lifecycle below.
- Reuse user identity but create a library-member projection for borrowing policy, suspension, balances, and history.

### Add

- Catalog, authors/contributors, publishers, subjects/tags, categories, editions, identifiers and cover/media.
- Branch holdings and copy-level accession/barcode inventory.
- Checkout, renewal, return, reservation queue, transfer, loss/damage, stocktake and write-off.
- Configurable loan policies, calendars, due dates, grace periods, fines/fees and waivers.
- Member portal, librarian desk, reports, notifications and immutable circulation history.

### Remove

- Nothing. The reference omits many operational screens, but absence from one navigation screenshot is not evidence to remove app features.

## Provisional decision gate

1. **Inventory granularity:** track every physical copy; recommended and assumed: yes.
2. **Fines:** calculate configurable fines but allow a tenant to disable collection; recommended and assumed.
3. **Reservations:** branch-aware FIFO holds with librarian override; recommended and assumed.
4. **Digital content:** metadata/link/controlled file access only; rich academic resources remain in Attachments Book.

## Domain boundaries

Library owns bibliographic records, physical/digital holdings, circulation, holds, acquisitions-lite, inventory, policies and library reports. It does not own school identities, accounting ledger entries, academic assignments, or generic file resources. Optional integrations publish charges to Finance and link learning resources without duplicating them.

## Pages

- **Library dashboard:** overdue count, due today, active loans, holds awaiting pickup, lost/damaged copies, popular titles and circulation trend.
- **Books:** searchable catalog with title, contributor, identifier, category, language, availability and branch; create/import/export.
- **Book detail:** metadata, editions, copies, availability timeline, holds, circulation history and attachments.
- **Categories & taxonomy:** hierarchical categories, subjects, tags, shelving/classification codes.
- **Copies & stock:** accession/barcode, branch, shelf/location, acquisition source/cost, condition and state.
- **Circulation desk:** scan/search member, scan copies, checkout/renew/return in one keyboard-first workspace.
- **My issued books:** current loans, due dates, renew eligibility, holds, history, fines/fees and notifications.
- **Reservations:** queue, pickup branch, ready-until deadline, fulfil/cancel/expire/no-show.
- **Transfers:** dispatch, in transit, receive and discrepancy handling.
- **Stocktake:** open count session, scan/import observations, reconcile missing/mis-shelved copies, approve adjustments.
- **Policies:** member type + material type + branch rules, closure calendar, limits, periods, renewals and fine schedule.
- **Reports:** loans, overdue, inventory, losses, collection usage, inactive titles, member activity and financial adjustments.

Every page needs loading, error, empty, filtered-empty, permission-denied and data states; tables need server pagination, stable sorting and export parity.

## Core data model

- `libraryBibliographicRecords`: tenant, title/subtitle, description, language, publication data, format, cover, identifiers and lifecycle state.
- `libraryContributors`, `libraryRecordContributors`, `libraryPublishers`.
- `libraryCategories`, `librarySubjects`, `libraryRecordSubjects`.
- `libraryEditions`: edition statement, ISBN/ISSN, publication year, pagination and format.
- `libraryCopies`: edition, accession number, barcode, branch, location/shelf, condition, circulation state, acquisition details and version.
- `libraryMembers`: user, member type, home branch, state, borrowing block and effective dates.
- `libraryLoanPolicies`: scoped policy with precedence, loan/renewal limits, grace and fine rules.
- `libraryLoans`: copy, member, checkout/due/return timestamps, renewal count, actor/device and state.
- `libraryLoanEvents`: immutable checkout, renew, due-date change, return, loss, damage and correction events.
- `libraryHolds`: record/edition/copy target, member, pickup branch, queue position, ready/expiry timestamps and state.
- `libraryTransfers`, `libraryTransferEvents`.
- `libraryStocktakes`, `libraryStocktakeObservations`, `libraryInventoryAdjustments`.
- `libraryCharges`, `libraryChargeAdjustments`: optional operational subledger with Finance posting reference.
- `libraryNotifications`: template/channel/delivery state; actual sending uses Communication providers.

All rows are tenant-scoped; physical inventory is branch-scoped. Use unique constraints for accession/barcode within tenant and optimistic concurrency on copies, loans and holds.

## State machines and rules

- Copy: `available → on_hold_shelf → checked_out → available`; exceptional states include `in_transit`, `repair`, `lost`, `missing`, `withdrawn`.
- Loan: `active → returned`; alternate terminal paths are `lost`, `claimed_returned`, `written_off`; renew creates an event rather than replacing history.
- Hold: `queued → ready_for_pickup → fulfilled`; alternatives `cancelled`, `expired`, `no_show`.
- Checkout must atomically validate member eligibility, copy availability, policy limits, unresolved blocks and hold ownership.
- Due dates use the applicable policy and branch closure calendar. Never silently shorten an existing loan after policy edits.
- Return atomically closes the loan, evaluates charges/condition and allocates the next eligible hold or transfer.
- A repeated scan/request uses an idempotency key and returns the existing result.
- Corrections require reason, actor and before/after snapshot; destructive history edits are forbidden.

## API outline

- `/api/addons/library/catalog`, `/catalog/:id`, `/copies`, `/members`
- `/api/addons/library/circulation/checkouts|renewals|returns`
- `/api/addons/library/holds`, `/holds/:id/ready|fulfil|cancel`
- `/api/addons/library/transfers`, `/stocktakes`, `/policies`, `/reports`
- Bulk import endpoints use validate → preview → commit jobs with downloadable error files.

Use Zod validation, tenant/branch authorization, database transactions, stable error codes, rate limits for public/member actions, audit metadata and idempotency on circulation mutations.

## Permissions

- `library.catalog.read|manage`, `library.copy.manage`, `library.circulation.operate|override`, `library.hold.manage`, `library.stocktake.manage|approve`, `library.policy.manage`, `library.report.read`, `library.charge.waive`.
- Students/guardians see only authorized household records; teachers/staff see self unless granted librarian permissions.
- Overrides require a reason and appear in audit reports.

## Delivery blueprint

| Phase | Deliverable | Dependency |
|---|---|---|
| A | Add-on shell, permissions, catalog, taxonomy, copies and imports | Core identity/tenant |
| B | Member projection, policies and closure calendar | A |
| C | Atomic checkout, renew, return and circulation desk | B |
| D | Holds, pickup workflow, reminders and member portal | C |
| E | Transfers, loss/damage, charges and optional Finance posting | C |
| F | Stocktake, dashboards, reports, privacy retention and operations | D–E |
| G | Optional RFID/SIP2, discovery enhancements and acquisitions | Proven demand |

## Acceptance and tracking

- Concurrency tests prove one copy cannot be loaned twice and one hold cannot be fulfilled twice.
- Cross-tenant/branch access, policy precedence, closures/DST, fines, renewals, loss, transfer and stocktake reconciliation are tested.
- Barcode workflow meets a measurable desk throughput target and remains keyboard accessible.
- Track checkout success/latency, renewal rejection reasons, overdue aging, hold fulfilment time, inventory accuracy, lost rate, active collection utilization and override rate.
- Roll out behind the existing add-on enablement mechanism with migration/seed, demo data, observability, backup/restore and rollback runbooks.

## Open-source references

- Koha — mature ILS workflows and terminology: https://github.com/Koha-Community/Koha (GPL; reference behavior only unless license obligations are accepted).
- Evergreen — multi-branch circulation and holds inspiration: https://github.com/evergreen-library-system/Evergreen
- Frappe Education/ERPNext — education identity and stock/accounting integration patterns: https://github.com/frappe/education

Do not copy UI or source blindly. Review licenses, security, data model fit and maintenance before adopting code.

