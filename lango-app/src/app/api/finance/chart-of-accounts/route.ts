import { and, asc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { chartOfAccounts } from '@/models/Schema';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.read');

    const accounts = await db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.tenantId, ctx.tenantId!))
      .orderBy(asc(chartOfAccounts.code));

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.manage');

    const body = await req.json();
    const { code, name, accountType, parentAccountId } = body;

    if (!code || !name || !accountType) {
      throw new ApiError(400, 'BAD_REQUEST', 'Les champs code, name et accountType sont requis.');
    }

    const [account] = await db
      .insert(chartOfAccounts)
      .values({
        tenantId: ctx.tenantId!,
        code,
        name,
        accountType,
        parentAccountId: parentAccountId || null,
      })
      .returning();

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
