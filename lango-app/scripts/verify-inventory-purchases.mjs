// Live acceptance verification for inventory Phase 3 (purchasing & receiving).
// Hits the running dev server (default :3002), verifies real DB rows.
// Run: node scripts/verify-inventory-purchases.mjs
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
const runId = randomUUID().slice(0, 8);
const mark = `[verify-${runId}]`;

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', PASSWORD);
  const langoAdmin = await signIn('admin@lango.ma', PASSWORD);
  console.log('→ signed in as Atlas admin and Lango admin\n');

  // Idempotent cleanup of previous-run leftovers
  await pool.query(
    `DELETE FROM inventory_purchase_lines WHERE tenant_id=$1 AND purchase_id IN
       (SELECT id FROM inventory_purchases WHERE tenant_id=$1 AND notes=$2)`, [ATLAS, mark],
  );
  await pool.query(`DELETE FROM inventory_purchases WHERE tenant_id=$1 AND notes=$2`, [ATLAS, mark]);
  await pool.query(
    `DELETE FROM expenses WHERE tenant_id=$1 AND description LIKE '%Achat N° PUR-%' AND description LIKE '%[verify%'`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_stock_movements WHERE tenant_id=$1 AND ref_type='purchase' AND ref_id IN
       (SELECT id FROM inventory_purchases WHERE tenant_id=$1 AND notes=$2)`, [ATLAS, mark],
  );
  await pool.query(
    `DELETE FROM inventory_stock_balances WHERE tenant_id=$1 AND product_id IN
       (SELECT id FROM inventory_products WHERE tenant_id=$1 AND code LIKE '%[verify%')`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_products WHERE tenant_id=$1 AND code LIKE '%[verify%'`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_categories WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_units WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_suppliers WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS],
  );

  let r;
  // ---- build refs via API
  r = await api(admin.cookie, '/api/addons/inventory/categories', { method: 'POST', body: { name: `Catégorie ${mark}` } });
  const catId = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/units', { method: 'POST', body: { name: `Unité ${mark}`, abbreviation: 'U8' } });
  const unitId = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/stores', { method: 'POST', body: { name: `Magasin ${mark}`, code: `ST-${runId}` } });
  const storeId = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/suppliers', { method: 'POST', body: { name: `Fournisseur ${mark}` } });
  const supId = r.json?.data?.id;

  // two products: one simple (ratio 1, unit cost 45.50 × 12 qty), one case pack (ratio 12, qty 2 cartons)
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
  check('refs created (cat/unit/store/supplier/prodA/prodB)', Boolean(catId && unitId && storeId && supId && prodA && prodB), '');

  // ---- create purchase (ordered): no stock effect
  r = await api(admin.cookie, '/api/addons/inventory/purchases', {
    method: 'POST', body: {
      supplierId: supId, storeId, orderDate: new Date().toISOString().slice(0, 10), notes: mark,
      lines: [
        { productId: prodA, qtyInPurchaseUnit: '12', unitCost: 45.5 },
        { productId: prodB, qtyInPurchaseUnit: '2', unitCost: 500 },
      ],
    },
  });
  check('POST purchase → 201', r.status === 201, `status ${r.status}`);
  const purchase = r.json?.data;
  check('purchase starts as ordered', purchase?.status === 'ordered', `status ${purchase?.status}`);
  check('purchaseNumber PUR- format', /^PUR-\d{4}-\d{6}$/.test(purchase?.purchaseNumber ?? ''), purchase?.purchaseNumber);
  // netAmount = 12×45.50 + 2×500 = 546 + 1000 = 1546
  check('netAmount = 1546 (server cents math)', purchase?.netAmount === 1546, `net ${purchase?.netAmount}`);
  check('purchase has 2 lines', purchase?.lines?.length === 2, `lines ${purchase?.lines?.length}`);

  // ordered ⇒ stock untouched
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('ordered ≠ stock (product A balance 0)', Number(r.json?.data?.totalStock ?? 0) === 0, `total ${r.json?.data?.totalStock}`);

  // invalid foreign refs → 422
  r = await api(admin.cookie, '/api/addons/inventory/purchases', {
    method: 'POST', body: {
      supplierId: supId, storeId, orderDate: new Date().toISOString().slice(0, 10), notes: mark,
      lines: [{ productId: randomUUID(), qtyInPurchaseUnit: '1', unitCost: 5 }],
    },
  });
  check('unknown product ref → 422 INVALID_REF', r.status === 422 && r.json?.error?.code === 'INVALID_REF', `status ${r.status} code ${r.json?.error?.code}`);

  // ---- receive
  r = await api(admin.cookie, `/api/addons/inventory/purchases/${purchase.id}/receive`, { method: 'POST' });
  check('receive → 200', r.status === 200, `status ${r.status}`);
  check('receive flips status to received', r.json?.data?.status === 'received', `status ${r.json?.data?.status}`);
  check('receive stores expenseId', Boolean(r.json?.data?.expenseId), r.json?.data?.expenseId ?? 'none');
  const expenseId = r.json?.data?.expenseId;

  // stock = qtyInPurchaseUnit × unitRatio (A: 12×1=12, B: 2×12=24)
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('product A stock = 12 after receipt', Number(r.json?.data?.totalStock) === 12, `total ${r.json?.data?.totalStock}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodB}`);
  check('product B stock = 24 after receipt (ratio 12)', Number(r.json?.data?.totalStock) === 24, `total ${r.json?.data?.totalStock}`);

  // movements ledger: 2 receipt rows, positive
  r = await api(admin.cookie, `/api/addons/inventory/movements?refType=purchase&limit=10`);
  const recvRows = (r.json?.data?.rows ?? []).filter((m) => m.refId === purchase.id);
  check('2 receipt movements posted', recvRows.length === 2, `count ${recvRows.length}`);
  check('receipt movements positive', recvRows.every((m) => Number(m.qty) > 0), JSON.stringify(recvRows.map((m) => m.qty)));

  // expense row created (category supplies, amount = netAmount)
  const { rows: dbExp } = await pool.query(
    `SELECT id, category, amount, description FROM expenses WHERE tenant_id=$1 AND id=$2`, [ATLAS, expenseId],
  );
  check('DB: expense row created', dbExp.length === 1, JSON.stringify(dbExp));
  check('DB: expense category=supplies amount=1546', dbExp[0]?.category === 'supplies' && Number(dbExp[0]?.amount) === 1546,
    `${dbExp[0]?.category} ${dbExp[0]?.amount}`);
  check('DB: expense description mentions purchase', (dbExp[0]?.description ?? '').includes(purchase.purchaseNumber), dbExp[0]?.description);

  // ---- receive-once idempotency: second receive returns 200, no double stock
  r = await api(admin.cookie, `/api/addons/inventory/purchases/${purchase.id}/receive`, { method: 'POST' });
  check('second receive → 200 idempotent', r.status === 200 && r.json?.data?.status === 'received', `status ${r.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('no double stock after 2nd receive (A=12)', Number(r.json?.data?.totalStock) === 12, `total ${r.json?.data?.totalStock}`);
  const { rows: dbMov } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1 AND ref_type='purchase' AND ref_id=$2`, [ATLAS, purchase.id],
  );
  check('DB: only 2 receipt movements total', dbMov[0].c === 2, `count ${dbMov[0].c}`);

  // ---- reverse a received purchase → 409 (deferred)
  r = await api(admin.cookie, `/api/addons/inventory/purchases/${purchase.id}/reverse`, { method: 'POST' });
  check('reverse received purchase → 409 NOT_REVERSIBLE', r.status === 409 && r.json?.error?.code === 'NOT_REVERSIBLE', `status ${r.status} code ${r.json?.error?.code}`);

  // ---- reverse an ordered purchase → 200 (no stock effect)
  r = await api(admin.cookie, '/api/addons/inventory/purchases', {
    method: 'POST', body: {
      supplierId: supId, storeId, orderDate: new Date().toISOString().slice(0, 10), notes: mark,
      lines: [{ productId: prodA, qtyInPurchaseUnit: '3', unitCost: 10 }],
    },
  });
  const orderedPurchase = r.json?.data;
  r = await api(admin.cookie, `/api/addons/inventory/purchases/${orderedPurchase.id}/reverse`, { method: 'POST' });
  check('reverse ordered purchase → 200', r.status === 200 && r.json?.data?.status === 'reversed', `status ${r.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodA}`);
  check('ordered reverse leaves stock untouched (A=12)', Number(r.json?.data?.totalStock) === 12, `total ${r.json?.data?.totalStock}`);

  // ---- cross-tenant isolation
  r = await api(langoAdmin.cookie, `/api/addons/inventory/purchases/${purchase.id}`);
  check('cross-tenant GET purchase → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, `/api/addons/inventory/purchases/${purchase.id}/receive`, { method: 'POST' });
  check('cross-tenant receive → 404', r.status === 404, `status ${r.status}`);

  // ---- list filters
  r = await api(admin.cookie, `/api/addons/inventory/purchases?status=received`);
  check('list received purchases includes ours', r.status === 200 && (r.json?.data ?? []).some((p) => p.id === purchase.id), `count ${r.json?.data?.length}`);
  r = await api(admin.cookie, `/api/addons/inventory/purchases?supplierId=${supId}`);
  check('list by supplier filter works', r.status === 200 && (r.json?.data ?? []).every((p) => p.supplierId === supId), `count ${r.json?.data?.length}`);
  const recvInList = r.json?.data?.find((p) => p.id === purchase.id);
  check('list derives paymentStatus unpaid', recvInList?.paymentStatus === 'unpaid', `paymentStatus ${recvInList?.paymentStatus}`);

  // ---- reconcile still green: balance == Σmovements
  r = await api(admin.cookie, '/api/addons/inventory/stock/reconcile', { method: 'POST' });
  check('reconcile after receipts → no drift', r.status === 200 && r.json?.data?.reconciled === true, JSON.stringify(r.json?.data));

  // ---- cleanup
  await pool.query(`DELETE FROM inventory_purchase_lines WHERE tenant_id=$1 AND purchase_id=$2`, [ATLAS, purchase.id]);
  await pool.query(`DELETE FROM inventory_purchases WHERE tenant_id=$1 AND id=$2`, [ATLAS, purchase.id]);
  await pool.query(`DELETE FROM inventory_purchases WHERE tenant_id=$1 AND id=$2`, [ATLAS, orderedPurchase.id]);
  await pool.query(`DELETE FROM expenses WHERE tenant_id=$1 AND id=$2`, [ATLAS, expenseId]);
  await pool.query(`DELETE FROM inventory_stock_movements WHERE tenant_id=$1 AND ref_type='purchase' AND ref_id=$2`, [ATLAS, purchase.id]);
  await pool.query(`DELETE FROM inventory_stock_balances WHERE tenant_id=$1 AND product_id IN ($2,$3)`, [ATLAS, prodA, prodB]);
  await pool.query(`DELETE FROM inventory_products WHERE tenant_id=$1 AND id IN ($2,$3)`, [ATLAS, prodA, prodB]);
  await pool.query(`DELETE FROM inventory_categories WHERE tenant_id=$1 AND id=$2`, [ATLAS, catId]);
  await pool.query(`DELETE FROM inventory_units WHERE tenant_id=$1 AND id=$2`, [ATLAS, unitId]);
  await pool.query(`DELETE FROM inventory_stores WHERE tenant_id=$1 AND id=$2`, [ATLAS, storeId]);
  await pool.query(`DELETE FROM inventory_suppliers WHERE tenant_id=$1 AND id=$2`, [ATLAS, supId]);

  // ---- DB evidence: Lango untouched
  const { rows: langoPurchases } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_purchases WHERE tenant_id=$1`, [LANGO]);
  const { rows: langoMoves } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1`, [LANGO]);
  check('DB: Lango has zero purchases', langoPurchases[0].c === 0, `count ${langoPurchases[0].c}`);
  check('DB: Lango has zero movements', langoMoves[0].c === 0, `count ${langoMoves[0].c}`);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => { console.error('FATAL', err); process.exit(1); });
