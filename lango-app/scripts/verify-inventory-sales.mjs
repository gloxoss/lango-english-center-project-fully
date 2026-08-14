// Live acceptance verification for inventory Phase 4 (Sales/POS + Finance integration).
// Hits the running dev server (default :3002), verifies real DB rows.
// Run: node scripts/verify-inventory-sales.mjs
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  const setCookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const body = await res.json().catch(() => ({}));
  if (!setCookies) throw new Error(`sign-in for ${email} returned no cookie (${res.status} ${JSON.stringify(body).slice(0, 200)})`);
  return { cookie: setCookies, body };
}

async function api(cookie, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

const PASSWORD = 'Admin123!';
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
const STUDENT = 'STU-001';
const runId = randomUUID().slice(0, 8);
const mark = `[verify-${runId}]`;
const SALE_TODAY = new Date().toISOString().slice(0, 10);

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', PASSWORD);
  const langoAdmin = await signIn('admin@lango.ma', PASSWORD);
  console.log('→ signed in as Atlas admin and Lango admin\n');

  // ---- idempotent cleanup of previous-run leftovers
  const verifyProducts = await pool.query(
    `SELECT id FROM inventory_products WHERE tenant_id=$1 AND remarks LIKE '%[verify%'`, [ATLAS],
  );
  const vp = verifyProducts.rows.map((r) => r.id);
  if (vp.length > 0) {
    const linkedSales = await pool.query(
      `SELECT DISTINCT sale_id FROM inventory_sale_lines WHERE tenant_id=$1 AND product_id = ANY($2::uuid[])`, [ATLAS, vp],
    );
    const saleIds = linkedSales.rows.map((r) => r.sale_id);
    if (saleIds.length > 0) {
      await pool.query(`DELETE FROM inventory_sale_lines WHERE tenant_id=$1 AND sale_id = ANY($2::uuid[])`, [ATLAS, saleIds]);
      await pool.query(`DELETE FROM inventory_sales WHERE tenant_id=$1 AND id = ANY($2::uuid[])`, [ATLAS, saleIds]);
    }
    await pool.query(
      `DELETE FROM inventory_purchase_lines WHERE tenant_id=$1 AND product_id = ANY($2::uuid[])`, [ATLAS, vp],
    );
  }
  await pool.query(`DELETE FROM inventory_purchases WHERE tenant_id=$1 AND notes LIKE '%[verify%'`, [ATLAS]);
  // invoiceItems/payments/allocations/invoices created by previous-run sales
  await pool.query(
    `DELETE FROM payment_allocations WHERE tenant_id=$1 AND payment_id IN
       (SELECT id FROM payments WHERE tenant_id=$1 AND invoice_id IN
         (SELECT id FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %'))`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM payments WHERE tenant_id=$1 AND invoice_id IN
       (SELECT id FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %')`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM invoice_items WHERE tenant_id=$1 AND invoice_id IN
       (SELECT id FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %')`, [ATLAS],
  );
  await pool.query(`DELETE FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %'`, [ATLAS]);
  // generic: any leftover verify movements on verify products
  await pool.query(
    `DELETE FROM inventory_stock_movements WHERE tenant_id=$1 AND product_id IN
       (SELECT id FROM inventory_products WHERE tenant_id=$1 AND remarks LIKE '%[verify%')`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_stock_balances WHERE tenant_id=$1 AND product_id IN
       (SELECT id FROM inventory_products WHERE tenant_id=$1 AND remarks LIKE '%[verify%')`, [ATLAS],
  );
  await pool.query(`DELETE FROM inventory_purchase_lines WHERE tenant_id=$1 AND purchase_id IN
       (SELECT id FROM inventory_purchases WHERE tenant_id=$1 AND notes=$2)`, [ATLAS, mark]);
  await pool.query(`DELETE FROM inventory_purchases WHERE tenant_id=$1 AND notes=$2`, [ATLAS, mark]);
  await pool.query(
    `DELETE FROM expenses WHERE tenant_id=$1 AND description LIKE '%[verify%'`, [ATLAS],
  );
  await pool.query(`DELETE FROM inventory_products WHERE tenant_id=$1 AND remarks LIKE '%[verify%'`, [ATLAS]);
  // fallback: orphaned sales from a half-crashed run (lines/products already gone)
  await pool.query(`DELETE FROM inventory_sale_lines WHERE tenant_id=$1 AND sale_id IN
       (SELECT id FROM inventory_sales WHERE tenant_id=$1 AND store_id IN
         (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%'))`, [ATLAS]);
  await pool.query(`DELETE FROM inventory_sales WHERE tenant_id=$1 AND store_id IN
       (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM inventory_categories WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM inventory_units WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM inventory_suppliers WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);

  let r;
  // ---- build refs + stock via API
  r = await api(admin.cookie, '/api/addons/inventory/categories', { method: 'POST', body: { name: `Catégorie ${mark}` } });
  const catId = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/units', { method: 'POST', body: { name: `Unité ${mark}`, abbreviation: 'U9' } });
  const unitId = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/stores', { method: 'POST', body: { name: `Magasin ${mark}`, code: `ST-${runId}` } });
  const storeId = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/suppliers', { method: 'POST', body: { name: `Fournisseur ${mark}` } });
  const supId = r.json?.data?.id;

  r = await api(admin.cookie, '/api/addons/inventory/products', { method: 'POST', body: {
    name: `Produit A ${mark}`, code: `PRD-A-${runId}`, categoryId: catId, purchaseUnitId: unitId, saleUnitId: unitId,
    unitRatio: '1', purchasePrice: 45.5, salePrice: 60, remarks: mark,
  } });
  const prodA = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/products', { method: 'POST', body: {
    name: `Produit B ${mark}`, code: `PRD-B-${runId}`, categoryId: catId, purchaseUnitId: unitId, saleUnitId: unitId,
    unitRatio: '12', purchasePrice: 500, salePrice: 60, remarks: mark,
  } });
  const prodB = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/products', { method: 'POST', body: {
    name: `Produit C ${mark}`, code: `PRD-C-${runId}`, categoryId: catId, purchaseUnitId: unitId, saleUnitId: unitId,
    unitRatio: '1', purchasePrice: 5, salePrice: 10, remarks: mark,
  } });
  const prodC = r.json?.data?.id;
  check('refs + 3 products created', Boolean(catId && unitId && storeId && supId && prodA && prodB && prodC), '');

  // stock A=12 (12×1), B=24 (2×12), C=1
  r = await api(admin.cookie, '/api/addons/inventory/purchases', { method: 'POST', body: {
    supplierId: supId, storeId, orderDate: SALE_TODAY, notes: mark,
    lines: [
      { productId: prodA, qtyInPurchaseUnit: '12', unitCost: 45.5 },
      { productId: prodB, qtyInPurchaseUnit: '2', unitCost: 500 },
      { productId: prodC, qtyInPurchaseUnit: '1', unitCost: 5 },
    ],
  } });
  const purchase = r.json?.data;
  r = await api(admin.cookie, `/api/addons/inventory/purchases/${purchase.id}/receive`, { method: 'POST' });
  check('receive → 200', r.status === 200 && r.json?.data?.status === 'received', `status ${r.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('starting stock A=12', Number(r.json?.data?.totalStock) === 12, `total ${r.json?.data?.totalStock}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodB}`);
  check('starting stock B=24', Number(r.json?.data?.totalStock) === 24, `total ${r.json?.data?.totalStock}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodC}`);
  check('starting stock C=1', Number(r.json?.data?.totalStock) === 1, `total ${r.json?.data?.totalStock}`);

  // ---- student sale (2×A@60 = 120, paid 120 cash) → invoice + payment integration
  const stuBody = {
    storeId, saleToRole: 'student', studentId: STUDENT, saleDate: SALE_TODAY,
    paidAmount: 120, paymentMethod: 'cash',
    lines: [{ productId: prodA, qty: '2', unitPrice: 60 }],
  };
  r = await api(admin.cookie, '/api/addons/inventory/sales', { method: 'POST', body: stuBody });
  check('student sale → 201', r.status === 201, `status ${r.status}`);
  const stuSale = r.json?.data;
  check('sale starts completed', stuSale?.status === 'completed', `status ${stuSale?.status}`);
  check('saleNumber SAL- format', /^SAL-\d{4}-\d{6}$/.test(stuSale?.saleNumber ?? ''), stuSale?.saleNumber);
  check('netAmount = 120', stuSale?.netAmount === 120, `net ${stuSale?.netAmount}`);
  check('student sale stores invoiceId', Boolean(stuSale?.invoiceId), stuSale?.invoiceId ?? 'none');
  check('sale studentName resolves', stuSale?.studentName === 'Yassine El Amrani', stuSale?.studentName);

  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('stock A=10 after student sale', Number(r.json?.data?.totalStock) === 10, `total ${r.json?.data?.totalStock}`);

  // finance integration: invoice row + items + payment + allocation
  const { rows: invRows } = await pool.query(
    `SELECT id, invoice_number, amount, discount_amount, net_amount, paid_amount, status, note FROM invoices WHERE tenant_id=$1 AND id=$2`, [ATLAS, stuSale.invoiceId],
  );
  check('DB: invoice row created', invRows.length === 1, JSON.stringify(invRows[0]));
  check('DB: invoice number INV- format', /^INV-\d{4}-\d{4}$/.test(invRows[0]?.invoice_number ?? ''), invRows[0]?.invoice_number);
  check('DB: invoice amount=120 net=120 paid=120', Number(invRows[0]?.amount) === 120 && Number(invRows[0]?.net_amount) === 120 && Number(invRows[0]?.paid_amount) === 120,
    `${invRows[0]?.amount}/${invRows[0]?.net_amount}/${invRows[0]?.paid_amount}`);
  check('DB: invoice status paid', invRows[0]?.status === 'paid', invRows[0]?.status);
  check('DB: invoice note mentions sale', (invRows[0]?.note ?? '').includes(stuSale.saleNumber), invRows[0]?.note);

  const { rows: items } = await pool.query(
    `SELECT description, amount FROM invoice_items WHERE tenant_id=$1 AND invoice_id=$2`, [ATLAS, stuSale.invoiceId],
  );
  check('DB: invoice item created', items.length === 1, JSON.stringify(items));
  check('DB: item description "Produit A × 2"', items[0]?.description === `Produit A ${mark} × 2`, items[0]?.description);
  check('DB: item amount = 120', Number(items[0]?.amount) === 120, `${items[0]?.amount}`);

  const { rows: pays } = await pool.query(
    `SELECT amount, payment_method, student_id FROM payments WHERE tenant_id=$1 AND invoice_id=$2`, [ATLAS, stuSale.invoiceId],
  );
  check('DB: payment row created', pays.length === 1, JSON.stringify(pays));
  check('DB: payment amount=120 method=cash student=STU-001', Number(pays[0]?.amount) === 120 && pays[0]?.payment_method === 'cash' && pays[0]?.student_id === STUDENT,
    `${pays[0]?.amount} ${pays[0]?.payment_method} ${pays[0]?.student_id}`);
  const { rows: allocs } = await pool.query(
    `SELECT allocated_amount FROM payment_allocations WHERE tenant_id=$1 AND invoice_id=$2`, [ATLAS, stuSale.invoiceId],
  );
  check('DB: payment allocation row', allocs.length === 1 && Number(allocs[0]?.allocated_amount) === 120, JSON.stringify(allocs));

  // student sale appears in finance history
  r = await api(admin.cookie, `/api/finance/invoices?studentId=${STUDENT}`);
  const finInv = (r.json?.data ?? []).find((i) => i.id === stuSale.invoiceId);
  check('finance list includes student sale invoice', Boolean(finInv), `status ${r.status} count ${(r.json?.data ?? []).length}`);
  check('finance invoice netAmount=120', finInv?.netAmount === 120, `${finInv?.netAmount}`);

  // ---- staff/guest counter sale → NO finance rows, local snapshot
  r = await api(admin.cookie, '/api/addons/inventory/sales', { method: 'POST', body: {
    storeId, saleToRole: 'guest', customerName: 'Client Comptoir Test', saleDate: SALE_TODAY,
    paidAmount: 120, paymentMethod: 'cash',
    lines: [{ productId: prodB, qty: '2', unitPrice: 60 }],
  } });
  check('guest sale → 201', r.status === 201, `status ${r.status}`);
  const guestSale = r.json?.data;
  check('guest sale has NO invoiceId', guestSale?.invoiceId === null, `invoiceId ${guestSale?.invoiceId}`);
  check('guest sale customerName stored', guestSale?.customerName === 'Client Comptoir Test', guestSale?.customerName);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodB}`);
  check('stock B=22 after guest sale (ratio irrelevant at sale)', Number(r.json?.data?.totalStock) === 22, `total ${r.json?.data?.totalStock}`);
  const { rows: guestInv } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %'`, [ATLAS],
  );
  check('DB: exactly 1 sale-invoice after guest sale (guest created none)', guestInv[0].c === 1, `count ${guestInv[0].c}`);

  // ---- partial-payment student sale → invoice status partial
  r = await api(admin.cookie, '/api/addons/inventory/sales', { method: 'POST', body: {
    storeId, saleToRole: 'student', studentId: STUDENT, saleDate: SALE_TODAY,
    paidAmount: 30, paymentMethod: 'card',
    lines: [{ productId: prodA, qty: '1', unitPrice: 60 }],
  } });
  const partialSale = r.json?.data;
  check('partial student sale → 201', r.status === 201, `status ${r.status}`);
  const { rows: partialInv } = await pool.query(
    `SELECT status, paid_amount, amount FROM invoices WHERE tenant_id=$1 AND id=$2`, [ATLAS, partialSale.invoiceId],
  );
  check('DB: partial invoice status=partial paid=30', partialInv[0]?.status === 'partial' && Number(partialInv[0]?.paid_amount) === 30,
    `${partialInv[0]?.status} ${partialInv[0]?.paid_amount}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('stock A=9 after partial sale', Number(r.json?.data?.totalStock) === 9, `total ${r.json?.data?.totalStock}`);

  // ---- idempotent retry (same idempotencyKey) → same sale, no double stock
  const retryKey = `retry-${runId}`;
  const retryBody = {
    storeId, saleToRole: 'guest', customerName: 'Client Retry Test', saleDate: SALE_TODAY,
    paidAmount: 60, paymentMethod: 'cash', idempotencyKey: retryKey,
    lines: [{ productId: prodA, qty: '1', unitPrice: 60 }],
  };
  r = await api(admin.cookie, '/api/addons/inventory/sales', { method: 'POST', body: retryBody });
  check('retry 1st → 201', r.status === 201, `status ${r.status}`);
  const retryFirst = r.json?.data;
  r = await api(admin.cookie, '/api/addons/inventory/sales', { method: 'POST', body: retryBody });
  check('retry 2nd → 201 same sale', r.status === 201 && r.json?.data?.id === retryFirst?.id, `status ${r.status} id ${r.json?.data?.id} vs ${retryFirst?.id}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('no double stock after retry (A=8)', Number(r.json?.data?.totalStock) === 8, `total ${r.json?.data?.totalStock}`);
  const { rows: retrySales } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_sales WHERE tenant_id=$1 AND idempotency_key=$2`, [ATLAS, retryKey],
  );
  check('DB: only 1 sale row for retry key', retrySales[0].c === 1, `count ${retrySales[0].c}`);

  // ---- negative-stock race: 2 concurrent sales of the last C unit
  const raceBody = {
    storeId, saleToRole: 'guest', customerName: 'Race Test', saleDate: SALE_TODAY,
    paidAmount: 10, paymentMethod: 'cash',
    lines: [{ productId: prodC, qty: '1', unitPrice: 10 }],
  };
  const [ra, rb] = await Promise.all([
    api(admin.cookie, '/api/addons/inventory/sales', { method: 'POST', body: raceBody }),
    api(admin.cookie, '/api/addons/inventory/sales', { method: 'POST', body: raceBody }),
  ]);
  const statuses = [ra.status, rb.status].sort();
  check('race: exactly one 201 and one 409', statuses[0] === 201 && statuses[1] === 409,
    `statuses ${ra.status}/${rb.status} codes ${ra.json?.error?.code}/${rb.json?.error?.code}`);
  check('race loser is INSUFFICIENT_STOCK', (ra.json?.error?.code ?? rb.json?.error?.code) === 'INSUFFICIENT_STOCK',
    `${ra.json?.error?.code}/${rb.json?.error?.code}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodC}`);
  check('stock C=0 after race (never negative)', Number(r.json?.data?.totalStock) === 0, `total ${r.json?.data?.totalStock}`);
  const { rows: raceMoves } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1 AND ref_type='sale' AND product_id=$2 AND movement_type='sale'`, [ATLAS, prodC],
  );
  check('DB: only 1 sale movement for C', raceMoves[0].c === 1, `count ${raceMoves[0].c}`);

  // ---- reversal restores stock exactly once
  r = await api(admin.cookie, `/api/addons/inventory/sales/${partialSale.id}/reverse`, { method: 'POST', body: { reason: 'Erreur de caisse' } });
  check('reverse student sale → 200', r.status === 200 && r.json?.data?.status === 'reversed', `status ${r.status}`);
  check('reversalReason stored', r.json?.data?.reversalReason === 'Erreur de caisse', r.json?.data?.reversalReason);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('stock A=9 after reversal (restored once)', Number(r.json?.data?.totalStock) === 9, `total ${r.json?.data?.totalStock}`);

  r = await api(admin.cookie, `/api/addons/inventory/sales/${partialSale.id}/reverse`, { method: 'POST', body: { reason: 'double' } });
  check('reverse again → idempotent 200', r.status === 200 && r.json?.data?.status === 'reversed', `status ${r.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('no double restore (A stays 9)', Number(r.json?.data?.totalStock) === 9, `total ${r.json?.data?.totalStock}`);

  const { rows: revMoves } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1 AND ref_id=$2 AND movement_type='sale_reversal'`, [ATLAS, partialSale.id],
  );
  check('DB: exactly 1 sale_reversal movement', revMoves[0].c === 1, `count ${revMoves[0].c}`);

  // documented deferral: reversed student invoice stays in Finance untouched
  const { rows: revInv } = await pool.query(
    `SELECT status, paid_amount FROM invoices WHERE tenant_id=$1 AND id=$2`, [ATLAS, partialSale.invoiceId],
  );
  check('DB: reversed sale invoice untouched (deferred credit note)', revInv[0]?.status === 'partial' && Number(revInv[0]?.paid_amount) === 30,
    `${revInv[0]?.status} ${revInv[0]?.paid_amount}`);

  // ---- cross-tenant isolation
  r = await api(langoAdmin.cookie, `/api/addons/inventory/sales/${stuSale.id}`);
  check('cross-tenant GET sale → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, `/api/addons/inventory/sales/${stuSale.id}/reverse`, { method: 'POST', body: {} });
  check('cross-tenant reverse sale → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, `/api/addons/inventory/sales`, { method: 'POST', body: {
    storeId, saleToRole: 'student', studentId: STUDENT, saleDate: SALE_TODAY,
    lines: [{ productId: prodA, qty: '1', unitPrice: 60 }],
  } });
  check('cross-tenant create sale → 422/404 (foreign store)', r.status === 422 || r.status === 404 || r.status === 403, `status ${r.status} code ${r.json?.error?.code}`);

  // ---- list + filters
  r = await api(admin.cookie, `/api/addons/inventory/sales?status=completed`);
  check('list completed sales includes ours', r.status === 200 && (r.json?.data ?? []).some((s) => s.id === stuSale.id), `count ${r.json?.data?.length}`);
  r = await api(admin.cookie, `/api/addons/inventory/sales?saleToRole=student`);
  check('list filter saleToRole=student', r.status === 200 && (r.json?.data ?? []).every((s) => s.saleToRole === 'student'), `count ${r.json?.data?.length}`);

  // ---- reconcile still green
  r = await api(admin.cookie, '/api/addons/inventory/stock/reconcile', { method: 'POST' });
  check('reconcile after sales → no drift', r.status === 200 && r.json?.data?.reconciled === true, JSON.stringify(r.json?.data));

  // ---- cleanup
  const saleIds = [stuSale.id, guestSale.id, partialSale.id, retryFirst.id];
  await pool.query(`DELETE FROM inventory_sale_lines WHERE tenant_id=$1 AND sale_id = ANY($2::uuid[])`, [ATLAS, saleIds]);
  await pool.query(`DELETE FROM inventory_sales WHERE tenant_id=$1 AND id = ANY($2::uuid[])`, [ATLAS, saleIds]);
  const raceIds = (await pool.query(
    `SELECT id FROM inventory_sales WHERE tenant_id=$1 AND customer_name IN ('Race Test', 'Client Retry Test')`, [ATLAS],
  )).rows.map((r) => r.id);
  if (raceIds.length > 0) {
    await pool.query(`DELETE FROM inventory_sale_lines WHERE tenant_id=$1 AND sale_id = ANY($2::uuid[])`, [ATLAS, raceIds]);
    await pool.query(`DELETE FROM inventory_sales WHERE tenant_id=$1 AND id = ANY($2::uuid[])`, [ATLAS, raceIds]);
  }
  await pool.query(`DELETE FROM inventory_stock_movements WHERE tenant_id=$1 AND product_id IN ($2,$3,$4)`, [ATLAS, prodA, prodB, prodC]);
  await pool.query(`DELETE FROM inventory_stock_balances WHERE tenant_id=$1 AND product_id IN ($2,$3,$4)`, [ATLAS, prodA, prodB, prodC]);
  await pool.query(`DELETE FROM inventory_purchase_lines WHERE tenant_id=$1 AND purchase_id=$2`, [ATLAS, purchase.id]);
  await pool.query(`DELETE FROM inventory_purchases WHERE tenant_id=$1 AND id=$2`, [ATLAS, purchase.id]);
  await pool.query(`DELETE FROM expenses WHERE tenant_id=$1 AND description LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM payment_allocations WHERE tenant_id=$1 AND invoice_id IN (SELECT id FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %')`, [ATLAS]);
  await pool.query(`DELETE FROM payments WHERE tenant_id=$1 AND invoice_id IN (SELECT id FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %')`, [ATLAS]);
  await pool.query(`DELETE FROM invoice_items WHERE tenant_id=$1 AND invoice_id IN (SELECT id FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %')`, [ATLAS]);
  await pool.query(`DELETE FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %'`, [ATLAS]);
  await pool.query(`DELETE FROM inventory_products WHERE tenant_id=$1 AND id IN ($2,$3,$4)`, [ATLAS, prodA, prodB, prodC]);
  await pool.query(`DELETE FROM inventory_categories WHERE tenant_id=$1 AND id=$2`, [ATLAS, catId]);
  await pool.query(`DELETE FROM inventory_units WHERE tenant_id=$1 AND id=$2`, [ATLAS, unitId]);
  await pool.query(`DELETE FROM inventory_stores WHERE tenant_id=$1 AND id=$2`, [ATLAS, storeId]);
  await pool.query(`DELETE FROM inventory_suppliers WHERE tenant_id=$1 AND id=$2`, [ATLAS, supId]);

  // ---- DB evidence: Lango untouched
  const { rows: langoSales } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_sales WHERE tenant_id=$1`, [LANGO]);
  const { rows: langoMoves } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1`, [LANGO]);
  const { rows: langoInvoices } = await pool.query(`SELECT COUNT(*)::int AS c FROM invoices WHERE tenant_id=$1 AND note LIKE 'Vente N° %'`, [LANGO]);
  check('DB: Lango has zero sales', langoSales[0].c === 0, `count ${langoSales[0].c}`);
  check('DB: Lango has zero movements', langoMoves[0].c === 0, `count ${langoMoves[0].c}`);
  check('DB: Lango has zero sale-invoices', langoInvoices[0].c === 0, `count ${langoInvoices[0].c}`);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => { console.error('FATAL', err); process.exit(1); });
