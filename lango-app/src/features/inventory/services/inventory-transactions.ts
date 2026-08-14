// Stock-movement choke point. Every stock-affecting mutation in the inventory
// add-on flows through postStockMovements — routes and services never touch the
// movement ledger or the balance projection directly.
//
// Guarantees (see .implementation-plan/EXECUTION-PLAN.md §3–§6):
//  * append-only ledger: movements are only ever inserted, never updated/deleted
//  * balances are a projection updated in the same transaction as the movements
//  * deterministic lock order on (productId, storeId) kills cross-document
//    deadlocks (e.g. two transfers crossing stores)
//  * the final balance is never negative: out-flows that would push a balance
//    below zero throw 409 INSUFFICIENT_STOCK and roll the whole tx back
//  * unique(tenant_id, idempotency_key) makes double-posting physically
//    impossible; callers catch the 23505 and downgrade to idempotent success
import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import type { db as dbClient } from '@/libs/DB';
import { inventoryProducts, inventoryStockBalances, inventoryStockMovements, inventoryStores } from '@/models/Schema';
import { milliToQty, qtyToMilli } from './inventory-math';

type InventoryTx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0];

export type MovementInput = {
  storeId: string;
  productId: string;
  movementType: 'receipt' | 'sale' | 'sale_reversal' | 'issue' | 'issue_return' | 'adjustment_in' | 'adjustment_out' | 'transfer_out' | 'transfer_in';
  qtyMilli: bigint; // signed: + in, - out
  refType: 'purchase' | 'sale' | 'issue' | 'adjustment' | 'transfer';
  refId: string;
  idempotencyKey: string;
  reason?: string | null;
  recordedAt?: string;
};

export async function postStockMovements(
  tx: InventoryTx,
  opts: { tenantId: string; actorId: string | null; movements: MovementInput[] },
): Promise<void> {
  const { tenantId, actorId } = opts;
  const movements = opts.movements;
  if (movements.length === 0) return;

  // Aggregate the net delta per (storeId, productId) for locking + checks.
  const deltas = new Map<string, { storeId: string; productId: string; qty: bigint }>();
  for (const m of movements) {
    const key = `${m.storeId}:${m.productId}`;
    const existing = deltas.get(key);
    if (existing) existing.qty += m.qtyMilli;
    else deltas.set(key, { storeId: m.storeId, productId: m.productId, qty: m.qtyMilli });
  }

  // Deterministic lock order — sort by (productId, storeId) so any two
  // concurrent documents touching overlapping products lock in the same order.
  const pairs = [...deltas.values()].sort((a, b) =>
    a.productId.localeCompare(b.productId) || a.storeId.localeCompare(b.storeId),
  );

  const locked = new Map<string, bigint>();
  for (const p of pairs) {
    await tx.insert(inventoryStockBalances)
      .values({ tenantId, storeId: p.storeId, productId: p.productId, quantity: '0' })
      .onConflictDoNothing()
      .execute();
    const [row] = await tx.select({ quantity: inventoryStockBalances.quantity })
      .from(inventoryStockBalances)
      .where(and(
        eq(inventoryStockBalances.tenantId, tenantId),
        eq(inventoryStockBalances.storeId, p.storeId),
        eq(inventoryStockBalances.productId, p.productId),
      ))
      .for('update')
      .limit(1);
    locked.set(`${p.storeId}:${p.productId}`, qtyToMilli(row?.quantity ?? '0'));
  }

  // Availability check under the lock: final balance must never go negative.
  for (const p of pairs) {
    const current = locked.get(`${p.storeId}:${p.productId}`) ?? BigInt(0);
    const next = current + p.qty;
    if (next < BigInt(0)) {
      const [prod] = await tx.select({ name: inventoryProducts.name }).from(inventoryProducts)
        .where(eq(inventoryProducts.id, p.productId)).limit(1);
      const [store] = await tx.select({ name: inventoryStores.name }).from(inventoryStores)
        .where(eq(inventoryStores.id, p.storeId)).limit(1);
      throw new ApiError(
        409,
        'INSUFFICIENT_STOCK',
        `Stock insuffisant pour "${prod?.name ?? p.productId}" au magasin "${store?.name ?? p.storeId}".`,
      );
    }
  }

  // Append movements (immutable) then upsert balances in the same tx.
  for (const m of movements) {
    await tx.insert(inventoryStockMovements).values({
      tenantId,
      storeId: m.storeId,
      productId: m.productId,
      movementType: m.movementType,
      qty: milliToQty(m.qtyMilli),
      refType: m.refType,
      refId: m.refId,
      idempotencyKey: m.idempotencyKey,
      actorId,
      reason: m.reason ?? null,
      recordedAt: m.recordedAt ?? new Date().toISOString(),
    }).execute();
  }

  const nowIso = new Date().toISOString();
  for (const p of pairs) {
    const next = (locked.get(`${p.storeId}:${p.productId}`) ?? BigInt(0)) + p.qty;
    await tx.update(inventoryStockBalances)
      .set({ quantity: milliToQty(next), updatedAt: nowIso })
      .where(and(
        eq(inventoryStockBalances.tenantId, tenantId),
        eq(inventoryStockBalances.storeId, p.storeId),
        eq(inventoryStockBalances.productId, p.productId),
      ))
      .execute();
  }
}

/** True when the error is a duplicate idempotency_key on the movement ledger. */
export function isIdempotencyViolation(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string };
  return e?.code === '23505' && e?.constraint === 'inventory_stock_movements_tenant_idempotency_key_unique';
}
