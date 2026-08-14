// Store-to-store transfers service. Create posts a `pending` doc with NO stock
// effect. `complete` is the atomic "post" transition: in one transaction it
// posts paired `transfer_out` (− at fromStore) + `transfer_in` (+ at toStore)
// movements for the same qty, so no half-moved stock is ever observable, and the
// availability check runs against fromStore only. `cancel` is allowed only while
// `pending` (nothing to undo). Both transitions are idempotent via the state guard.
import { aliasedTable, and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import type { RequestContext } from '@/libs/api/context';
import {
  inventoryProducts, inventoryStores, inventoryTransferLines, inventoryTransfers,
} from '@/models/Schema';
import { qtyToMilli } from './inventory-math';
import { reserveInventoryNumber } from './inventory-sequence';
import { isIdempotencyViolation, postStockMovements } from './inventory-transactions';

const fromStore = aliasedTable(inventoryStores, 'from_store');
const toStore = aliasedTable(inventoryStores, 'to_store');

export type TransferLineInput = { productId: string; qty: string };
export type TransferInput = {
  fromStoreId: string;
  toStoreId: string;
  reason?: string | null;
  lines: TransferLineInput[];
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

export async function listTransfers(
  tenantId: string,
  opts: { fromStoreId?: string | null; toStoreId?: string | null; status?: string | null } = {},
) {
  const conditions = [eq(inventoryTransfers.tenantId, tenantId)];
  if (opts.fromStoreId) conditions.push(eq(inventoryTransfers.fromStoreId, opts.fromStoreId));
  if (opts.toStoreId) conditions.push(eq(inventoryTransfers.toStoreId, opts.toStoreId));
  if (opts.status) conditions.push(eq(inventoryTransfers.status, opts.status as any));

  return db.select({
    id: inventoryTransfers.id,
    transferNumber: inventoryTransfers.transferNumber,
    fromStoreId: inventoryTransfers.fromStoreId,
    fromStoreName: fromStore.name,
    toStoreId: inventoryTransfers.toStoreId,
    toStoreName: toStore.name,
    reason: inventoryTransfers.reason,
    status: inventoryTransfers.status,
    createdById: inventoryTransfers.createdById,
    completedAt: inventoryTransfers.completedAt,
    cancelledAt: inventoryTransfers.cancelledAt,
    createdAt: inventoryTransfers.createdAt,
    updatedAt: inventoryTransfers.updatedAt,
  })
    .from(inventoryTransfers)
    .innerJoin(fromStore, eq(fromStore.id, inventoryTransfers.fromStoreId))
    .innerJoin(toStore, eq(toStore.id, inventoryTransfers.toStoreId))
    .where(and(...conditions))
    .orderBy(desc(inventoryTransfers.createdAt));
}

export async function getTransfer(tenantId: string, id: string) {
  const [row] = await db.select({
    id: inventoryTransfers.id,
    transferNumber: inventoryTransfers.transferNumber,
    fromStoreId: inventoryTransfers.fromStoreId,
    fromStoreName: fromStore.name,
    toStoreId: inventoryTransfers.toStoreId,
    toStoreName: toStore.name,
    reason: inventoryTransfers.reason,
    status: inventoryTransfers.status,
    createdById: inventoryTransfers.createdById,
    completedAt: inventoryTransfers.completedAt,
    completedById: inventoryTransfers.completedById,
    cancelledAt: inventoryTransfers.cancelledAt,
    cancelledById: inventoryTransfers.cancelledById,
    createdAt: inventoryTransfers.createdAt,
    updatedAt: inventoryTransfers.updatedAt,
  })
    .from(inventoryTransfers)
    .innerJoin(fromStore, eq(fromStore.id, inventoryTransfers.fromStoreId))
    .innerJoin(toStore, eq(toStore.id, inventoryTransfers.toStoreId))
    .where(and(eq(inventoryTransfers.id, id), eq(inventoryTransfers.tenantId, tenantId)))
    .limit(1);
  if (!row) return null;

  const lines = await db.select({
    id: inventoryTransferLines.id,
    productId: inventoryTransferLines.productId,
    productName: inventoryProducts.name,
    productCode: inventoryProducts.code,
    qty: inventoryTransferLines.qty,
  })
    .from(inventoryTransferLines)
    .innerJoin(inventoryProducts, eq(inventoryProducts.id, inventoryTransferLines.productId))
    .where(and(eq(inventoryTransferLines.transferId, id), eq(inventoryTransferLines.tenantId, tenantId)));

  return { ...row, lines };
}

export async function createTransfer(context: RequestContext, tenantId: string, input: TransferInput) {
  if (input.lines.length === 0) throw new ApiError(422, 'INVALID_LINES', 'Au moins une ligne est requise.');
  if (input.fromStoreId === input.toStoreId) {
    throw new ApiError(422, 'INVALID_REF', 'Le magasin de départ et d\'arrivée doivent être différents.');
  }

  if (input.idempotencyKey) {
    const existing = await db.select({ id: inventoryTransfers.id }).from(inventoryTransfers)
      .where(and(eq(inventoryTransfers.tenantId, tenantId), eq(inventoryTransfers.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existing[0]) return getTransfer(tenantId, existing[0].id);
  }

  const [fromStore] = await db.select({ id: inventoryStores.id }).from(inventoryStores)
    .where(and(eq(inventoryStores.id, input.fromStoreId), eq(inventoryStores.tenantId, tenantId)))
    .limit(1);
  const [toStore] = await db.select({ id: inventoryStores.id }).from(inventoryStores)
    .where(and(eq(inventoryStores.id, input.toStoreId), eq(inventoryStores.tenantId, tenantId)))
    .limit(1);
  if (!fromStore || !toStore) {
    throw new ApiError(422, 'INVALID_REF', 'Un magasin du transfert est introuvable dans cet établissement.');
  }

  const products = await verifyProducts(tenantId, input.lines.map((l) => l.productId));
  for (const l of input.lines) {
    if (!products.has(l.productId)) {
      throw new ApiError(422, 'INVALID_REF', 'Un produit du transfert est introuvable dans cet établissement.');
    }
  }

  let transferId = '';
  try {
    await db.transaction(async (tx) => {
      const transferNumber = await reserveInventoryNumber(tx, tenantId, 'TRF');
      const [tf] = await tx.insert(inventoryTransfers).values({
        tenantId,
        transferNumber,
        fromStoreId: input.fromStoreId,
        toStoreId: input.toStoreId,
        reason: input.reason?.trim() ?? null,
        status: 'pending',
        createdById: context.userId,
        idempotencyKey: input.idempotencyKey ?? null,
      }).returning();
      if (!tf) throw new ApiError(500, 'INSERT_FAILED', 'Échec de l\'enregistrement du transfert.');
      transferId = tf.id;

      await tx.insert(inventoryTransferLines).values(
        input.lines.map((l) => ({
          tenantId,
          transferId: tf.id,
          productId: l.productId,
          qty: l.qty,
        })),
      );
    });
  } catch (err) {
    if (isIdempotencyViolation(err) && input.idempotencyKey) {
      const existing = await db.select({ id: inventoryTransfers.id }).from(inventoryTransfers)
        .where(and(eq(inventoryTransfers.tenantId, tenantId), eq(inventoryTransfers.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (existing[0]) return getTransfer(tenantId, existing[0].id);
    }
    throw err;
  }

  recordAudit(context, 'create', 'inventory_transfer', transferId, {});
  return getTransfer(tenantId, transferId);
}

// ---------------------------------------------------------------------------
// Post transitions (idempotent state guards)
// ---------------------------------------------------------------------------

export async function completeTransfer(context: RequestContext, tenantId: string, id: string) {
  const existing = await getTransfer(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Transfert introuvable dans cet établissement.');
  if (existing.status === 'completed') return existing;
  if (existing.status === 'reversed') {
    throw new ApiError(409, 'TRANSFER_CANCELLED', 'Un transfert annulé ne peut pas être complété.');
  }

  await db.transaction(async (tx) => {
    const [doc] = await tx.select({ id: inventoryTransfers.id, status: inventoryTransfers.status })
      .from(inventoryTransfers)
      .where(and(eq(inventoryTransfers.id, id), eq(inventoryTransfers.tenantId, tenantId)))
      .for('update')
      .limit(1);
    if (!doc || doc.status !== 'pending') return;

    const lines = await tx.select({
      productId: inventoryTransferLines.productId,
      qty: inventoryTransferLines.qty,
    })
      .from(inventoryTransferLines)
      .where(and(eq(inventoryTransferLines.transferId, id), eq(inventoryTransferLines.tenantId, tenantId)));

    const movements = lines.flatMap((l, i) => [
      {
        storeId: existing.fromStoreId,
        productId: l.productId,
        movementType: 'transfer_out' as const,
        qtyMilli: -qtyToMilli(l.qty),
        refType: 'transfer' as const,
        refId: id,
        idempotencyKey: `transfer_out:${id}:${existing.fromStoreId}:${l.productId}:${i}`,
        reason: `Transfert N° ${existing.transferNumber}`,
      },
      {
        storeId: existing.toStoreId,
        productId: l.productId,
        movementType: 'transfer_in' as const,
        qtyMilli: qtyToMilli(l.qty),
        refType: 'transfer' as const,
        refId: id,
        idempotencyKey: `transfer_in:${id}:${existing.toStoreId}:${l.productId}:${i}`,
        reason: `Transfert N° ${existing.transferNumber}`,
      },
    ]);

    await postStockMovements(tx, { tenantId, actorId: context.userId, movements });

    await tx.update(inventoryTransfers)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        completedById: context.userId,
      })
      .where(and(eq(inventoryTransfers.id, id), eq(inventoryTransfers.tenantId, tenantId)))
      .execute();
  });

  recordAudit(context, 'update', 'inventory_transfer', id, { action: 'complete' });
  return getTransfer(tenantId, id);
}

export async function cancelTransfer(context: RequestContext, tenantId: string, id: string) {
  const existing = await getTransfer(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Transfert introuvable dans cet établissement.');
  if (existing.status === 'reversed') return existing;
  if (existing.status !== 'pending') {
    throw new ApiError(409, 'TRANSFER_COMPLETED', 'Seul un transfert en attente peut être annulé.');
  }

  await db.transaction(async (tx) => {
    const [doc] = await tx.select({ id: inventoryTransfers.id, status: inventoryTransfers.status })
      .from(inventoryTransfers)
      .where(and(eq(inventoryTransfers.id, id), eq(inventoryTransfers.tenantId, tenantId)))
      .for('update')
      .limit(1);
    if (!doc || doc.status !== 'pending') return;

    await tx.update(inventoryTransfers)
      .set({
        status: 'reversed',
        cancelledAt: new Date().toISOString(),
        cancelledById: context.userId,
      })
      .where(and(eq(inventoryTransfers.id, id), eq(inventoryTransfers.tenantId, tenantId)))
      .execute();
  });

  recordAudit(context, 'update', 'inventory_transfer', id, { action: 'cancel' });
  return getTransfer(tenantId, id);
}
