import type { NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { cashierSessions, payments } from '@/models/Schema';

const openSessionSchema = z.object({
  startingFloat: z.number().min(0).default(0),
}).strict();

const closeSessionSchema = z.object({
  actualCash: z.number().min(0),
  notes: z.string().max(1000).optional(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant']);
    await requireCapability(ctx, 'finance.read');

    const tenantId = ctx.tenantId!;
    const userId = ctx.userId;

    const [activeSession] = await db
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.tenantId, tenantId),
          eq(cashierSessions.cashierId, userId),
          eq(cashierSessions.status, 'open'),
        ),
      )
      .limit(1);

    if (!activeSession) {
      return NextResponse.json({
        success: true,
        data: { activeSession: null, recentSessions: [] },
      });
    }

    const [cashSummary] = await db
      .select({
        totalCash: sql<number>`coalesce(sum(${payments.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.receivedById, userId),
          eq(payments.paymentMethod, 'cash'),
          sql`${payments.createdAt} >= ${activeSession.openedAt}`,
        ),
      );

    const totalCollected = Number(cashSummary?.totalCash ?? 0);
    const expectedCash = activeSession.startingFloat + totalCollected;

    const recentSessions = await db
      .select()
      .from(cashierSessions)
      .where(and(eq(cashierSessions.tenantId, tenantId), eq(cashierSessions.cashierId, userId)))
      .orderBy(desc(cashierSessions.openedAt))
      .limit(10);

    return NextResponse.json({
      success: true,
      data: {
        activeSession: {
          ...activeSession,
          totalCollected,
          expectedCash,
        },
        recentSessions,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant']);
    await requireCapability(ctx, 'finance.manage');

    const tenantId = ctx.tenantId!;
    const userId = ctx.userId;
    const body = await parseJson(req, openSessionSchema);

    const [existing] = await db
      .select({ id: cashierSessions.id })
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.tenantId, tenantId),
          eq(cashierSessions.cashierId, userId),
          eq(cashierSessions.status, 'open'),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ApiError(409, 'SESSION_ALREADY_OPEN', 'Une session de caisse est déjà ouverte pour votre compte.');
    }

    const [newSession] = await db
      .insert(cashierSessions)
      .values({
        tenantId,
        cashierId: userId,
        startingFloat: body.startingFloat,
        expectedCash: body.startingFloat,
        totalCollected: 0,
        status: 'open',
      })
      .returning();

    return NextResponse.json({ success: true, data: newSession }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant']);
    await requireCapability(ctx, 'finance.manage');

    const tenantId = ctx.tenantId!;
    const userId = ctx.userId;
    const body = await parseJson(req, closeSessionSchema);

    const [activeSession] = await db
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.tenantId, tenantId),
          eq(cashierSessions.cashierId, userId),
          eq(cashierSessions.status, 'open'),
        ),
      )
      .limit(1);

    if (!activeSession) {
      throw new ApiError(404, 'NO_OPEN_SESSION', 'Aucune session de caisse ouverte à clôturer.');
    }

    const [cashSummary] = await db
      .select({
        totalCash: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.receivedById, userId),
          eq(payments.paymentMethod, 'cash'),
          sql`${payments.createdAt} >= ${activeSession.openedAt}`,
        ),
      );

    const totalCollected = Number(cashSummary?.totalCash ?? 0);
    const expectedCash = activeSession.startingFloat + totalCollected;

    const [closedSession] = await db
      .update(cashierSessions)
      .set({
        status: 'closed',
        closedAt: new Date().toISOString(),
        totalCollected,
        expectedCash,
        actualCash: body.actualCash,
        notes: body.notes || null,
      })
      .where(eq(cashierSessions.id, activeSession.id))
      .returning();

    return NextResponse.json({ success: true, data: closedSession });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
