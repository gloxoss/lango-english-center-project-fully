import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { hasCapability, PERMISSIONS, type PermissionKey } from '@/libs/api/permissions';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const allKeys = Object.keys(PERMISSIONS) as PermissionKey[];
    const results = await Promise.all(
      allKeys.map(async key => [key, await hasCapability(ctx.userId, ctx.tenantId ?? '', ctx.role, key)] as const),
    );
    const permissions = results.filter(([, granted]) => granted).map(([key]) => key);

    return NextResponse.json({ success: true, data: { role: ctx.role, permissions } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
