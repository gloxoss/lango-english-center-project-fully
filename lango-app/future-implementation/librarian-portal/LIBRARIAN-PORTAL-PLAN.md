# Librarian Portal — Future Implementation Plan

## Goal

Deliver a keyboard/barcode-first circulation and catalog workspace when the Library Management add-on is enabled.

## Core journeys and pages

- **Library home:** due today, overdue, holds pickup, transfers, missing/damaged items and stocktake tasks.
- **Circulation desk:** exact member identification, copy scanning, checkout, renewal and return with atomic policy feedback.
- **Catalog:** bibliographic records, contributors, categories, editions and import validation.
- **Copies/holdings:** accession/barcode, branch/shelf, state/condition, acquisition and history.
- **Members:** eligibility, current loans/holds/charges and borrowing block; only minimal identity/contact fields.
- **Holds/transfers:** FIFO queue, pickup expiry, dispatch/receive and discrepancy resolution.
- **Inventory:** stocktake sessions, scan/import observations, reconcile and approval.
- **Reports:** circulation, overdue, inventory, collection use, loss/damage and overrides.

## Role and rules

- Introduce a librarian role template/capabilities after the permission model; do not simply append a role enum and expose admin routes.
- Separate catalog manage, circulation operate/override, hold, transfer, stocktake prepare/approve, charge waive and report permissions.
- All copy/loan/hold mutations use Library transactions/idempotency and immutable events. Overrides require reasons.
- Member search hides unrelated academic, finance, guardian and staff information.
- `/api/librarian/me/home|tasks` plus `/api/addons/library/...` with branch/location scope.

## Delivery

1. Role template/add-on manifest and dashboard.
2. Circulation desk/member lookup.
3. Catalog/copies.
4. Holds/transfers.
5. Stocktake/reports/operations.

## Done when

- A copy cannot be double-loaned and a librarian cannot cross unauthorized branches.
- Barcode workflows meet desk throughput and remain keyboard accessible.
- Disabling Library removes the portal cleanly without changing the user account.

