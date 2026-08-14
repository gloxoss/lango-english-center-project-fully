// Inventory overview KPIs for the dashboard landing. Read-only aggregation:
// master-data counts, total stock value (cost basis), low-stock products,
// open/overdue issues, pending transfers, 30-day movement stats and the most
// recent ledger rows. No writes, no audit.
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { moneyToCents } from '@/libs/finance/money';
import {
  inventoryCategories, inventoryIssues, inventoryProducts, inventoryStockMovements,
  inventoryStores, inventorySuppliers, inventoryTransfers,
} from '@/models/Schema';
import { qtyTimesPrice, qtyToMilli } from './inventory-math';
import { listProducts } from './catalog-service';
import { listMovements } from './reconcile-service';

export async function getOverview(tenantId: string) {
  const products = await listProducts(tenantId);

  let stockValueCents = 0;
  for (const p of products) {
    if (p.purchasePrice == null) continue;
    const priceCents = moneyToCents(p.purchasePrice.toFixed(2));
    for (const b of p.stockByStore) {
      stockValueCents += Number(qtyTimesPrice(qtyToMilli(b.quantity), priceCents));
    }
  }

  const lowStockProducts = products.filter((p) => Number(p.totalStock) <= 0);

  const [productsCount, categoriesCount, storesCount, suppliersCount, openIssues, overdueIssues, pendingTransfers, movementsCount] = await Promise.all([
    db.select({ c: count() }).from(inventoryProducts).where(and(eq(inventoryProducts.tenantId, tenantId), eq(inventoryProducts.isActive, true))),
    db.select({ c: count() }).from(inventoryCategories).where(eq(inventoryCategories.tenantId, tenantId)),
    db.select({ c: count() }).from(inventoryStores).where(eq(inventoryStores.tenantId, tenantId)),
    db.select({ c: count() }).from(inventorySuppliers).where(eq(inventorySuppliers.tenantId, tenantId)),
    db.select({ c: count() }).from(inventoryIssues).where(and(eq(inventoryIssues.tenantId, tenantId), eq(inventoryIssues.status, 'issued'))),
    db.select({ c: count() }).from(inventoryIssues).where(and(
      eq(inventoryIssues.tenantId, tenantId),
      eq(inventoryIssues.status, 'issued'),
      sql`${inventoryIssues.dueDate} < ${new Date().toISOString().slice(0, 10)}`,
      sql`${inventoryIssues.returnDate} IS NULL`,
    )),
    db.select({ c: count() }).from(inventoryTransfers).where(and(eq(inventoryTransfers.tenantId, tenantId), eq(inventoryTransfers.status, 'pending'))),
    db.select({ c: count() }).from(inventoryStockMovements).where(eq(inventoryStockMovements.tenantId, tenantId)),
  ]);

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const movementRows = await db.select({
    movementType: inventoryStockMovements.movementType,
    qty: inventoryStockMovements.qty,
  })
    .from(inventoryStockMovements)
    .where(and(eq(inventoryStockMovements.tenantId, tenantId), gte(inventoryStockMovements.recordedAt, since)));

  const byType = new Map<string, number>();
  let inQtyMilli = BigInt(0);
  let outQtyMilli = BigInt(0);
  for (const m of movementRows) {
    byType.set(m.movementType, (byType.get(m.movementType) ?? 0) + 1);
    const milli = qtyToMilli(m.qty);
    if (milli >= BigInt(0)) inQtyMilli += milli;
    else outQtyMilli += -milli;
  }

  const recent = await listMovements(tenantId, { limit: 10, offset: 0 });

  return {
    counts: {
      products: productsCount[0]?.c ?? 0,
      categories: categoriesCount[0]?.c ?? 0,
      stores: storesCount[0]?.c ?? 0,
      suppliers: suppliersCount[0]?.c ?? 0,
      openIssues: openIssues[0]?.c ?? 0,
      overdueIssues: overdueIssues[0]?.c ?? 0,
      pendingTransfers: pendingTransfers[0]?.c ?? 0,
      movements: movementsCount[0]?.c ?? 0,
    },
    stockValueCents,
    lowStockCount: lowStockProducts.length,
    lowStockProducts: lowStockProducts.map((p) => ({ id: p.id, name: p.name, code: p.code, totalStock: p.totalStock })),
    movements30d: {
      byType: Object.fromEntries(byType),
      inQty: String(inQtyMilli),
      outQty: String(outQtyMilli),
    },
    recent: recent.rows,
  };
}
