// Issues / loans service. `issue` is a stock-out: each line posts a negative
// `issue` movement after the availability check, so a loan can never push a
// balance below zero. Return (`returned`) restores sellable stock with positive
// `issue_return` movements. Damaged/lost are *dispositions* recorded on the
// issue doc (status flip + returnDate): the units already left sellable stock at
// issue time, so no extra movement is posted — an `adjustment_out` here would
// double-decrement the balance and could trip the non-negative invariant
// (documented deviation from EXECUTION-PLAN.md §10). `overdue` is derived at
// read time, never stored. Idempotency = doc-level state guard + per-line keys.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import type { RequestContext } from '@/libs/api/context';
import {
  inventoryIssueLines, inventoryIssues, inventoryProducts, inventoryStores, user,
} from '@/models/Schema';
import { qtyToMilli } from './inventory-math';
import { reserveInventoryNumber } from './inventory-sequence';
import { isIdempotencyViolation, postStockMovements } from './inventory-transactions';

export type IssueLineInput = { productId: string; qty: string };
export type IssueInput = {
  storeId: string;
  issueToRole: 'student' | 'staff' | 'guest';
  studentId?: string | null;
  issueToName?: string | null;
  issueDate: string;
  dueDate: string;
  lines: IssueLineInput[];
  idempotencyKey?: string | null;
};

const isOverdue = (row: { status: string; dueDate: string | null; returnDate: string | null }) =>
  row.status === 'issued' && !!row.dueDate && !row.returnDate && row.dueDate < new Date().toISOString().slice(0, 10);

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

export async function listIssues(
  tenantId: string,
  opts: { storeId?: string | null; status?: string | null; issueToRole?: string | null; from?: string | null; to?: string | null } = {},
) {
  const conditions = [eq(inventoryIssues.tenantId, tenantId)];
  if (opts.storeId) conditions.push(eq(inventoryIssues.storeId, opts.storeId));
  if (opts.status) conditions.push(eq(inventoryIssues.status, opts.status as any));
  if (opts.issueToRole) conditions.push(eq(inventoryIssues.issueToRole, opts.issueToRole as any));
  if (opts.from) conditions.push(sql`${inventoryIssues.issueDate} >= ${opts.from}`);
  if (opts.to) conditions.push(sql`${inventoryIssues.issueDate} <= ${opts.to}`);

  const rows = await db.select({
    id: inventoryIssues.id,
    issueNumber: inventoryIssues.issueNumber,
    storeId: inventoryIssues.storeId,
    storeName: inventoryStores.name,
    issueToRole: inventoryIssues.issueToRole,
    studentId: inventoryIssues.studentId,
    studentName: user.name,
    issueToName: inventoryIssues.issueToName,
    issueDate: inventoryIssues.issueDate,
    dueDate: inventoryIssues.dueDate,
    returnDate: inventoryIssues.returnDate,
    status: inventoryIssues.status,
    recordedById: inventoryIssues.recordedById,
    createdAt: inventoryIssues.createdAt,
    updatedAt: inventoryIssues.updatedAt,
  })
    .from(inventoryIssues)
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventoryIssues.storeId))
    .leftJoin(user, eq(user.id, inventoryIssues.studentId))
    .where(and(...conditions))
    .orderBy(desc(inventoryIssues.issueDate), desc(inventoryIssues.createdAt));

  return rows.map((r) => ({ ...r, isOverdue: isOverdue(r) }));
}

export async function getIssue(tenantId: string, id: string) {
  const [row] = await db.select({
    id: inventoryIssues.id,
    issueNumber: inventoryIssues.issueNumber,
    storeId: inventoryIssues.storeId,
    storeName: inventoryStores.name,
    issueToRole: inventoryIssues.issueToRole,
    studentId: inventoryIssues.studentId,
    studentName: user.name,
    issueToName: inventoryIssues.issueToName,
    issueDate: inventoryIssues.issueDate,
    dueDate: inventoryIssues.dueDate,
    returnDate: inventoryIssues.returnDate,
    status: inventoryIssues.status,
    recordedById: inventoryIssues.recordedById,
    createdAt: inventoryIssues.createdAt,
    updatedAt: inventoryIssues.updatedAt,
  })
    .from(inventoryIssues)
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventoryIssues.storeId))
    .leftJoin(user, eq(user.id, inventoryIssues.studentId))
    .where(and(eq(inventoryIssues.id, id), eq(inventoryIssues.tenantId, tenantId)))
    .limit(1);
  if (!row) return null;

  const lines = await db.select({
    id: inventoryIssueLines.id,
    productId: inventoryIssueLines.productId,
    productName: inventoryProducts.name,
    productCode: inventoryProducts.code,
    qty: inventoryIssueLines.qty,
  })
    .from(inventoryIssueLines)
    .innerJoin(inventoryProducts, eq(inventoryProducts.id, inventoryIssueLines.productId))
    .where(and(eq(inventoryIssueLines.issueId, id), eq(inventoryIssueLines.tenantId, tenantId)));

  return { ...row, isOverdue: isOverdue(row), lines };
}

// ---------------------------------------------------------------------------
// Create (stock-out on issue)
// ---------------------------------------------------------------------------

