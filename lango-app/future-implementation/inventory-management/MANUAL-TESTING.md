# Inventory Management — Manual Testing Logic

Complete manual acceptance logic for the **Inventory Management** add-on (Lango / SchoolOS,
Next.js 15 App Router, Drizzle + PostgreSQL). This is the human-facing companion to the automated
live scripts `scripts/verify-inventory-sales.mjs` and `scripts/verify-inventory-issues.mjs`.

Every module below lists the **business flow**, the **exact UI actions**, the **expected results**,
and the **negative / edge cases** to probe by hand. Cross-cutting suites (concurrency, isolation,
addon-disable, finance regression) are at the end. The section numbers match the acceptance matrix
in `EXECUTION-PLAN.md` §17 (C1–C14).

---

## 1. Preconditions

| Item | Value |
|---|---|
| App URL | `http://localhost:3000` (locale `en` or `fr`; dev server :3002 in this workspace) |
| DB | `postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos` |
| Tenant A | Atlas — `ca40c88e-339c-4fea-b5c4-51d5c9cc0239` |
| Tenant B | Lango — `f62f31eb-1fc8-4102-9145-a5ce0bca989b` |
| Atlas admin | `y.elamrani@atlas.ma` / `Admin123!` (`USR-001`, school_admin) |
| Lango admin | `admin@lango.ma` / `Admin123!` (`USR-LANGO-001`) |
| Student (Atlas) | `STU-001` — Yassine El Amrani |
| Add-on | `inventory` must be `is_enabled=true` for **both** tenants (Phase 0 entitlement rows) |
| Permissions | school_admin role defaults include all `inventory.*` keys (verified in `permissions.ts`) |

**Reset between runs:** delete rows in FK order — `inventory_issue_lines`, `inventory_issues`,
`inventory_adjustment_lines`, `inventory_adjustments`, `inventory_transfer_lines`,
`inventory_transfers`, `inventory_stock_movements`, `inventory_stock_balances`,
`inventory_purchase_lines`, `inventory_purchases`, `inventory_products`, `inventory_stores`,
`inventory_suppliers`, `inventory_units`, `inventory_categories`. Also delete finance side effects:
`payment_allocations`, `payments`, `invoice_items`, `invoices` with `note LIKE 'Vente N° %'`, and
`expenses` with `description LIKE '%[verify%'`.

**Quick sanity after reset:** sign in as both admins; open **Inventaire → Stock**; page renders with
zero balances and an empty movements journal.

---

## 2. API conventions (apply to every step)

- Create endpoints return **201** with `{ success, data }`; reads return **200**.
- Reference numbers: `PUR- / SAL- / ISS- / ADJ- / TRF-{year}-######` (tenant-unique).
- Errors: `422 INVALID_REF` (foreign id not in this tenant), `422 INVALID_LINES`, `400 INVALID_QUANTITY`,
  `409 INSUFFICIENT_STOCK` (never negative), `409 TRANSFER_CANCELLED` / `TRANSFER_COMPLETED`,
  `404 NOT_FOUND`, `403 ADDON_NOT_ACTIVATED` / `403 FORBIDDEN`.
- **Idempotency:** any create may carry `idempotencyKey`; a retry with the same key returns the
  existing doc with **201**, and the stock effect is applied exactly once.
- **Money** is stored in cents, **quantities** as scaled integers (thousandths). No float drift.
- Quantity inputs are decimal strings (`"0.5"`, `"12"`); unit ratio converts purchase→sale units.

---

## 3. Master data (catalog)

Route family `/api/addons/inventory/{categories|units|stores|suppliers|products}` (+ `[id]`).

### 3.1 Categories
1. **Inventaire → Catégories → Nouvelle catégorie** → name `Manuel scolaire` → **Créer**.
   - List shows the row; editing changes the name; deleting a category in use is blocked (`IN_USE`).

### 3.2 Units
1. **Unités → Nouvelle unité** → name `Pièce`, abbreviation `pcs` → **Créer**.
2. Create a second unit `Boîte` (`bx`).
3. Delete the `Boîte` unit after it is referenced by a product → blocked (`IN_USE`).

