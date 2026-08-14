// Sales/POS service. The sale-to-role fork is the core of the design:
//  * student sale → creates a REAL invoices + invoiceItems + (if paid) payments +
//    paymentAllocations row atomically with the stock movements (§5 step 6), so
//    stock can never decrement without its invoice. invoiceNumber reuses the
//    finance format INV-{year}-{4 digits}.
//  * staff/guest counter sale → no invoices/payments (invoices.studentId is NOT
//    NULL, so a family ledger is structurally impossible); netAmount/paidAmount/
//    paymentMethod/paymentReference live on the sale record only.
// Reversal restores stock via compensating sale_reversal movements and flips the
// status; Finance-side credit note / refund for a reversed student sale is
// deferred (documented in EXECUTION-PLAN.md §16). Money is cents (BigInt),
// quantities scaled-int millis.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import type { RequestContext } from '@/libs/api/context';
import { tryPostPaymentGLEntry } from '@/libs/finance/gl-auto-post';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import {
  invoiceItems, invoices, inventoryProducts, inventorySaleLines, inventorySales, inventoryStores,
  paymentAllocations, payments, user,
} from '@/models/Schema';
import { milliToQty, qtyToMilli } from './inventory-math';
import { reserveInventoryNumber } from './inventory-sequence';
import { isIdempotencyViolation, postStockMovements } from './inventory-transactions';

export type SaleLineInput = { productId: string; qty: string; unitPrice: number };
export type SaleInput = {
  storeId: string;
  saleToRole: 'student' | 'staff' | 'guest';
  studentId?: string | null;
  customerName?: string | null;
  saleDate: string;
  paidAmount?: number | null;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'check' | null;
  paymentReference?: string | null;
  lines: SaleLineInput[];
  idempotencyKey?: string | null;
};

const THOUSAND = BigInt(1000);

function lineTotalCents(qty: string, unitPrice: number): bigint {
  const qtyMilli = qtyToMilli(qty);
  const priceCents = moneyToCents(unitPrice.toFixed(2));
  return (qtyMilli * priceCents) / THOUSAND;
}

async function verifyProducts(tenantId: string, productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.select({ id: inventoryProducts.id, name: inventoryProducts.name })
    .from(inventoryProducts)
    .where(and(eq(inventoryProducts.tenantId, tenantId), inArray(inventoryProducts.id, productIds)));
  const found = new Map<string, string>();
  for (const r of rows) found.set(r.id, r.name);
  return found;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listSales(
  tenantId: string,
  opts: { storeId?: string | null; status?: string | null; saleToRole?: string | null; from?: string | null; to?: string | null } = {},
) {
  const conditions = [eq(inventorySales.tenantId, tenantId)];
  if (opts.storeId) conditions.push(eq(inventorySales.storeId, opts.storeId));
  if (opts.status) conditions.push(eq(inventorySales.status, opts.status as any));
  if (opts.saleToRole) conditions.push(eq(inventorySales.saleToRole, opts.saleToRole as any));
  if (opts.from) conditions.push(sql`${inventorySales.saleDate} >= ${opts.from}`);
  if (opts.to) conditions.push(sql`${inventorySales.saleDate} <= ${opts.to}`);

  return db.select({
    id: inventorySales.id,
    saleNumber: inventorySales.saleNumber,
    storeId: inventorySales.storeId,
    storeName: inventoryStores.name,
    saleToRole: inventorySales.saleToRole,
    studentId: inventorySales.studentId,
    studentName: user.name,
    customerName: inventorySales.customerName,
    saleDate: inventorySales.saleDate,
    netAmount: inventorySales.netAmount,
    paidAmount: inventorySales.paidAmount,
    paymentStatus: sql<string>`case when ${inventorySales.paidAmount} >= ${inventorySales.netAmount} and ${inventorySales.netAmount} > 0 then 'paid' when ${inventorySales.paidAmount} > 0 then 'partial' else 'unpaid' end`,
    paymentMethod: inventorySales.paymentMethod,
    paymentReference: inventorySales.paymentReference,
    status: inventorySales.status,
    invoiceId: inventorySales.invoiceId,
    recordedById: inventorySales.recordedById,
    reversalReason: inventorySales.reversalReason,
    createdAt: inventorySales.createdAt,
    updatedAt: inventorySales.updatedAt,
  })
    .from(inventorySales)
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventorySales.storeId))
    .leftJoin(user, eq(user.id, inventorySales.studentId))
    .where(and(...conditions))
    .orderBy(desc(inventorySales.saleDate), desc(inventorySales.createdAt));
}

