import type { NextRequest } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { accountingReconciliationMatches, bankReconciliations, journalEntryLines } from '@/models/Schema';

const schema = z.object({ lineIds: z.array(z.string().uuid()).min(1).max(500) }).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.reconcile');
    const [{ id }, body] = await Promise.all([params, parseJson(req, schema)]);
    const uniqueLineIds = [...new Set(body.lineIds)];

    await db.transaction(async (tx) => {
      const [reconciliation] = await tx.select().from(bankReconciliations).where(and(
        eq(bankReconciliations.tenantId, tenantId), eq(bankReconciliations.id, id),
      )).for('update');
      if (!reconciliation) throw new ApiError(404, 'RECONCILIATION_NOT_FOUND', 'Rapprochement bancaire introuvable.');
      if (reconciliation.status === 'completed') throw new ApiError(409, 'RECONCILIATION_CLOSED', 'Ce rapprochement est déjà clôturé.');

      const lines = await tx.select().from(journalEntryLines).where(and(
        eq(journalEntryLines.tenantId, tenantId), inArray(journalEntryLines.id, uniqueLineIds),
      ));
      if (lines.length !== uniqueLineIds.length) throw new ApiError(404, 'JOURNAL_LINE_NOT_FOUND', 'Certaines lignes sont introuvables.');

      const existing = await tx.select({
        journalLineId: accountingReconciliationMatches.journalLineId,
        reconciliationId: accountingReconciliationMatches.reconciliationId,
      }).from(accountingReconciliationMatches).where(and(
        eq(accountingReconciliationMatches.tenantId, tenantId),
        inArray(accountingReconciliationMatches.journalLineId, uniqueLineIds),
      ));
      if (existing.some(match => match.reconciliationId !== id)) {
        throw new ApiError(409, 'LINE_ALREADY_RECONCILED', 'Une ou plusieurs lignes sont déjà rapprochées ailleurs.');
      }
      const alreadyMatched = new Set(existing.map(match => match.journalLineId));
      const newLines = lines.filter(line => !alreadyMatched.has(line.id));
      if (newLines.length) {
        await tx.insert(accountingReconciliationMatches).values(newLines.map(line => ({
          tenantId,
          reconciliationId: id,
          journalLineId: line.id,
          matchedAmount: centsToMoney(moneyToCents(line.debitAmount) - moneyToCents(line.creditAmount)),
          matchedById: ctx.userId,
        })));
      }

      const [total] = await tx.select({
        amount: sql<string>`coalesce(sum(${accountingReconciliationMatches.matchedAmount}),0)::text`,
      }).from(accountingReconciliationMatches).where(and(
        eq(accountingReconciliationMatches.tenantId, tenantId), eq(accountingReconciliationMatches.reconciliationId, id),
      ));
      await tx.update(bankReconciliations).set({ reconciledBalance: total?.amount ?? '0.00' }).where(and(
        eq(bankReconciliations.tenantId, tenantId), eq(bankReconciliations.id, id),
      ));
    });

    return NextResponse.json({ success: true, message: 'Lignes rapprochées sans modifier le journal immuable.' });
  } catch (error) { return apiErrorResponse(error); }
}
