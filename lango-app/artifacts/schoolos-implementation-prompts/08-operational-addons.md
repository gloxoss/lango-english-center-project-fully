# 08 — Operational Add-ons Prompt Pack

Each add-on registers routes, permissions, navigation, settings, jobs, reports, audit events, and entitlement checks through the common platform. Disabling an add-on hides entry points and stops jobs but preserves data.

## Library

### OP-L01 — Library overview and catalog

**Routes:** `/dashboard/library`, `/library/books`, `/books/new`, `/books/[id]`, `/categories`. **Users:** librarian, scoped admin, read-only teachers/students. **Objective:** maintain title/edition records and searchable physical/digital holdings. **Layout:** operations dashboard; faceted catalog; detail with metadata, cover, copies, availability, history. **Actions:** add/import title, add copy, classify, attach licensed digital resource, archive. **States:** available, issued, reserved, lost, damaged, withdrawn, metadata incomplete. **Acceptance:** distinguish bibliographic title from copy/barcode; signed digital access. **Exclude:** one “quantity” field as copy truth.

### OP-L02 — Members, issue/return, reservations, and my books

**Routes:** `/dashboard/library/circulation`, `/members/[id]`, `/reservations`, portal `/library/my-books`. **Objective:** issue/return/renew efficiently and let members see loans, due dates, and holds. **Layout:** scan/search borrower then item; transaction confirmation; member timeline. **Actions:** issue, return, renew, reserve, cancel, mark lost/damaged, hand fine to finance. **States:** blocked member, limit reached, reserved for another, overdue, duplicate scan. **Acceptance:** atomic availability update, policy version recorded, no library cash ledger. **Exclude:** deleting circulation history.

### OP-L03 — Stocktake and library reports

**Routes:** `/dashboard/library/stocktake`, `/reports`. **Objective:** scan expected holdings, resolve missing/unexpected copies, and report circulation/overdues. **States:** open count, duplicate, wrong branch, reconciled. **Acceptance:** background import, variance audit, branch scope. **Exclude:** silently marking unscanned books lost.

## Inventory

### OP-I01 — Items, categories, stores, units, and suppliers

**Routes:** `/dashboard/inventory/items`, `/categories`, `/stores`, `/units`, `/suppliers`. **Objective:** define stock items/SKUs, locations, units, reorder policy, and vendors. **Layout:** filterable master lists and item detail with balances by store. **Acceptance:** unit conversions explicit; no direct editable balance. **Exclude:** mixing library copies with consumable inventory.

### OP-I02 — Purchases and receipts

**Routes:** `/dashboard/inventory/purchases`, `/purchases/new`, `/purchases/[id]`. **Objective:** draft/approve purchase orders, receive partial deliveries, and hand financial obligations to accounting. **Actions:** submit, approve, receive, reject quantity, close, return. **States:** draft, ordered, partially received, received, cancelled. **Acceptance:** stock moves on receipt, not order; immutable receipt transactions. **Exclude:** auto-paying suppliers.

### OP-I03 — Sales, issues, returns, and loans

**Routes:** `/dashboard/inventory/issues`, `/sales`, `/loans`. **Objective:** issue consumables/assets to departments or people and track returnable items. **Actions:** reserve, issue, return, transfer, mark damaged/lost with approval. **States:** insufficient stock, issued, overdue loan, returned, written off. **Acceptance:** double-entry stock movements and responsible party. **Exclude:** negative stock without explicit controlled policy.

### OP-I04 — Stocktake and inventory reports

**Routes:** `/dashboard/inventory/stocktake`, `/reports`. **Objective:** count, reconcile, value, and explain stock changes. **Acceptance:** count freeze/snapshot, variance approvals, valuation basis labeled. **Exclude:** silently changing historical cost.

## Transport

### OP-T01 — Routes and stoppages

**Routes:** `/dashboard/transport/routes`, `/routes/[id]`, `/stops`. **Objective:** define effective-dated routes, ordered stops, planned times, capacity needs, and branch scope. **Layout:** list plus sequence editor; map only when configured, with accessible ordered-list alternative. **Actions:** create version, reorder, publish, retire. **States:** draft, active, superseded, invalid timing. **Acceptance:** published rider allocations reference route version. **Exclude:** mandatory proprietary maps.

### OP-T02 — Vehicles, crew, and assignment

**Routes:** `/dashboard/transport/vehicles`, `/crew`, `/assign-vehicle`. **Objective:** maintain vehicle capacity/compliance dates and assign qualified crew to route runs. **States:** maintenance, document expiring, capacity mismatch, crew conflict. **Acceptance:** conflict and expiration blocks configurable; sensitive driver data restricted. **Exclude:** treating staff profile as vehicle compliance record.

### OP-T03 — Rider allocation

**Routes:** `/dashboard/transport/allocations`, `/allocations/new`. **Objective:** assign students/staff to route/stop/direction with effective dates and guardian confirmation where required. **Layout:** route capacity and waitlist, rider search, exceptions. **States:** full, waitlisted, duplicate active allocation, pickup restriction. **Acceptance:** child scope and custody/pickup rules. **Exclude:** exposing full passenger list to families.

### OP-T04 — Trips, tracking, incidents, and reports

**Routes:** `/dashboard/transport/trips`, `/trips/[id]`, `/tracking`, `/incidents`, `/reports`. **Objective:** start/end runs, record boarding exceptions, optionally show consented vehicle location, handle incidents, and compare planned vs actual. **States:** not started, en route, delayed, completed, tracking unavailable, emergency. **Acceptance:** explicit retention/consent, role-limited real-time location, manual fallback. **Exclude:** continuous student device tracking.

## Hostel

### OP-H01 — Hostel, room, category, and bed setup

**Routes:** `/dashboard/hostel`, `/hostels`, `/rooms`, `/categories`. **Objective:** model buildings, rooms, beds, gender/age/access policies, capacity, facilities, and maintenance. **Acceptance:** bed is allocation unit; maintenance blocks occupancy. **Exclude:** single room quantity counters.

### OP-H02 — Bed allocation and resident profile

**Routes:** `/dashboard/hostel/allocations`, `/residents/[id]`. **Objective:** allocate eligible residents to beds with dates, guardian contacts, billing link, and history. **States:** occupied, reserved, maintenance, waitlisted, checkout pending. **Acceptance:** no overlapping bed/resident allocation; finance link is explicit. **Exclude:** duplicating student identity.

### OP-H03 — Roll call, leave, visitors, incidents, and maintenance

**Routes:** `/dashboard/hostel/roll-call`, `/leave`, `/visitors`, `/incidents`, `/maintenance`. **Objective:** run safety checks and exception workflows with minimum sensitive data. **Actions:** mark presence, approve outing/return, check visitor, escalate incident, block bed/room. **States:** missing resident, overdue return, unauthorized visitor, urgent maintenance. **Acceptance:** immutable safety timeline and escalation notification. **Exclude:** public incident notes.

### OP-H04 — Hostel allocation and operations reports

**Route:** `/dashboard/hostel/reports`. **Objective:** report occupancy, vacancies, movements, leave exceptions, maintenance, and fee-link reconciliation. **Acceptance:** period and branch/building scope, freshness labels, drill-through. **Exclude:** medical/custody details in aggregate exports.

## Verification prompt

Test entitlement denial, title-vs-copy integrity, circulation races, stock movement balance, partial receipts, route versioning, capacity conflicts, location consent/retention, bed overlap, safety escalation, offline scan retries, branch scope, and clean add-on disable/re-enable.