### 3.3 Stores
1. **Magasins → Nouveau magasin** → name `Boutique principale`, code `ST-MAIN` → **Créer**.
2. Create a second store `Dépôt` (`ST-DEPOT`).
3. Edit the code → saved; delete a store that has balances → blocked.

### 3.4 Suppliers
1. **Fournisseurs → Nouveau fournisseur** → name `Distributeur Test` → **Créer**.

### 3.5 Products
1. **Produits → Nouveau produit** → name `Cahier A5`, code `CAH-001`, category, unit `Pièce`
   (purchase + sale, ratio `1`), purchase price `45,50`, sale price `60` → **Créer**.
2. Product appears with `Stock total : 0`, `Stock par magasin :` empty.
3. Create a second product `Cahier A5 par 12` with **unit ratio `12`** and purchase price `500`
   (used to prove ratio math in purchases).
4. **Archive** a product → filtered out of the active list; unarchive restores it.
5. Products show `stockByStore` totals that update after every receipt/sale/issue/adjustment/transfer
   below (verify after each module: refresh **Produits** and **Stock**).

---

## 4. Purchasing & receiving

Route family `/api/addons/inventory/purchases` (+ `[id]`, `[id]/receive`, `[id]/reverse`).

### 4.1 Happy path
1. **Achats → Nouvel achat** → supplier `Distributeur Test`, store `Boutique principale`,
   order date today, add lines:
   - `Cahier A5 × 12` at `45,50` (line total `546,00`)
   - `Cahier A5 par 12 × 2` at `500,00` → ratio math yields `24` sale units on receipt
   → **Enregistrer**.
2. Purchase row is **`ordered`** (status badge). **Stock total = 0** (order ≠ stock).
3. **Recevoir** the order → status **`received`**.
   - `Cahier A5` stock = **12**; `Cahier A5 par 12` stock = **24** (2 purchase units × 12 ratio).
   - **Finance** shows an `expenses` row (supplier) and the linked GL stays green.
4. **Recevoir again** (idempotent) → returns `200` with the same `received` doc; stock does **not**
   double (probe the purchase detail / re-read product stock).

### 4.2 Negative
- Receive with insufficient quantity in a line → clear validation error, no partial state.
- Cross-tenant: from Lango admin, GET / PATCH / receive / reverse an Atlas purchase → `404`.
- Reverse a received purchase → stock restored exactly once; original receipt movements intact +
  compensating rows present (no DELETEs). Reversing again → idempotent, no double restore.

---

## 5. Sales / POS (C5, C7)

Route family `/api/addons/inventory/sales` (+ `[id]`, `[id]/reverse`).

### 5.1 Student sale → Finance integration
1. **Ventes → Nouvelle vente** → store `Boutique principale`, client type **Étudiant**, student
   `STU-001`, sale date today, line `Cahier A5 × 2 @ 60`, **paid 120**, method **cash** → **Enregistrer**.
2. Sale is **`completed`**, number `SAL-…`, `netAmount = 120`, `studentName = Yassine El Amrani`,
   and an `invoiceId` is attached.
   - Stock `Cahier A5`: 12 → **10**.
   - **DB:** `invoices` row (`INV-…`, amount=120, net=120, paid=120, status `paid`, note mentions the
     sale number), 1 `invoice_items` row `Cahier A5 × 2` amount 120, 1 `payments` row
     (amount 120, method cash, `student_id = STU-001`), 1 `payment_allocations` row 120.
   - **Finance → Student statement / Invoices** (`/api/finance/invoices?studentId=STU-001`) lists the
     sale invoice. **(C5)**
3. Partial payment: repeat with **paid 30**, method card → invoice status **`partial`**, `paid = 30`.

### 5.2 Staff / guest counter sale (no finance rows)
1. **Vente** client type **Comptoir**, name `Client Comptoir Test`, paid 120, line 2×`Cahier A5 par 12`
   @ 60.
   - Sale is `completed`, `invoiceId = null`, `customerName` stored.
   - Stock `Cahier A5 par 12`: 24 → **22** (sale uses sale units; ratio irrelevant at sale).
   - **No** new `invoices` row for this sale (still exactly the student-sale invoice).

