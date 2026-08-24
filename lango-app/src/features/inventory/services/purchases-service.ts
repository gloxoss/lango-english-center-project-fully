// Purchasing service: create (ordered, no stock effect), receive (idempotent —
// posts receipt movements and creates one expenses row atomically), list with
// filters, detail with lines, reverse (v1: ordered→reversed only).
// Money math is exact cents (BigInt); quantities are scaled-int millis.
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import type { RequestContext } from '@/libs/api/context';
import { tryPostExpenseGLEntry } from '@/libs/finance/gl-auto-post';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import {
  expenses,
  inventoryProducts,
  inventoryPurchaseLines,
  inventoryPurchases,
  inventoryStores,
  inventorySuppliers,
} from '@/models/Schema';
import { qtyToMilli } from './inventory-math';
import { reserveInventoryNumber } from './inventory-sequence';
import { isIdempotencyViolation, postStockMovements } from './inventory-transactions';

export type PurchaseLineInput = { productId: string; qtyInPurchaseUnit: string; unitCost: number };
export type PurchaseInput = {
  supplierId: string;
  storeId: string;
  orderDate: string;
  notes?: string | null;
  lines: PurchaseLineInput[];
  paidAmount?: number | null;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'check' | null;
  paymentReference?: string | null;
};

const THOUSAND = BigInt(1000);

async function verifyProducts(tenantId: string, productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.select({ id: inventoryProducts.id, unitRatio: inventoryProducts.unitRatio })
    .from(inventoryProducts)
    .where(and(eq(inventoryProducts.tenantId, tenantId), inArray(inventoryProducts.id, productIds)));
  const found = new Map<string, string>();
  for (const r of rows) found.set(r.id, r.unitRatio);
  return found;
}

function lineTotalCents(qtyInPurchaseUnit: string, unitCost: number): bigint {
  const qtyMilli = qtyToMilli(qtyInPurchaseUnit);
  const costCents = moneyToCents(unitCost.toFixed(2));
  return (qtyMilli * costCents) / THOUSAND;
}

function baseQtyMilli(qtyInPurchaseUnit: string, unitRatio: string): bigint {
  const qtyMilli = qtyToMilli(qtyInPurchaseUnit);
  const ratioMilli = qtyToMilli(unitRatio);
  return (qtyMilli * ratioMilli) / THOUSAND;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listPurchases(
  tenantId: string,
  opts: { supplierId?: string | null; storeId?: string | null; status?: string | null; from?: string | null; to?: string | null } = {},
) {
  const conditions = [eq(inventoryPurchases.tenantId, tenantId)];
  if (opts.supplierId) conditions.push(eq(inventoryPurchases.supplierId, opts.supplierId));
  if (opts.storeId) conditions.push(eq(inventoryPurchases.storeId, opts.storeId));
  if (opts.status) conditions.push(eq(inventoryPurchases.status, opts.status as any));
  if (opts.from) conditions.push(gte(inventoryPurchases.orderDate, opts.from));
  if (opts.to) conditions.push(sql`${inventoryPurchases.orderDate} <= ${opts.to}`);

  return db.select({
    id: inventoryPurchases.id,
    purchaseNumber: inventoryPurchases.purchaseNumber,
    supplierId: inventoryPurchases.supplierId,
    supplierName: inventorySuppliers.name,
    storeId: inventoryPurchases.storeId,
    storeName: inventoryStores.name,
    status: inventoryPurchases.status,
    orderDate: inventoryPurchases.orderDate,
    receivedAt: inventoryPurchases.receivedAt,
    netAmount: inventoryPurchases.netAmount,
    paidAmount: inventoryPurchases.paidAmount,
    paymentStatus: sql<string>`case when ${inventoryPurchases.paidAmount} >= ${inventoryPurchases.netAmount} and ${inventoryPurchases.netAmount} > 0 then 'paid' when ${inventoryPurchases.paidAmount} > 0 then 'partial' else 'unpaid' end`,
    paymentMethod: inventoryPurchases.paymentMethod,
    paymentReference: inventoryPurchases.paymentReference,
    expenseId: inventoryPurchases.expenseId,
    recordedById: inventoryPurchases.recordedById,
    notes: inventoryPurchases.notes,
    createdAt: inventoryPurchases.createdAt,
    updatedAt: inventoryPurchases.updatedAt,
  })
    .from(inventoryPurchases)
    .innerJoin(inventorySuppliers, eq(inventorySuppliers.id, inventoryPurchases.supplierId))
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventoryPurchases.storeId))
    .where(and(...conditions))
    .orderBy(desc(inventoryPurchases.orderDate), desc(inventoryPurchases.createdAt));
}

