import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const [tenant] = context.tenantId
      ? await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, context.tenantId)).limit(1)
      : [];

    return NextResponse.json({
      success: true,
      user: {
        id: context.userId,
        fullName: context.name,
        email: context.email,
        role: context.role,
        tenantId: context.tenantId,
      },
      schoolName: tenant?.name ?? null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