### 5.3 Reversal (C7)
1. **Ventes → Annuler** on the partial student sale (reason `Erreur de caisse`).
   - Status → **`reversed`**, `reversalReason` stored.
   - Stock `Cahier A5` restored **exactly once** (probe product stock).
   - **DB:** exactly 1 `sale_reversal` movement; the original `sale` movements intact.
   - Reversing again → idempotent `200`, no double restore.
   - **Documented deferral:** the student invoice stays `partial` in Finance (credit-note/refund
     integration is deferred in v1).

### 5.4 Negative-stock race (C1)
1. With exactly **1** unit of a product left, fire two concurrent counter sales of 1 unit.
   - Exactly one `201`, the other `409 INSUFFICIENT_STOCK`; balance **never negative**;
     movements = 1× `sale` only.

---

## 6. Issues / loans (C2, C6)

Route family `/api/addons/inventory/issues` (+ `[id]`, `[id]/return`).

### 6.1 Issue lifecycle
1. **Prêts → Nouveau prêt** → store `Boutique principale`, bénéficiaire type **Comptoir**, name
   `Bénéficiaire Test`, date de sortie today, échéance +7 days, line `Cahier A5 × 5` → **Enregistrer**.
   - Doc is **`issued`**, number `ISS-…`; stock `Cahier A5` 10 → **5**. **(C2)**
2. **Retourner** with disposition **Retourné** (reason `Fin de prêt`) → status **`returned`**,
   `returnDate` set; stock 5 → **10** (restored exactly once).
   - DB: exactly 1 `issue_return` movement. Calling return again → idempotent, no double restore.
3. **Étudiant** issue: bénéficiaire type **Étudiant**, student `STU-001`, line `Cahier A5 × 3`.
   - Doc shows `studentName = Yassine El Amrani`; stock 10 → **7**. **(C6)**

### 6.2 Overdue (derived at read time)
1. Create an issue with échéance **yesterday**, never return it.
   - The row shows **En retard** (status stays `issued`, `isOverdue = true`); it must NOT be in the
     `status=issued` filter list alongside a future-due issue without the overdue flag being lost.

### 6.3 Damaged / lost (documented deviation from plan §10)
1. **Damaged:** issue `Cahier A5 × 2` (stock 7 → 5), then **Retourner** disposition **Abîmé**.
   - Status → **`damaged`**, `returnDate` set, **stock stays 5** (the `issue` movement already removed
     the units from sellable stock; posting an `adjustment_out` would double-decrement).
   - DB: **0** `issue_return` movements for this doc.
2. **Lost:** issue `Cahier A5 × 1` (stock 5 → 4), then disposition **Perdu**.
   - Status → **`lost`**, stock stays 4, no movement.

### 6.4 Negative
- Issue 100 × `Cahier A5` → `409 INSUFFICIENT_STOCK`; stock unchanged.
- Issue with same `idempotencyKey` twice → same doc id, stock effect once.
- Cross-tenant: Lango admin GET / return / create an issue on Atlas store → `404` / `422 INVALID_REF`.

---

## 7. Adjustments

Route family `/api/addons/inventory/adjustments` (+ `[id]`).

1. **Ajustements → Nouvel ajustement** → store, type **Correction de stock**, raison
   `Inventaire tournant`, line `Cahier A5 × 4` direction **Entrée (+)** → **Appliquer**.
   - Doc **`applied`**, number `ADJ-…`; stock `Cahier A5` 4 → **8**.
2. Type **Perte**, direction **Sortie (−)**, `Cahier A5 × 3` → stock 8 → **5**.
3. Sortie 100 → `409 INSUFFICIENT_STOCK`; stock unchanged.
4. Same `idempotencyKey` twice → same doc, effect once.
5. Cross-tenant GET / create → `404` / `422 INVALID_REF`.

---

## 8. Transfers (C6, C9, C10)