export async function getPurchase(tenantId: string, id: string) {
  const [row] = await db.select({
    id: inventoryPurchases.id,
    purchaseNumber: inventoryPurchases.purchaseNumber,
    supplierId: inventoryPurchases.supplierId,
    supplierName: inventorySuppliers.name,
    storeId: inventoryPurchases.storeId,
    storeName: inventoryStores.name,
    status: inventoryPurchases.status,
    orderDate: inventoryPurchases.orderDate,
    receivedAt: inventoryPurchases.receivedAt,
    netAmount: inventoryPurchases.netAmount,
    paidAmount: inventoryPurchases.paidAmount,
    paymentMethod: inventoryPurchases.paymentMethod,
    paymentReference: inventoryPurchases.paymentReference,
    expenseId: inventoryPurchases.expenseId,
    recordedById: inventoryPurchases.recordedById,
    notes: inventoryPurchases.notes,
    createdAt: inventoryPurchases.createdAt,
    updatedAt: inventoryPurchases.updatedAt,
  })
    .from(inventoryPurchases)
    .innerJoin(inventorySuppliers, eq(inventorySuppliers.id, inventoryPurchases.supplierId))
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventoryPurchases.storeId))
    .where(and(eq(inventoryPurchases.id, id), eq(inventoryPurchases.tenantId, tenantId)))
    .limit(1);
  if (!row) return null;

  const lines = await db.select({
    id: inventoryPurchaseLines.id,
    productId: inventoryPurchaseLines.productId,
    productName: inventoryProducts.name,
    productCode: inventoryProducts.code,
    qtyInPurchaseUnit: inventoryPurchaseLines.qtyInPurchaseUnit,
    unitCost: inventoryPurchaseLines.unitCost,
    lineTotal: inventoryPurchaseLines.lineTotal,
  })
    .from(inventoryPurchaseLines)
    .innerJoin(inventoryProducts, eq(inventoryProducts.id, inventoryPurchaseLines.productId))
    .where(and(
      eq(inventoryPurchaseLines.purchaseId, id),
      eq(inventoryPurchaseLines.tenantId, tenantId),
    ));

  return { ...row, lines };
}

// ---------------------------------------------------------------------------
// Create (status = ordered; no stock effect)
// ---------------------------------------------------------------------------

