// Inventory <-> accounting coupling + stock-level integrity.
//
// receivePurchase() posts stock movements and creates exactly one `expenses`
// row atomically, then is idempotent on repeat calls (no double-posting).
// postStockMovements() (used by both sales and purchase receipts) must never
// let a balance go negative - a sale can't oversell below zero stock.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql, and } from 'drizzle-orm';
import { db } from '@/libs/DB';
import type { RequestContext } from '@/libs/api/context';
import { createPurchase, receivePurchase } from '@/features/inventory/services/purchases-service';
import { createSale } from '@/features/inventory/services/sales-service';
import {
  expenses,
  invoices,
  tenants,
  user,
} from '@/models/Schema';
import {
  inventoryProducts,
  inventoryPurchases,
  inventorySales,
  inventoryStockBalances,
  inventoryStockMovements,
  inventoryStores,
  inventorySuppliers,
} from '@/features/inventory/models/inventory-schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('inventory accounting coupling + stock integrity', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const adminId = `INV-ACC-ADMIN-${suffix}`;
  const studentId = `INV-ACC-STU-${suffix}`;

  let storeId = '';
  let supplierId = '';
  let productId = '';

  const ctx: RequestContext = {
    userId: adminId,
    tenantId,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Inventory Admin',
    email: `inv-acc-admin-${suffix}@test.local`,
  };

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Inventory Accounting ${suffix}`, slug: `inv-acc-${suffix}` });
    await db.insert(user).values([
      { id: adminId, tenantId, name: 'Inventory Admin', email: `inv-acc-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentId, tenantId, name: 'Inventory Student', email: `inv-acc-stu-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);

    storeId = (await db.insert(inventoryStores).values({ tenantId, name: 'Magasin Principal', code: `STORE-${suffix}` }).returning({ id: inventoryStores.id }))[0]!.id;
    supplierId = (await db.insert(inventorySuppliers).values({ tenantId, name: `Fournisseur ${suffix}` }).returning({ id: inventorySuppliers.id }))[0]!.id;
    productId = (await db.insert(inventoryProducts).values({ tenantId, name: 'Cahier', code: `PRD-${suffix}` }).returning({ id: inventoryProducts.id }))[0]!.id;
  }, 30_000);

  afterAll(async () => {
    await db.delete(inventoryStockMovements).where(eq(inventoryStockMovements.tenantId, tenantId));
    await db.delete(inventoryStockBalances).where(eq(inventoryStockBalances.tenantId, tenantId));
    await db.delete(inventorySales).where(eq(inventorySales.tenantId, tenantId));
    await db.delete(inventoryPurchases).where(eq(inventoryPurchases.tenantId, tenantId));
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(expenses).where(eq(expenses.tenantId, tenantId));
    await db.delete(inventoryProducts).where(eq(inventoryProducts.tenantId, tenantId));
    await db.delete(inventorySuppliers).where(eq(inventorySuppliers.tenantId, tenantId));
    await db.delete(inventoryStores).where(eq(inventoryStores.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  describe('purchase receipt posts to accounting exactly once', () => {
    let purchaseId = '';

    it('creates a purchase (no stock/accounting effect yet)', async () => {
      const purchase = await createPurchase(ctx, tenantId, {
        supplierId,
        storeId,
        orderDate: new Date().toISOString().slice(0, 10),
        lines: [{ productId, qtyInPurchaseUnit: '10', unitCost: 20 }],
      });
      purchaseId = purchase!.id;

      const [balance] = await db.select({ quantity: inventoryStockBalances.quantity })
        .from(inventoryStockBalances)
        .where(and(eq(inventoryStockBalances.tenantId, tenantId), eq(inventoryStockBalances.productId, productId)));
      expect(balance).toBeUndefined();
    });

    it('receiving it posts stock + exactly one expense row', async () => {
      await receivePurchase(ctx, tenantId, purchaseId);

      const [balance] = await db.select({ quantity: inventoryStockBalances.quantity })
        .from(inventoryStockBalances)
        .where(and(eq(inventoryStockBalances.tenantId, tenantId), eq(inventoryStockBalances.storeId, storeId), eq(inventoryStockBalances.productId, productId)));
      expect(Number(balance!.quantity)).toBe(10);

      const expenseRows = await db.select().from(expenses).where(eq(expenses.tenantId, tenantId));
      expect(expenseRows).toHaveLength(1);
      expect(Number(expenseRows[0]!.amount)).toBe(200);
    });

    it('receiving the same purchase again is a no-op (idempotent, no double posting)', async () => {
      await receivePurchase(ctx, tenantId, purchaseId);

      const [balance] = await db.select({ quantity: inventoryStockBalances.quantity })
        .from(inventoryStockBalances)
        .where(and(eq(inventoryStockBalances.tenantId, tenantId), eq(inventoryStockBalances.storeId, storeId), eq(inventoryStockBalances.productId, productId)));
      expect(Number(balance!.quantity)).toBe(10);

      const expenseRows = await db.select().from(expenses).where(eq(expenses.tenantId, tenantId));
      expect(expenseRows).toHaveLength(1);
    });
  });

  describe('stock-level integrity', () => {
    it('a guest sale within available stock succeeds and decrements the balance', async () => {
      await createSale(ctx, tenantId, {
        storeId,
        saleToRole: 'guest',
        customerName: 'Client Comptoir',
        saleDate: new Date().toISOString().slice(0, 10),
        lines: [{ productId, qty: '3', unitPrice: 25 }],
      });

      const [balance] = await db.select({ quantity: inventoryStockBalances.quantity })
        .from(inventoryStockBalances)
        .where(and(eq(inventoryStockBalances.tenantId, tenantId), eq(inventoryStockBalances.storeId, storeId), eq(inventoryStockBalances.productId, productId)));
      expect(Number(balance!.quantity)).toBe(7);
    });

    it('a sale that would oversell below zero stock is rejected with INSUFFICIENT_STOCK', async () => {
      await expect(
        createSale(ctx, tenantId, {
          storeId,
          saleToRole: 'guest',
          customerName: 'Client Trop Gourmand',
          saleDate: new Date().toISOString().slice(0, 10),
          lines: [{ productId, qty: '999', unitPrice: 25 }],
        }),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });

      // Balance must be unchanged by the rejected sale.
      const [balance] = await db.select({ quantity: inventoryStockBalances.quantity })
        .from(inventoryStockBalances)
        .where(and(eq(inventoryStockBalances.tenantId, tenantId), eq(inventoryStockBalances.storeId, storeId), eq(inventoryStockBalances.productId, productId)));
      expect(Number(balance!.quantity)).toBe(7);
    });

    it('a student sale posts a real invoice (accounting coupling for student sales)', async () => {
      await createSale(ctx, tenantId, {
        storeId,
        saleToRole: 'student',
        studentId,
        saleDate: new Date().toISOString().slice(0, 10),
        lines: [{ productId, qty: '2', unitPrice: 25 }],
      });

      const invoiceRows = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, studentId)));
      expect(invoiceRows).toHaveLength(1);
      expect(Number(invoiceRows[0]!.netAmount)).toBe(50);
    });
  });
});
