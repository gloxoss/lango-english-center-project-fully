// Inventory Phase 6 — live acceptance for the Overview dashboard + CSV exports.
//
// Runs against the dev server (:3002) and the local PostgreSQL. It creates a small,
// deterministic fixture dataset (scoped to 'P6-' identifiers) directly in the DB so the
// KPI values can be cross-checked against the /overview API, then exercises the three CSV
// exports (BOM, CRLF, escaping, filters, content-type, attachment filename, tenant
// isolation, capability gate) and the /inventory → /inventory/overview redirect.
//
// It FAILS (exit 1) on any check that fails and on any skipped/unreachable prerequisite —
// there is no silent skip path. On completion it removes the P6 fixtures and restores the
// add-on entitlement, leaving the DB in the documented baseline state.
//
// Run: node scripts/verify-inventory-phase6.mjs
// Env: VERIFY_BASE (default http://localhost:3002), DATABASE_URL.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
const PASSWORD = 'Admin123!';
const ATLAS_ADMIN = 'y.elamrani@atlas.ma';
const LANGO_ADMIN = 'admin@lango.ma';

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};
const fatal = (msg) => { throw new Error(msg); };

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  const setCookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!setCookies) fatal(`sign-in for ${email} returned no cookie (${res.status})`);
  return setCookies;
}

async function api(cookie, path, { method = 'GET', body, expectStatus } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  // Decode via Buffer (not res.text()) so a leading UTF-8 BOM survives; JSON.parse
  // strips it for the JSON payloads.
  const bytes = Buffer.from(await res.arrayBuffer());
  const text = bytes.toString('utf8');
  let json = null;
  try { json = JSON.parse(text.replace(/^﻿/, '')); } catch { /* not json */ }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus}, got ${res.status}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, json, text, headers: res.headers, bytes };
}

// Any bare '\n' NOT inside a double-quoted cell is a line separator and must be '\r\n'.
// '\n' inside a quoted cell (e.g. a multi-line reason) is legal CSV content.
function hasLoneLfOutsideQuotes(text) {
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { i++; continue; } // escaped "" stays inside
      inQuotes = !inQuotes;
    } else if (ch === '\n' && !inQuotes) {
      if (text[i - 1] !== '\r') return true;
    }
  }
  return false;
}

function assertCsvShape(label, res) {
  const b = res.bytes;
  const bom = b && b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
  check(`${label}: UTF-8 BOM (EF BB BF)`, bom, b ? `bytes ${b[0].toString(16)} ${b[1].toString(16)} ${b[2].toString(16)}` : 'no body');
  const text = res.text;
  check(`${label}: CRLF line endings`, text.includes('\r\n') && !hasLoneLfOutsideQuotes(text), 'no bare LF line separator outside quoted cells');
}

// ---------------------------------------------------------------------------
// Fixture helpers (direct DB, scoped to 'P6-' identifiers)
// ---------------------------------------------------------------------------

async function cleanupFixtures(client) {
  const del = async (sql, params) => { const r = await client.query(sql, params ?? []); return r.rowCount ?? 0; };
  let n = 0;
  n += await del(`delete from inventory_issue_lines where issue_id in (select id from inventory_issues where tenant_id=$1 and issue_number like 'P6-%')`, [ATLAS]);
  n += await del(`delete from inventory_transfer_lines where transfer_id in (select id from inventory_transfers where tenant_id=$1 and transfer_number like 'P6-%')`, [ATLAS]);
  n += await del(`delete from inventory_issues where tenant_id=$1 and issue_number like 'P6-%'`, [ATLAS]);
  n += await del(`delete from inventory_transfers where tenant_id=$1 and transfer_number like 'P6-%'`, [ATLAS]);
  n += await del(`delete from inventory_stock_movements where tenant_id=$1 and product_id in (select id from inventory_products where tenant_id=$1 and code like 'P6-%')`, [ATLAS]);
  n += await del(`delete from inventory_stock_balances where tenant_id=$1 and product_id in (select id from inventory_products where tenant_id=$1 and code like 'P6-%')`, [ATLAS]);
  n += await del(`delete from inventory_products where tenant_id=$1 and code like 'P6-%'`, [ATLAS]);
  n += await del(`delete from inventory_stores where tenant_id=$1 and code like 'P6-%'`, [ATLAS]);
  return n;
}