export async function createIssue(context: RequestContext, tenantId: string, input: IssueInput) {
  if (input.issueToRole === 'student' && !input.studentId) {
    throw new ApiError(422, 'INVALID_REF', 'Un prêt étudiant doit préciser l\'étudiant.');
  }
  if (input.issueToRole !== 'student' && !input.issueToName?.trim()) {
    throw new ApiError(422, 'INVALID_REF', 'Un prêt comptoir doit préciser le bénéficiaire.');
  }

  if (input.idempotencyKey) {
    const existing = await db.select({ id: inventoryIssues.id }).from(inventoryIssues)
      .where(and(eq(inventoryIssues.tenantId, tenantId), eq(inventoryIssues.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existing[0]) return getIssue(tenantId, existing[0].id);
  }

  if (input.issueToRole === 'student') {
    const [stu] = await db.select({ id: user.id }).from(user)
      .where(and(eq(user.id, input.studentId!), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!stu) throw new ApiError(422, 'INVALID_REF', 'L\'étudiant indiqué est introuvable dans cet établissement.');
  }

  const [store] = await db.select({ id: inventoryStores.id }).from(inventoryStores)
    .where(and(eq(inventoryStores.id, input.storeId), eq(inventoryStores.tenantId, tenantId)))
    .limit(1);
  if (!store) throw new ApiError(422, 'INVALID_REF', 'Le magasin indiqué est introuvable dans cet établissement.');

  const products = await verifyProducts(tenantId, input.lines.map((l) => l.productId));
  for (const l of input.lines) {
    if (!products.has(l.productId)) {
      throw new ApiError(422, 'INVALID_REF', 'Un produit du prêt est introuvable dans cet établissement.');
    }
  }

  let issueId = '';
  try {
    await db.transaction(async (tx) => {
      const issueNumber = await reserveInventoryNumber(tx, tenantId, 'ISS');
      const [issue] = await tx.insert(inventoryIssues).values({
        tenantId,
        issueNumber,
        storeId: input.storeId,
        issueToRole: input.issueToRole,
        studentId: input.issueToRole === 'student' ? input.studentId : null,
        issueToName: input.issueToRole === 'student' ? null : input.issueToName?.trim() ?? null,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        status: 'issued',
        recordedById: context.userId,
        idempotencyKey: input.idempotencyKey ?? null,
      }).returning();
      if (!issue) throw new ApiError(500, 'INSERT_FAILED', 'Échec de l\'enregistrement du prêt.');
      issueId = issue.id;

      const movements = input.lines.map((l, i) => ({
        storeId: input.storeId,
        productId: l.productId,
        movementType: 'issue' as const,
        qtyMilli: -qtyToMilli(l.qty),
        refType: 'issue' as const,
        refId: issue.id,
        idempotencyKey: `issue:${issue.id}:${input.storeId}:${l.productId}:${i}`,
        reason: `Prêt N° ${issueNumber}`,
      }));

      await postStockMovements(tx, { tenantId, actorId: context.userId, movements });

      await tx.insert(inventoryIssueLines).values(
        input.lines.map((l) => ({
          tenantId,
          issueId: issue.id,
          productId: l.productId,
          qty: l.qty,
        })),
      );
    });
  } catch (err) {
    if (isIdempotencyViolation(err) && input.idempotencyKey) {
      const existing = await db.select({ id: inventoryIssues.id }).from(inventoryIssues)
        .where(and(eq(inventoryIssues.tenantId, tenantId), eq(inventoryIssues.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (existing[0]) return getIssue(tenantId, existing[0].id);
    }
    throw err;
  }

  recordAudit(context, 'create', 'inventory_issue', issueId, { issueToRole: input.issueToRole });
  return getIssue(tenantId, issueId);
}

// ---------------------------------------------------------------------------
// Return / damage / loss (idempotent state guard)
// ---------------------------------------------------------------------------

export async function returnIssue(
  context: RequestContext,
  tenantId: string,
  id: string,
  disposition: 'returned' | 'damaged' | 'lost',
  reason?: string | null,
) {
  const existing = await getIssue(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Prêt introuvable dans cet établissement.');
  if (existing.status !== 'issued') return existing;

  await db.transaction(async (tx) => {
    const [doc] = await tx.select({ id: inventoryIssues.id, status: inventoryIssues.status })
      .from(inventoryIssues)
      .where(and(eq(inventoryIssues.id, id), eq(inventoryIssues.tenantId, tenantId)))
      .for('update')
      .limit(1);
    if (!doc || doc.status !== 'issued') return;

    if (disposition === 'returned') {
      const lines = await tx.select({
        productId: inventoryIssueLines.productId,
        qty: inventoryIssueLines.qty,
      })
        .from(inventoryIssueLines)
        .where(and(eq(inventoryIssueLines.issueId, id), eq(inventoryIssueLines.tenantId, tenantId)));

      const movements = lines.map((l, i) => ({
        storeId: existing.storeId,
        productId: l.productId,
        movementType: 'issue_return' as const,
        qtyMilli: qtyToMilli(l.qty),
        refType: 'issue' as const,
        refId: id,
        idempotencyKey: `issue_return:${id}:${existing.storeId}:${l.productId}:${i}`,
        reason: reason?.trim() ? `Retour ${existing.issueNumber} — ${reason.trim()}` : `Retour ${existing.issueNumber}`,
      }));

      await postStockMovements(tx, { tenantId, actorId: context.userId, movements });
    }

    await tx.update(inventoryIssues)
      .set({
        status: disposition,
        returnDate: new Date().toISOString().slice(0, 10),
        updatedAt: sql`now()`,
      })
      .where(and(eq(inventoryIssues.id, id), eq(inventoryIssues.tenantId, tenantId)))
      .execute();
  });

  recordAudit(context, 'update', 'inventory_issue', id, { action: 'return', disposition, reason: reason ?? undefined });
  return getIssue(tenantId, id);
}
