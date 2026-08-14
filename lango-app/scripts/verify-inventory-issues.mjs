// Live acceptance verification for inventory Phase 5 (Issues + Adjustments + Transfers).
// Hits the running dev server (default :3002), verifies real DB rows.
// Run: node scripts/verify-inventory-issues.mjs
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
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const NEXT_WEEK = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', PASSWORD);
  const langoAdmin = await signIn('admin@lango.ma', PASSWORD);
  console.log('→ signed in as Atlas admin and Lango admin\n');

  // ---- idempotent cleanup of previous-run leftovers
  await pool.query(
    `DELETE FROM inventory_issue_lines WHERE tenant_id=$1 AND issue_id IN
       (SELECT id FROM inventory_issues WHERE tenant_id=$1 AND store_id IN
         (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%'))`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_issues WHERE tenant_id=$1 AND store_id IN
       (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_adjustment_lines WHERE tenant_id=$1 AND adjustment_id IN
       (SELECT id FROM inventory_adjustments WHERE tenant_id=$1 AND store_id IN
         (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%'))`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_adjustments WHERE tenant_id=$1 AND store_id IN
       (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_transfer_lines WHERE tenant_id=$1 AND transfer_id IN
       (SELECT id FROM inventory_transfers WHERE tenant_id=$1 AND from_store_id IN
         (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%'))`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_transfer_lines WHERE tenant_id=$1 AND transfer_id IN
       (SELECT id FROM inventory_transfers WHERE tenant_id=$1 AND to_store_id IN
         (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%'))`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_transfers WHERE tenant_id=$1 AND (from_store_id IN
       (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%') OR to_store_id IN
       (SELECT id FROM inventory_stores WHERE tenant_id=$1 AND name LIKE '%[verify%'))`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_stock_movements WHERE tenant_id=$1 AND product_id IN
       (SELECT id FROM inventory_products WHERE tenant_id=$1 AND remarks LIKE '%[verify%')`, [ATLAS],
  );
  await pool.query(
    `DELETE FROM inventory_stock_balances WHERE tenant_id=$1 AND product_id IN
       (SELECT id FROM inventory_products WHERE tenant_id=$1 AND remarks LIKE '%[verify%')`, [ATLAS],
  );
  await pool.query(`DELETE FROM inventory_purchase_lines WHERE tenant_id=$1 AND purchase_id IN
       (SELECT id FROM inventory_purchases WHERE tenant_id=$1 AND notes LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM inventory_purchases WHERE tenant_id=$1 AND notes LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM inventory_products WHERE tenant_id=$1 AND remarks LIKE '%[verify%'`, [ATLAS]);
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
  const store1 = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/stores', { method: 'POST', body: { name: `Magasin 2 ${mark}`, code: `ST2-${runId}` } });
  const store2 = r.json?.data?.id;
  r = await api(admin.cookie, '/api/addons/inventory/suppliers', { method: 'POST', body: { name: `Fournisseur ${mark}` } });
  const supId = r.json?.data?.id;

  const makeProduct = async (name, code) => {
    r = await api(admin.cookie, '/api/addons/inventory/products', { method: 'POST', body: {
      name, code, categoryId: catId, purchaseUnitId: unitId, saleUnitId: unitId,
      unitRatio: '1', purchasePrice: 10, salePrice: 20, remarks: mark,
    } });
    return r.json?.data?.id;
  };
  const prodX = await makeProduct(`Produit X ${mark}`, `PRD-X-${runId}`);
  const prodY = await makeProduct(`Produit Y ${mark}`, `PRD-Y-${runId}`);
  const prodZ = await makeProduct(`Produit Z ${mark}`, `PRD-Z-${runId}`);
  check('refs + 2 stores + 3 products created', Boolean(catId && unitId && store1 && store2 && supId && prodX && prodY && prodZ), '');

  // stock X=20, Y=20, Z=20 all at store1
  r = await api(admin.cookie, '/api/addons/inventory/purchases', { method: 'POST', body: {
    supplierId: supId, storeId: store1, orderDate: TODAY, notes: mark,
    lines: [
      { productId: prodX, qtyInPurchaseUnit: '20', unitCost: 10 },
      { productId: prodY, qtyInPurchaseUnit: '20', unitCost: 10 },
      { productId: prodZ, qtyInPurchaseUnit: '20', unitCost: 10 },
    ],
  } });
  const purchase = r.json?.data;
  r = await api(admin.cookie, `/api/addons/inventory/purchases/${purchase.id}/receive`, { method: 'POST' });
  check('receive → 200', r.status === 200 && r.json?.data?.status === 'received', `status ${r.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('starting stock X=20', Number(r.json?.data?.totalStock) === 20, `total ${r.json?.data?.totalStock}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodY}`);
  check('starting stock Y=20', Number(r.json?.data?.totalStock) === 20, `total ${r.json?.data?.totalStock}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodZ}`);
  check('starting stock Z=20 at store1, 0 at store2', Number(r.json?.data?.totalStock) === 20 && Number((r.json?.data?.stockByStore ?? []).find(s => s.storeId === store2)?.quantity ?? 0) === 0,
    `total ${r.json?.data?.totalStock}`);

  // ======================================================================
  // ISSUES (product X @ store1)
  // ======================================================================
  const issueIds = [];

  // i1: guest issue 5×X
  r = await api(admin.cookie, '/api/addons/inventory/issues', { method: 'POST', body: {
    storeId: store1, issueToRole: 'guest', issueToName: 'Bénéficiaire Comptoir Test', issueDate: TODAY, dueDate: NEXT_WEEK,
    lines: [{ productId: prodX, qty: '5' }],
  } });
  check('guest issue → 201', r.status === 201, `status ${r.status}`);
  const i1 = r.json?.data;
  issueIds.push(i1.id);
  check('issue starts issued', i1?.status === 'issued', i1?.status);
  check('issueNumber ISS- format', /^ISS-\d{4}-\d{6}$/.test(i1?.issueNumber ?? ''), i1?.issueNumber);
  check('guest issue has no student', i1?.studentId === null && i1?.issueToName === 'Bénéficiaire Comptoir Test', `student ${i1?.studentId} name ${i1?.issueToName}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('stock X=15 after guest issue', Number(r.json?.data?.totalStock) === 15, `total ${r.json?.data?.totalStock}`);

  // return i1 (returned) → stock restored
  r = await api(admin.cookie, `/api/addons/inventory/issues/${i1.id}/return`, { method: 'POST', body: { disposition: 'returned', reason: 'Fin de prêt' } });
  check('return issued → 200', r.status === 200 && r.json?.data?.status === 'returned', `status ${r.status}/${r.json?.data?.status}`);
  check('returnDate set on return', Boolean(r.json?.data?.returnDate), r.json?.data?.returnDate);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('stock X=20 after return', Number(r.json?.data?.totalStock) === 20, `total ${r.json?.data?.totalStock}`);
  r = await api(admin.cookie, `/api/addons/inventory/issues/${i1.id}/return`, { method: 'POST', body: { disposition: 'returned', reason: 'double' } });
  check('return again → idempotent 200 returned', r.status === 200 && r.json?.data?.status === 'returned', `status ${r.status}`);
  const { rows: i1RetMoves } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1 AND ref_id=$2 AND movement_type='issue_return'`, [ATLAS, i1.id],
  );
  check('DB: exactly 1 issue_return movement for i1', i1RetMoves[0].c === 1, `count ${i1RetMoves[0].c}`);

  // i2: student issue 3×X
  r = await api(admin.cookie, '/api/addons/inventory/issues', { method: 'POST', body: {
    storeId: store1, issueToRole: 'student', studentId: STUDENT, issueDate: TODAY, dueDate: NEXT_WEEK,
    lines: [{ productId: prodX, qty: '3' }],
  } });
  check('student issue → 201', r.status === 201, `status ${r.status}`);
  const i2 = r.json?.data;
  issueIds.push(i2.id);
  check('student issue resolves studentName', i2?.studentName === 'Yassine El Amrani', i2?.studentName);
  check('student issue isOverdue false (due next week)', i2?.isOverdue === false, `overdue ${i2?.isOverdue}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('stock X=17 after student issue', Number(r.json?.data?.totalStock) === 17, `total ${r.json?.data?.totalStock}`);

  // i3: overdue issue (due yesterday), never returned
  r = await api(admin.cookie, '/api/addons/inventory/issues', { method: 'POST', body: {
    storeId: store1, issueToRole: 'guest', issueToName: 'Retardataire Test', issueDate: TODAY, dueDate: YESTERDAY,
    lines: [{ productId: prodX, qty: '2' }],
  } });
  check('overdue-due issue → 201', r.status === 201, `status ${r.status}`);
  const i3 = r.json?.data;
  issueIds.push(i3.id);
  r = await api(admin.cookie, `/api/addons/inventory/issues/${i3.id}`);
  check('issue isOverdue true (due yesterday)', r.json?.data?.isOverdue === true, `overdue ${r.json?.data?.isOverdue}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('stock X=15 after overdue issue', Number(r.json?.data?.totalStock) === 15, `total ${r.json?.data?.totalStock}`);

  // i4: damaged — units leave at issue, damage records disposition only (no extra movement)
  r = await api(admin.cookie, '/api/addons/inventory/issues', { method: 'POST', body: {
    storeId: store1, issueToRole: 'guest', issueToName: 'Abîme Test', issueDate: TODAY, dueDate: NEXT_WEEK,
    lines: [{ productId: prodX, qty: '2' }],
  } });
  const i4 = r.json?.data;
  issueIds.push(i4.id);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('stock X=13 after damaged issue', Number(r.json?.data?.totalStock) === 13, `total ${r.json?.data?.totalStock}`);
  r = await api(admin.cookie, `/api/addons/inventory/issues/${i4.id}/return`, { method: 'POST', body: { disposition: 'damaged', reason: 'Cassé' } });
  check('return damaged → 200 status damaged', r.status === 200 && r.json?.data?.status === 'damaged', `status ${r.status}/${r.json?.data?.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('stock X=13 unchanged after damage disposition', Number(r.json?.data?.totalStock) === 13, `total ${r.json?.data?.totalStock}`);
  const { rows: i4RetMoves } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1 AND ref_id=$2 AND movement_type='issue_return'`, [ATLAS, i4.id],
  );
  check('DB: no issue_return movement for damaged (deviation §10)', i4RetMoves[0].c === 0, `count ${i4RetMoves[0].c}`);

  // i5: lost — same disposition-only rule
  r = await api(admin.cookie, '/api/addons/inventory/issues', { method: 'POST', body: {
    storeId: store1, issueToRole: 'guest', issueToName: 'Perte Test', issueDate: TODAY, dueDate: NEXT_WEEK,
    lines: [{ productId: prodX, qty: '1' }],
  } });
  const i5 = r.json?.data;
  issueIds.push(i5.id);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('stock X=12 after lost issue', Number(r.json?.data?.totalStock) === 12, `total ${r.json?.data?.totalStock}`);
  r = await api(admin.cookie, `/api/addons/inventory/issues/${i5.id}/return`, { method: 'POST', body: { disposition: 'lost', reason: 'Perdu par l\'élève' } });
  check('return lost → 200 status lost', r.status === 200 && r.json?.data?.status === 'lost', `status ${r.status}/${r.json?.data?.status}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('stock X=12 unchanged after loss disposition', Number(r.json?.data?.totalStock) === 12, `total ${r.json?.data?.totalStock}`);

  // i6: insufficient stock → 409
  r = await api(admin.cookie, '/api/addons/inventory/issues', { method: 'POST', body: {
    storeId: store1, issueToRole: 'guest', issueToName: 'Rupture Test', issueDate: TODAY, dueDate: NEXT_WEEK,
    lines: [{ productId: prodX, qty: '100' }],
  } });
  check('issue 100×X → 409 INSUFFICIENT_STOCK', r.status === 409 && r.json?.error?.code === 'INSUFFICIENT_STOCK', `status ${r.status} code ${r.json?.error?.code}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('stock X=12 after rejected issue', Number(r.json?.data?.totalStock) === 12, `total ${r.json?.data?.totalStock}`);

  // i7: idempotent retry (same idempotencyKey) → same doc, single movement
  const issKey = `iss-retry-${runId}`;
  const issBody = {
    storeId: store1, issueToRole: 'guest', issueToName: 'Retry Prêt Test', issueDate: TODAY, dueDate: NEXT_WEEK,
    idempotencyKey: issKey, lines: [{ productId: prodX, qty: '1' }],
  };
  r = await api(admin.cookie, '/api/addons/inventory/issues', { method: 'POST', body: issBody });
  check('issue retry 1st → 201', r.status === 201, `status ${r.status}`);
  const i7 = r.json?.data;
  issueIds.push(i7.id);
  r = await api(admin.cookie, '/api/addons/inventory/issues', { method: 'POST', body: issBody });
  check('issue retry 2nd → 201 same id', r.status === 201 && r.json?.data?.id === i7?.id, `status ${r.status} id ${r.json?.data?.id} vs ${i7?.id}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodX}`);
  check('no double stock after issue retry (X=11)', Number(r.json?.data?.totalStock) === 11, `total ${r.json?.data?.totalStock}`);
  const { rows: issKeyRows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_issues WHERE tenant_id=$1 AND idempotency_key=$2`, [ATLAS, issKey],
  );
  check('DB: only 1 issue row for retry key', issKeyRows[0].c === 1, `count ${issKeyRows[0].c}`);

  // ---- list + filters (issues)
  r = await api(admin.cookie, `/api/addons/inventory/issues?status=issued`);
  const issuedList = r.json?.data ?? [];
  check('list issues?status=issued includes i2 & i3 only', r.status === 200 && issuedList.some(x => x.id === i2.id) && issuedList.some(x => x.id === i3.id) && !issuedList.some(x => x.id === i1.id) && !issuedList.some(x => x.id === i4.id),
    `count ${issuedList.length}`);
  r = await api(admin.cookie, `/api/addons/inventory/issues?issueToRole=student`);
  check('list filter issueToRole=student', r.status === 200 && (r.json?.data ?? []).every(x => x.issueToRole === 'student'), `count ${r.json?.data?.length}`);

  // ======================================================================
  // ADJUSTMENTS (product Y @ store1)
  // ======================================================================
  const adjIds = [];

  // a1: adjustment_in 4×Y (count correction)
  r = await api(admin.cookie, '/api/addons/inventory/adjustments', { method: 'POST', body: {
    storeId: store1, type: 'count_correction', reason: 'Inventaire tournant', lines: [{ productId: prodY, direction: 'in', qty: '4' }],
  } });
  check('adjustment in → 201', r.status === 201, `status ${r.status}`);
  const a1 = r.json?.data;
  adjIds.push(a1.id);
  check('adjustmentNumber ADJ- format', /^ADJ-\d{4}-\d{6}$/.test(a1?.adjustmentNumber ?? ''), a1?.adjustmentNumber);
  check('adjustment status applied', a1?.status === 'applied', a1?.status);
  check('adjustment type stored', a1?.type === 'count_correction', a1?.type);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodY}`);
  check('stock Y=24 after adjustment_in', Number(r.json?.data?.totalStock) === 24, `total ${r.json?.data?.totalStock}`);

  // a2: adjustment_out 3×Y (loss)
  r = await api(admin.cookie, '/api/addons/inventory/adjustments', { method: 'POST', body: {
    storeId: store1, type: 'loss', reason: 'Casse', lines: [{ productId: prodY, direction: 'out', qty: '3' }],
  } });
  const a2 = r.json?.data;
  adjIds.push(a2.id);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodY}`);
  check('stock Y=21 after adjustment_out', Number(r.json?.data?.totalStock) === 21, `total ${r.json?.data?.totalStock}`);

  // a3: insufficient out → 409
  r = await api(admin.cookie, '/api/addons/inventory/adjustments', { method: 'POST', body: {
    storeId: store1, type: 'write_off', reason: 'Trop', lines: [{ productId: prodY, direction: 'out', qty: '100' }],
  } });
  check('adjustment out 100×Y → 409 INSUFFICIENT_STOCK', r.status === 409 && r.json?.error?.code === 'INSUFFICIENT_STOCK', `status ${r.status} code ${r.json?.error?.code}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodY}`);
  check('stock Y=21 after rejected adjustment', Number(r.json?.data?.totalStock) === 21, `total ${r.json?.data?.totalStock}`);

  // a4: idempotent retry (adjustment_in 2×Y)
  const adjKey = `adj-retry-${runId}`;
  const adjBody = {
    storeId: store1, type: 'count_correction', reason: 'Retry', idempotencyKey: adjKey,
    lines: [{ productId: prodY, direction: 'in', qty: '2' }],
  };
  r = await api(admin.cookie, '/api/addons/inventory/adjustments', { method: 'POST', body: adjBody });
  const a4 = r.json?.data;
  adjIds.push(a4.id);
  r = await api(admin.cookie, '/api/addons/inventory/adjustments', { method: 'POST', body: adjBody });
  check('adjustment retry → 201 same id', r.status === 201 && r.json?.data?.id === a4?.id, `status ${r.status} id ${r.json?.data?.id} vs ${a4?.id}`);
  r = await api(admin.cookie, `/api/addons/inventory/products/${prodY}`);
  check('no double stock after adjustment retry (Y=23)', Number(r.json?.data?.totalStock) === 23, `total ${r.json?.data?.totalStock}`);
  const { rows: adjKeyRows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_adjustments WHERE tenant_id=$1 AND idempotency_key=$2`, [ATLAS, adjKey],
  );
  check('DB: only 1 adjustment row for retry key', adjKeyRows[0].c === 1, `count ${adjKeyRows[0].c}`);

  // ---- list + filters (adjustments)
  r = await api(admin.cookie, `/api/addons/inventory/adjustments?type=loss`);
  check('list adjustments?type=loss includes a2', r.status === 200 && (r.json?.data ?? []).some(x => x.id === a2.id), `count ${r.json?.data?.length}`);

  // ======================================================================
  // TRANSFERS (product Z, store1 → store2)
  // ======================================================================
  const trfIds = [];
  const zq = async () => {
    r = await api(admin.cookie, `/api/addons/inventory/products/${prodZ}`);
    const sbs = r.json?.data?.stockByStore ?? [];
    const q = (sid) => Number(sbs.find(s => s.storeId === sid)?.quantity ?? 0);
    return { s1: q(store1), s2: q(store2) };
  };

  // t1: create pending (no stock effect), then complete → paired movements
  r = await api(admin.cookie, '/api/addons/inventory/transfers', { method: 'POST', body: {
    fromStoreId: store1, toStoreId: store2, reason: 'Réappro magasin 2', lines: [{ productId: prodZ, qty: '5' }],
  } });
  check('create transfer → 201', r.status === 201, `status ${r.status}`);
  const t1 = r.json?.data;
  trfIds.push(t1.id);
  check('transfer starts pending', t1?.status === 'pending', t1?.status);
  check('transferNumber TRF- format', /^TRF-\d{4}-\d{6}$/.test(t1?.transferNumber ?? ''), t1?.transferNumber);
  check('transfer has from/to store names', t1?.fromStoreName && t1?.toStoreName && t1?.fromStoreName !== t1?.toStoreName, `${t1?.fromStoreName} → ${t1?.toStoreName}`);
  let z = await zq();
  check('pending transfer has NO stock effect (Z s1=20 s2=0)', z.s1 === 20 && z.s2 === 0, `s1 ${z.s1} s2 ${z.s2}`);

  r = await api(admin.cookie, `/api/addons/inventory/transfers/${t1.id}/complete`, { method: 'POST' });
  check('complete transfer → 200 completed', r.status === 200 && r.json?.data?.status === 'completed', `status ${r.status}/${r.json?.data?.status}`);
  check('completedAt set', Boolean(r.json?.data?.completedAt), r.json?.data?.completedAt);
  z = await zq();
  check('stock moved Z s1=15 s2=5', z.s1 === 15 && z.s2 === 5, `s1 ${z.s1} s2 ${z.s2}`);

  r = await api(admin.cookie, `/api/addons/inventory/transfers/${t1.id}/complete`, { method: 'POST' });
  check('complete again → idempotent 200 completed', r.status === 200 && r.json?.data?.status === 'completed', `status ${r.status}`);
  z = await zq();
  check('no double move after complete retry (Z s1=15 s2=5)', z.s1 === 15 && z.s2 === 5, `s1 ${z.s1} s2 ${z.s2}`);
  const { rows: t1Out } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1 AND ref_id=$2 AND movement_type='transfer_out'`, [ATLAS, t1.id],
  );
  const { rows: t1In } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1 AND ref_id=$2 AND movement_type='transfer_in'`, [ATLAS, t1.id],
  );
  check('DB: exactly 1 transfer_out + 1 transfer_in for t1', t1Out[0].c === 1 && t1In[0].c === 1, `out ${t1Out[0].c} in ${t1In[0].c}`);

  // t2: cancel pending, then complete → 409 TRANSFER_CANCELLED
  r = await api(admin.cookie, '/api/addons/inventory/transfers', { method: 'POST', body: {
    fromStoreId: store1, toStoreId: store2, reason: 'Annulé bientôt', lines: [{ productId: prodZ, qty: '6' }],
  } });
  const t2 = r.json?.data;
  trfIds.push(t2.id);
  r = await api(admin.cookie, `/api/addons/inventory/transfers/${t2.id}/cancel`, { method: 'POST' });
  check('cancel pending → 200 reversed', r.status === 200 && r.json?.data?.status === 'reversed', `status ${r.status}/${r.json?.data?.status}`);
  check('cancelledAt set', Boolean(r.json?.data?.cancelledAt), r.json?.data?.cancelledAt);
  r = await api(admin.cookie, `/api/addons/inventory/transfers/${t2.id}/complete`, { method: 'POST' });
  check('complete cancelled → 409 TRANSFER_CANCELLED', r.status === 409 && r.json?.error?.code === 'TRANSFER_CANCELLED', `status ${r.status} code ${r.json?.error?.code}`);

  // t3: created pending (no stock check), fails at complete → stays pending
  r = await api(admin.cookie, '/api/addons/inventory/transfers', { method: 'POST', body: {
    fromStoreId: store1, toStoreId: store2, reason: 'Rupture à compléter', lines: [{ productId: prodZ, qty: '100' }],
  } });
  check('create transfer 100×Z → 201 pending (no stock check)', r.status === 201 && r.json?.data?.status === 'pending', `status ${r.status}`);
  const t3 = r.json?.data;
  trfIds.push(t3.id);
  r = await api(admin.cookie, `/api/addons/inventory/transfers/${t3.id}/complete`, { method: 'POST' });
  check('complete 100×Z → 409 INSUFFICIENT_STOCK', r.status === 409 && r.json?.error?.code === 'INSUFFICIENT_STOCK', `status ${r.status} code ${r.json?.error?.code}`);
  r = await api(admin.cookie, `/api/addons/inventory/transfers/${t3.id}`);
  check('failed complete leaves status pending', r.json?.data?.status === 'pending', r.json?.data?.status);
  r = await api(admin.cookie, `/api/addons/inventory/transfers/${t3.id}/cancel`, { method: 'POST' });
  check('cancel failed-transfer → 200 reversed', r.status === 200 && r.json?.data?.status === 'reversed', `status ${r.status}`);
  z = await zq();
  check('no stock effect from cancelled transfer (Z s1=15 s2=5)', z.s1 === 15 && z.s2 === 5, `s1 ${z.s1} s2 ${z.s2}`);

  // from == to → 422
  r = await api(admin.cookie, '/api/addons/inventory/transfers', { method: 'POST', body: {
    fromStoreId: store1, toStoreId: store1, reason: 'Erreur', lines: [{ productId: prodZ, qty: '1' }],
  } });
  check('transfer from==to → 422 INVALID_REF', r.status === 422 && r.json?.error?.code === 'INVALID_REF', `status ${r.status} code ${r.json?.error?.code}`);

  // t4: idempotent create retry
  const trfKey = `trf-retry-${runId}`;
  const trfBody = {
    fromStoreId: store1, toStoreId: store2, reason: 'Retry', idempotencyKey: trfKey,
    lines: [{ productId: prodZ, qty: '1' }],
  };
  r = await api(admin.cookie, '/api/addons/inventory/transfers', { method: 'POST', body: trfBody });
  const t4 = r.json?.data;
  trfIds.push(t4.id);
  r = await api(admin.cookie, '/api/addons/inventory/transfers', { method: 'POST', body: trfBody });
  check('transfer create retry → 201 same id', r.status === 201 && r.json?.data?.id === t4?.id, `status ${r.status} id ${r.json?.data?.id} vs ${t4?.id}`);
  const { rows: trfKeyRows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inventory_transfers WHERE tenant_id=$1 AND idempotency_key=$2`, [ATLAS, trfKey],
  );
  check('DB: only 1 transfer row for retry key', trfKeyRows[0].c === 1, `count ${trfKeyRows[0].c}`);
  r = await api(admin.cookie, `/api/addons/inventory/transfers/${t4.id}/cancel`, { method: 'POST' });
  check('cancel t4 → 200 reversed', r.status === 200 && r.json?.data?.status === 'reversed', `status ${r.status}`);

  // ---- list + filters (transfers)
  r = await api(admin.cookie, `/api/addons/inventory/transfers?status=completed`);
  check('list transfers?status=completed includes t1', r.status === 200 && (r.json?.data ?? []).some(x => x.id === t1.id), `count ${r.json?.data?.length}`);

  // ======================================================================
  // CROSS-TENANT ISOLATION
  // ======================================================================
  r = await api(langoAdmin.cookie, `/api/addons/inventory/issues/${i1.id}`);
  check('cross-tenant GET issue → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, `/api/addons/inventory/issues/${i1.id}/return`, { method: 'POST', body: { disposition: 'returned' } });
  check('cross-tenant return issue → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, '/api/addons/inventory/issues', { method: 'POST', body: {
    storeId: store1, issueToRole: 'guest', issueToName: 'Intrus', issueDate: TODAY, dueDate: NEXT_WEEK,
    lines: [{ productId: prodX, qty: '1' }],
  } });
  check('cross-tenant create issue → 422/404/403', r.status === 422 || r.status === 404 || r.status === 403, `status ${r.status} code ${r.json?.error?.code}`);
  r = await api(langoAdmin.cookie, `/api/addons/inventory/adjustments/${a1.id}`);
  check('cross-tenant GET adjustment → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, '/api/addons/inventory/adjustments', { method: 'POST', body: {
    storeId: store1, type: 'count_correction', lines: [{ productId: prodY, direction: 'in', qty: '1' }],
  } });
  check('cross-tenant create adjustment → 422/404/403', r.status === 422 || r.status === 404 || r.status === 403, `status ${r.status} code ${r.json?.error?.code}`);
  r = await api(langoAdmin.cookie, `/api/addons/inventory/transfers/${t1.id}`);
  check('cross-tenant GET transfer → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, `/api/addons/inventory/transfers/${t1.id}/complete`, { method: 'POST' });
  check('cross-tenant complete transfer → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, '/api/addons/inventory/transfers', { method: 'POST', body: {
    fromStoreId: store1, toStoreId: store2, lines: [{ productId: prodZ, qty: '1' }],
  } });
  check('cross-tenant create transfer → 422/404/403', r.status === 422 || r.status === 404 || r.status === 403, `status ${r.status} code ${r.json?.error?.code}`);

  // ---- reconcile still green (total Z = 20 spread s1=15/s2=5)
  r = await api(admin.cookie, '/api/addons/inventory/stock/reconcile', { method: 'POST' });
  check('reconcile after issues/adjustments/transfers → no drift', r.status === 200 && r.json?.data?.reconciled === true, JSON.stringify(r.json?.data));

  // ---- cleanup
  await pool.query(`DELETE FROM inventory_issue_lines WHERE tenant_id=$1 AND issue_id = ANY($2::uuid[])`, [ATLAS, issueIds]);
  await pool.query(`DELETE FROM inventory_issues WHERE tenant_id=$1 AND id = ANY($2::uuid[])`, [ATLAS, issueIds]);
  await pool.query(`DELETE FROM inventory_adjustment_lines WHERE tenant_id=$1 AND adjustment_id = ANY($2::uuid[])`, [ATLAS, adjIds]);
  await pool.query(`DELETE FROM inventory_adjustments WHERE tenant_id=$1 AND id = ANY($2::uuid[])`, [ATLAS, adjIds]);
  await pool.query(`DELETE FROM inventory_transfer_lines WHERE tenant_id=$1 AND transfer_id = ANY($2::uuid[])`, [ATLAS, trfIds]);
  await pool.query(`DELETE FROM inventory_transfers WHERE tenant_id=$1 AND id = ANY($2::uuid[])`, [ATLAS, trfIds]);
  await pool.query(`DELETE FROM inventory_stock_movements WHERE tenant_id=$1 AND product_id IN ($2,$3,$4)`, [ATLAS, prodX, prodY, prodZ]);
  await pool.query(`DELETE FROM inventory_stock_balances WHERE tenant_id=$1 AND product_id IN ($2,$3,$4)`, [ATLAS, prodX, prodY, prodZ]);
  await pool.query(`DELETE FROM inventory_purchase_lines WHERE tenant_id=$1 AND purchase_id=$2`, [ATLAS, purchase.id]);
  await pool.query(`DELETE FROM inventory_purchases WHERE tenant_id=$1 AND id=$2`, [ATLAS, purchase.id]);
  await pool.query(`DELETE FROM inventory_products WHERE tenant_id=$1 AND id IN ($2,$3,$4)`, [ATLAS, prodX, prodY, prodZ]);
  await pool.query(`DELETE FROM inventory_categories WHERE tenant_id=$1 AND id=$2`, [ATLAS, catId]);
  await pool.query(`DELETE FROM inventory_units WHERE tenant_id=$1 AND id=$2`, [ATLAS, unitId]);
  await pool.query(`DELETE FROM inventory_stores WHERE tenant_id=$1 AND id IN ($2,$3)`, [ATLAS, store1, store2]);
  await pool.query(`DELETE FROM inventory_suppliers WHERE tenant_id=$1 AND id=$2`, [ATLAS, supId]);

  // ---- DB evidence: Lango untouched
  const { rows: langoIssues } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_issues WHERE tenant_id=$1`, [LANGO]);
  const { rows: langoAdj } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_adjustments WHERE tenant_id=$1`, [LANGO]);
  const { rows: langoTrf } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_transfers WHERE tenant_id=$1`, [LANGO]);
  const { rows: langoMoves } = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_stock_movements WHERE tenant_id=$1`, [LANGO]);
  check('DB: Lango has zero issues', langoIssues[0].c === 0, `count ${langoIssues[0].c}`);
  check('DB: Lango has zero adjustments', langoAdj[0].c === 0, `count ${langoAdj[0].c}`);
  check('DB: Lango has zero transfers', langoTrf[0].c === 0, `count ${langoTrf[0].c}`);
  check('DB: Lango has zero movements', langoMoves[0].c === 0, `count ${langoMoves[0].c}`);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => { console.error('FATAL', err); process.exit(1); });