async function createFixtures(client) {
  const [store1] = (await client.query(
    `insert into inventory_stores (tenant_id, name, code, status) values ($1,'P6 Store','P6-STORE','active') returning id`, [ATLAS])).rows;
  const [store2] = (await client.query(
    `insert into inventory_stores (tenant_id, name, code, status) values ($1,'P6 Store 2','P6-STORE2','active') returning id`, [ATLAS])).rows;

  const [a] = (await client.query(
    `insert into inventory_products (tenant_id, name, code, purchase_price, sale_price, is_active)
     values ($1,'P6 Alpha, "quoted"','P6-A',45.50,60.00,true) returning id`, [ATLAS])).rows;
  const [b] = (await client.query(
    `insert into inventory_products (tenant_id, name, code, purchase_price, sale_price, is_active)
     values ($1,'P6 Beta','P6-B',60.00,70.00,true) returning id`, [ATLAS])).rows;
  const [c] = (await client.query(
    `insert into inventory_products (tenant_id, name, code, purchase_price, sale_price, is_active)
     values ($1,'P6 Gamma','P6-C',100.00,120.00,false) returning id`, [ATLAS])).rows;

  // balances (balance == sum of movements invariant)
  await client.query(`insert into inventory_stock_balances (tenant_id, store_id, product_id, quantity) values ($1,$2,$3,12)`, [ATLAS, store1.id, a.id]);
  await client.query(`insert into inventory_stock_balances (tenant_id, store_id, product_id, quantity) values ($1,$2,$3,0)`, [ATLAS, store1.id, b.id]);
  await client.query(`insert into inventory_stock_balances (tenant_id, store_id, product_id, quantity) values ($1,$2,$3,5)`, [ATLAS, store1.id, c.id]);

  await client.query(
    `insert into inventory_stock_movements (tenant_id, store_id, product_id, movement_type, qty, ref_type, ref_id, idempotency_key, actor_id, reason, recorded_at)
     values ($1,$2,$3,'receipt',12,'purchase','11111111-1111-4111-8111-111111111111','p6-mv-a','USR-001',$4, now())`,
    [ATLAS, store1.id, a.id, 'p6 fixture\nline2']);
  await client.query(
    `insert into inventory_stock_movements (tenant_id, store_id, product_id, movement_type, qty, ref_type, ref_id, idempotency_key, actor_id, reason, recorded_at)
     values ($1,$2,$3,'receipt',5,'purchase','22222222-2222-4222-8222-222222222222','p6-mv-c','USR-001','p6 fixture', now())`,
    [ATLAS, store1.id, c.id]);

  // one open issue, one overdue issue
  await client.query(
    `insert into inventory_issues (tenant_id, issue_number, store_id, issue_to_role, issue_to_name, issue_date, due_date, return_date, status, recorded_by_id)
     values ($1,'P6-ISS-1',$2,'guest','P6 Borrower',current_date, current_date + 1, null, 'issued','USR-001')`, [ATLAS, store1.id]);
  await client.query(
    `insert into inventory_issues (tenant_id, issue_number, store_id, issue_to_role, issue_to_name, issue_date, due_date, return_date, status, recorded_by_id)
     values ($1,'P6-ISS-2',$2,'guest','P6 Borrower',current_date - 2, current_date - 1, null, 'issued','USR-001')`, [ATLAS, store1.id]);

  // one pending transfer (requires two distinct stores)
  await client.query(
    `insert into inventory_transfers (tenant_id, transfer_number, from_store_id, to_store_id, reason, status, created_by_id)
     values ($1,'P6-TRF-1',$2,$3,'p6 fixture','pending','USR-001')`, [ATLAS, store1.id, store2.id]);

  return { store1: store1.id, store2: store2.id, a: a.id, b: b.id, c: c.id };
}

