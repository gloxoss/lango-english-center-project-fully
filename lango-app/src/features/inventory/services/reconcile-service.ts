// Stock read projection + reconciliation. The reproducible invariant:
// balance.quantity == SUM(movements.qty) per (store, product). reconcileStock()
// recomputes balances from the ledger and reports any pre-reconcile drift.
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { recordAudit } from '@/libs/api/audit';
import {
  inventoryProducts,
  inventoryStockBalances,
  inventoryStockMovements,
  inventoryStores,
} from '@/models/Schema';
import { milliToQty, qtyToMilli } from './inventory-math';

// ---------------------------------------------------------------------------
// Stock balances (read projection, with product + store names)
// ---------------------------------------------------------------------------

export async function listStockBalances(
  tenantId: string,
  opts: { storeId?: string | null; productId?: string | null; lowStockQty?: string | null } = {},
) {
  const conditions = [eq(inventoryStockBalances.tenantId, tenantId)];
  if (opts.storeId) conditions.push(eq(inventoryStockBalances.storeId, opts.storeId));
  if (opts.productId) conditions.push(eq(inventoryStockBalances.productId, opts.productId));

  const rows = await db.select({
    productId: inventoryStockBalances.productId,
    productName: inventoryProducts.name,
    productCode: inventoryProducts.code,
    storeId: inventoryStockBalances.storeId,
    storeName: inventoryStores.name,
    storeCode: inventoryStores.code,
    quantity: inventoryStockBalances.quantity,
    updatedAt: inventoryStockBalances.updatedAt,
  })
    .from(inventoryStockBalances)
    .innerJoin(inventoryProducts, eq(inventoryProducts.id, inventoryStockBalances.productId))
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventoryStockBalances.storeId))
    .where(and(...conditions))
    .orderBy(asc(inventoryProducts.name), asc(inventoryStores.name));

  if (opts.lowStockQty) {
    const threshold = qtyToMilli(opts.lowStockQty);
    return rows.filter((r) => qtyToMilli(r.quantity) < threshold);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Movement ledger (filters + pagination)
// ---------------------------------------------------------------------------

export async function listMovements(
  tenantId: string,
  opts: {
    productId?: string | null;
    storeId?: string | null;
    movementType?: string | null;
    refType?: string | null;
    refId?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  } = {},
) {
  const conditions = [eq(inventoryStockMovements.tenantId, tenantId)];
  if (opts.productId) conditions.push(eq(inventoryStockMovements.productId, opts.productId));
  if (opts.storeId) conditions.push(eq(inventoryStockMovements.storeId, opts.storeId));
  if (opts.movementType) conditions.push(eq(inventoryStockMovements.movementType, opts.movementType as any));
  if (opts.refType) conditions.push(eq(inventoryStockMovements.refType, opts.refType));
  if (opts.refId) conditions.push(eq(inventoryStockMovements.refId, opts.refId));
  if (opts.from) conditions.push(gte(inventoryStockMovements.recordedAt, opts.from));
  if (opts.to) conditions.push(sql`${inventoryStockMovements.recordedAt} <= ${opts.to}::timestamp`);

  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const [rows, countRows] = await Promise.all([
    db.select({
      id: inventoryStockMovements.id,
      storeId: inventoryStockMovements.storeId,
      storeName: inventoryStores.name,
      productId: inventoryStockMovements.productId,
      productName: inventoryProducts.name,
      productCode: inventoryProducts.code,
      movementType: inventoryStockMovements.movementType,
      qty: inventoryStockMovements.qty,
      refType: inventoryStockMovements.refType,
      refId: inventoryStockMovements.refId,
      actorId: inventoryStockMovements.actorId,
      reason: inventoryStockMovements.reason,
      recordedAt: inventoryStockMovements.recordedAt,
    })
      .from(inventoryStockMovements)
      .innerJoin(inventoryStores, eq(inventoryStores.id, inventoryStockMovements.storeId))
      .innerJoin(inventoryProducts, eq(inventoryProducts.id, inventoryStockMovements.productId))
      .where(and(...conditions))
      .orderBy(desc(inventoryStockMovements.recordedAt), desc(inventoryStockMovements.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(inventoryStockMovements)
      .where(and(...conditions)),
  ]);

  return { rows, total: countRows[0]?.count ?? 0, limit, offset };
}

// ---------------------------------------------------------------------------
// Reconciliation: recompute balances from the immutable ledger
// ---------------------------------------------------------------------------

export async function reconcileStock(context: RequestContext, tenantId: string) {
  const aggregate = await db.select({
    storeId: inventoryStockMovements.storeId,
    productId: inventoryStockMovements.productId,
    sum: sql<string>`sum(${inventoryStockMovements.qty})::text`,
  })
    .from(inventoryStockMovements)
    .where(eq(inventoryStockMovements.tenantId, tenantId))
    .groupBy(inventoryStockMovements.storeId, inventoryStockMovements.productId);

  const balances = await db.select({
    storeId: inventoryStockBalances.storeId,
    productId: inventoryStockBalances.productId,
    quantity: inventoryStockBalances.quantity,
  })
    .from(inventoryStockBalances)
    .where(eq(inventoryStockBalances.tenantId, tenantId));

  const projected = new Map<string, bigint>();
  for (const row of aggregate) {
    projected.set(`${row.storeId}:${row.productId}`, qtyToMilli(row.sum));
  }
  const current = new Map<string, string>();
  for (const row of balances) {
    current.set(`${row.storeId}:${row.productId}`, row.quantity);
  }

  const discrepancies: Array<{ storeId: string; productId: string; expected: string; actual: string }> = [];
  const allKeys = new Set([...projected.keys(), ...current.keys()]);
  for (const key of allKeys) {
    const [storeId = '', productId = ''] = key.split(':');
    const expectedMilli = projected.get(key) ?? BigInt(0);
    const expected = milliToQty(expectedMilli);
    const actual = current.get(key) ?? '0';
    if (qtyToMilli(actual) !== expectedMilli) {
      discrepancies.push({ storeId, productId, expected, actual });
    }
  }

  if (discrepancies.length > 0) {
    await db.transaction(async (tx) => {
      for (const key of allKeys) {
        const [storeId = '', productId = ''] = key.split(':');
        const expected = milliToQty(projected.get(key) ?? BigInt(0));
        const actual = current.get(key) ?? '0';
        if (qtyToMilli(actual) === (projected.get(key) ?? BigInt(0))) continue;
        await tx.execute(sql`
          INSERT INTO inventory_stock_balances (tenant_id, store_id, product_id, quantity, updated_at)
          VALUES (${tenantId}, ${storeId}, ${productId}, ${expected}, now())
          ON CONFLICT (tenant_id, store_id, product_id)
          DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()
        `);
      }
    });
    for (const d of discrepancies) {
      recordAudit(context, 'update', 'inventory_balance', `${d.storeId}:${d.productId}`, {
        expected: d.expected,
        actual: d.actual,
        reconciledAt: new Date().toISOString(),
      });
    }
  }

  return { discrepancies, reconciled: discrepancies.length === 0 };
}