Route family `/api/addons/inventory/transfers` (+ `[id]`, `[id]/complete`, `[id]/cancel`).

### 8.1 Atomic complete
1. **Transferts → Nouveau transfert** → magasin départ `Boutique principale`, arrivée `Dépôt`,
   raison `Réappro`, line `Cahier A5 × 5` → **Enregistrer**.
   - Doc **`pending`**, number `TRF-…`, `fromStoreName ≠ toStoreName`.
   - **No stock effect while pending** (Boutique 5, Dépôt 0).
2. **Compléter** → status **`completed`**, `completedAt` set; Boutique **0**, Dépôt **5**.
   - DB: exactly 1 `transfer_out` (Boutique) + 1 `transfer_in` (Dépôt) for the same qty — atomic pair.
   - Completing again → idempotent `200`, no double move. **(C9)**

### 8.2 Cancel / state guards
1. Create a pending transfer, **Annuler** → status **`reversed`**, `cancelledAt` set; no stock effect.
2. Complete that cancelled transfer → `409 TRANSFER_CANCELLED`.
3. Create a transfer of 100 units (allowed at create — no stock check), **Compléter** →
   `409 INSUFFICIENT_STOCK`; status stays **`pending`**; then cancel it.
4. Transfer with from == to → `422 INVALID_REF`.
5. Same `idempotencyKey` twice at create → same doc, effect once.

### 8.3 Concurrent complete + cancel (C9)
Fire complete and cancel simultaneously on one pending transfer → the two transitions serialize on
`FOR UPDATE`; the terminal state is exactly one of `completed`/`reversed`, and either both
`transfer_out`+`transfer_in` rows exist (completed) or neither (cancelled). Never a half-posted pair.

### 8.4 Deadlock freedom (C10)
Two multi-line transfers crossing the same stores in opposite order, completed concurrently →
both succeed without timeout (sorted lock order in `postStockMovements`).

### 8.5 Cross-tenant (C6)
Lango admin GET / complete / cancel / create an Atlas transfer → `404` / `422 INVALID_REF`.

---

## 9. Stock, movements & reconciliation (C3, C4)

Route family `/api/addons/inventory/stock`, `/stock/reconcile`, `/movements`.

1. **Stock** page lists every (product × store) balance row with names and quantities.
   - After the receipt in §4, `Cahier A5`=12 and `Cahier A5 par 12`=24 appear with the store name.
2. **Journal des mouvements** (in **Stock** view): every operation (§4–§8) produced a row with
   `movementType`, `qty` (signed), `refType`, `refId`, `reason`, actor, timestamp. Filter by
   product / store / movement type / ref type / date range; pagination works.
3. **Réconcilier** (button or `POST /stock/reconcile`) → returns `{ discrepancies: [], reconciled: true }`.
   - **Invariant (C3):** for every (store, product) and **both tenants**, `balance.quantity == SUM(movements.qty)`.
   - **C4:** a pending (ordered) purchase produces no movement and balance 0; only the receive posts
     `receipt` movements exactly once.
4. Drift probe (optional, advanced): hand-edit one balance row, run reconcile → it reports the
   discrepancy and rewrites the balance from the ledger.

---

## 10. Overview / reports / exports (Phase 6)

The full Phase 6 acceptance is covered by the repeatable script
`node scripts/verify-inventory-phase6.mjs` — it **fails (exit 1) on any skipped check or missing
fixture**, so there is no silent-skip path. It creates deterministic `P6-` fixtures directly in the
DB, cross-checks the Overview API against direct SQL, exercises every CSV export, and leaves the DB
at the documented baseline (fixtures removed, add-on re-enabled). Recorded result: **41/41 PASS,
exit 0**.

Checked automatically (no browser required):

1. **Redirect:** `GET /fr/dashboard/inventory` → `307`, `Location` ends `/inventory/overview`.
2. **Overview KPIs == direct SQL:** active products, categories, stores, suppliers, stock value
   (cents, `floor((qty·1000)·(price·100)+500)/1000`), low-stock count, open issues, overdue issues
   (`status=issued AND due_date<today AND return_date IS NULL`), pending transfers, total movements,
   movements 30d — all match a parallel SQL computation.
