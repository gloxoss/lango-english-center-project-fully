# Inventory Management — Future Addon

**STATUS: IMPLEMENTED** — see `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md`
(#25) for verified details. 30 API routes, 26 tables (`inventory-schema.ts`,
migration `0077`), 13 pages + sidebar, 7 `inventory.*` permissions are live;
addon registry (`src/addons/registry.ts`) already lists `inventory` as
`enabled:true`/"Built." Remaining gaps: most verification lives in
`scripts/verify-inventory-*.mjs` rather than vitest (only
`inventory-math.test.ts` is an in-repo test), and `MANUAL-TESTING.md` §14
manual browser/SQL checks are still open. Read `AGENT-HANDOFF.md` first for
overall project state.

## What the reference screenshots show

Eight RamomSchool pages, shared 2026-08-01 (not saved to this repo — inline
in the conversation that produced this doc), all under one "Inventory"
sidebar section:

- **Product** — the item catalog: name, code, category, purchase unit vs
  sale unit (e.g. buy a box of pens by the Dozen, sell individually by the
  Piece, with a unit-ratio conversion — "12" in the screenshot), separate
  purchase price and sale price (margin), remarks.
- **Category** — simple flat tag list for products (Sports, Accessories,
  Study material, Dress, Books Stationery, Furniture and Equipment,
  Computer).
- **Store** — multiple physical stock locations (the screenshot shows 5:
  Family Fashion Store, Super Shop, Smart Computer, Academic Essentials,
  Sports Scholars), each with a code, contact info, address — this is a
  genuinely multi-location model, not a single warehouse.
- **Supplier** — vendor directory: name, address, contact, email, company
  name, and which products they supply.
- **Unit** — measurement units (KG, Piece, Dozen, Unit), scoped per branch
  in the reference product.
- **Purchase** — buying stock from a supplier: bill number, supplier,
  purchase status (Received/Ordered), payment status (Total Paid/Partly
  Paid), date, net payable, paid, due.
- **Sales** — selling stock to someone (the screenshot shows "Role:
  Student", a named student, payment status, net payable/paid/due) — this
  is a school shop / point-of-sale flow: charging a student's family for a
  uniform, a book, etc.
- **Issue** — lending/checking out an item rather than selling it: who
  it's issued to, date of issue, due date, return date (shows
  "Not Returned" as a real status, and a completed return with an actual
  return date on the second row) — a library-style loan tracker for
  equipment/books that get returned rather than consumed.

## Why a school would actually want this

- **School shop / uniform & book sales**: schools that sell uniforms,
  textbooks, or stationery directly to families currently have no way to
  track that in SchoolOS at all — it would happen entirely outside the
  system today.
- **Equipment loans**: sports equipment, laptops, musical instruments,
  library books lent to students need a due-date/return-tracking system
  distinct from a sale — the "Issue" concept is genuinely different from
  "Sales" and both are needed, not just one.
- **Procurement accountability**: knowing what was bought from which
  supplier, at what price, and whether it's been paid for is a real
  administrative need for any school office, separate from tuition
  invoicing.
- **Multi-store**: relevant for schools that already have multiple
  physical stock points (a canteen, a uniform shop, a stationery counter)
  under one tenant.

## Why it's genuinely bigger scope than it looks

Nothing in this list overlaps with existing schema — this is a new
business domain end to end: products, categories, stores, suppliers,
units, purchases, sales, and issues would all be new tables. Compare to
`two-factor-authentication/`, which turned out cheap because Better Auth
already did the hard part — there's no equivalent shortcut here.

**One real design question to resolve before building, not guess:**
should "Sales" (charging a student's family for a uniform/book) create a
real row in the *existing* `invoices`/`payments` tables (so it shows up
in the family's normal billing history and the real finance dashboard
totals), or live in its own separate ledger like the reference product
does? Recommend integrating with the real `invoices`/`payments` schema
(`src/models/Schema.ts:1415`, `:1461`) rather than a parallel payment
system — this app already has one real, working payment/invoice engine
with tenant isolation and audit logging; a second parallel one for
inventory sales would duplicate that logic and let a family's real total
balance drift out of sync across two systems. "Purchase" (paying a
supplier) is a different case — that's closer to the existing `expenses`
table (`:1194`) than to invoices, since it's money going out, not coming
in from a family.

## Rough scope if this is picked up

1. New tables: `inventoryProducts`, `inventoryCategories`,
   `inventoryStores`, `inventorySuppliers`, `inventoryUnits`,
   `inventoryPurchases` (+ line items), `inventoryIssues`. "Sales" reuses
   `invoices`/`payments` per the design question above rather than a new
   table, if that recommendation is accepted.
2. Stock-level tracking needs a decision: computed on the fly from
   purchases minus sales/issues, or a maintained running balance per
   product per store (faster reads, more moving parts to keep correct) —
   don't build the maintained-balance version unless read performance is
   actually shown to need it.
3. UI: reuse the existing `DataTable` component and admin page patterns
   already established across the app (same as every other module) —
   nothing about this needs new UI infrastructure.

## Page-by-page business logic (implementation-ready detail)

### 1. Product (list + create/edit)

- Fields: name, code (unique per tenant — enforce at the DB level with a
  unique constraint, not just client-side validation), category (FK),
  **purchase unit** and **sale unit** (both FK to Unit), **unit ratio**
  (how many sale-units per purchase-unit — e.g. buy by the Dozen, sell by
  the Piece, ratio 12), purchase price, sale price, remarks.
- **Business logic**: sale price should warn (not block) if it's below
  purchase price — a real margin check, but schools may legitimately sell
  at cost or a loss for some items (e.g. subsidized uniforms), so this is
  a soft warning not a hard validation.
- Stock quantity is **not a field on this table** — it's derived (see
  the stock-tracking design question in "Rough scope" above), so the
  Product page shows a computed current-stock column per store, not a
  stored one, unless the maintained-balance approach is chosen instead.

