// Stock adjustments service. An adjustment is applied atomically on create:
// `in` lines post positive `adjustment_in` movements, `out` lines post negative
// `adjustment_out` movements (availability-checked). The doc row itself is the
// idempotency anchor — status defaults to `applied` and is never re-applied.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import type { RequestContext } from '@/libs/api/context';
import {
  inventoryAdjustmentLines, inventoryAdjustments, inventoryProducts, inventoryStores,
} from '@/models/Schema';
import { qtyToMilli } from './inventory-math';
import { reserveInventoryNumber } from './inventory-sequence';
import { isIdempotencyViolation, postStockMovements } from './inventory-transactions';

export type AdjustmentLineInput = { productId: string; direction: 'in' | 'out'; qty: string };
export type AdjustmentInput = {
  storeId: string;
  type: 'count_correction' | 'damage' | 'loss' | 'donation' | 'write_off';
  reason?: string | null;
  note?: string | null;
  lines: AdjustmentLineInput[];
  idempotencyKey?: string | null;
};

async function verifyProducts(tenantId: string, productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.select({ id: inventoryProducts.id, name: inventoryProducts.name })
    .from(inventoryProducts)
    .where(and(eq(inventoryProducts.tenantId, tenantId), inArray(inventoryProducts.id, productIds)));
  const found = new Map<string, string>();
  for (const r of rows) found.set(r.id, r.name);
  return found;
}

export async function listAdjustments(
  tenantId: string,
  opts: { storeId?: string | null; type?: string | null; status?: string | null; from?: string | null; to?: string | null } = {},
) {
  const conditions = [eq(inventoryAdjustments.tenantId, tenantId)];
  if (opts.storeId) conditions.push(eq(inventoryAdjustments.storeId, opts.storeId));
  if (opts.type) conditions.push(eq(inventoryAdjustments.type, opts.type as any));
  if (opts.status) conditions.push(eq(inventoryAdjustments.status, opts.status as any));
  if (opts.from) conditions.push(sql`${inventoryAdjustments.createdAt} >= ${opts.from}`);
  if (opts.to) conditions.push(sql`${inventoryAdjustments.createdAt} <= ${opts.to}`);

  return db.select({
    id: inventoryAdjustments.id,
    adjustmentNumber: inventoryAdjustments.adjustmentNumber,
    storeId: inventoryAdjustments.storeId,
    storeName: inventoryStores.name,
    type: inventoryAdjustments.type,
    reason: inventoryAdjustments.reason,
    note: inventoryAdjustments.note,
    status: inventoryAdjustments.status,
    createdById: inventoryAdjustments.createdById,
    createdAt: inventoryAdjustments.createdAt,
    updatedAt: inventoryAdjustments.updatedAt,
  })
    .from(inventoryAdjustments)
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventoryAdjustments.storeId))
    .where(and(...conditions))
    .orderBy(desc(inventoryAdjustments.createdAt));
}

export async function getAdjustment(tenantId: string, id: string) {
  const [row] = await db.select({
    id: inventoryAdjustments.id,
    adjustmentNumber: inventoryAdjustments.adjustmentNumber,
    storeId: inventoryAdjustments.storeId,
    storeName: inventoryStores.name,
    type: inventoryAdjustments.type,
    reason: inventoryAdjustments.reason,
    note: inventoryAdjustments.note,
    status: inventoryAdjustments.status,
    createdById: inventoryAdjustments.createdById,
    createdAt: inventoryAdjustments.createdAt,
    updatedAt: inventoryAdjustments.updatedAt,
  })
    .from(inventoryAdjustments)
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventoryAdjustments.storeId))
    .where(and(eq(inventoryAdjustments.id, id), eq(inventoryAdjustments.tenantId, tenantId)))
    .limit(1);
  if (!row) return null;

  const lines = await db.select({
    id: inventoryAdjustmentLines.id,
    productId: inventoryAdjustmentLines.productId,
    productName: inventoryProducts.name,
    productCode: inventoryProducts.code,
    direction: inventoryAdjustmentLines.direction,
    qty: inventoryAdjustmentLines.qty,
  })
    .from(inventoryAdjustmentLines)
    .innerJoin(inventoryProducts, eq(inventoryProducts.id, inventoryAdjustmentLines.productId))
    .where(and(eq(inventoryAdjustmentLines.adjustmentId, id), eq(inventoryAdjustmentLines.tenantId, tenantId)));

  return { ...row, lines };
}