3. **Lists match DB:** low-stock list and recent-movements list equal the ledger rows.
4. **CSV exports (products / stock / movements):** body begins with UTF-8 BOM bytes `EF BB BF`;
   line separators are `CRLF` (bare LF allowed only inside quoted cells); escaping wraps cells
   containing `" , \n \r` in quotes with `""` doubling (verified for a product name with comma+quote
   and a movement reason with an embedded newline); `Content-Type: text/csv; charset=utf-8`;
   `Content-Disposition: attachment; filename="inventory-<type>-<YYYY-MM-DD>.csv"`.
5. **CSV filters:** `type=stock&lowStock=1` returns only sub-threshold balances; movements support
   `movementType` / `productId` filters.
6. **Tenant isolation:** the Lango export contains no Atlas `P6-` rows.
7. **Capability gate (static):** the export route requires `inventory.export`; the overview route
   requires `inventory.read`.
8. **Sidebar order:** under *Inventaire*, **Aperçu** is the first sub-item.
9. **States:** with the add-on disabled, overview returns `403 ADDON_NOT_ACTIVATED` and returns
   `200` after re-enable; with no fixtures, overview returns all-zero counts and empty lists.

**Manual (browser) part of Phase 6 — pending:** visually confirm the Overview KPI banner,
low-stock table, recent-movements panel, the three export buttons, and empty/loading/error states in
the UI in both `fr` and `en`, at mobile/tablet/desktop widths; open a downloaded CSV in Excel to
confirm accents round-trip.

---

## 11. Cross-cutting acceptance (C6–C14)

### C6 — Tenant isolation (manual sweep)
Every foreign id (category, unit, store, supplier, product, student) submitted by tenant B in a
tenant A context → `422 INVALID_REF` (or `404` on direct doc id). No row of tenant B is ever
readable/writable by tenant A and vice-versa. Run the two-tenant sweep at least once after §4–§8.

### C8 — Addon disable / re-enable
1. In DB set `addon_entitlements.is_enabled = false` for `(Atlas, 'inventory')`.
2. Any `/api/addons/inventory/**` call → `403 ADDON_NOT_ACTIVATED`.
3. **Unrelated modules still work:** `/api/finance/invoices`, `/api/students`, student billing →
   `200`.
4. Re-enable `is_enabled = true` → inventory routes `200` and previously created data is visible
   again (no rows lost while disabled).

### C11 — Precision
Create a 100-line sale doc with unit prices and fractional quantities; `netAmount` equals the manual
sum to the cent; `reconcile` stays green; re-read product stock is stable (no float drift).

### C12 — Finance regression
Existing flows still pass after inventory ships: payment exceeding invoice balance → `409`,
invoice listing, payments, expenses. (Invoices created by student sales coexist with regular
invoices.)

### C13 — Isolation static gate
`npx tsx scripts/check-tenant-isolation.ts` flags only the known baseline files — no new inventory
route breaks isolation.

### C14 — Build gates
`npx tsc --noEmit` → **0 errors**; `npx next build` → **exit 0**; migration
`0077_inventory_management.sql` applies idempotently twice (re-run exits 0). Each phase ends with a
green gate.

---

## 12. UI navigation checkpoint (final walkthrough)

Sign in as Atlas admin and click through the whole module:

| Sidebar item | Page loads | Key dialogs present |
|---|---|---|
| Inventaire | `/dashboard/inventory` → redirects to Aperçu | Overview KPIs |
| → Aperçu | `/dashboard/inventory/overview` | KPI banner + low-stock table + recent movements + export buttons |
| → Produits | product list + search + archive | Nouveau produit |
| → Catégories | list | Nouvelle catégorie |
| → Unités | list | Nouvelle unité |
| → Magasins | list | Nouveau magasin |
| → Fournisseurs | list | Nouveau fournisseur |
| → Achats | order list + status badges | Nouvel achat, Recevoir, Annuler |
| → Ventes | KPI (Ventes/Terminées/Étudiantes/Annulées) + filters | Nouvelle vente, Annuler |
| → Prêts | KPI (Prêts/En cours/Retournés/Perdus-Abîmés) + filters | Nouveau prêt, Retourner |
| → Ajustements | KPI (Ajustements/Inventaires/Pertes-Abîmés/Dons-Rebuts) | Nouvel ajustement |
| → Transferts | KPI (Transferts/En attente/Complétés/Annulés) | Nouveau transfert, Compléter, Annuler |
| → Stock | balances + movements journal | Réconcilier |