export async function getSale(tenantId: string, id: string) {
  const [row] = await db.select({
    id: inventorySales.id,
    saleNumber: inventorySales.saleNumber,
    storeId: inventorySales.storeId,
    storeName: inventoryStores.name,
    saleToRole: inventorySales.saleToRole,
    studentId: inventorySales.studentId,
    studentName: user.name,
    customerName: inventorySales.customerName,
    saleDate: inventorySales.saleDate,
    netAmount: inventorySales.netAmount,
    paidAmount: inventorySales.paidAmount,
    paymentMethod: inventorySales.paymentMethod,
    paymentReference: inventorySales.paymentReference,
    status: inventorySales.status,
    invoiceId: inventorySales.invoiceId,
    recordedById: inventorySales.recordedById,
    reversedById: inventorySales.reversedById,
    reversedAt: inventorySales.reversedAt,
    reversalReason: inventorySales.reversalReason,
    createdAt: inventorySales.createdAt,
    updatedAt: inventorySales.updatedAt,
  })
    .from(inventorySales)
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventorySales.storeId))
    .leftJoin(user, eq(user.id, inventorySales.studentId))
    .where(and(eq(inventorySales.id, id), eq(inventorySales.tenantId, tenantId)))
    .limit(1);
  if (!row) return null;

  const lines = await db.select({
    id: inventorySaleLines.id,
    productId: inventorySaleLines.productId,
    productName: inventoryProducts.name,
    productCode: inventoryProducts.code,
    qty: inventorySaleLines.qty,
    unitPrice: inventorySaleLines.unitPrice,
    lineTotal: inventorySaleLines.lineTotal,
    invoiceItemId: inventorySaleLines.invoiceItemId,
  })
    .from(inventorySaleLines)
    .innerJoin(inventoryProducts, eq(inventoryProducts.id, inventorySaleLines.productId))
    .where(and(
      eq(inventorySaleLines.saleId, id),
      eq(inventorySaleLines.tenantId, tenantId),
    ));

  return { ...row, lines };
}

// ---------------------------------------------------------------------------
// Create (role fork → invoice/payment integration for students)
// ---------------------------------------------------------------------------