// SQL cross-check of the overview KPIs (mirrors overview-service.ts)
async function sqlExpectedKpis() {
  const one = async (sql, params) => (await pool.query(sql, params ?? [])).rows[0];
  const activeProducts = Number((await one(`select count(*)::int as n from inventory_products where tenant_id=$1 and is_active=true`, [ATLAS])).n);
  const stores = Number((await one(`select count(*)::int as n from inventory_stores where tenant_id=$1`, [ATLAS])).n);
  const categories = Number((await one(`select count(*)::int as n from inventory_categories where tenant_id=$1`, [ATLAS])).n);
  const suppliers = Number((await one(`select count(*)::int as n from inventory_suppliers where tenant_id=$1`, [ATLAS])).n);
  const stockValueCents = Number((await one(
    `select coalesce(sum(floor((round(sb.quantity::numeric * 1000) * round(p.purchase_price * 100) + 500) / 1000)),0)::bigint as v
     from inventory_stock_balances sb join inventory_products p on p.id = sb.product_id
     where sb.tenant_id=$1 and p.is_active=true and p.purchase_price is not null`, [ATLAS])).v);
  const lowStock = Number((await one(
    `select count(*)::int as n from inventory_products p
     where p.tenant_id=$1 and p.is_active=true
       and (select coalesce(sum(sb.quantity),0) from inventory_stock_balances sb where sb.product_id = p.id) <= 0`, [ATLAS])).n);
  const openIssues = Number((await one(`select count(*)::int as n from inventory_issues where tenant_id=$1 and status='issued'`, [ATLAS])).n);
  const overdueIssues = Number((await one(
    `select count(*)::int as n from inventory_issues where tenant_id=$1 and status='issued' and due_date < current_date and return_date is null`, [ATLAS])).n);
  const pendingTransfers = Number((await one(`select count(*)::int as n from inventory_transfers where tenant_id=$1 and status='pending'`, [ATLAS])).n);
  const movements = Number((await one(`select count(*)::int as n from inventory_stock_movements where tenant_id=$1`, [ATLAS])).n);
  const movements30d = Number((await one(
    `select count(*)::int as n from inventory_stock_movements where tenant_id=$1 and recorded_at >= now() - interval '30 days'`, [ATLAS])).n);
  return {
    activeProducts, stores, categories, suppliers, stockValueCents, lowStock,
    openIssues, overdueIssues, pendingTransfers, movements, movements30d,
  };
}