export async function createAdjustment(context: RequestContext, tenantId: string, input: AdjustmentInput) {
  if (input.lines.length === 0) throw new ApiError(422, 'INVALID_LINES', 'Au moins une ligne est requise.');

  if (input.idempotencyKey) {
    const existing = await db.select({ id: inventoryAdjustments.id }).from(inventoryAdjustments)
      .where(and(eq(inventoryAdjustments.tenantId, tenantId), eq(inventoryAdjustments.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existing[0]) return getAdjustment(tenantId, existing[0].id);
  }

  const [store] = await db.select({ id: inventoryStores.id }).from(inventoryStores)
    .where(and(eq(inventoryStores.id, input.storeId), eq(inventoryStores.tenantId, tenantId)))
    .limit(1);
  if (!store) throw new ApiError(422, 'INVALID_REF', 'Le magasin indiqué est introuvable dans cet établissement.');

  const products = await verifyProducts(tenantId, input.lines.map((l) => l.productId));
  for (const l of input.lines) {
    if (!products.has(l.productId)) {
      throw new ApiError(422, 'INVALID_REF', 'Un produit de l\'ajustement est introuvable dans cet établissement.');
    }
  }

  let adjustmentId = '';
  try {
    await db.transaction(async (tx) => {
      const adjustmentNumber = await reserveInventoryNumber(tx, tenantId, 'ADJ');
      const [adj] = await tx.insert(inventoryAdjustments).values({
        tenantId,
        adjustmentNumber,
        storeId: input.storeId,
        type: input.type,
        reason: input.reason?.trim() ?? null,
        note: input.note?.trim() ?? null,
        status: 'applied',
        createdById: context.userId,
        idempotencyKey: input.idempotencyKey ?? null,
      }).returning();
      if (!adj) throw new ApiError(500, 'INSERT_FAILED', 'Échec de l\'enregistrement de l\'ajustement.');
      adjustmentId = adj.id;

      const movements = input.lines.map((l, i) => ({
        storeId: input.storeId,
        productId: l.productId,
        movementType: (l.direction === 'in' ? 'adjustment_in' : 'adjustment_out') as 'adjustment_in' | 'adjustment_out',
        qtyMilli: l.direction === 'in' ? qtyToMilli(l.qty) : -qtyToMilli(l.qty),
        refType: 'adjustment' as const,
        refId: adj.id,
        idempotencyKey: `adjustment:${adj.id}:${input.storeId}:${l.productId}:${i}`,
        reason: `Ajustement ${input.type} N° ${adjustmentNumber}`,
      }));

      await postStockMovements(tx, { tenantId, actorId: context.userId, movements });

      await tx.insert(inventoryAdjustmentLines).values(
        input.lines.map((l) => ({
          tenantId,
          adjustmentId: adj.id,
          productId: l.productId,
          direction: l.direction,
          qty: l.qty,
        })),
      );
    });
  } catch (err) {
    if (isIdempotencyViolation(err) && input.idempotencyKey) {
      const existing = await db.select({ id: inventoryAdjustments.id }).from(inventoryAdjustments)
        .where(and(eq(inventoryAdjustments.tenantId, tenantId), eq(inventoryAdjustments.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (existing[0]) return getAdjustment(tenantId, existing[0].id);
    }
    throw err;
  }

  recordAudit(context, 'create', 'inventory_adjustment', adjustmentId, { type: input.type });
  return getAdjustment(tenantId, adjustmentId);
}