Each page must be **interactive** (search, filters, create modal, confirmations) — no static
placeholders. All French UI labels above are the ones rendered; switch locale to `en` and repeat the
sweep.

---

## 13. Cleanup / reset (restore pristine state)

Delete in this order (see §1 reset): the transfer/issues/adjustments lines then docs, movements,
balances, purchase lines/purchases, products, stores, suppliers, units, categories; plus finance
side effects (`payment_allocations`, `payments`, `invoice_items`, `invoices` with `note LIKE
'Vente N° %'`, `expenses` with `[verify` description). Re-enable the `inventory` add-on if §11/C8
left it disabled. Final check: both tenants show empty balances and zero movements.

---

## 14. Sign-off checklist

### Automated evidence (executed 2026-08-08, all headless — exit codes recorded)

- [x] **Catalog 45/45** — `node scripts/verify-inventory-catalog.mjs` (exit 0): categories/units/
      stores/suppliers/products CRUD, duplicate 409, IN_USE archive guards, reconcile, ledger/balance
      drift, low-stock filter, tenant isolation (Lango zero rows).
- [x] **Purchases 32/32** — `node scripts/verify-inventory-purchases.mjs` (exit 0): order→receive→
      expense, receive-once idempotency, ordered≠stock, ratio math, reverse restores once, cross-tenant
      404, Lango zero.
- [x] **Sales 57/57** — `node scripts/verify-inventory-sales.mjs` (exit 0): student sale→
      invoice/payment/allocation + Finance statement, guest sale no invoice, partial `partial`,
      reversal restores once, C1 race (one 201 + one 409, never negative), Lango zero.
- [x] **Issues/loans 86/86** — `node scripts/verify-inventory-issues.mjs` (exit 0): issue→return,
      overdue derived flag, damaged/lost dispositions (no double decrement), insufficient 409,
      idempotent retries, adjustments in/out, transfer atomic complete/cancel guards + insufficient on
      complete, deadlock/race paths, cross-tenant 404/422, Lango zero.
- [x] **Add-on gate 7/7** — `node scripts/verify-inventory-addon-gate.mjs` (exit 0): all 10 inventory
      routes `403 ADDON_NOT_ACTIVATED` while disabled; finance + students still `200`; data intact on
      re-enable; add-on left **re-enabled**.
- [x] **Phase 6 41/41** — `node scripts/verify-inventory-phase6.mjs` (exit 0): §10 redirect, KPIs vs
      SQL, low-stock/recent lists, CSV BOM/CRLF/escaping/filters/tenant-isolation/capability gate,
      sidebar order, error + empty states; fixtures removed and add-on re-enabled afterward.
- [x] **Type-check** — `npx tsc --noEmit` → exit 0 (final run, live-classrooms concurrent edits settled).
- [x] **Production build** — `npx next build` → exit 0 (after transient in-flight edits from the
      shared worktree settled; no inventory change was involved in the transient failures).

### Manual (browser + SQL) — execute in a live session, **not claimed as done**

- [ ] §3–§9 UI flows: dialogs, search/filters, archive confirmations, Recevoir/Retourner/Compléter
      buttons, status badges, KPI banners on every list page.
- [ ] §10 Phase 6 visual pass: Overview banner + export buttons in the browser (`fr` and `en`,
      mobile/tablet/desktop), CSV opens correctly in Excel.
- [ ] §11 C11 precision (100-line doc), C12 finance regression sweep, C13 isolation static gate.
- [ ] §12 full UI walkthrough in `fr` and `en`.
