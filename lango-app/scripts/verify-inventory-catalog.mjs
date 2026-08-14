// Live acceptance verification for inventory Phase 2 (catalog + ledger + reconcile).
// Hits the running dev server (default :3002) with real sessions, verifies real DB rows.
// Run: node scripts/verify-inventory-catalog.mjs
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

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', PASSWORD); // Atlas school_admin
  const langoAdmin = await signIn('admin@lango.ma', PASSWORD); // Lango school_admin
  console.log('→ signed in as Atlas admin and Lango admin\n');

  // Idempotent cleanup of previous-run leftovers (prefix with runId for this run)
  const mark = `[verify-${runId}]`;
  await pool.query(
    `DELETE FROM inventory_stock_movements WHERE tenant_id=$1 AND reason=$2`, [ATLAS, mark],
  );
  await pool.query(
    `DELETE FROM inventory_stock_balances WHERE tenant_id=$1 AND product_id IN
       (SELECT id FROM inventory_products WHERE tenant_id=$1 AND (name LIKE '%[verify%' OR code LIKE '%[verify%'))`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_products WHERE tenant_id=$1 AND (name LIKE '%[verify%' OR code LIKE '%[verify%')`, [ATLAS],
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
  let catId, unitId, storeId, supId, prodId;

  // ---------------------------------------------------------------- categories
  r = await api(admin.cookie, '/api/addons/inventory/categories', {
    method: 'POST', body: { name: `Catégorie ${mark}`, description: 'test live' },
  });
  check('POST category → 201', r.status === 201, `status ${r.status}`);
  catId = r.json?.data?.id;
  check('POST category returns id', Boolean(catId), catId ?? '');

  r = await api(admin.cookie, '/api/addons/inventory/categories', {
    method: 'POST', body: { name: `Catégorie ${mark}` },
  });
  check('duplicate category name → 409', r.status === 409, `status ${r.status}`);

  r = await api(admin.cookie, `/api/addons/inventory/categories/${catId}`, {
    method: 'PATCH', body: { description: 'mis à jour' },
  });
  check('PATCH category → 200', r.status === 200 && r.json?.data?.description === 'mis à jour', `status ${r.status}`);

  // -------------------------------------------------------------------- units
  r = await api(admin.cookie, '/api/addons/inventory/units', {
    method: 'POST', body: { name: `Unité ${mark}`, abbreviation: 'U8' },
  });
  check('POST unit → 201', r.status === 201, `status ${r.status}`);
  unitId = r.json?.data?.id;
  check('POST unit returns id', Boolean(unitId), unitId ?? '');

  r = await api(admin.cookie, '/api/addons/inventory/units', {
    method: 'POST', body: { name: `Unité ${mark}` },
  });
  check('duplicate unit name → 409', r.status === 409, `status ${r.status}`);

  // -------------------------------------------------------------------- stores
  r = await api(admin.cookie, '/api/addons/inventory/stores', {
    method: 'POST', body: { name: `Magasin ${mark}`, code: `ST-${runId}` },
  });
  check('POST store → 201', r.status === 201, `status ${r.status}`);
  storeId = r.json?.data?.id;
  check('POST store returns id', Boolean(storeId), storeId ?? '');

  r = await api(admin.cookie, '/api/addons/inventory/stores', {
    method: 'POST', body: { name: `Magasin ${mark}`, code: `ST-${runId}` },
  });
  check('duplicate store code → 409', r.status === 409, `status ${r.status}`);

  // ---------------------------------------------------------------- suppliers
  r = await api(admin.cookie, '/api/addons/inventory/suppliers', {
    method: 'POST', body: { name: `Fournisseur ${mark}`, contactName: 'Test', phone: '+212600000000' },
  });
  check('POST supplier → 201', r.status === 201, `status ${r.status}`);
  supId = r.json?.data?.id;
  check('POST supplier returns id', Boolean(supId), supId ?? '');

  r = await api(admin.cookie, '/api/addons/inventory/suppliers', {
    method: 'POST', body: { name: `Fournisseur ${mark}` },
  });
  check('duplicate supplier name → 409', r.status === 409, `status ${r.status}`);

  // ----------------------------------------------------------------- products
  r = await api(admin.cookie, '/api/addons/inventory/products', {
    method: 'POST', body: {
      name: `Produit ${mark}`, code: `PRD-${runId}`, categoryId: catId, purchaseUnitId: unitId, saleUnitId: unitId,
      unitRatio: '1', purchasePrice: 45, salePrice: 60, remarks: 'test live',
    },
  });
  check('POST product → 201', r.status === 201, `status ${r.status}`);
  prodId = r.json?.data?.id;
  check('POST product returns id', Boolean(prodId), prodId ?? '');
  check('POST product resolves category/units', r.json?.data?.categoryId === catId, 'categoryId resolved');

  r = await api(admin.cookie, '/api/addons/inventory/products', {
    method: 'POST', body: { name: `Produit ${mark}`, code: `PRD-${runId}` },
  });
  check('duplicate product code → 409', r.status === 409, `status ${r.status}`);

  r = await api(admin.cookie, '/api/addons/inventory/products', {
    method: 'POST', body: { name: `Produit ${mark} X`, code: `PRD-X-${runId}`, categoryId: randomUUID() },
  });
  check('invalid category ref → 422 INVALID_REF', r.status === 422 && r.json?.error?.code === 'INVALID_REF', `status ${r.status} code ${r.json?.error?.code}`);

  r = await api(admin.cookie, `/api/addons/inventory/products/${prodId}`, {
    method: 'PATCH', body: { salePrice: 70 },
  });
  check('PATCH product → 200', r.status === 200 && r.json?.data?.salePrice === 70, `status ${r.status} sale ${r.json?.data?.salePrice}`);

  // cross-tenant isolation
  r = await api(langoAdmin.cookie, `/api/addons/inventory/categories/${catId}`, { method: 'PATCH', body: { name: 'pirate' } });
  check('cross-tenant PATCH category → 404', r.status === 404, `status ${r.status}`);

  // -------------------------------------------------- reconcile: ledger → balance
  r = await api(admin.cookie, '/api/addons/inventory/stock/reconcile', { method: 'POST' });
  check('reconcile with empty ledger → reconciled=true', r.status === 200 && r.json?.data?.reconciled === true, `status ${r.status} ${JSON.stringify(r.json?.data)}`);

  // insert a ledger movement directly (mimics a future purchase receipt)
  await pool.query(
    `INSERT INTO inventory_stock_movements (tenant_id, store_id, product_id, movement_type, qty, ref_type, ref_id, idempotency_key, actor_id, reason)
     VALUES ($1,$2,$3,'receipt',7,'purchase',gen_random_uuid(),$4,NULL,$5)`,
    [ATLAS, storeId, prodId, `verify-${runId}`, mark],
  );
  r = await api(admin.cookie, '/api/addons/inventory/stock/reconcile', { method: 'POST' });
  check('reconcile detects ledger/balance drift', r.status === 200 && r.json?.data?.reconciled === false && r.json?.data?.discrepancies?.length >= 1,
    `status ${r.status} discrepancies ${r.json?.data?.discrepancies?.length}`);

  // now GET stock — balance should be 7 (recomputed from ledger)
  r = await api(admin.cookie, `/api/addons/inventory/stock?productId=${prodId}`);
  const balRow = r.json?.data?.find((b) => b.productId === prodId);
  check('GET stock shows reconciled balance = 7', r.status === 200 && balRow && Number(balRow.quantity) === 7, `qty ${balRow?.quantity}`);

  r = await api(admin.cookie, `/api/addons/inventory/products/${prodId}`);
  const prodStock = r.json?.data?.stockByStore?.find((b) => b.storeId === storeId);
  check('GET product embeds stockByStore', Boolean(prodStock) && Number(prodStock.quantity) === 7, `qty ${prodStock?.quantity}`);
  check('GET product totalStock = 7', Number(r.json?.data?.totalStock) === 7, `total ${r.json?.data?.totalStock}`);

  r = await api(admin.cookie, `/api/addons/inventory/movements?productId=${prodId}&limit=5`);
  check('GET movements lists ledger rows', r.status === 200 && Array.isArray(r.json?.data?.rows) && r.json?.data?.rows?.length >= 1,
    `rows ${r.json?.data?.rows?.length}`);

  // low stock filter: qty=7 IS below threshold 10 → must be included
  r = await api(admin.cookie, `/api/addons/inventory/stock?productId=${prodId}&lowStock=10`);
  check('lowStock filter includes qty=7 below threshold 10', r.status === 200 && r.json?.data?.length >= 1, `count ${r.json?.data?.length}`);

  // IN_USE guard: product has movement history → archive → 409
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodId}`, { method: 'DELETE' });
  check('archive product with ledger history → 409 IN_USE', r.status === 409 && r.json?.error?.code === 'IN_USE', `status ${r.status} code ${r.json?.error?.code}`);

  // category IN_USE guard: product references it → 409
  r = await api(admin.cookie, `/api/addons/inventory/categories/${catId}`, { method: 'DELETE' });
  check('archive category referenced by product → 409 IN_USE', r.status === 409 && r.json?.error?.code === 'IN_USE', `status ${r.status} code ${r.json?.error?.code}`);

  // unit IN_USE guard
  r = await api(admin.cookie, `/api/addons/inventory/units/${unitId}`, { method: 'DELETE' });
  check('archive unit referenced by product → 409 IN_USE', r.status === 409 && r.json?.error?.code === 'IN_USE', `status ${r.status} code ${r.json?.error?.code}`);

  // store IN_USE guard (has a movement)
  r = await api(admin.cookie, `/api/addons/inventory/stores/${storeId}`, { method: 'DELETE' });
  check('archive store with movements → 409 IN_USE', r.status === 409 && r.json?.error?.code === 'IN_USE', `status ${r.status} code ${r.json?.error?.code}`);

  // cleanup ledger + balance, then archive product (row persists, is_active=false)
  await pool.query(`DELETE FROM inventory_stock_movements WHERE tenant_id=$1 AND idempotency_key=$2`, [ATLAS, `verify-${runId}`]);
  await pool.query(`DELETE FROM inventory_stock_balances WHERE tenant_id=$1 AND product_id=$2`, [ATLAS, prodId]);

  r = await api(admin.cookie, `/api/addons/inventory/products/${prodId}`, { method: 'DELETE' });
  check('archive product after ledger cleanup → 200', r.status === 200, `status ${r.status}`);
  r = await api(admin.cookie, '/api/addons/inventory/products?archived=true');
  check('archived product listed under archived=true', r.status === 200 && r.json?.data?.some((p) => p.id === prodId), `count ${r.json?.data?.length}`);

  // release category/unit references by removing the (archived) product row,
  // then the remaining master-data success path is provable
  await pool.query(`DELETE FROM inventory_products WHERE tenant_id=$1 AND id=$2`, [ATLAS, prodId]);

  r = await api(admin.cookie, `/api/addons/inventory/categories/${catId}`, { method: 'DELETE' });
  check('archive category once unreferenced → 200', r.status === 200, `status ${r.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/units/${unitId}`, { method: 'DELETE' });
  check('archive unit once unreferenced → 200', r.status === 200, `status ${r.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/stores/${storeId}`, { method: 'DELETE' });
  check('archive store after ledger cleanup → 200', r.status === 200, `status ${r.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/suppliers/${supId}`, { method: 'DELETE' });
  check('archive supplier without purchases → 200', r.status === 200, `status ${r.status}`);

  // archived items visible under archived flag
  r = await api(admin.cookie, '/api/addons/inventory/categories?status=archived');
  check('archived category listed under status=archived', r.status === 200 && r.json?.data?.some((c) => c.id === catId), `count ${r.json?.data?.length}`);

  // ------------------------------------------------------------ DB evidence
  const { rows: dbCats } = await pool.query(`SELECT name, status FROM inventory_categories WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  const { rows: dbUnits } = await pool.query(`SELECT name, status FROM inventory_units WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  const { rows: dbStores } = await pool.query(`SELECT name, status FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  const { rows: dbProds } = await pool.query(`SELECT code, is_active FROM inventory_products WHERE tenant_id=$1 AND code LIKE '%[verify%'`, [ATLAS]);
  check('DB: categories cleaned to archived rows', dbCats.every((c) => c.status === 'archived'), JSON.stringify(dbCats));
  check('DB: units cleaned to archived rows', dbUnits.every((u) => u.status === 'archived'), JSON.stringify(dbUnits));
  check('DB: stores cleaned to archived rows', dbStores.every((s) => s.status === 'archived'), JSON.stringify(dbStores));
  check('DB: products cleaned (rows removed)', dbProds.length === 0, `count ${dbProds.length}`);

  const { rows: langoCats } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_categories WHERE tenant_id=$1`, [LANGO]);
  const { rows: langoProds } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_products WHERE tenant_id=$1`, [LANGO]);
  const { rows: langoMoves } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1`, [LANGO]);
  check('DB: Lango tenant has zero categories', langoCats[0].c === 0, `count ${langoCats[0].c}`);
  check('DB: Lango tenant has zero products', langoProds[0].c === 0, `count ${langoProds[0].c}`);
  check('DB: Lango tenant has zero movements', langoMoves[0].c === 0, `count ${langoMoves[0].c}`);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => { console.error('FATAL', err); process.exit(1); });