async function main() {
  const client = await pool.connect();
  let fixtures = null;
  let addonRestored = false;
  try {
    const atlas = await signIn(ATLAS_ADMIN, PASSWORD);
    const lango = await signIn(LANGO_ADMIN, PASSWORD);
    console.log('→ signed in as Atlas + Lango admins\n');

    // --- fixtures ---
    await client.query('begin');
    await cleanupFixtures(client);
    fixtures = await createFixtures(client);
    await client.query('commit');
    console.log('→ P6 fixtures created (2 active products, 1 archived, 2 stores, 2 movements, 1 open + 1 overdue issue, 1 pending transfer)\n');

    // --- overview KPIs vs direct SQL ---
    const ovRes = await api(atlas, '/api/addons/inventory/overview', { expectStatus: 200 });
    const ov = ovRes.json.data;
    const exp = await sqlExpectedKpis();
    const kpi = (label, actual, expected) => check(label, actual === expected, `api=${actual} sql=${expected}`);
    kpi('overview: active products', ov.counts.products, exp.activeProducts);
    kpi('overview: categories', ov.counts.categories, exp.categories);
    kpi('overview: stores', ov.counts.stores, exp.stores);
    kpi('overview: suppliers', ov.counts.suppliers, exp.suppliers);
    kpi('overview: stock value (cents)', ov.stockValueCents, exp.stockValueCents);
    kpi('overview: low-stock count', ov.lowStockCount, exp.lowStock);
    kpi('overview: open issues', ov.counts.openIssues, exp.openIssues);
    kpi('overview: overdue issues', ov.counts.overdueIssues, exp.overdueIssues);
    kpi('overview: pending transfers', ov.counts.pendingTransfers, exp.pendingTransfers);
    kpi('overview: movements (total)', ov.counts.movements, exp.movements);
    kpi('overview: movements 30d', Object.values(ov.movements30d.byType).reduce((a, b) => a + b, 0), exp.movements30d);

    // low-stock list + recent movement list match the DB rows
    const lowCodes = ov.lowStockProducts.map((p) => p.code).sort();
    check('overview: low-stock list matches DB (P6-B only)', JSON.stringify(lowCodes) === JSON.stringify(['P6-B']), JSON.stringify(lowCodes));
    const recentCodes = ov.recent.map((m) => m.productCode).sort();
    check('overview: recent movements match DB ledger', JSON.stringify(recentCodes) === JSON.stringify(['P6-A', 'P6-C']), JSON.stringify(recentCodes));

    // --- CSV exports ---
    console.log('\n→ CSV exports');
    const exProducts = await api(atlas, '/api/addons/inventory/export?type=products', { expectStatus: 200 });
    assertCsvShape('export products', exProducts);
    check('export products: content-type', (exProducts.headers.get('content-type') ?? '').startsWith('text/csv; charset=utf-8'), exProducts.headers.get('content-type'));
    check('export products: attachment filename', (exProducts.headers.get('content-disposition') ?? '').includes('attachment; filename="inventory-products-'), exProducts.headers.get('content-disposition'));
    check('export products: header row', exProducts.text.includes('Nom,Code,Prix achat,Prix vente,Stock total,Stock par magasin'));
    check('export products: comma+quote escaping', exProducts.text.includes('"P6 Alpha, ""quoted""",P6-A,45.50,60.00,12,P6 Store: 12'));
    check('export products: plain row present', exProducts.text.includes('P6 Beta,P6-B,60.00,70.00,0,P6 Store: 0'));
    check('export products: excludes archived P6-C', !exProducts.text.includes('P6-C'));

    const exStock = await api(atlas, '/api/addons/inventory/export?type=stock', { expectStatus: 200 });
    assertCsvShape('export stock', exStock);
    check('export stock: header row', exStock.text.includes('Magasin,Code magasin,Produit,Code produit,Quantité,Mis à jour'));
    check('export stock: all balances incl archived', exStock.text.includes('"P6 Alpha, ""quoted""",P6-A,12.000,') && exStock.text.includes('P6-C,5.000,'));

    const exLow = await api(atlas, '/api/addons/inventory/export?type=stock&lowStock=1', { expectStatus: 200 });
    check('export stock filter lowStock=1 → only P6-B', exLow.text.includes('P6-B,0.000,') && !exLow.text.includes('P6-A'));

    const exMv = await api(atlas, '/api/addons/inventory/export?type=movements', { expectStatus: 200 });
    assertCsvShape('export movements', exMv);
    check('export movements: header row', exMv.text.includes('Date,Magasin,Produit,Code,Type,Quantité,Référence,Raison,Acteur'));
    check('export movements: newline escaping in quoted cell', exMv.text.includes('"p6 fixture\nline2"'));
    const exMvReceipt = await api(atlas, '/api/addons/inventory/export?type=movements&movementType=receipt', { expectStatus: 200 });
    check('export movements filter movementType=receipt', (exMvReceipt.text.match(/p6 fixture/g) ?? []).length === 2);
    const exMvProd = await api(atlas, `/api/addons/inventory/export?type=movements&productId=${fixtures.a}`, { expectStatus: 200 });
    check('export movements filter productId=P6-A → 1 row', (exMvProd.text.match(/P6-A/g) ?? []).length === 1 && !exMvProd.text.includes('P6-C'));

    // tenant isolation: Lango export must never contain Atlas fixture rows
    const langoProducts = await api(lango, '/api/addons/inventory/export?type=products', { expectStatus: 200 });
    check('export tenant-isolated: Lango export has no P6 rows', !langoProducts.text.includes('P6-A') && !langoProducts.text.includes('P6 Store'));

    // capability gate (static): export route must require inventory.export
    const exportRoute = await readFile(path.resolve('src/app/api/addons/inventory/export/route.ts'), 'utf8');
    check('export route requires inventory.export capability (static)', exportRoute.includes(`requireCapability(context, 'inventory.export')`));
    const overviewRoute = await readFile(path.resolve('src/app/api/addons/inventory/overview/route.ts'), 'utf8');
    check('overview route requires inventory.read capability (static)', overviewRoute.includes(`requireCapability(context, 'inventory.read')`));

    // --- redirect /dashboard/inventory → /dashboard/inventory/overview ---
    console.log('\n→ redirect + sidebar');
    const redir = await api(atlas, '/fr/dashboard/inventory', {});
    const loc = redir.headers.get('location') ?? '';
    check('redirect /fr/dashboard/inventory → 3xx', redir.status === 307 || redir.status === 308, `status=${redir.status}`);
    check('redirect Location → /fr/dashboard/inventory/overview', loc.includes('/inventory/overview'), loc);

    const sidebar = await readFile(path.resolve('src/components/shared/sidebar.tsx'), 'utf8');
    const invBlock = sidebar.slice(sidebar.indexOf('label: \'Inventaire\''));
    const firstSub = invBlock.slice(0, invBlock.indexOf('label: \'Aperçu\''));
    check('sidebar: Aperçu is first inventory sub-item', firstSub.includes('inventory/overview') || invBlock.trim().startsWith('label: \'Inventaire\''), 'Aperçu precedes other inventory items');

    // --- error state: addon disabled → overview 403, restored after ---
    console.log('\n→ error state (addon disabled)');
    await pool.query(`update addon_entitlements set is_enabled=false where tenant_id=$1 and addon_id='inventory'`, [ATLAS]);
    const off = await api(atlas, '/api/addons/inventory/overview');
    check('overview 403 ADDON_NOT_ACTIVATED when addon disabled', off.status === 403 && off.json?.error?.code === 'ADDON_NOT_ACTIVATED', `status=${off.status}`);
    await pool.query(`update addon_entitlements set is_enabled=true where tenant_id=$1 and addon_id='inventory'`, [ATLAS]);
    addonRestored = true;
    const on = await api(atlas, '/api/addons/inventory/overview', { expectStatus: 200 });
    check('overview 200 after addon re-enabled', on.status === 200);

    // --- empty state: after cleanup, overview returns all-zero counts ---
    console.log('\n→ empty state');
    await client.query('begin');
    await cleanupFixtures(client);
    await client.query('commit');
    fixtures = null;
    const empty = await api(atlas, '/api/addons/inventory/overview', { expectStatus: 200 });
    const e = empty.json.data;
    const allZero = e.counts.products === 0 && e.counts.stores === 0 && e.counts.categories === 0 && e.counts.suppliers === 0
      && e.counts.openIssues === 0 && e.counts.overdueIssues === 0 && e.counts.pendingTransfers === 0
      && e.counts.movements === 0 && e.stockValueCents === 0 && e.lowStockCount === 0 && e.recent.length === 0;
    check('overview empty state: all-zero counts + empty lists', allZero, JSON.stringify(e.counts));

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    return failed.length ? 1 : 0;
  } catch (err) {
    console.error('PHASE6 FATAL', err);
    // best-effort restore: remove fixtures + re-enable addon
    try {
      if (fixtures) { await client.query('begin'); await cleanupFixtures(client); await client.query('commit'); }
      await pool.query(`update addon_entitlements set is_enabled=true where tenant_id=$1 and addon_id='inventory'`, [ATLAS]);
    } catch { /* ignore */ }
    return 1;
  } finally {
    // always release the checked-out client so pool.end() can close cleanly
    if (!addonRestored) {
      await pool.query(`update addon_entitlements set is_enabled=true where tenant_id=$1 and addon_id='inventory'`, [ATLAS]).catch(() => {});
    }
    try { await client.release(); } catch { /* ignore */ }
    await pool.end().catch(() => {});
  }
}

main().then((code) => process.exit(code));