export async function createPurchase(context: RequestContext, tenantId: string, input: PurchaseInput) {
  if (input.paidAmount != null && input.paidAmount < 0) {
    throw new ApiError(422, 'INVALID_AMOUNT', 'Le montant payé ne peut pas être négatif.');
  }
  const products = await verifyProducts(tenantId, input.lines.map((l) => l.productId));
  for (const l of input.lines) {
    if (!products.has(l.productId)) {
      throw new ApiError(422, 'INVALID_REF', 'Un produit de la commande est introuvable dans cet établissement.');
    }
  }

  const lineTotals = input.lines.map((l) => lineTotalCents(l.qtyInPurchaseUnit, l.unitCost));
  const netCents = lineTotals.reduce((acc, c) => acc + c, BigInt(0));
  const netAmount = Number(centsToMoney(netCents));

  if (input.paidAmount != null && moneyToCents(input.paidAmount.toFixed(2)) > netCents) {
    throw new ApiError(422, 'INVALID_AMOUNT', 'Le montant payé dépasse le total de la commande.');
  }

  let purchaseId = '';
  await db.transaction(async (tx) => {
    const purchaseNumber = await reserveInventoryNumber(tx, tenantId, 'PUR');
    const [purchase] = await tx.insert(inventoryPurchases).values({
      tenantId,
      purchaseNumber,
      supplierId: input.supplierId,
      storeId: input.storeId,
      status: 'ordered',
      orderDate: input.orderDate,
      netAmount,
      paidAmount: input.paidAmount ?? 0,
      paymentMethod: input.paymentMethod ?? null,
      paymentReference: input.paymentReference ?? null,
      recordedById: context.userId,
      notes: input.notes ?? null,
    }).returning();
    if (!purchase) throw new ApiError(500, 'INSERT_FAILED', 'Échec de l\'enregistrement de la commande.');

    const lineRows = input.lines.map((l, i) => ({
      tenantId,
      purchaseId: purchase.id,
      productId: l.productId,
      qtyInPurchaseUnit: l.qtyInPurchaseUnit,
      unitCost: l.unitCost,
      lineTotal: Number(centsToMoney(lineTotals[i]!)),
    }));
    await tx.insert(inventoryPurchaseLines).values(lineRows).execute();
    purchaseId = purchase.id;
  });

  recordAudit(context, 'create', 'inventory_purchase', purchaseId, { netAmount: String(netAmount) });
  return getPurchase(tenantId, purchaseId);
}

// ---------------------------------------------------------------------------
// Receive (idempotent) — posts receipt movements + one expense row atomically
// ---------------------------------------------------------------------------