export async function createSale(context: RequestContext, tenantId: string, input: SaleInput) {
  if (input.saleToRole === 'student' && !input.studentId) {
    throw new ApiError(422, 'INVALID_REF', 'Une vente étudiant doit préciser l\'étudiant.');
  }
  if (input.saleToRole !== 'student' && !input.customerName?.trim()) {
    throw new ApiError(422, 'INVALID_REF', 'Une vente comptoir doit préciser le nom du client.');
  }
  if (input.paidAmount != null && input.paidAmount < 0) {
    throw new ApiError(422, 'INVALID_AMOUNT', 'Le montant payé ne peut pas être négatif.');
  }

  // Client-retry idempotency: an identical POST with the same key short-circuits.
  if (input.idempotencyKey) {
    const existing = await db.select({ id: inventorySales.id }).from(inventorySales)
      .where(and(eq(inventorySales.tenantId, tenantId), eq(inventorySales.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existing[0]) return getSale(tenantId, existing[0].id);
  }

  let studentName: string | null = null;
  if (input.saleToRole === 'student') {
    const [stu] = await db.select({ id: user.id, name: user.name }).from(user)
      .where(and(eq(user.id, input.studentId!), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!stu) {
      throw new ApiError(422, 'INVALID_REF', 'L\'étudiant indiqué est introuvable dans cet établissement.');
    }
    studentName = stu.name;
  }

  const [store] = await db.select({ id: inventoryStores.id }).from(inventoryStores)
    .where(and(eq(inventoryStores.id, input.storeId), eq(inventoryStores.tenantId, tenantId)))
    .limit(1);
  if (!store) {
    throw new ApiError(422, 'INVALID_REF', 'Le magasin indiqué est introuvable dans cet établissement.');
  }

  const products = await verifyProducts(tenantId, input.lines.map((l) => l.productId));
  for (const l of input.lines) {
    if (!products.has(l.productId)) {
      throw new ApiError(422, 'INVALID_REF', 'Un produit de la vente est introuvable dans cet établissement.');
    }
  }

  const lineTotals = input.lines.map((l) => lineTotalCents(l.qty, l.unitPrice));
  const netCents = lineTotals.reduce((acc, c) => acc + c, BigInt(0));
  const netAmount = Number(centsToMoney(netCents));

  if (input.paidAmount != null && moneyToCents(input.paidAmount.toFixed(2)) > netCents) {
    throw new ApiError(422, 'INVALID_AMOUNT', 'Le montant payé dépasse le total de la vente.');
  }

  let saleId = '';
  let invoiceId: string | null = null;
  let paymentId: string | null = null;
  let invoiceNumber: string | null = null;

  try {
    await db.transaction(async (tx) => {
      const saleNumber = await reserveInventoryNumber(tx, tenantId, 'SAL');
      const [sale] = await tx.insert(inventorySales).values({
        tenantId,
        saleNumber,
        storeId: input.storeId,
        saleToRole: input.saleToRole,
        studentId: input.saleToRole === 'student' ? input.studentId : null,
        customerName: input.saleToRole === 'student' ? null : input.customerName?.trim() ?? null,
        saleDate: input.saleDate,
        netAmount,
        paidAmount: input.paidAmount ?? 0,
        paymentMethod: input.paymentMethod ?? null,
        paymentReference: input.paymentReference ?? null,
        status: 'completed',
        recordedById: context.userId,
        idempotencyKey: input.idempotencyKey ?? null,
      }).returning();
      if (!sale) throw new ApiError(500, 'INSERT_FAILED', 'Échec de l\'enregistrement de la vente.');
      saleId = sale.id;

      const movements = input.lines.map((l, i) => ({
        storeId: input.storeId,
        productId: l.productId,
        movementType: 'sale' as const,
        qtyMilli: -qtyToMilli(l.qty),
        refType: 'sale' as const,
        refId: sale.id,
        idempotencyKey: `sale:${sale.id}:${input.storeId}:${l.productId}:${i}`,
        reason: `Vente N° ${saleNumber}`,
      }));

      await postStockMovements(tx, { tenantId, actorId: context.userId, movements });

      const lineRows = input.lines.map((l, i) => ({
        tenantId,
        saleId: sale.id,
        productId: l.productId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: Number(centsToMoney(lineTotals[i]!)),
        invoiceItemId: null,
      }));
      const insertedLines = await tx.insert(inventorySaleLines).values(lineRows).returning();
      const lineIds = insertedLines.map((l) => l.id);

      if (input.saleToRole === 'student') {
        const year = new Date(input.saleDate).getFullYear() || new Date().getFullYear();
        const invNumber = `INV-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;
        const [invoice] = await tx.insert(invoices).values({
          tenantId,
          studentId: input.studentId!,
          invoiceNumber: invNumber,
          amount: netAmount,
          discountAmount: 0,
          netAmount,
          paidAmount: input.paidAmount ?? 0,
          status: paidStatus(input.paidAmount ?? 0, netAmount),
          dueDate: input.saleDate,
          issueDate: input.saleDate,
          note: `Vente N° ${saleNumber}`,
        }).returning();
        if (!invoice) throw new ApiError(500, 'INSERT_FAILED', 'Échec de la création de la facture.');

        const itemRows = input.lines.map((l, i) => ({
          tenantId,
          invoiceId: invoice.id,
          description: `${products.get(l.productId) ?? l.productId} × ${l.qty}`,
          amount: Number(centsToMoney(lineTotals[i]!)),
        }));
        const items = await tx.insert(invoiceItems).values(itemRows).returning();
        for (let i = 0; i < lineIds.length; i++) {
          const item = items[i];
          if (item) {
            await tx.update(inventorySaleLines)
              .set({ invoiceItemId: item.id })
              .where(and(eq(inventorySaleLines.id, lineIds[i]!), eq(inventorySaleLines.tenantId, tenantId)))
              .execute();
          }
        }

        const paid = input.paidAmount ?? 0;
        if (paid > 0) {
          const [payment] = await tx.insert(payments).values({
            tenantId,
            invoiceId: invoice.id,
            studentId: input.studentId!,
            amount: paid,
            paymentMethod: input.paymentMethod ?? 'cash',
            referenceId: input.paymentReference ?? null,
            receivedById: context.userId,
          }).returning();
          if (!payment) throw new ApiError(500, 'INSERT_FAILED', 'Échec de l\'enregistrement du paiement.');

          await tx.insert(paymentAllocations).values({
            tenantId,
            paymentId: payment.id,
            invoiceId: invoice.id,
            allocatedAmount: paid.toFixed(2),
          });
          paymentId = payment.id;
        }

        await tx.update(inventorySales)
          .set({ invoiceId: invoice.id, updatedAt: sql`now()` })
          .where(and(eq(inventorySales.id, sale.id), eq(inventorySales.tenantId, tenantId)))
          .execute();
        invoiceId = invoice.id;
        invoiceNumber = invNumber;
      }
    });
  } catch (err) {
    if (isIdempotencyViolation(err) && input.idempotencyKey) {
      const existing = await db.select({ id: inventorySales.id }).from(inventorySales)
        .where(and(eq(inventorySales.tenantId, tenantId), eq(inventorySales.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (existing[0]) return getSale(tenantId, existing[0].id);
    }
    throw err;
  }

  recordAudit(context, 'create', 'inventory_sale', saleId, {
    netAmount: String(netAmount),
    saleToRole: input.saleToRole,
    invoiceId: invoiceId ?? undefined,
  });
  if (input.saleToRole === 'student' && paymentId && invoiceNumber && (input.paidAmount ?? 0) > 0) {
    // Fail-open GL — never block the sale on CoA/fiscal-period config.
    await tryPostPaymentGLEntry({
      tenantId,
      actorId: context.userId,
      paymentId,
      invoiceNumber,
      amount: String(input.paidAmount),
      paymentDate: new Date().toISOString(),
    });
  }
  return getSale(tenantId, saleId);
}

function paidStatus(paidAmount: number, netAmount: number): 'pending' | 'partial' | 'paid' {
  if (paidAmount > 0 && paidAmount < netAmount) return 'partial';
  if (paidAmount >= netAmount && netAmount > 0) return 'paid';
  return 'pending';
}

// ---------------------------------------------------------------------------
// Reverse (v1: restores stock + status flip; Finance credit note deferred)
// ---------------------------------------------------------------------------

export async function reverseSale(context: RequestContext, tenantId: string, id: string, reason?: string | null) {
  const existing = await getSale(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Vente introuvable dans cet établissement.');
  if (existing.status === 'reversed') return existing;

  await db.transaction(async (tx) => {
    const [doc] = await tx.select({ id: inventorySales.id, status: inventorySales.status })
      .from(inventorySales)
      .where(and(eq(inventorySales.id, id), eq(inventorySales.tenantId, tenantId)))
      .for('update')
      .limit(1);
    if (!doc || doc.status === 'reversed') return;

    const lines = await tx.select({
      productId: inventorySaleLines.productId,
      qty: inventorySaleLines.qty,
    })
      .from(inventorySaleLines)
      .where(and(eq(inventorySaleLines.saleId, id), eq(inventorySaleLines.tenantId, tenantId)));

    const movements = lines.map((l, i) => ({
      storeId: existing.storeId,
      productId: l.productId,
      movementType: 'sale_reversal' as const,
      qtyMilli: qtyToMilli(l.qty),
      refType: 'sale' as const,
      refId: id,
      idempotencyKey: `sale_reversal:${id}:${existing.storeId}:${l.productId}:${i}`,
      reason: reason?.trim() ? `Annulation ${existing.saleNumber} — ${reason.trim()}` : `Annulation ${existing.saleNumber}`,
    }));

    await postStockMovements(tx, { tenantId, actorId: context.userId, movements });

    await tx.update(inventorySales)
      .set({
        status: 'reversed',
        reversedById: context.userId,
        reversedAt: new Date().toISOString(),
        reversalReason: reason?.trim() ?? null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(inventorySales.id, id), eq(inventorySales.tenantId, tenantId)))
      .execute();
  });

  recordAudit(context, 'update', 'inventory_sale', id, { action: 'reverse', reason: reason ?? undefined });
  return getSale(tenantId, id);
}
