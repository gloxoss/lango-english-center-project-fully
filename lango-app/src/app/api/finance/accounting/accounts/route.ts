import type { NextRequest } from 'next/server';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { chartOfAccounts, journalEntryLines } from '@/models/Schema';

const createAccount = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parentAccountId: z.string().uuid().nullable().optional(),
}).strict();

const archiveAccount = z.object({
  id: z.string().uuid(),
  isActive: z.literal(false),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.read');
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 50) || 50));
    const search = url.searchParams.get('search')?.trim();
    const conditions = [eq(chartOfAccounts.tenantId, ctx.tenantId!)];
    if (search) conditions.push(or(ilike(chartOfAccounts.code, `%${search}%`), ilike(chartOfAccounts.name, `%${search}%`))!);
    const [rows, countRows] = await Promise.all([
      db.select().from(chartOfAccounts).where(and(...conditions)).orderBy(asc(chartOfAccounts.code)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)::int` }).from(chartOfAccounts).where(and(...conditions)),
    ]);
    return NextResponse.json({ success: true, data: rows, meta: { page, pageSize, total: countRows[0]?.count ?? 0 } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.manage');
    const body = await parseJson(req, createAccount);
    if (body.parentAccountId) {
      const parent = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and(
        eq(chartOfAccounts.tenantId, ctx.tenantId!),
        eq(chartOfAccounts.id, body.parentAccountId),
      )).limit(1);
      if (!parent.length) return NextResponse.json({ success: false, error: { code: 'PARENT_ACCOUNT_NOT_FOUND', message: 'Compte parent introuvable.' } }, { status: 422 });
    }
    const [account] = await db.insert(chartOfAccounts).values({ tenantId: ctx.tenantId!, ...body }).returning();
    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.manage');
    const body = await parseJson(req, archiveAccount);

    const [account] = await db.select({ id: chartOfAccounts.id, isActive: chartOfAccounts.isActive })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.tenantId, ctx.tenantId!), eq(chartOfAccounts.id, body.id)))
      .limit(1);
    if (!account) {
      return NextResponse.json({ success: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Compte introuvable.' } }, { status: 404 });
    }
    if (!account.isActive) return NextResponse.json({ success: true, data: account, meta: { idempotent: true } });

    const [[children], [balance]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(chartOfAccounts).where(and(
        eq(chartOfAccounts.tenantId, ctx.tenantId!),
        eq(chartOfAccounts.parentAccountId, body.id),
        eq(chartOfAccounts.isActive, true),
      )),
      db.select({ net: sql<string>`coalesce(sum(${journalEntryLines.debitAmount} - ${journalEntryLines.creditAmount}), 0)::numeric::text` })
        .from(journalEntryLines)
        .where(and(eq(journalEntryLines.tenantId, ctx.tenantId!), eq(journalEntryLines.accountId, body.id))),
    ]);
    if ((children?.count ?? 0) > 0) {
      return NextResponse.json({ success: false, error: { code: 'ACCOUNT_HAS_ACTIVE_CHILDREN', message: 'Archivez d’abord les sous-comptes actifs.' } }, { status: 409 });
    }
    if (Number(balance?.net ?? 0) !== 0) {
      return NextResponse.json({ success: false, error: { code: 'ACCOUNT_NON_ZERO_BALANCE', message: 'Un compte dont le solde n’est pas nul ne peut pas être archivé.' } }, { status: 409 });
    }

    const [archived] = await db.update(chartOfAccounts).set({ isActive: false, updatedAt: new Date().toISOString() }).where(and(
      eq(chartOfAccounts.tenantId, ctx.tenantId!),
      eq(chartOfAccounts.id, body.id),
      eq(chartOfAccounts.isActive, true),
    )).returning();
    return NextResponse.json({ success: true, data: archived ?? account });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