### 2. Category (flat list, add form + list)

- Simplest page in the module: name field, list with edit/delete.
- **Business logic**: prevent deleting a category still referenced by a
  product (foreign-key restrict, matching this app's established pattern
  elsewhere of blocking deletes that would orphan real data rather than
  cascading silently).

### 3. Store (list + create)

- Fields: name, code, mobile, address, description.
- **Business logic**: this is the multi-location anchor — every Purchase
  receives INTO a store, every Sale/Issue goes OUT FROM a store. A tenant
  with only one physical location still needs exactly one Store row
  (don't special-case "no store" — keep the data model consistent even
  for the common single-location case).

### 4. Supplier (list + create)

- Fields: name, address, contact number, email, company name, and a
  read-only "Product List" column showing what they've supplied
  historically (derived from Purchase line items referencing them, not a
  stored field — don't let this drift out of sync with actual purchase
  history).

### 5. Unit (add form + list)

- Fields: name (KG, Piece, Dozen, Unit, etc.).
- Reference screenshot shows units scoped per branch/tenant — keep it
  simple as a flat tenant-scoped list; don't add a conversion-table
  concept here (the ratio between purchase/sale unit lives on the
  Product itself, per-product, not as a generic unit-to-unit conversion
  system — that would be solving a more general problem than this app
  actually needs).

### 6. Purchase (list + add)

- **Add Purchase**: pick supplier, pick store (where the stock is
  received), add line items (product, quantity, unit price), a purchase
  date, and a payment-status entry (paid amount now, due amount
  computed).
- **List columns**: bill number (auto-generated, sequential per tenant —
  same pattern as this app's other reference-number generation, e.g. the
  attendance register's `REG-...` reference), supplier, purchase status
  (Ordered/Received — Received should be the trigger that actually
  increments stock, not the initial creation, since an "Ordered" purchase
  hasn't physically arrived yet), payment status (computed from
  paid vs net payable: Total Paid / Partly Paid / Unpaid), date, net
  payable, paid, due.
- **Business logic**: this is money going OUT to a supplier — recommend
  linking to the existing `expenses` table (`Schema.ts:1194`) rather than
  building a fully parallel payment ledger, per the design question
  above.

### 7. Sales (list + add)

- **Add Sales**: pick who it's for (role: Student/Staff/Guest — reference
  screenshot shows "Role: Student"), pick the store, add line items,
  record payment.
- **List columns**: bill number, role, sale-to (name), payment status,
  date, net payable, paid, due.
- **Business logic — the real integration decision from "Rough scope"
  above, spelled out per-page**: if a Sale is to a student, recommend it
  create a real row in the existing `invoices` table
  (`Schema.ts:1415`) tagged with an inventory-sale reference, and any
  payment against it use the real `payments` table
  (`:1461`) — so it shows up in that family's actual billing history and
  the real finance dashboard totals stay correct. A Sale to a
  non-student (staff, walk-in) has no family billing history to join, so
  that case can use a standalone record. Don't build one parallel
  ledger that handles both cases uniformly if it means students' sales
  silently don't appear in their real invoice history.

### 8. Issue (list + add)

- **Add Issue**: who it's issued to, which product/item, date of issue,
  due date (when it should come back).
- **List columns**: role, issue-to, mobile, date of issue, due date,
  return date — shown as "Not Returned" (a real status, not a blank) until
  actually returned.
- **Business logic**: distinct from Sales — issuing an item should
  decrement available stock at that store the same way a Sale does, but
  **returning** it should increment stock back. A "mark as returned"
  action (sets `returnDate`) is the core interaction on this page beyond
  create/list. Consider an overdue indicator (due date passed, still
  "Not Returned") as a real, useful signal — the reference screenshot's
  "Not Returned" badge in red already implies this distinction matters
  to whoever built the reference product.

## Addon or core?

**Addon.** Unlike 2FA, this one genuinely fits the addon model — not
every school needs a shop/procurement/loan-tracking system, and it's a
self-contained domain that doesn't touch core student/attendance/grading
logic. Added to `src/addons/registry.ts` as a candidate (see that file).