export async function receivePurchase(context: RequestContext, tenantId: string, id: string) {
  const existing = await getPurchase(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Commande introuvable dans cet établissement.');
  if (existing.status === 'received') return existing;
  if (existing.status === 'reversed') {
    throw new ApiError(409, 'ALREADY_REVERSED', 'Cette commande a été annulée.');
  }

  try {
    await db.transaction(async (tx) => {
      const [doc] = await tx.select({ id: inventoryPurchases.id, status: inventoryPurchases.status })
        .from(inventoryPurchases)
        .where(and(eq(inventoryPurchases.id, id), eq(inventoryPurchases.tenantId, tenantId)))
        .for('update')
        .limit(1);
      if (!doc || doc.status === 'reversed') {
        throw new ApiError(409, 'ALREADY_REVERSED', 'Cette commande a été annulée.');
      }
      if (doc.status === 'received') return;

      const lines = await tx.select({
        productId: inventoryPurchaseLines.productId,
        unitRatio: inventoryProducts.unitRatio,
        qtyInPurchaseUnit: inventoryPurchaseLines.qtyInPurchaseUnit,
      })
        .from(inventoryPurchaseLines)
        .innerJoin(inventoryProducts, eq(inventoryProducts.id, inventoryPurchaseLines.productId))
        .where(and(eq(inventoryPurchaseLines.purchaseId, id), eq(inventoryPurchaseLines.tenantId, tenantId)));

      const movements = lines.map((l, i) => ({
        storeId: existing.storeId,
        productId: l.productId,
        movementType: 'receipt' as const,
        qtyMilli: baseQtyMilli(l.qtyInPurchaseUnit, l.unitRatio),
        refType: 'purchase' as const,
        refId: id,
        idempotencyKey: `purchase:${id}:${existing.storeId}:${l.productId}:${i}`,
        reason: `Réception commande ${existing.purchaseNumber}`,
      }));

      await postStockMovements(tx, { tenantId, actorId: context.userId, movements });

      const [expense] = await tx.insert(expenses).values({
        tenantId,
        category: 'supplies',
        amount: existing.netAmount,
        expenseDate: new Date().toISOString().slice(0, 10),
        description: `Achat N° ${existing.purchaseNumber} — ${existing.supplierName}`,
        recordedById: context.userId,
      }).returning();
      if (!expense) throw new ApiError(500, 'INSERT_FAILED', 'Échec de la création de la dépense.');

      await tx.update(inventoryPurchases)
        .set({ status: 'received', receivedAt: new Date().toISOString(), expenseId: expense.id, updatedAt: sql`now()` })
        .where(and(eq(inventoryPurchases.id, id), eq(inventoryPurchases.tenantId, tenantId)))
        .execute();
    });
  } catch (err) {
    if (isIdempotencyViolation(err)) {
      const current = await getPurchase(tenantId, id);
      if (current?.status === 'received') return current;
    }
    throw err;
  }

  const fresh = await getPurchase(tenantId, id);
  if (!fresh) throw new ApiError(500, 'UPDATE_FAILED', 'Échec de la réception de la commande.');
  recordAudit(context, 'update', 'inventory_purchase', id, { action: 'receive', expenseId: fresh.expenseId });
  // Fail-open GL — never block the receipt on CoA/fiscal-period config.
  await tryPostExpenseGLEntry({
    tenantId,
    actorId: context.userId,
    expenseId: fresh.expenseId!,
    description: `Achat N° ${fresh.purchaseNumber} — ${fresh.supplierName}`,
    amount: String(fresh.netAmount),
    expenseDate: fresh.receivedAt ?? new Date().toISOString().slice(0, 10),
  });
  return fresh;
}

// ---------------------------------------------------------------------------
// Reverse (v1: ordered → reversed only; no stock effect)
// ---------------------------------------------------------------------------

export async function reversePurchase(context: RequestContext, tenantId: string, id: string) {
  const existing = await getPurchase(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Commande introuvable dans cet établissement.');
  if (existing.status === 'reversed') return existing;
  if (existing.status === 'received') {
    throw new ApiError(409, 'NOT_REVERSIBLE', 'L\'annulation d\'une commande réceptionnée est différée. Annulez la réception manuellement.');
  }
  const [row] = await db.update(inventoryPurchases)
    .set({ status: 'reversed', updatedAt: sql`now()` })
    .where(and(eq(inventoryPurchases.id, id), eq(inventoryPurchases.tenantId, tenantId)))
    .returning();
  if (!row) throw new ApiError(500, 'UPDATE_FAILED', 'Échec de l\'annulation de la commande.');
  recordAudit(context, 'update', 'inventory_purchase', id, { action: 'reverse' });
  return getPurchase(tenantId, id);
}

// ---------------------------------------------------------------------------
// Auto-Purchase & Reorder Suggestions (§14.3)
// ---------------------------------------------------------------------------

export type ReorderSuggestionItem = {
  productId: string;
  productName: string;
  productCode: string;
  currentStock: number;
  reorderThreshold: number;
  suggestedQuantity: number;
  unitCost: number;
  estimatedTotal: number;
  defaultSupplierId: string | null;
  defaultSupplierName: string | null;
  targetStoreId: string | null;
  targetStoreName: string | null;
};

export async function getReorderSuggestions(tenantId: string, opts: { storeId?: string | null; threshold?: number } = {}) {
  const threshold = opts.threshold ?? 5;
  const [products, suppliers, stores] = await Promise.all([
    db.select({
      id: inventoryProducts.id,
      name: inventoryProducts.name,
      code: inventoryProducts.code,
      purchasePrice: inventoryProducts.purchasePrice,
      unitRatio: inventoryProducts.unitRatio,
    })
      .from(inventoryProducts)
      .where(and(eq(inventoryProducts.tenantId, tenantId), eq(inventoryProducts.isActive, true))),
    db.select({ id: inventorySuppliers.id, name: inventorySuppliers.name })
      .from(inventorySuppliers)
      .where(and(eq(inventorySuppliers.tenantId, tenantId), eq(inventorySuppliers.status, 'active'))),
    db.select({ id: inventoryStores.id, name: inventoryStores.name })
      .from(inventoryStores)
      .where(and(eq(inventoryStores.tenantId, tenantId), eq(inventoryStores.status, 'active'))),
  ]);

  const defaultSupplier = suppliers[0] ?? null;
  const defaultStore = (opts.storeId ? stores.find((s) => s.id === opts.storeId) : stores[0]) ?? null;

  // Query actual stock balances across products
  const productIds = products.map((p) => p.id);
  const balances = productIds.length > 0
    ? await db.select({
      productId: inventoryPurchaseLines.productId,
      supplierId: inventoryPurchases.supplierId,
    })
      .from(inventoryPurchaseLines)
      .innerJoin(inventoryPurchases, eq(inventoryPurchases.id, inventoryPurchaseLines.purchaseId))
      .where(and(eq(inventoryPurchaseLines.tenantId, tenantId), inArray(inventoryPurchaseLines.productId, productIds)))
      .orderBy(desc(inventoryPurchases.orderDate))
      .limit(100)
    : [];

  const recentSupplierMap = new Map<string, string>();
  for (const b of balances) {
    if (!recentSupplierMap.has(b.productId)) {
      recentSupplierMap.set(b.productId, b.supplierId);
    }
  }

  // Load balances from catalog service helper logic
  const stockRows = productIds.length > 0
    ? await db.select({
      productId: sql<string>`product_id`,
      totalStock: sql<number>`COALESCE(SUM(CAST(quantity AS numeric)), 0)`,
    })
      .from(sql`inventory_stock_balances`)
      .where(and(eq(sql`tenant_id`, tenantId), inArray(sql`product_id`, productIds)))
      .groupBy(sql`product_id`)
    : [];

  const stockMap = new Map<string, number>();
  for (const s of stockRows) {
    stockMap.set(s.productId, Number(s.totalStock));
  }

  const suggestions: ReorderSuggestionItem[] = [];
  for (const p of products) {
    const currentStock = stockMap.get(p.id) ?? 0;
    if (currentStock <= threshold) {
      const suggestedQty = Math.max(10, Math.ceil(25 - currentStock));
      const unitCost = p.purchasePrice ? Number(p.purchasePrice) : 50;
      const estimatedTotal = suggestedQty * unitCost;

      const matchedSupplierId = recentSupplierMap.get(p.id) || defaultSupplier?.id || null;
      const matchedSupplier = suppliers.find((s) => s.id === matchedSupplierId) || defaultSupplier;

      suggestions.push({
        productId: p.id,
        productName: p.name,
        productCode: p.code,
        currentStock,
        reorderThreshold: threshold,
        suggestedQuantity: suggestedQty,
        unitCost,
        estimatedTotal,
        defaultSupplierId: matchedSupplier?.id ?? null,
        defaultSupplierName: matchedSupplier?.name ?? null,
        targetStoreId: defaultStore?.id ?? null,
        targetStoreName: defaultStore?.name ?? null,
      });
    }
  }

  return {
    threshold,
    totalSuggestions: suggestions.length,
    estimatedTotalBudget: suggestions.reduce((sum, item) => sum + item.estimatedTotal, 0),
    suggestions,
    suppliers,
    stores,
  };
}

export type AutoGeneratePoGroup = {
  supplierId: string;
  storeId: string;
  lines: Array<{ productId: string; qtyInPurchaseUnit: string; unitCost: number }>;
  notes?: string;
};

export async function generateDraftPurchaseOrders(
  context: RequestContext,
  tenantId: string,
  orders: AutoGeneratePoGroup[],
) {
  const createdPurchases = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const order of orders) {
    if (!order.supplierId || !order.storeId || order.lines.length === 0) continue;
    const po = await createPurchase(context, tenantId, {
      supplierId: order.supplierId,
      storeId: order.storeId,
      orderDate: today,
      notes: order.notes || 'Généré automatiquement par l\'assistant de réapprovisionnement',
      lines: order.lines,
    });
    createdPurchases.push(po);
  }

  return {
    createdCount: createdPurchases.length,
    purchases: createdPurchases,
  };
}

